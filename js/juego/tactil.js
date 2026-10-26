/* =========================================================================
   Territorios Conectados — Controles para celular y tableta
   Palanca en la esquina inferior izquierda para caminar.
   El letrero "Entrar / Usar" se puede tocar (hace lo mismo que la tecla E).
   ========================================================================= */
(function () {
  'use strict';

  const RADIO = 52;          // cuánto se puede alejar la perilla del centro (px)
  const ZONA_MUERTA = 0.18;  // movimientos muy pequeños no cuentan

  let activo = false;
  let dedo = null;
  let centro = { x: 0, y: 0 };
  let dir = { dx: 0, dy: 0 };
  let base, perilla;

  function esTactil() {
    return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  function mostrar() {
    if (activo) return;
    activo = true;
    document.body.classList.add('modo-tactil');
  }

  function soltar() {
    dedo = null;
    dir = { dx: 0, dy: 0 };
    if (perilla) perilla.style.transform = 'translate(-50%, -50%)';
    if (base) base.classList.remove('activa');
  }

  function mover(x, y) {
    let vx = x - centro.x, vy = y - centro.y;
    const d = Math.hypot(vx, vy);
    if (d > RADIO) { vx = vx / d * RADIO; vy = vy / d * RADIO; }
    perilla.style.transform = 'translate(calc(-50% + ' + vx + 'px), calc(-50% + ' + vy + 'px))';
    const fuerza = Math.min(1, d / RADIO);
    if (fuerza < ZONA_MUERTA) { dir = { dx: 0, dy: 0 }; return; }
    const ang = Math.atan2(vy, vx);
    dir = { dx: Math.cos(ang), dy: Math.sin(ang) };
  }

  function crear() {
    const hud = document.getElementById('hud');
    if (!hud || base) return;
    base = document.createElement('div');
    base.className = 'palanca';
    base.setAttribute('aria-label', 'Palanca para caminar');
    perilla = document.createElement('div');
    perilla.className = 'palanca-perilla';
    base.appendChild(perilla);
    hud.appendChild(base);

    base.addEventListener('pointerdown', e => {
      if (dedo !== null) return;
      e.preventDefault();
      dedo = e.pointerId;
      base.setPointerCapture(e.pointerId);
      const r = base.getBoundingClientRect();
      centro = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      base.classList.add('activa');
      mover(e.clientX, e.clientY);
    });
    base.addEventListener('pointermove', e => { if (e.pointerId === dedo) { e.preventDefault(); mover(e.clientX, e.clientY); } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => base.addEventListener(t, e => { if (e.pointerId === dedo) soltar(); }));

    // El letrero de "Entrar / Usar" se puede tocar
    const p = document.getElementById('hud-prompt');
    if (p) {
      p.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (window.Juego && Juego.tocarUsar) Juego.tocarUsar();
      });
    }

    // Botón de gestos para el celular (en el computador se usan las teclas 1 a 6)
    const gestos = document.createElement('div');
    gestos.className = 'gestos-tactil';
    const abrir = document.createElement('button');
    abrir.className = 'boton-gesto principal';
    abrir.type = 'button';
    abrir.textContent = '👋';
    abrir.setAttribute('aria-label', 'Gestos');
    const lista = document.createElement('div');
    lista.className = 'gestos-lista';
    lista.hidden = true;
    ['👋', '😀', '❤️', '🆘', '👍', '🤝'].forEach(em => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'boton-gesto'; b.textContent = em;
      b.addEventListener('click', () => { lista.hidden = true; if (window.Juego && Juego.gesto) Juego.gesto(em); });
      lista.appendChild(b);
    });
    abrir.addEventListener('click', () => { lista.hidden = !lista.hidden; });
    gestos.appendChild(lista);
    gestos.appendChild(abrir);
    hud.appendChild(gestos);

    // Si se abre un panel, se suelta la palanca
    document.addEventListener('visibilitychange', soltar);
  }

  function iniciar() {
    crear();
    if (esTactil()) mostrar();
    // Si alguien toca la pantalla en un aparato que no parecía táctil, aparece igual
    window.addEventListener('touchstart', mostrar, { once: true, passive: true });
  }

  window.Tactil = {
    iniciar,
    direccion: () => (activo && dedo !== null ? dir : null),
    soltar
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
