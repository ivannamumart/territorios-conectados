/* =========================================================================
   Territorios Conectados — Panel docente
   Roles: profesora (todo), monitor (ver, regalar, revivir, revisar
   consultas) y observadora (solo ver).
   ========================================================================= */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const CLAVE = 'tc_equipo';
  const M = window.MundoDatos;
  const RECURSOS = { energia: '⚡', flores: '🌸', sal: '🧂', maiz: '🌽', cafe: '☕', cocos: '🥥', pescado: '🐟' };
  const NOMBRES_REC = { energia: 'Energía', flores: 'Flores', sal: 'Sal', maiz: 'Maíz', cafe: 'Café', cocos: 'Cocos', pescado: 'Pescado', oportunidades: 'Oportunidades (para el grupo)' };
  const bolsaTexto = b => Object.keys(RECURSOS).filter(k => k !== 'energia' && Number((b || {})[k]) > 0).map(k => RECURSOS[k] + b[k]).join(' ') || '—';
  let sesion = null;       // { token, rol, nombre }
  let datos = null;        // último panel_estado
  let reloj = null;
  let pestana = 'vivo';
  let configCargada = false;

  // ------------------------------------------------------------------ utilidades
  function el(tag, props, ...hijos) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    hijos.flat().forEach(h => { if (h == null || h === false) return; e.appendChild(typeof h === 'string' || typeof h === 'number' ? document.createTextNode(String(h)) : h); });
    return e;
  }
  let relojAviso = null;
  function aviso(texto, tipo) {
    const a = $('aviso');
    a.textContent = texto; a.className = tipo || ''; a.hidden = false;
    clearTimeout(relojAviso); relojAviso = setTimeout(() => { a.hidden = true; }, 4500);
  }
  const hora = t => t ? new Date(t).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  const fecha = t => t ? new Date(t).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  const puede = (...roles) => sesion && roles.indexOf(sesion.rol) >= 0;
  const fmt = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ' h ' : '') + m + ' min'; };

  async function rpc(nombre, args) {
    try { return await Servidor.rpc(nombre, Object.assign({ p_token: sesion.token }, args || {})); }
    catch (e) {
      if (/expiró/.test(e.message)) { salir(); }
      throw e;
    }
  }

  // ------------------------------------------------------------------ entrada
  async function entrar() {
    $('error-login').hidden = true;
    const b = $('entrar'); b.disabled = true;
    try {
      const s = await Servidor.rpc('equipo_entrar', { p_usuario: $('usuario').value, p_clave: $('clave').value });
      sesion = s;
      try { sessionStorage.setItem(CLAVE, JSON.stringify(s)); localStorage.setItem(CLAVE, JSON.stringify({ token: s.token })); } catch (e) { /* nada */ }
      abrirPanel();
    } catch (e) {
      $('error-login').textContent = e.message; $('error-login').hidden = false;
    } finally { b.disabled = false; }
  }

  function salir() {
    if (sesion) Servidor.rpc('equipo_salir', { p_token: sesion.token }).catch(() => {});
    try { sessionStorage.removeItem(CLAVE); localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
    location.reload();
  }

  function abrirPanel() {
    $('p-login').hidden = true;
    $('p-panel').hidden = false;
    const nombres = { admin: 'Profesora · control total', monitor: 'Monitor · puede ver respuestas y regalar', observador: 'Observadora · solo mira' };
    $('rol').textContent = (sesion.usuario || '') + ' · ' + nombres[sesion.rol];
    document.body.dataset.rol = sesion.rol;
    document.querySelectorAll('.solo-admin').forEach(b => { b.hidden = !puede('admin'); });
    document.querySelectorAll('.solo-admin-caja').forEach(b => { b.hidden = !puede('admin'); });
    document.querySelector('.solo-lectura').hidden = puede('admin');
    document.querySelectorAll('[data-seccion="controles"] input, [data-seccion="controles"] select').forEach(i => { i.disabled = !puede('admin'); });
    refrescar();
    reloj = setInterval(() => { if (!document.hidden) refrescar(); }, 5000);
  }

  // ------------------------------------------------------------------ datos
  async function refrescar() {
    try { datos = await rpc('panel_estado'); }
    catch (e) { aviso(e.message, 'error'); return; }
    pintarReloj();
    pintarResumen();
    if (pestana === 'vivo') { pintarMapa(); pintarRanking(); pintarListas(); }
    if (pestana === 'controles' && !configCargada) cargarConfig();
    if (pestana === 'grupos') pintarGrupos();
    if (pestana === 'consultas') pintarMarcadas();
    if (pestana === 'comercio') pintarOfertas();
    const n = datos.marcadas.length;
    $('n-marcadas').hidden = !n; $('n-marcadas').textContent = n;
  }

  function segJuego() {
    const c = datos.config;
    return Number(c.seg);
  }

  function pintarReloj() {
    const c = datos.config;
    const est = { espera: '⏳ Esperando inicio', corriendo: '▶ Corriendo', pausado: '⏸ En pausa', terminado: '🏁 Terminado' }[c.estado_juego];
    let txt = est;
    if (c.estado_juego === 'corriendo' && c.fin_clase) {
      const falta = (Date.parse(c.fin_clase) - Date.parse(datos.ahora)) / 1000;
      txt += falta > 0 ? ' · quedan ' + fmt(falta) + ' de clase' : (c.casa_hasta && c.fuera_de_clase === 'corre' ? ' · en casa hasta ' + fecha(c.casa_hasta) : '');
    }
    txt += ' · tiempo jugado: ' + fmt(segJuego());
    $('reloj-panel').textContent = txt;
    $('reloj-panel').className = 'reloj-panel ' + c.estado_juego;
    $('estado-reloj').textContent = txt + (c.fin_clase ? ' · la sesión termina a las ' + hora(c.fin_clase) : '');
  }

  function pintarResumen() {
    const js = datos.jugadores;
    const lim = Date.parse(datos.ahora) - 3 * 60 * 1000;
    const enLinea = js.filter(j => j.visto_en && Date.parse(j.visto_en) > lim).length;
    const caja = $('resumen'); caja.innerHTML = '';
    [['👥', datos.grupos.length, 'grupos'], ['🟢', enLinea, 'en línea'],
     ['📜', datos.grupos.reduce((a, g) => a + g.resueltos.length, 0), 'huecos llenos'], ['🏆', datos.grupos.filter(g => g.completo_en).length, 'textos completos'],
     ['❌', datos.grupos.reduce((a, g) => a + Number(g.fallos), 0), 'palabras falladas'],
     ['🔎', js.reduce((a, j) => a + j.consultas, 0), 'consultas'], ['🚩', datos.marcadas.length, 'marcadas'],
     ['🤝', datos.ofertas.filter(o => o.estado === 'aceptada').length, 'tratos'], ['🎟️', js.reduce((a, j) => a + (j.oport_armadas || 0), 0), 'armadas']].forEach(([i, n, t]) => {
      caja.appendChild(el('div', { class: 'dato' }, el('span', { class: 'ico', text: i }), el('b', { text: n }), el('span', { text: t })));
    });
  }

  // ------------------------------------------------------------------ mapa en vivo
  function pintarMapa() {
    const cv = $('mapa-vivo');
    const ancho = Math.min(cv.parentElement.clientWidth - 8, 1100);
    if (cv.width !== Math.round(ancho)) { cv.width = Math.round(ancho); cv.height = Math.round(ancho * M.ALTO / M.ANCHO); }
    const ctx = cv.getContext('2d');
    const k = cv.width / M.ANCHO;
    const X = x => x * k, Y = y => y * k;
    ctx.fillStyle = '#bfe4f6'; ctx.fillRect(0, 0, cv.width, cv.height);
    const islas = datos.grupos.map(g => g.isla).filter(i => i != null);
    const mundo = M.construir(islas);
    ctx.strokeStyle = '#e9c89d'; ctx.lineWidth = Math.max(3, M.PUENTE_MEDIO * 2 * k);
    mundo.puentes.forEach(p => { ctx.beginPath(); ctx.moveTo(X(p.x1), Y(p.y1)); ctx.lineTo(X(p.x2), Y(p.y2)); ctx.stroke(); });
    ctx.fillStyle = '#ffd1e2'; ctx.beginPath(); ctx.arc(X(M.CX), Y(M.CY), M.PLAZA_R * k, 0, 7); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    datos.grupos.forEach(g => {
      if (g.isla == null) return;
      const c = M.centroIsla(g.isla), t = window.TERRITORIOS[g.territorio];
      ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), M.ISLA_R * k, 0, 7); ctx.fill();
      ctx.fillStyle = '#33405a'; ctx.font = '800 ' + Math.max(11, 13 * k * 3) + 'px Nunito, sans-serif';
      ctx.fillText(g.emoji + ' ' + g.nombre, X(c.x), Y(c.y - M.ISLA_R - 40));
    });
    // Personas dentro de edificios
    const dentro = {};
    datos.jugadores.forEach(j => {
      if (!j.escena || j.escena === 'mundo') return;
      dentro[j.escena] = (dentro[j.escena] || 0) + 1;
    });
    mundo.edificios.forEach(e => {
      const g = e.isla != null ? datos.grupos.find(x => x.isla === e.isla) : null;
      const clave = e.lugar === 'salon' ? 'salon' : (g ? g.id + ':' + e.lugar : '');
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(X(e.rect.x1), Y(e.rect.y1), (e.rect.x2 - e.rect.x1) * k, (e.rect.y2 - e.rect.y1) * k);
      ctx.font = Math.max(10, 34 * k) + 'px sans-serif';
      ctx.fillText(M.nombreLugar(e.lugar, g && g.territorio, null).emoji, X(e.x), Y(e.y - 10));
      if (dentro[clave]) {
        ctx.fillStyle = '#5b78f0'; ctx.beginPath(); ctx.arc(X(e.x + 60), Y(e.y - 60), 11, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '800 12px Nunito, sans-serif'; ctx.fillText(dentro[clave], X(e.x + 60), Y(e.y - 60));
      }
    });
    // Personas en el mapa
    const lim = Date.parse(datos.ahora) - 3 * 60 * 1000;
    datos.jugadores.forEach(j => {
      if (j.escena !== 'mundo' || j.x == null) return;
      const viejo = !j.visto_en || Date.parse(j.visto_en) < lim;
      ctx.globalAlpha = viejo ? 0.35 : 1;
      ctx.font = '18px sans-serif';
      ctx.fillText(j.avatar, X(j.x), Y(j.y) - 6);
      ctx.globalAlpha = 1;
    });
  }

  function pintarRanking() {
    const caja = $('ranking-vivo'); caja.innerHTML = '';
    datos.ranking.forEach((g, i) => {
      const t = window.TERRITORIOS[g.territorio];
      caja.appendChild(el('div', { class: 'fila-ranking' },
        el('span', { class: 'pos', text: ['🥇', '🥈', '🥉'][i] || String(i + 1) }),
        el('span', { class: 'emoji', text: g.emoji }),
        el('span', { class: 'nom' }, el('b', { text: g.nombre }), el('small', { text: t.emoji + ' ' + t.nombre + ' · tema ' + g.tema + ' · 🎟️ ' + g.oportunidades + ' · ❌ ' + g.fallos + (g.completo_en ? ' · 🏆 completo ' + hora(g.completo_en) : '') })),
        el('span', { class: 'puntos-ranking', text: g.resueltos + '/18' })));
    });
    if (!datos.ranking.length) caja.appendChild(el('p', { class: 'subtitulo', text: 'Aún no hay grupos.' }));
  }

  function nombreGrupo(id) { const g = datos.grupos.find(x => x.id === id); return g ? g.emoji + ' ' + g.nombre : ''; }

  function pintarListas() {
    const av = $('lista-avance'); av.innerHTML = '';
    datos.grupos.forEach(g => {
      const hechos = new Set(g.resueltos);
      const cuadros = el('span', { class: 'cuadros-avance' }, ...Array.from({ length: 18 }, (_, k) => el('i', { class: hechos.has(k + 1) ? 'on' : '', title: 'Hueco ' + (k + 1) })));
      av.appendChild(el('div', { class: 'persona-fila' },
        el('span', { class: 'cara', text: g.emoji }),
        el('span', {}, el('b', { text: g.nombre + ' · ' + hechos.size + '/18' }), el('small', { text: 'Tema ' + g.tema + ': ' + (g.titulo || '') + ' · 🎟️ ' + g.oportunidades + ' · ❌ ' + g.fallos }), cuadros)));
    });
    if (!av.children.length) av.appendChild(el('p', { class: 'subtitulo', text: 'Aún no hay grupos.' }));
    const it = $('lista-intentos'); it.innerHTML = '';
    (datos.intentos || []).slice(0, 25).forEach(i => {
      it.appendChild(el('div', { class: 'persona-fila' },
        el('span', { class: 'cara', text: i.correcta ? '✅' : '❌' }),
        el('span', {}, el('b', { text: i.avatar + ' ' + i.nombre + ' · ' + i.emoji + ' ' + i.grupo }), el('small', { text: hora(i.momento) + ' · hueco ' + i.n + ': «' + (i.respuesta || '') + '»' }))));
    });
    if (!it.children.length) it.appendChild(el('p', { class: 'subtitulo', text: 'Nadie ha probado palabras todavía.' }));
    const bit = $('bitacora'); bit.innerHTML = '';
    const textos = {
      ingreso_nuevo: 'entró por primera vez', regreso: 'volvió a entrar', grupo_creado: 'Se creó un grupo', compra: 'compró en el mercado',
      venta: 'vendió en el mercado', compra_megas: 'recargó megas', trabajo: 'trabajó', ayuda: 'envió recursos', oferta: 'publicó una oferta',
      intercambio: 'hizo un intercambio', respuesta: 'respondió una misión', rescate_inicia: 'quedó en rescate', rescatado: 'fue rescatado',
      muerte: 'se convirtió en fantasma', reloj: 'Reloj', config: 'Ajustes cambiados', regalo_docente: 'Regalo del equipo docente',
      revivido: 'fue revivido', cambio_territorio: 'Cambio de territorio', reinicio: 'Mundo reiniciado', recolecta: 'recolectó', oportunidad: 'armó una oportunidad 🎟️',
      hueco: 'probó el hueco', texto_completo: '🏆 completó el texto del grupo'
    };
    datos.bitacora.forEach(b => {
      let t = (b.nombre ? b.avatar + ' ' + b.nombre + ' ' : '') + (textos[b.tipo] || b.tipo);
      if (b.tipo === 'respuesta') t += b.detalle.correcta ? ' ✅' : ' ❌';
      if (b.tipo === 'hueco') t += ' ' + b.detalle.n + (b.detalle.correcta ? ' ✅' : ' ❌');
      if (b.tipo === 'reloj') t += ': ' + b.detalle.accion;
      if (b.tipo === 'grupo_creado') t += ': ' + b.detalle.nombre;
      bit.appendChild(el('li', {}, el('small', { text: hora(b.momento) }), ' ', t));
    });
  }

  // ------------------------------------------------------------------ controles
  function cargarConfig() {
    const c = datos.config;
    const pon = (id, v) => { $(id).value = v; };
    pon('d-desgaste', c.mult_desgaste); pon('d-megas', c.mult_megas);
    pon('d-oport', c.oport_inicio); pon('d-grupos', c.max_grupos);
    pon('d-porgrupo', c.max_por_grupo); pon('d-mov', c.mov_mapa); pon('d-anuncio', c.anuncio || '');
    $('d-inscripcion').checked = !!c.inscripcion_abierta;
    if (c.casa_hasta) {
      const d = new Date(c.casa_hasta); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      $('casa-hasta').value = d.toISOString().slice(0, 16);
    }
    document.querySelectorAll('input[name="fuera"]').forEach(r => { r.checked = r.value === c.fuera_de_clase; });
    ['desgaste', 'megas'].forEach(n => { $('v-' + n).textContent = '×' + Number($('d-' + n).value).toFixed(1); });
    configCargada = true;
  }

  async function guardarConfig() {
    try {
      await rpc('panel_config', { p_cambios: {
        mult_desgaste: Number($('d-desgaste').value), mult_megas: Number($('d-megas').value),
        oport_inicio: parseInt($('d-oport').value, 10),
        max_grupos: parseInt($('d-grupos').value, 10), max_por_grupo: parseInt($('d-porgrupo').value, 10),
        inscripcion_abierta: $('d-inscripcion').checked, mov_mapa: $('d-mov').value, anuncio: $('d-anuncio').value
      } });
      aviso('Ajustes guardados. Los estudiantes los ven de inmediato.', 'ok');
      configCargada = false; refrescar();
    } catch (e) { aviso(e.message, 'error'); }
  }

  async function accionReloj(accion) {
    const args = { p_accion: accion };
    if (accion === 'iniciar' || accion === 'reanudar' || accion === 'sumar') args.p_minutos = parseInt($('min-clase').value, 10) || 0;
    if (accion === 'casa') {
      if (!$('casa-hasta').value) { aviso('Elige hasta qué fecha y hora.', 'error'); return; }
      args.p_casa_hasta = new Date($('casa-hasta').value).toISOString();
      args.p_fuera = (document.querySelector('input[name="fuera"]:checked') || {}).value;
    }
    try {
      await rpc('panel_reloj', args);
      const textos = { iniciar: 'El juego empezó.', reanudar: 'El juego siguió.', pausar: 'Juego en pausa.', sumar: 'Se sumó tiempo a la sesión.', casa: 'Guardado el tiempo en casa.', terminar: 'El juego terminó. Abre la pantalla final en la pestaña Reporte.' };
      aviso(textos[accion], 'ok');
      $('terminar-2').hidden = true;
      refrescar();
    } catch (e) { aviso(e.message, 'error'); }
  }

  // ------------------------------------------------------------------ grupos
  function pintarGrupos() {
    const caja = $('grupos-lista');
    if (caja.querySelector('input:focus, select:focus')) return; // no interrumpir mientras escribe
    caja.innerHTML = '';
    if (!datos.grupos.length) { caja.appendChild(el('p', { class: 'subtitulo', text: 'Aún no hay grupos.' })); return; }
    const seg = segJuego();
    datos.grupos.forEach(g => {
      const t = window.TERRITORIOS[g.territorio];
      const selector = el('select', { 'aria-label': 'Territorio de ' + g.nombre, disabled: !puede('admin') },
        ...window.ORDEN_TERRITORIOS.map(id => el('option', { value: id, selected: id === g.territorio }, window.TERRITORIOS[id].emoji + ' ' + window.TERRITORIOS[id].nombre)));
      selector.addEventListener('change', async () => {
        try { await rpc('panel_territorio', { p_grupo: g.id, p_territorio: selector.value }); aviso('Territorio cambiado.', 'ok'); refrescar(); }
        catch (e) { aviso(e.message, 'error'); }
      });
      const miembros = datos.jugadores.filter(j => j.grupo_id === g.id);
      const tabla = el('table', { class: 'tabla-panel' },
        el('tr', {}, ...['Estudiante', '⚡', 'Productos', 'Huecos', 'Fallos', 'Consultas', '🚩', 'Tratos', '🎟️ armadas', ''].map(h => el('th', { text: h }))));
      miembros.forEach(j => {
        tabla.appendChild(el('tr', {},
          el('td', {}, j.avatar + ' ' + j.nombre),
          el('td', { text: Math.round(j.energia) }), el('td', { text: bolsaTexto(j.bolsa) }),
          el('td', { text: j.huecos_ok }), el('td', { text: j.fallos }), el('td', { text: j.consultas }), el('td', { text: j.marcadas || '' }),
          el('td', { text: j.intercambios }), el('td', { text: j.oport_armadas }),
          el('td', { class: 'acciones' },
            puede('admin', 'monitor') ? el('button', { class: 'boton mini suave', onclick: () => abrirRegalo(j.nombre, j.id, null) }, '🎁') : null,
            el('button', { class: 'boton mini suave', onclick: () => { cambiarPestana('consultas'); $('ver-estudiante').value = j.id; verHistorial(); } }, '🔎'))));
      });
      caja.appendChild(el('div', { class: 'caja grupo-caja', style: 'border-top: 10px solid ' + t.color },
        el('div', { class: 'grupo-cabeza' },
          el('span', { class: 'emoji', text: g.emoji }),
          el('div', {}, el('h2', { text: g.nombre }), el('small', { text: 'Código: ' }, el('b', { text: g.codigo || '—' }), ' · creado ' + fecha(g.creado_en))),
          el('div', { class: 'campo' }, el('label', { text: 'Territorio' }), selector),
          puede('admin', 'monitor') ? el('button', { class: 'boton sol', onclick: () => abrirRegalo(g.nombre + ' (todo el grupo)', null, g.id) }, '🎁 Regalar al grupo') : null,
          puede('admin', 'monitor') ? el('button', { class: 'boton suave', onclick: () => verRespuestas(g) }, '🔑 Ver texto y respuestas') : null),
        el('p', { class: 'subtitulo' }, el('b', { text: 'Tema ' + g.tema + ': ' + (g.titulo || '') }), ' · 📜 ' + g.resueltos.length + '/18 huecos · 🎟️ ' + g.oportunidades + ' oportunidades · ❌ ' + g.fallos + ' palabras falladas' + (g.completo_en ? ' · 🏆 completó el texto a las ' + hora(g.completo_en) : '')),
        el('div', { class: 'tabla-scroll' }, tabla)));
    });
  }

  function abrirRegalo(nombre, jugador, grupo) {
    const capa = el('div', { class: 'capa-modal' });
    const claves = Object.keys(RECURSOS).concat(['oportunidades']);
    const campos = claves.map(r => el('div', { class: 'campo' }, el('label', { for: 'reg-' + r, text: (RECURSOS[r] || '🎟️') + ' ' + NOMBRES_REC[r] }), el('input', { id: 'reg-' + r, type: 'number', value: 0 })));
    const cerrar = () => capa.remove();
    capa.appendChild(el('div', { class: 'cartel modal' },
      el('h2', { text: '🎁 Regalar a ' + nombre }),
      el('p', { class: 'subtitulo', text: 'Usa números negativos para quitar. La energía llega hasta 100. Las oportunidades son de todo el grupo (si regalas a una persona, van a su grupo).' }),
      el('div', { class: 'fila-controles' }, ...campos),
      el('div', { class: 'fila-botones' },
        el('button', { class: 'boton suave', onclick: cerrar }, 'Cancelar'),
        el('button', { class: 'boton', onclick: async () => {
          const rec = {};
          claves.forEach(r => { const v = Number($('reg-' + r).value); if (v) rec[r] = v; });
          try { await rpc('panel_regalar', { p_jugador: jugador, p_grupo: grupo, p_recursos: rec }); aviso('Listo: recursos enviados.', 'ok'); cerrar(); refrescar(); }
          catch (e) { aviso(e.message, 'error'); }
        } }, 'Enviar'))));
    capa.addEventListener('mousedown', e => { if (e.target === capa) cerrar(); });
    document.body.appendChild(capa);
    $('reg-energia').focus();
  }

  async function verRespuestas(g) {
    let d;
    try { d = await rpc('panel_texto', { p_grupo: g.id }); } catch (e) { aviso(e.message, 'error'); return; }
    const capa = el('div', { class: 'capa-modal' });
    const cerrar = () => capa.remove();
    const texto = el('p', { class: 'texto-respuestas' });
    d.texto.split(/(\{\d+\})/).forEach(tr => {
      const m = tr.match(/^\{(\d+)\}$/);
      if (!m) { texto.appendChild(document.createTextNode(tr)); return; }
      const h = d.huecos.find(x => x.n === Number(m[1]));
      texto.appendChild(el('b', { class: h.resuelto ? 'ok' : 'falta', title: 'Hueco ' + h.n }, '[' + h.n + ' ' + h.respuesta.split('|')[0] + ']'));
    });
    const tabla = el('table', { class: 'tabla-panel' }, el('tr', {}, ...['#', 'Pista', 'Consulta', 'Respuesta (se aceptan)', ''].map(x => el('th', { text: x }))));
    d.huecos.forEach(h => tabla.appendChild(el('tr', {}, el('td', { text: h.n }), el('td', { text: h.pregunta }), el('td', {}, el('code', { text: h.consulta })),
      el('td', { text: h.respuesta.split('|').join(' · ') }), el('td', { text: h.resuelto ? '✅' : '' }))));
    capa.appendChild(el('div', { class: 'cartel modal ancho' },
      el('h2', { text: '🔑 ' + g.emoji + ' ' + g.nombre + ' · ' + d.titulo }),
      el('p', {}, el('b', { text: d.pregunta })), texto,
      el('p', { class: 'subtitulo', text: 'Idea final: ' + d.idea }),
      el('div', { class: 'tabla-scroll' }, tabla),
      el('div', { class: 'fila-botones' }, el('button', { class: 'boton', onclick: cerrar }, 'Cerrar'))));
    capa.addEventListener('mousedown', e => { if (e.target === capa) cerrar(); });
    document.body.appendChild(capa);
  }

  // ------------------------------------------------------------------ consultas
  function tarjetaConsulta(q, conNombre) {
    const m = q.metricas || {};
    return el('div', { class: 'consulta-pasada' + (q.marcada ? ' marcada' : '') + (q.ok === false ? ' fallida' : '') },
      el('div', { class: 'cabeza' },
        el('span', { text: hora(q.momento) + (conNombre ? ' · ' + q.avatar + ' ' + q.nombre + ' · ' + q.grupo : '') + (q.bytes != null ? ' · ' + (q.bytes / 1024).toFixed(1) + ' KB · ⚡' + q.megas : '') }),
        q.marcada || conNombre ? el('b', { class: 'motivo', text: '🚩 ' + (q.motivo || '') }) : null),
      el('pre', { class: 'json chico', text: q.texto || '' }),
      el('small', { class: 'metricas', text: 'Teclas: ' + (m.teclas ?? '—') + ' · letras tecleadas: ' + (m.insertados_teclado ?? '—') + ' · texto nuevo: ' + (m.crecimiento ?? '—') + ' · ritmo medio: ' + (m.media_ms ?? '—') + ' ms · intentos de pegar: ' + (m.intentos_pegar ?? 0) }),
      conNombre && puede('admin', 'monitor') ? el('button', { class: 'boton mini suave', onclick: async () => {
        try { await rpc('panel_revisada', { p_consulta: q.id }); aviso('Marcada como revisada.', 'ok'); refrescar(); } catch (e) { aviso(e.message, 'error'); }
      } }, '✔ Revisada') : null);
  }

  function pintarMarcadas() {
    const caja = $('marcadas'); caja.innerHTML = '';
    if (!datos.marcadas.length) caja.appendChild(el('p', { class: 'subtitulo', text: 'No hay consultas marcadas sin revisar. 🎉' }));
    datos.marcadas.forEach(q => caja.appendChild(tarjetaConsulta(q, true)));
    const sel = $('ver-estudiante');
    const actual = sel.value;
    if (sel.options.length !== datos.jugadores.length + 1) {
      sel.innerHTML = '';
      sel.appendChild(el('option', { value: '' }, 'Elige…'));
      datos.jugadores.forEach(j => sel.appendChild(el('option', { value: j.id }, j.avatar + ' ' + j.nombre + ' · ' + nombreGrupo(j.grupo_id))));
      sel.value = actual;
    }
  }

  async function verHistorial() {
    const id = $('ver-estudiante').value;
    const caja = $('historial'); caja.innerHTML = '';
    if (!id) return;
    try {
      const filas = await rpc('panel_consultas', { p_jugador: id });
      if (!filas.length) { caja.appendChild(el('p', { class: 'subtitulo', text: 'Sin consultas todavía.' })); return; }
      const tot = filas.reduce((a, f) => a + (f.megas || 0), 0);
      caja.appendChild(el('p', { class: 'subtitulo', text: filas.length + ' consultas · ⚡' + tot + ' de energía · ' + filas.filter(f => f.marcada).length + ' marcadas' }));
      filas.forEach(q => caja.appendChild(tarjetaConsulta(q, false)));
    } catch (e) { aviso(e.message, 'error'); }
  }

  // ------------------------------------------------------------------ comercio
  function pintarOfertas() {
    const caja = $('ofertas'); caja.innerHTML = '';
    if (!datos.ofertas.length) { caja.appendChild(el('p', { class: 'subtitulo', text: 'Aún no hay ofertas.' })); return; }
    const tabla = el('table', { class: 'tabla-panel' }, el('tr', {}, ...['Hora', 'Lugar', 'Quién', 'Ofrece', 'Pide', 'Mensaje', 'Estado'].map(h => el('th', { text: h }))));
    datos.ofertas.forEach(o => {
      tabla.appendChild(el('tr', { class: o.marcada ? 'marcada' : '' },
        el('td', { text: hora(o.creada_en) }), el('td', { text: o.lugar_nombre }), el('td', { text: o.autor_avatar + ' ' + o.autor_nombre }),
        el('td', { text: o.da_cant + ' ' + (RECURSOS[o.da_recurso] || o.da_recurso) }), el('td', { text: o.pide_cant + ' ' + (RECURSOS[o.pide_recurso] || o.pide_recurso) }),
        el('td', { text: (o.mensaje || '') + (o.marcada ? '  🚩 ' + o.motivo : '') }),
        el('td', { text: o.estado === 'aceptada' ? '🤝 con ' + o.acepto_nombre : o.estado === 'cancelada' ? 'Cancelada' : 'Abierta' })));
    });
    caja.appendChild(tabla);
  }

  // ------------------------------------------------------------------ reporte CSV
  const COLUMNAS = [
    ['estudiante', 'Estudiante'], ['grupo', 'Grupo'], ['territorio', 'Territorio'], ['tema', 'Tema'], ['texto', 'Texto'],
    ['huecos_del_grupo', 'Huecos llenos del grupo'], ['oportunidades_del_grupo', 'Oportunidades del grupo'],
    ['huecos_que_completo', 'Huecos que llenó'], ['intentos_fallidos', 'Palabras falladas'],
    ['consultas_hechas', 'Consultas hechas'], ['energia_en_consultas', 'Energía gastada en consultas'], ['consultas_marcadas', 'Consultas marcadas'],
    ['energia', 'Energía final'], ['productos', 'Productos'], ['intercambios_hechos', 'Intercambios hechos'], ['ayudas_dadas', 'Envíos a otros'],
    ['oportunidades_armadas', 'Oportunidades armadas'], ['primer_ingreso', 'Primer ingreso'], ['ultima_conexion', 'Última conexión']
  ];

  async function descargarCSV() {
    let filas;
    try { filas = await rpc('panel_reporte'); } catch (e) { aviso(e.message, 'error'); return; }
    const celda = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lineas = [COLUMNAS.map(c => c[1]).join(';')].concat(filas.map(f => COLUMNAS.map(c => celda(f[c[0]])).join(';')));
    const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'territorios-conectados-reporte-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    aviso('Reporte descargado (' + filas.length + ' estudiantes).', 'ok');
    pintarVistaReporte(filas);
  }

  function pintarVistaReporte(filas) {
    const caja = $('vista-reporte'); caja.innerHTML = '';
    const tabla = el('table', { class: 'tabla-panel' }, el('tr', {}, ...COLUMNAS.map(c => el('th', { text: c[1] }))));
    filas.forEach(f => tabla.appendChild(el('tr', {}, ...COLUMNAS.map(c => el('td', { text: f[c[0]] == null ? '' : f[c[0]] })))));
    caja.appendChild(tabla);
  }

  // ------------------------------------------------------------------ pestañas
  function cambiarPestana(p) {
    pestana = p;
    document.querySelectorAll('#pestanas button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.p === p)));
    document.querySelectorAll('[data-seccion]').forEach(s => { s.hidden = s.dataset.seccion !== p; });
    if (p === 'controles') configCargada = false;
    if (p === 'reporte') rpc('panel_reporte').then(pintarVistaReporte).catch(() => {});
    if (datos) refrescar();
  }

  function iniciar() {
    if (!Servidor.configurado() || !Servidor.iniciar()) {
      $('error-login').textContent = 'Falta conectar el juego con Supabase (archivo js/config.js).';
      $('error-login').hidden = false;
      return;
    }
    $('entrar').addEventListener('click', entrar);
    ['usuario', 'clave'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); }));
    document.querySelectorAll('#pestanas button').forEach(b => b.addEventListener('click', () => cambiarPestana(b.dataset.p)));
    document.querySelectorAll('[data-reloj]').forEach(b => b.addEventListener('click', () => accionReloj(b.dataset.reloj)));
    $('terminar-1').addEventListener('click', () => { $('terminar-2').hidden = false; });
    $('terminar-no').addEventListener('click', () => { $('terminar-2').hidden = true; });
    $('guardar-config').addEventListener('click', guardarConfig);
    ['desgaste', 'megas'].forEach(n => $('d-' + n).addEventListener('input', () => { $('v-' + n).textContent = '×' + Number($('d-' + n).value).toFixed(1); }));
    $('ver-estudiante').addEventListener('change', verHistorial);
    $('descargar-csv').addEventListener('click', descargarCSV);
    $('salir').addEventListener('click', salir);
    $('cambiar-clave').addEventListener('click', async () => {
      try { await rpc('equipo_cambiar_clave', { p_actual: $('clave-actual').value, p_nueva: $('clave-nueva').value }); aviso('Contraseña cambiada.', 'ok'); $('clave-actual').value = ''; $('clave-nueva').value = ''; }
      catch (e) { aviso(e.message, 'error'); }
    });
    $('reiniciar').addEventListener('click', async () => {
      try { await rpc('panel_reiniciar', { p_palabra: $('palabra-reinicio').value }); aviso('El mundo quedó vacío y en espera.', 'ok'); $('palabra-reinicio').value = ''; refrescar(); }
      catch (e) { aviso(e.message, 'error'); }
    });
    window.addEventListener('resize', () => { if (datos && pestana === 'vivo') pintarMapa(); });

    let guardada = null;
    try { guardada = JSON.parse(sessionStorage.getItem(CLAVE) || 'null'); } catch (e) { /* nada */ }
    if (guardada && guardada.token) { sesion = guardada; abrirPanel(); }
    else $('usuario').focus();
  }

  iniciar();
})();
