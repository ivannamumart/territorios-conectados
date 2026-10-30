/* =========================================================================
   Territorios Conectados — Geometría del mundo
   Dónde está cada isla, cada edificio y cada puente. Lo usan el juego y
   el mapa en vivo del panel docente, así siempre coinciden.
   ========================================================================= */
(function () {
  'use strict';

  const ANCHO = 4400, ALTO = 3400;
  const CX = ANCHO / 2, CY = ALTO / 2;
  const RX = 1560, RY = 1190;        // óvalo donde van las 9 islas
  const ISLA_R = 340;                 // radio de cada isla
  const PLAZA_R = 340;                // radio de la plaza central
  const PUENTE_MEDIO = 44;            // medio ancho de los puentes
  const EDIF_W = 140, EDIF_H = 104;   // tamaño de los edificios

  const LUGARES = {
    archivo: { id: 'archivo', nombre: 'Archivo',  emoji: '📜', techo: '#8fa7f0' },
    pistas:  { id: 'pistas',  nombre: 'Pistas',   emoji: '🔎', techo: '#f2c46b' },
    consola: { id: 'consola', nombre: 'Consola',  emoji: '💻', techo: '#c3a6e8' },
    campo:   { id: 'campo',   nombre: 'Campo',    emoji: '🌱', techo: '#9ad6a7' },
    salon:   { id: 'salon',   nombre: 'Mercado Central', emoji: '🤝', techo: '#f5a3c7' }
  };

  /** Nombre y emoji de un lugar (el campo cambia según el territorio). */
  function nombreLugar(lugar, territorio, params) {
    const L = LUGARES[lugar];
    if (lugar === 'campo' && params && params.producto) return { nombre: params.producto.lugar, emoji: params.producto.lugar_icono };
    return { nombre: L.nombre, emoji: L.emoji };
  }

  // Posición de cada edificio respecto a la isla: distancia y ángulo
  // medido desde la dirección "hacia afuera" (el puente llega por detrás).
  // El Archivo va en el centro de la isla.
  const DISPOSICION = [
    { lugar: 'archivo', dist: 60,  ang: 0 },
    { lugar: 'pistas',  dist: 210, ang: -105 },
    { lugar: 'consola', dist: 210, ang: 105 },
    { lugar: 'campo',   dist: 235, ang: 0 }
  ];

  const rad = g => g * Math.PI / 180;

  function centroIsla(i) {
    const ang = -Math.PI / 2 + i * (2 * Math.PI / 9);
    return { x: CX + Math.cos(ang) * RX, y: CY + Math.sin(ang) * RY, afuera: Math.atan2(Math.sin(ang) * RY, Math.cos(ang) * RX) };
  }

  function rectEdificio(x, y) {
    // El rectángulo sólido; la puerta queda justo debajo.
    return { x1: x - EDIF_W / 2, y1: y - EDIF_H * 0.62, x2: x + EDIF_W / 2, y2: y + EDIF_H * 0.38 };
  }

  function edificiosIsla(i) {
    const c = centroIsla(i);
    return DISPOSICION.map(d => {
      const a = c.afuera + rad(d.ang);
      const x = c.x + Math.cos(a) * d.dist, y = c.y + Math.sin(a) * d.dist;
      return { lugar: d.lugar, isla: i, x, y, puerta: { x, y: y + EDIF_H * 0.38 + 34 }, rect: rectEdificio(x, y) };
    });
  }

  function edificioSalon() {
    const x = CX, y = CY - 170;
    return { lugar: 'salon', isla: null, x, y, puerta: { x, y: y + EDIF_H * 0.38 + 34 }, rect: rectEdificio(x, y) };
  }

  function puente(i) {
    const c = centroIsla(i);
    const dx = CX - c.x, dy = CY - c.y, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L;
    return {
      x1: c.x + ux * (ISLA_R - 40), y1: c.y + uy * (ISLA_R - 40),
      x2: CX - ux * (PLAZA_R - 40), y2: CY - uy * (PLAZA_R - 40)
    };
  }

  function distSegmento(px, py, s) {
    const vx = s.x2 - s.x1, vy = s.y2 - s.y1;
    const t = Math.max(0, Math.min(1, ((px - s.x1) * vx + (py - s.y1) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(px - (s.x1 + t * vx), py - (s.y1 + t * vy));
  }

  /**
   * Arma el mundo para las islas ocupadas (lista de números de isla 0..8).
   */
  function construir(islasOcupadas) {
    const islas = [...new Set(islasOcupadas)].filter(i => i >= 0 && i < 9).sort((a, b) => a - b);
    const edificios = [edificioSalon()];
    const puentes = [];
    islas.forEach(i => { edificios.push(...edificiosIsla(i)); puentes.push({ isla: i, ...puente(i) }); });
    const fuente = { x: CX, y: CY + 40, r: 58 };

    function caminable(x, y) {
      if (x < 0 || y < 0 || x > ANCHO || y > ALTO) return false;
      let suelo = Math.hypot(x - CX, y - CY) < PLAZA_R - 16;
      if (!suelo) for (const i of islas) { const c = centroIsla(i); if (Math.hypot(x - c.x, y - c.y) < ISLA_R - 18) { suelo = true; break; } }
      if (!suelo) for (const p of puentes) { if (distSegmento(x, y, p) < PUENTE_MEDIO - 6) { suelo = true; break; } }
      if (!suelo) return false;
      if (Math.hypot(x - fuente.x, y - fuente.y) < fuente.r) return false;
      for (const e of edificios) { const r = e.rect; if (x > r.x1 && x < r.x2 && y > r.y1 && y < r.y2) return false; }
      return true;
    }

    function region(x, y) {
      let mejor = 'plaza', d = Math.hypot(x - CX, y - CY);
      for (const i of islas) { const c = centroIsla(i); const di = Math.hypot(x - c.x, y - c.y); if (di < d) { d = di; mejor = 'isla' + i; } }
      return mejor;
    }

    function puntoInicio(i) {
      if (i == null || islas.indexOf(i) < 0) return { x: CX, y: CY + 150 };
      const c = centroIsla(i);
      const dx = CX - c.x, dy = CY - c.y, L = Math.hypot(dx, dy);
      return { x: c.x + dx / L * 40, y: c.y + dy / L * 40 };
    }

    return { islas, edificios, puentes, fuente, caminable, region, puntoInicio };
  }

  /** Generador de números pseudoaleatorios con semilla (decoración estable). */
  function semilla(n) {
    let s = (n * 9301 + 49297) % 233280;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  window.MundoDatos = {
    ANCHO, ALTO, CX, CY, ISLA_R, PLAZA_R, PUENTE_MEDIO, EDIF_W, EDIF_H, LUGARES, nombreLugar,
    centroIsla, edificiosIsla, edificioSalon, puente, construir, semilla, distSegmento
  };
})();
