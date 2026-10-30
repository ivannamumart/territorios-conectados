/* =========================================================================
   Territorios Conectados — Controlador del juego
   Une el mapa (Phaser), el servidor (Supabase), la barra de recursos y los
   paneles de cada lugar.
   ========================================================================= */
(function () {
  'use strict';

  const M = window.MundoDatos;
  const J = {
    estado: null,
    grupos: [],
    gruposPorId: new Map(),
    gruposPorIsla: new Map(),
    parametros: {},
    miembros: new Map(),
    mundo: null,
    phaser: null,
    escenaActiva: null,
    escenaId: 'mundo',
    posicionActual: null,
    llegadaMundo: null,
    distancia: 0,
    recibido: 0,
    offset: 0,
    ultimoLatido: 0,
    ultimoAvisoId: 0,
    dejar: [],
    relojes: [],
    pidiendoEstado: 0
  };

  // ------------------------------------------------------------------ datos
  async function cargarGrupos() {
    const filas = await Servidor.leer('grupos', 'id, nombre, emoji, territorio, isla, oportunidades, completo_en, creado_en');
    J.grupos = filas;
    J.gruposPorId = new Map(filas.map(g => [g.id, g]));
    J.gruposPorIsla = new Map(filas.filter(g => g.isla != null).map(g => [g.isla, g]));
  }

  async function cargarTerritorios() {
    const filas = await Servidor.leer('territorios', 'id, parametros');
    filas.forEach(t => { J.parametros[t.id] = t.parametros; });
  }

  async function cargarMiembros() {
    const filas = await Servidor.leer('jugadores',
      'id, nombre, avatar, estado, energia, bolsa, huecos_ok, creado_en',
      ['grupo_id', J.estado.grupo.id]);
    J.miembros = new Map(filas.map(f => [f.id, f]));
    HUD.actualizarAlertas();
  }

  function construirMundo() {
    const islas = J.grupos.map(g => g.isla).filter(i => i != null);
    J.mundo = M.construir(islas);
  }

  // ------------------------------------------------------------------ estado
  function aplicar(e) {
    if (!e || !e.jugador) return;
    const antes = J.estado && J.estado.jugador ? J.estado.jugador.estado : null;
    const territorioAntes = J.estado && J.estado.grupo ? J.estado.grupo.territorio : null;
    J.estado = { jugador: e.jugador, grupo: Object.assign({}, J.estado ? J.estado.grupo : {}, e.grupo), reloj: e.reloj, config: e.config };
    J.recibido = Date.now();
    J.offset = Date.parse(e.reloj.ahora) - J.recibido;
    const g = J.gruposPorId.get(e.grupo.id);
    if (g) Object.assign(g, { territorio: e.grupo.territorio, oportunidades: e.grupo.oportunidades });
    if (antes && antes !== e.jugador.estado) {
      const esc = J.escenaActiva;
      if (esc && esc.yo) esc.yo.setEstado(e.jugador.estado);
      Red.actualizarYo({ estado: e.jugador.estado });
    }
    if (territorioAntes && territorioAntes !== e.grupo.territorio && J.escenaActiva && J.escenaActiva.scene.key === 'Mundo') {
      J.escenaActiva.scene.restart({ llegada: J.posicionActual });
    }
    Red.fijarModo(J.escenaId === 'mundo' || J.escenaId === 'salon' ? e.config.mov_mapa : 'normal');
    HUD.actualizar();
  }

  /** Segundos de juego según el servidor (avanzan solo si el juego corre). */
  function segJuego() {
    if (!J.estado) return 0;
    const r = J.estado.reloj;
    if (r.estado !== 'corriendo') return Number(r.seg);
    return Number(r.seg) + (Date.now() + J.offset - Date.parse(r.ahora)) / 1000;
  }

  /** Recursos que se ven ahora (el servidor guarda; aquí se anima el desgaste). */
  function recursos() {
    const j = J.estado.jugador, r = J.estado.reloj;
    let e = Number(j.energia);
    if (r.estado === 'corriendo') {
      const dt = Math.max(0, segJuego() - Number(j.ref_seg));
      e = Math.min(100, e + Number(r.recarga_por_min || 0) / 60 * dt);
    }
    return { energia: e, bolsa: j.bolsa || {} };
  }

  async function pedirEstado() {
    try { aplicar(await Servidor.accion('mi_estado')); } catch (e) { /* lo intentamos luego */ }
  }

  async function latido(forzar) {
    const ahora = Date.now();
    const moviste = J.distancia > 30;
    if (!forzar && !(moviste && ahora - J.ultimoLatido > 30000) && ahora - J.ultimoLatido < 75000) return;
    J.ultimoLatido = ahora;
    const enviada = J.distancia;
    const p = J.posicionActual || {};
    try {
      const e = await Servidor.accion('latido', {
        p_escena: J.escenaId, p_x: p.x != null ? Math.round(p.x) : null, p_y: p.y != null ? Math.round(p.y) : null,
        p_distancia: Math.round(enviada)
      });
      J.distancia = Math.max(0, J.distancia - enviada);
      aplicar(e);
    } catch (e) { /* sin conexión: seguimos y lo intentamos luego */ }
  }

  function revisarCero() { /* ya no hay rescates */ }

  // ------------------------------------------------------------------ acciones
  async function accion(nombre, args, opciones) {
    const op = opciones || {};
    try {
      const r = await Servidor.accion(nombre, args);
      if (r && r.jugador) aplicar(r);
      if (r && r.mensaje && !op.silencioso) aviso(r.mensaje, 'ok');
      return r;
    } catch (e) {
      if (!op.silencioso) aviso(e.message, 'error');
      throw e;
    }
  }

  function aviso(texto, tipo) { HUD.aviso(texto, tipo); }

  // ------------------------------------------------------------------ escenas
  function posicionInicial() {
    const j = J.estado.jugador;
    if (j.escena === 'mundo' && j.x != null && j.y != null && J.mundo.caminable(j.x, j.y)) return { x: j.x, y: j.y };
    if (j.escena && j.escena !== 'mundo') {
      const [gid, lugar] = j.escena === 'salon' ? [null, 'salon'] : j.escena.split(':');
      const g = gid ? J.gruposPorId.get(gid) : null;
      const e = J.mundo.edificios.find(x => x.lugar === lugar && (lugar === 'salon' || (g && x.isla === g.isla)));
      if (e) return { x: e.puerta.x, y: e.puerta.y };
    }
    return J.mundo.puntoInicio(J.estado.grupo.isla);
  }

  function alEntrarEscena(escena, escenaId, pos) {
    J.escenaActiva = escena;
    J.escenaId = escenaId;
    J.posicionActual = pos;
    Paneles.cerrar();
    HUD.lugar(escenaId);
    Servidor.accion('cambiar_escena', { p_escena: escenaId, p_x: Math.round(pos.x), p_y: Math.round(pos.y) })
      .then(aplicar).catch(e => aviso(e.message, 'error'));
  }

  function unirseCanal(nombre, gente, pos) {
    const j = J.estado.jugador;
    Red.fijarModo(nombre.indexOf('mundo') === 0 || nombre === 'salon' ? J.estado.config.mov_mapa : 'normal');
    Red.unirse(nombre, { id: j.id, nombre: j.nombre, avatar: j.avatar, grupo: J.estado.grupo.emoji, estado: j.estado, x: pos.x, y: pos.y }, {
      alLlegar: p => gente.llegar(p),
      alSalir: id => gente.salir(id),
      alMover: p => gente.mover(p),
      alEmote: p => gente.emote(p)
    });
  }

  function entrarLugar(edificio) {
    if (!J.escenaActiva) return;
    J.llegadaMundo = { x: edificio.puerta.x, y: edificio.puerta.y };
    HUD.prompt(null);
    const esc = J.escenaActiva;
    esc.cameras.main.fadeOut(220, 207, 230, 255);
    esc.cameras.main.once('camerafadeoutcomplete', () => esc.scene.start('Interior', { edificio }));
  }

  function salirLugar() {
    if (!J.escenaActiva) return;
    HUD.prompt(null);
    const esc = J.escenaActiva;
    esc.cameras.main.fadeOut(220, 51, 64, 90);
    esc.cameras.main.once('camerafadeoutcomplete', () => esc.scene.start('Mundo', { llegada: J.llegadaMundo }));
  }

  function usarEstacion(id, grupoLugar, lugar) {
    Paneles.abrir(id, { grupoLugar, lugar });
  }

  // ------------------------------------------------------------------ tiempo real
  function escuchar() {
    const s = J.estado;
    // Mi grupo
    J.dejar.push(Servidor.escuchar({
      tabla: 'jugadores', filtro: 'grupo_id=eq.' + s.grupo.id, cadaSegundos: 30,
      alCambiar: cambio => {
        if (!cambio) return cargarMiembros().catch(() => {});
        if (cambio.tipo === 'DELETE') J.miembros.delete(cambio.viejo.id);
        else J.miembros.set(cambio.nuevo.id, cambio.nuevo);
        // Mi propia fila: se copian los datos sin volver a preguntar al servidor
        if (cambio.nuevo && cambio.nuevo.id === s.jugador.id && J.estado) {
          const n = cambio.nuevo, j = J.estado.jugador, antes = j.estado;
          ['energia', 'bolsa', 'ref_seg', 'ultimo_recolecto_seg', 'huecos_ok', 'fallos',
           'megas_gastados', 'consultas'].forEach(k => { if (k in n) j[k] = n[k]; });
          if (antes !== j.estado) {
            if (J.escenaActiva && J.escenaActiva.yo) J.escenaActiva.yo.setEstado(j.estado);
            Red.actualizarYo({ estado: j.estado });
          }
          HUD.actualizar();
        }
        if (cambio.nuevo && J.escenaActiva && J.escenaActiva.gente) J.escenaActiva.gente.estado(cambio.nuevo.id, cambio.nuevo.estado);
        HUD.actualizarAlertas();
        Paneles.refrescar('grupo');
      }
    }));
    // Grupos del mundo (cambian poco)
    J.dejar.push(Servidor.escuchar({
      tabla: 'grupos', cadaSegundos: 45,
      alCambiar: async () => {
        const islasAntes = J.grupos.map(g => g.isla + ':' + g.territorio).sort().join();
        try { await cargarGrupos(); } catch (e) { return; }
        const mio = J.gruposPorId.get(J.estado.grupo.id);
        if (mio && mio.oportunidades !== J.estado.grupo.oportunidades) {
          J.estado.grupo.oportunidades = mio.oportunidades;
          Paneles.refrescar('texto');
        }
        const islasAhora = J.grupos.map(g => g.isla + ':' + g.territorio).sort().join();
        if (islasAntes !== islasAhora) {
          construirMundo();
          if (J.escenaActiva && J.escenaActiva.scene.key === 'Mundo') J.escenaActiva.scene.restart({ llegada: J.posicionActual });
        }
        HUD.actualizar();
      }
    }));
    // Configuración y reloj (pausas, anuncios)
    J.dejar.push(Servidor.escuchar({ tabla: 'config', cadaSegundos: 40, alCambiar: () => pedirEstado() }));
    // Mis avisos
    J.dejar.push(Servidor.escuchar({
      tabla: 'avisos', filtro: 'jugador_id=eq.' + s.jugador.id, cadaSegundos: 30,
      alCambiar: async cambio => {
        if (cambio && cambio.tipo === 'INSERT') { recibirAviso(cambio.nuevo); return; }
        try {
          const filas = await Servidor.leer('avisos', 'id, texto, tipo, creado_en', ['jugador_id', s.jugador.id],
            q => q.gt('id', J.ultimoAvisoId).order('id', { ascending: true }).limit(20));
          filas.forEach(recibirAviso);
        } catch (e) { /* luego */ }
      }
    }));
  }

  function recibirAviso(a) {
    if (!a || a.id <= J.ultimoAvisoId) return;
    J.ultimoAvisoId = a.id;
    if (Date.now() - Date.parse(a.creado_en) > 10 * 60 * 1000) return; // viejos: no los mostramos
    aviso(a.texto, 'ok');
    HUD.registrar(a.texto);
    pedirEstado().then(() => { Paneles.refrescar('texto'); Paneles.refrescar('pistas'); });
  }

  // ------------------------------------------------------------------ arranque
  async function iniciar(sesion) {
    J.estado = { jugador: sesion.jugador, grupo: sesion.grupo, reloj: sesion.reloj, config: sesion.config };
    aplicarSinHud(sesion);
    await Promise.all([cargarGrupos(), cargarTerritorios()]);
    construirMundo();
    // El último aviso ya visto: no repetimos los antiguos
    try {
      const ult = await Servidor.leer('avisos', 'id', ['jugador_id', sesion.jugador.id], q => q.order('id', { ascending: false }).limit(1));
      J.ultimoAvisoId = ult[0] ? ult[0].id : 0;
    } catch (e) { /* nada */ }

    document.getElementById('ui').hidden = true;
    document.getElementById('juego').hidden = false;
    HUD.iniciar();
    Paneles.iniciar();
    await cargarMiembros().catch(() => {});

    // Esperar las letras del juego (máximo 2,5 s) para que el mapa no salga con otra fuente
    try {
      await Promise.race([
        Promise.all(['800 20px "Baloo 2"', '800 16px Nunito', '700 16px Nunito'].map(f => document.fonts.load(f))),
        new Promise(r => setTimeout(r, 2500))
      ]);
    } catch (e) { /* seguimos con la fuente del sistema */ }

    J.phaser = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'juego',
      backgroundColor: '#bfe4f6',
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      scene: [window.EscenaMundo, window.EscenaInterior],
      banner: false,
      input: { keyboard: { capture: [] } },
      render: { antialias: true, roundPixels: false }
    });

    escuchar();
    J.relojes.push(setInterval(() => { HUD.actualizar(); revisarCero(); }, 250));
    J.relojes.push(setInterval(() => latido(false), 10000));
    J.relojes.push(setInterval(() => Servidor.rpc('tic_mundo').catch(() => {}), 60000));
    Servidor.rpc('tic_mundo').catch(() => {});
    latido(true);

    window.addEventListener('keydown', teclaGlobal);
    window.addEventListener('beforeunload', () => { if (J.distancia > 30) latido(true); });
  }

  function aplicarSinHud(e) {
    J.recibido = Date.now();
    J.offset = Date.parse(e.reloj.ahora) - J.recibido;
  }

  const EMOTES = { '1': '👋', '2': '😀', '3': '❤️', '4': '🆘', '5': '👍', '6': '🤝' };
  function teclaGlobal(e) {
    if (Paneles.abierto()) {
      if (e.key === 'Escape') Paneles.cerrar();
      return;
    }
    const enCampo = /INPUT|TEXTAREA|SELECT|BUTTON/.test((document.activeElement || {}).tagName || '');
    if (enCampo && document.activeElement.tagName !== 'BUTTON') return;
    const enBoton = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if ((e.key === 'e' || e.key === 'E' || ((e.key === 'Enter' || e.key === ' ') && !enBoton)) && !e.repeat) {
      if (enBoton) document.activeElement.blur();
      J.pedidoUsar = Date.now();
      if (e.key === ' ') e.preventDefault();
      return;
    }
    if (enCampo) return;
    if (EMOTES[e.key] && J.escenaActiva && J.escenaActiva.yo) {
      J.escenaActiva.yo.mostrarEmote(EMOTES[e.key]);
      Red.emote(EMOTES[e.key]);
    } else if (e.key === 'm' || e.key === 'M') Paneles.abrir('texto', {});
    else if (e.key === 'g' || e.key === 'G') Paneles.abrir('grupo', {});
    else if (e.key === 'h' || e.key === 'H' || e.key === '?') Paneles.abrir('ayuda', {});
  }

  function salir() {
    latido(true);
    J.dejar.forEach(f => { try { f(); } catch (e) { /* nada */ } });
    J.relojes.forEach(clearInterval);
    Red.salir();
    Servidor.salir();
    location.reload();
  }

  window.Juego = {
    get estado() { return J.estado; },
    get mundo() { return J.mundo; },
    get grupos() { return J.grupos; },
    get miembros() { return J.miembros; },
    get escenaId() { return J.escenaId; },
    get posicionActual() { return J.posicionActual; },
    set posicionActual(p) { J.posicionActual = p; },
    iniciar, salir, aplicar, accion, aviso, recursos, segJuego, pedirEstado, cargarMiembros,
    ahoraServidor: () => Date.now() + J.offset,
    escenaActivaMundo: () => (J.escenaActiva && J.escenaActiva.scene.key === 'Mundo' ? J.escenaActiva : null),
    escenaActiva: () => J.escenaActiva,
    grupoPorIsla: i => J.gruposPorIsla.get(i),
    grupoPorId: id => J.gruposPorId.get(id),
    parametrosTerritorio: t => J.parametros[t] || {},
    esDeMiGrupo: id => J.miembros.has(id),
    yoId: () => J.estado && J.estado.jugador.id,
    puedeMoverse: () => !!J.estado,
    movimientoMapa: () => (J.estado && J.estado.config.mov_mapa) || 'normal',
    panelAbierto: () => Paneles.abierto(),
    prompt: t => HUD.prompt(t),
    sumarDistancia: d => { J.distancia += d; },
    /** ¿Se presionó E/Enter/Espacio hace poco? (se consume una sola vez) */
    tocarUsar: () => { if (!Paneles.abierto()) J.pedidoUsar = Date.now(); },
    gesto: em => { if (J.escenaActiva && J.escenaActiva.yo) { J.escenaActiva.yo.mostrarEmote(em); Red.emote(em); } },
    consumirUsar: () => { const ok = J.pedidoUsar && Date.now() - J.pedidoUsar < 600; J.pedidoUsar = 0; return !!ok; },
    posicionInicial, alEntrarEscena, unirseCanal, entrarLugar, salirLugar, usarEstacion
  };
})();
