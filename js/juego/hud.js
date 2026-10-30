/* =========================================================================
   Territorios Conectados — Barra de recursos, reloj, avisos y minimapa
   ========================================================================= */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const M = window.MundoDatos;
  const PRODUCTOS = { flores: '🌸', sal: '🧂', maiz: '🌽', cafe: '☕', cocos: '🥥', pescado: '🐟' };
  let relojAviso = null;
  let ultimaBolsa = null;
  let ultimoMini = 0;
  const historial = [];

  function iniciar() {
    $('hud').hidden = false;
    $('hud-misiones').addEventListener('click', () => Paneles.abrir('texto', {}));
    $('hud-grupo').addEventListener('click', () => Paneles.abrir('grupo', {}));
    $('hud-ayuda').addEventListener('click', () => Paneles.abrir('ayuda', {}));
    $('hud-avisos').addEventListener('click', () => Paneles.abrir('avisos', {}));
    $('hud-resultados').addEventListener('click', () => { location.href = 'final.html'; });
    const j = Juego.estado.jugador, g = Juego.estado.grupo;
    $('hud-avatar').textContent = j.avatar;
    $('hud-nombre').textContent = j.nombre;
    $('hud-grupo-nombre').textContent = g.emoji + ' ' + g.nombre;
    actualizar();
  }

  const fmt = s => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
  };

  function barra(id, valor) {
    const b = $(id);
    const v = Math.max(0, Math.min(100, valor));
    b.querySelector('.relleno').style.width = v + '%';
    b.querySelector('b').textContent = Math.round(valor);
    b.classList.toggle('bajo', v < 25);
    b.classList.toggle('critico', v < 10);
  }

  function textoReloj(r) {
    if (r.estado === 'espera') return '⏳ Esperando el inicio';
    if (r.estado === 'pausado') return '⏸ En pausa';
    if (r.estado === 'terminado') return '🏁 Terminado';
    if (r.fin_clase) {
      const falta = (Date.parse(r.fin_clase) - Juego.ahoraServidor()) / 1000;
      if (falta > 0) return '⏱ ' + fmt(falta) + ' de clase';
      if (r.casa_hasta && r.fuera_de_clase === 'corre') {
        const d = new Date(r.casa_hasta);
        return '🏠 Sigue en casa hasta ' + d.toLocaleString('es-CO', { weekday: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      }
    }
    return '▶ Jugando';
  }

  function actualizar() {
    if (!Juego.estado) return;
    const e = Juego.estado, j = e.jugador, r = e.reloj;
    const rec = Juego.recursos();
    barra('hud-energia', rec.energia);
    $('hud-oport').textContent = e.grupo.oportunidades != null ? e.grupo.oportunidades : '–';
    $('hud-oport').parentNode.classList.toggle('critico', Number(e.grupo.oportunidades) === 0);
    $('hud-huecos').textContent = e.grupo.resueltos != null ? e.grupo.resueltos : 0;
    const bolsa = j.bolsa || {};
    const claveBolsa = JSON.stringify(bolsa);
    if (claveBolsa !== ultimaBolsa) {
      ultimaBolsa = claveBolsa;
      const caja = $('hud-bolsa');
      caja.innerHTML = '';
      const hay = Object.keys(PRODUCTOS).filter(k => Number(bolsa[k]) > 0);
      if (!hay.length) caja.appendChild(Object.assign(document.createElement('small'), { textContent: 'Sin productos todavía' }));
      hay.forEach(k => {
        const s = document.createElement('span');
        s.textContent = PRODUCTOS[k] + ' ' + bolsa[k];
        caja.appendChild(s);
      });
    }
    $('hud-reloj').textContent = textoReloj(r);
    $('hud-reloj').className = 'reloj ' + r.estado;

    // Anuncio de la profe
    const an = (e.config.anuncio || '').trim();
    $('hud-anuncio').hidden = !an;
    if (an) $('hud-anuncio-texto').textContent = an;

    // Estado propio / del juego
    const caja = $('hud-estado');
    let texto = '', clase = '';
    $('hud-resultados').hidden = r.estado !== 'terminado';
    if (r.estado === 'terminado') { texto = '🏁 El juego terminó. ¡Gracias por jugar!'; clase = 'fin'; }
    else if (Number(e.grupo.oportunidades) === 0 && !e.grupo.completo_en && r.estado === 'corriendo') {
      texto = '🎟️ Tu grupo se quedó sin oportunidades. Recolecten, intercambien en la Plaza Central y armen una oportunidad en el Archivo.';
      clase = 'rescate';
    } else if (r.estado === 'espera') { texto = '⏳ El juego aún no empieza. Explora el mapa mientras la profe da la señal.'; clase = 'pausa'; }
    else if (r.estado === 'pausado') { texto = '⏸ El juego está en pausa.'; clase = 'pausa'; }
    caja.hidden = !texto;
    caja.className = 'hud-estado ' + clase;
    $('hud-estado-texto').textContent = texto;

    actualizarAlertasTiempo();
    if (Date.now() - ultimoMini > 300) { ultimoMini = Date.now(); minimapa(); }
  }

  function lugar(escenaId) {
    let t = '🗺️ Mapa del mundo', senal = null;
    if (escenaId === 'salon') t = '🤝 Mercado Central';
    else if (escenaId && escenaId !== 'mundo') {
      const [gid, l] = escenaId.split(':');
      const g = Juego.grupoPorId(gid);
      const terr = g && window.TERRITORIOS[g.territorio];
      const NL = M.nombreLugar(l, g && g.territorio, g && Juego.parametrosTerritorio(g.territorio));
      t = NL.emoji + ' ' + NL.nombre + (g ? ' · ' + g.emoji + ' ' + g.nombre : '');
      if (terr && l === 'consola') senal = terr.rasgos[0].nivel;
    }
    $('hud-lugar').textContent = t;
    const s = $('hud-senal');
    s.hidden = senal == null;
    if (senal != null) s.querySelectorAll('i').forEach((b, k) => b.classList.toggle('on', k < senal));
    $('hud-minimapa').hidden = escenaId !== 'mundo';
  }

  function prompt(texto) {
    const p = $('hud-prompt');
    p.hidden = !texto;
    if (texto) $('hud-prompt-texto').textContent = texto;
  }

  function aviso(texto, tipo) {
    const a = $('hud-aviso');
    a.textContent = texto;
    a.className = 'hud-aviso ' + (tipo || '');
    a.hidden = false;
    clearTimeout(relojAviso);
    relojAviso = setTimeout(() => { a.hidden = true; }, tipo === 'alerta' ? 7000 : 4500);
  }

  function registrar(texto) {
    historial.unshift({ texto, hora: new Date() });
    if (historial.length > 40) historial.pop();
    const n = $('hud-avisos-n');
    n.textContent = String(Math.min(99, (Number(n.textContent) || 0) + 1));
    n.hidden = false;
  }

  let claveAlertas = '';
  function actualizarAlertas() {
    const caja = $('hud-alertas');
    const yo = Juego.yoId();
    const lista = [];
    const clave = lista.map(m => m.id + ':' + m.rescate_hasta_seg).join('|');
    if (clave === claveAlertas) { actualizarAlertasTiempo(); return; }   // nada cambió: no redibujar
    claveAlertas = clave;
    caja.innerHTML = '';
    lista.forEach(m => {
      const d = document.createElement('div');
      d.className = 'alerta';
      d.dataset.hasta = m.rescate_hasta_seg;
      d.innerHTML = '<span class="cara"></span><span class="txt"><b></b><small></small></span><button class="boton coral mini">Ayudar</button>';
      d.querySelector('.cara').textContent = '🆘' + m.avatar;
      d.querySelector('b').textContent = m.nombre + ' necesita ayuda';
      d.querySelector('button').addEventListener('click', () => Paneles.abrir('ayudar', { para: m.id }));
      caja.appendChild(d);
    });
    actualizarAlertasTiempo();
  }

  function actualizarAlertasTiempo() {
    const seg = Juego.segJuego();
    document.querySelectorAll('#hud-alertas .alerta').forEach(d => {
      d.querySelector('small').textContent = 'Quedan ' + fmt(Number(d.dataset.hasta) - seg) + ' de juego';
    });
  }

  function minimapa() {
    const cv = $('hud-minimapa');
    if (cv.hidden || !Juego.mundo) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, k = Math.min(W / M.ANCHO, H / M.ALTO);
    const ox = (W - M.ANCHO * k) / 2, oy = (H - M.ALTO * k) / 2;
    const X = x => ox + x * k, Y = y => oy + y * k;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#bfe4f6'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#e9c89d'; ctx.lineWidth = Math.max(2, M.PUENTE_MEDIO * 2 * k);
    Juego.mundo.puentes.forEach(p => { ctx.beginPath(); ctx.moveTo(X(p.x1), Y(p.y1)); ctx.lineTo(X(p.x2), Y(p.y2)); ctx.stroke(); });
    ctx.fillStyle = '#ffd1e2'; ctx.beginPath(); ctx.arc(X(M.CX), Y(M.CY), M.PLAZA_R * k, 0, 7); ctx.fill();
    Juego.mundo.islas.forEach(i => {
      const c = M.centroIsla(i), g = Juego.grupoPorIsla(i);
      const t = g && window.TERRITORIOS[g.territorio];
      ctx.fillStyle = t ? t.color : '#dddddd';
      ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), M.ISLA_R * k, 0, 7); ctx.fill();
      if (g && g.id === Juego.estado.grupo.id) { ctx.strokeStyle = '#5b78f0'; ctx.lineWidth = 2.5; ctx.stroke(); }
      if (g) { ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g.emoji, X(c.x), Y(c.y)); }
    });
    const esc = Juego.escenaActivaMundo && Juego.escenaActivaMundo();
    const p = Juego.posicionActual;
    if (esc && esc.gente) esc.gente.mapa.forEach(a => {
      ctx.fillStyle = Juego.esDeMiGrupo(a.id) ? '#3e9a68' : '#33405a';
      ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), 2.5, 0, 7); ctx.fill();
    });
    if (p) {
      ctx.fillStyle = '#5b78f0'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 5, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  window.HUD = {
    iniciar, actualizar, lugar, prompt, aviso, registrar, actualizarAlertas,
    historial: () => historial,
    limpiarContador: () => { const n = $('hud-avisos-n'); n.textContent = '0'; n.hidden = true; }
  };
})();
