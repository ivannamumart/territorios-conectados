/* =========================================================================
   Territorios Conectados — Piezas que comparten el mapa y los interiores
   ========================================================================= */
(function () {
  'use strict';

  const VELOCIDAD = 240; // píxeles por segundo

  /** Teclas: flechas, WASD y E/Enter para usar. No captura el teclado de los paneles. */
  function crearControles(escena) {
    const k = escena.input.keyboard;
    k.disableGlobalCapture();
    const teclas = k.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false);
    return teclas;
  }

  function direccion(teclas) {
    if (window.Juego && Juego.panelAbierto()) { if (window.Tactil) Tactil.soltar(); return { dx: 0, dy: 0 }; }
    const t = window.Tactil && Tactil.direccion();
    if (t) return t;
    const izq = teclas.LEFT.isDown || teclas.A.isDown;
    const der = teclas.RIGHT.isDown || teclas.D.isDown;
    const arr = teclas.UP.isDown || teclas.W.isDown;
    const aba = teclas.DOWN.isDown || teclas.S.isDown;
    let dx = (der ? 1 : 0) - (izq ? 1 : 0);
    let dy = (aba ? 1 : 0) - (arr ? 1 : 0);
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    return { dx, dy };
  }

  /**
   * Mueve el avatar propio respetando lo caminable (se desliza por bordes).
   * Devuelve { vx, vy, recorrido }.
   */
  function moverYo(avatar, teclas, deltaMs, caminable, tiempo) {
    const puede = !window.Juego || Juego.puedeMoverse();
    const d = puede ? direccion(teclas) : { dx: 0, dy: 0 };
    const paso = VELOCIDAD * Math.min(deltaMs, 100) / 1000;
    let x = avatar.x, y = avatar.y, recorrido = 0;
    if (d.dx || d.dy) {
      const nx = x + d.dx * paso, ny = y + d.dy * paso;
      if (caminable(nx, ny)) { x = nx; y = ny; }
      else if (caminable(nx, y)) { x = nx; }
      else if (caminable(x, ny)) { y = ny; }
      recorrido = Math.hypot(x - avatar.x, y - avatar.y);
      avatar.setPosicion(x, y);
    }
    const moviendo = recorrido > 0.1;
    avatar.pasos(moviendo, tiempo);
    return { vx: moviendo ? d.dx * VELOCIDAD : 0, vy: moviendo ? d.dy * VELOCIDAD : 0, recorrido };
  }

  /** Tecla de usar: E, Enter o Espacio (una vez por pulsación). */
  function usar(teclas) {
    if (window.Juego && Juego.panelAbierto()) return false;
    return !!(window.Juego && Juego.consumirUsar());
  }

  /** Avatares de las demás personas que están en el mismo canal. */
  class Gente {
    constructor(escena) { this.escena = escena; this.mapa = new Map(); }
    llegar(p) {
      if (!p || !p.id || (window.Juego && p.id === Juego.yoId())) return;
      let a = this.mapa.get(p.id);
      const tipo = window.Juego && Juego.esDeMiGrupo(p.id) ? 'grupo' : 'otro';
      if (!a) {
        a = new Avatar(this.escena, p, tipo);
        this.mapa.set(p.id, a);
      } else {
        a.datos.nombre = p.nombre; a.datos.avatar = p.avatar;
        if (p.estado && p.estado !== a.datos.estado) a.setEstado(p.estado);
      }
      if (p.x != null && p.y != null && !a.objetivo) a.setPosicion(p.x, p.y);
    }
    mover(p) {
      const a = this.mapa.get(p.i);
      if (a) a.recibir(p);
    }
    emote(p) { const a = this.mapa.get(p.i); if (a) a.mostrarEmote(p.e); }
    salir(id) { const a = this.mapa.get(id); if (a) { a.destruir(); this.mapa.delete(id); } }
    vaciar() { this.mapa.forEach(a => a.destruir()); this.mapa.clear(); }
    actualizar(tiempo, caminable) { this.mapa.forEach(a => a.actualizarRemoto(tiempo, caminable)); }
    estado(id, estado) { const a = this.mapa.get(id); if (a) a.setEstado(estado); }
  }

  /** Texto con borde blanco, legible sobre cualquier fondo. */
  function rotulo(escena, x, y, texto, tam, color) {
    return escena.add.text(x, y, texto, {
      fontSize: (tam || 18) + 'px', fontFamily: '"Baloo 2", Nunito, system-ui, sans-serif', fontStyle: '800',
      color: color || '#33405a', stroke: '#ffffff', strokeThickness: 6, align: 'center', resolution: RES_TEXTO
    }).setOrigin(0.5);
  }

  function emoji(escena, x, y, e, tam) {
    return escena.add.text(x, y, e, { fontSize: (tam || 40) + 'px', fontFamily: FUENTE_EMOJI, resolution: RES_TEXTO }).setOrigin(0.5, 1);
  }

  const hex = c => Phaser.Display.Color.HexStringToColor(c).color;
  const mezclar = (c1, c2, t) => {
    const a = Phaser.Display.Color.HexStringToColor(c1), b = Phaser.Display.Color.HexStringToColor(c2);
    return Phaser.Display.Color.GetColor(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t);
  };

  window.EscenaComun = { VELOCIDAD, crearControles, moverYo, usar, Gente, rotulo, emoji, hex, mezclar };
})();
