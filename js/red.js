/* =========================================================================
   Territorios Conectados — Movimiento en tiempo real
   -------------------------------------------------------------------------
   Cada lugar (y cada zona del mapa) es un "canal". Para gastar pocos
   mensajes del plan gratuito, solo se avisa cuando alguien empieza a
   caminar, cambia de dirección o se detiene; los demás computadores
   calculan el camino entre avisos.
   ========================================================================= */
(function () {
  'use strict';

  let canal = null;
  let escenaActual = null;
  let yo = null;
  let manejadores = {};
  let conectado = false;
  let modo = 'normal';
  let ultimoEnvio = 0;
  let ultimoVel = { vx: 0, vy: 0 };
  let ultimoPos = { x: 0, y: 0 };
  let relojRespuesta = null;

  function unirse(escena, datosYo, h) {
    salir();
    escenaActual = escena;
    yo = { ...datosYo };
    manejadores = h || {};
    ultimoPos = { x: yo.x, y: yo.y };
    const c = Servidor.cliente();
    if (!c) return;
    try {
      canal = c.channel('tc:' + escena, { config: { broadcast: { self: false }, presence: { key: yo.id } } });
      canal
        .on('broadcast', { event: 'm' }, ({ payload }) => {
          if (payload && payload.i !== yo.id && manejadores.alMover) manejadores.alMover(payload);
        })
        .on('broadcast', { event: 'e' }, ({ payload }) => {
          if (payload && payload.i !== yo.id && manejadores.alEmote) manejadores.alEmote(payload);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (key === yo.id) return;
          const p = newPresences && newPresences[0];
          if (p && manejadores.alLlegar) manejadores.alLlegar(p);
          // Le contamos a quien llega dónde estamos ahora (una sola vez)
          clearTimeout(relojRespuesta);
          relojRespuesta = setTimeout(() => enviar(ultimoPos.x, ultimoPos.y, ultimoVel.vx, ultimoVel.vy, true), 250 + Math.random() * 400);
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          if (key !== yo.id && manejadores.alSalir) manejadores.alSalir(key);
        })
        .subscribe(async estado => {
          conectado = estado === 'SUBSCRIBED';
          if (conectado) {
            try { await canal.track(datosPresencia()); } catch (e) { /* nada */ }
            const st = canal.presenceState();
            Object.keys(st).forEach(k => { if (k !== yo.id && st[k][0] && manejadores.alLlegar) manejadores.alLlegar(st[k][0]); });
          }
        });
    } catch (e) { canal = null; }
  }

  function datosPresencia() {
    return { id: yo.id, nombre: yo.nombre, avatar: yo.avatar, grupo: yo.grupo, estado: yo.estado, x: Math.round(ultimoPos.x), y: Math.round(ultimoPos.y) };
  }

  function salir() {
    clearTimeout(relojRespuesta);
    if (canal) {
      const c = Servidor.cliente();
      try { canal.untrack(); } catch (e) { /* nada */ }
      try { c && c.removeChannel(canal); } catch (e) { /* nada */ }
    }
    canal = null; conectado = false; escenaActual = null;
  }

  function enviar(x, y, vx, vy, forzar) {
    if (!canal || !conectado) return;
    const ahora = Date.now();
    if (!forzar && ahora - ultimoEnvio < (modo === 'ahorro' ? 400 : 150)) return;
    ultimoEnvio = ahora;
    ultimoVel = { vx, vy };
    try {
      canal.send({ type: 'broadcast', event: 'm', payload: { i: yo.id, x: Math.round(x), y: Math.round(y), vx: Math.round(vx), vy: Math.round(vy) } });
    } catch (e) { /* nada */ }
  }

  /**
   * Se llama en cada cuadro con la posición y velocidad propias.
   * Decide si vale la pena avisar a los demás.
   */
  function reportar(x, y, vx, vy) {
    ultimoPos = { x, y };
    if (!canal || !conectado) return;
    const cambio = Math.sign(vx) !== Math.sign(ultimoVel.vx) || Math.sign(vy) !== Math.sign(ultimoVel.vy);
    const moviendo = vx !== 0 || vy !== 0;
    const recordar = modo === 'ahorro' ? 5000 : 2500;
    if (cambio) enviar(x, y, vx, vy, !moviendo);           // detenerse se avisa siempre
    else if (moviendo && Date.now() - ultimoEnvio > recordar) enviar(x, y, vx, vy, true);
  }

  function emote(e) {
    if (!canal || !conectado) return;
    try { canal.send({ type: 'broadcast', event: 'e', payload: { i: yo.id, e } }); } catch (err) { /* nada */ }
  }

  async function actualizarYo(cambios) {
    if (!yo) return;
    Object.assign(yo, cambios);
    if (canal && conectado) { try { await canal.track(datosPresencia()); } catch (e) { /* nada */ } }
  }

  /** Quiénes están en este mismo lugar según la presencia. */
  function presentes() {
    if (!canal) return [];
    const st = canal.presenceState();
    return Object.keys(st).filter(k => yo && k !== yo.id).map(k => st[k][0]).filter(Boolean);
  }

  window.Red = {
    unirse, salir, reportar, emote, actualizarYo, presentes,
    fijarModo: m => { modo = m || 'normal'; },
    escena: () => escenaActual,
    conectado: () => conectado
  };
})();
