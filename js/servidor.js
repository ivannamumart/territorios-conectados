/* =========================================================================
   Territorios Conectados — Conexión con el servidor (Supabase)
   -------------------------------------------------------------------------
   Todo lo que el juego guarda o lee del mundo compartido pasa por aquí.
   - Las acciones llaman funciones seguras de la base de datos, que revisan
     las reglas del juego.
   - Los cambios llegan en tiempo real. Si el tiempo real falla (por ejemplo
     en una red que lo bloquea), el juego vuelve a preguntar cada pocos
     segundos, así que nada se queda congelado.
   ========================================================================= */
(function () {
  'use strict';

  const CLAVE_TOKEN = 'tc_token';
  let cliente = null;

  function configurado() {
    const c = window.CONFIG || {};
    return /^https?:\/\/.+/.test(c.SUPABASE_URL || '') && String(c.SUPABASE_KEY || '').length > 20;
  }

  function iniciar() {
    if (cliente) return true;
    if (!configurado() || !window.supabase) return false;
    cliente = window.supabase.createClient(window.CONFIG.SUPABASE_URL.trim().replace(/\/+$/, ''), window.CONFIG.SUPABASE_KEY.trim(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } }
    });
    return true;
  }

  // ---------------- token guardado en este navegador ----------------
  function leerToken() {
    try { return localStorage.getItem(CLAVE_TOKEN); } catch (e) { return null; }
  }
  function guardarToken(t) {
    try { if (t) localStorage.setItem(CLAVE_TOKEN, t); else localStorage.removeItem(CLAVE_TOKEN); } catch (e) { /* sin almacenamiento */ }
  }

  // ---------------- errores en lenguaje simple ----------------
  function mensajeAmable(error) {
    const m = String((error && (error.message || error.details)) || error || '');
    if (/Failed to fetch|NetworkError|Load failed|fetch failed|network/i.test(m)) return 'No hay conexión con el servidor. Revisa el internet e intenta otra vez.';
    if (/JWT|apikey|Invalid API key|No API key/i.test(m)) return 'La llave de Supabase no es válida. Revisa el archivo js/config.js.';
    if (/Could not find the function|schema cache/i.test(m)) return 'Falta preparar la base de datos. Ejecuta el archivo supabase/base-de-datos.sql en Supabase.';
    if (/invalid input syntax for type uuid/i.test(m)) return 'Tu sesión guardada no es válida. Vuelve a entrar con tu nombre y código.';
    if (/too many|rate limit/i.test(m)) return 'El servidor está muy ocupado. Espera unos segundos e intenta otra vez.';
    return m || 'Algo salió mal. Intenta otra vez.';
  }

  async function rpc(nombre, args) {
    if (!iniciar()) throw new Error('El juego aún no está conectado a Supabase.');
    let resp;
    try { resp = await cliente.rpc(nombre, args || {}); }
    catch (e) { throw new Error(mensajeAmable(e)); }
    if (resp.error) throw new Error(mensajeAmable(resp.error));
    return resp.data;
  }

  /** Igual que rpc, pero agrega el token del jugador. */
  function accion(nombre, args) {
    return rpc(nombre, Object.assign({ p_token: leerToken() }, args || {}));
  }

  async function leer(tabla, columnas, filtro, extra) {
    if (!iniciar()) throw new Error('El juego aún no está conectado a Supabase.');
    let q = cliente.from(tabla).select(columnas || '*');
    if (filtro) q = q.eq(filtro[0], filtro[1]);
    if (extra) q = extra(q);
    let resp;
    try { resp = await q; } catch (e) { throw new Error(mensajeAmable(e)); }
    if (resp.error) throw new Error(mensajeAmable(resp.error));
    return resp.data || [];
  }

  // ---------------- registro y sesión ----------------
  async function crearGrupo(nombre, avatar, grupo, emojiGrupo) {
    const s = await rpc('crear_grupo', { p_nombre: nombre, p_avatar: avatar, p_grupo: grupo, p_emoji_grupo: emojiGrupo });
    guardarToken(s.token);
    return s;
  }

  async function entrar(nombre, codigo, avatar) {
    const s = await rpc('entrar', { p_nombre: nombre, p_codigo: codigo, p_avatar: avatar || null });
    if (s && s.token) guardarToken(s.token);
    return s;
  }

  async function miSesion() {
    const t = leerToken();
    if (!t) return null;
    try {
      const s = await rpc('mi_sesion', { p_token: t });
      if (!s) guardarToken(null);
      return s;
    } catch (e) {
      if (/sesión guardada no es válida|ya no es válida/.test(e.message)) { guardarToken(null); return null; }
      throw e;
    }
  }

  function salir() { guardarToken(null); detenerTodo(); }

  // ---------------- tiempo real con respaldo ----------------
  const escuchas = [];

  /**
   * escuchar({ tabla, filtro: 'grupo_id=eq.xxx', cadaSegundos, alCambiar })
   * - Cambio en tiempo real: alCambiar({ tipo, nuevo, viejo }).
   * - Toca recargar todo (al conectar o como respaldo): alCambiar(null).
   * Devuelve una función para dejar de escuchar.
   */
  function escuchar(op) {
    iniciar();
    const registro = { canal: null, reloj: null, tiempoRealOk: false };
    let espera = null;
    const recargar = () => { clearTimeout(espera); espera = setTimeout(() => op.alCambiar(null), 200); };

    try {
      const nombreCanal = 'tc-' + op.tabla + '-' + Math.random().toString(36).slice(2, 8);
      const cfg = { event: '*', schema: 'public', table: op.tabla };
      if (op.filtro) cfg.filter = op.filtro;
      registro.canal = cliente.channel(nombreCanal)
        .on('postgres_changes', cfg, p => op.alCambiar({ tipo: p.eventType, nuevo: p.new, viejo: p.old }))
        .subscribe(estado => {
          const antes = registro.tiempoRealOk;
          registro.tiempoRealOk = estado === 'SUBSCRIBED';
          if (registro.tiempoRealOk && !antes) recargar();
        });
    } catch (e) { registro.canal = null; }

    const base = (op.cadaSegundos || 20) * 1000;
    const ciclo = () => {
      registro.reloj = setTimeout(() => { op.alCambiar(null); ciclo(); }, registro.tiempoRealOk ? base * 4 : base);
    };
    if (op.cadaSegundos !== 0) ciclo();

    escuchas.push(registro);
    return function dejar() {
      clearTimeout(registro.reloj);
      clearTimeout(espera);
      if (registro.canal) { try { cliente.removeChannel(registro.canal); } catch (e) { /* nada */ } }
      const i = escuchas.indexOf(registro);
      if (i >= 0) escuchas.splice(i, 1);
    };
  }

  function detenerTodo() {
    escuchas.slice().forEach(r => {
      clearTimeout(r.reloj);
      if (r.canal) { try { cliente.removeChannel(r.canal); } catch (e) { /* nada */ } }
    });
    escuchas.length = 0;
  }

  window.Servidor = {
    configurado, iniciar, rpc, accion, leer, leerToken,
    crearGrupo, entrar, miSesion, salir,
    escuchar, detenerTodo,
    cliente: () => (iniciar() ? cliente : null)
  };
})();
