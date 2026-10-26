/* =========================================================================
   Territorios Conectados — Fondo animado (Phaser 3)
   Islas pastel que flotan alrededor de la plaza central, con nubes.
   Es el mismo mundo que luego se recorre en el mapa.
   ========================================================================= */
(function () {
  'use strict';

  const SIN_MOVIMIENTO = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hex = c => Phaser.Display.Color.HexStringToColor(c).color;
  const oscurecer = (c, f) => {
    const col = Phaser.Display.Color.HexStringToColor(c);
    return Phaser.Display.Color.GetColor(col.red * f, col.green * f, col.blue * f);
  };

  class EscenaFondo extends Phaser.Scene {
    constructor() { super('Fondo'); }

    create() {
      this.cielo = this.add.graphics();
      this.sol = this.add.graphics();
      this.caminos = this.add.graphics();
      this.nubes = [];
      this.islas = [];

      for (let i = 0; i < 7; i++) this.nubes.push(this.crearNube());

      const ids = window.ORDEN_TERRITORIOS;
      ids.forEach((id, i) => this.islas.push(this.crearIsla(window.TERRITORIOS[id], i)));
      this.plaza = this.crearIsla({ nombre: 'Plaza Central', emoji: '🎪', color: '#ffd9e6' }, -1, true);

      this.acomodar(this.scale.width, this.scale.height);
      this.scale.on('resize', size => this.acomodar(size.width, size.height));
    }

    crearNube() {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.85);
      const w = Phaser.Math.Between(90, 170);
      g.fillEllipse(0, 0, w, w * 0.42);
      g.fillEllipse(-w * 0.28, 6, w * 0.6, w * 0.32);
      g.fillEllipse(w * 0.3, 8, w * 0.55, w * 0.3);
      g.velocidad = Phaser.Math.FloatBetween(6, 16);
      return g;
    }

    crearIsla(t, indice, esPlaza) {
      const c = this.add.container(0, 0);
      const tam = esPlaza ? 1.15 : 1;
      const sombra = this.add.ellipse(0, 70 * tam, 120 * tam, 22 * tam, 0x6f86b8, 0.16);
      const tierra = this.add.graphics();
      tierra.fillStyle(0xd9b48f, 1);
      tierra.fillTriangle(-62 * tam, 4, 62 * tam, 4, 0, 52 * tam);
      tierra.fillStyle(0xc49a72, 1);
      tierra.fillTriangle(-30 * tam, 4, 30 * tam, 4, 0, 52 * tam);
      const pasto = this.add.ellipse(0, 0, 140 * tam, 46 * tam, hex(t.color));
      pasto.setStrokeStyle(4, oscurecer(t.color, 0.82));
      const emoji = this.add.text(0, -22 * tam, t.emoji, {
        fontSize: Math.round(46 * tam) + 'px',
        fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
        resolution: Math.min(window.devicePixelRatio || 1, 2)
      }).setOrigin(0.5, 0.75);
      c.add([sombra, tierra, pasto, emoji]);
      c.datos = { indice, esPlaza, fase: Math.random() * Math.PI * 2 };
      return c;
    }

    acomodar(w, h) {
      // Cielo
      this.cielo.clear();
      this.cielo.fillGradientStyle(0xcfe6ff, 0xcfe6ff, 0xfff1dc, 0xfff1dc, 1);
      this.cielo.fillRect(0, 0, w, h);
      this.sol.clear();
      this.sol.fillStyle(0xffe9a8, 0.55); this.sol.fillCircle(w * 0.86, h * 0.14, 90);
      this.sol.fillStyle(0xfff3c7, 0.9); this.sol.fillCircle(w * 0.86, h * 0.14, 52);

      // Islas en óvalo alrededor de la plaza
      const cx = w / 2, cy = h * 0.54;
      const rx = Math.max(160, w * 0.40), ry = Math.max(140, h * 0.34);
      const escala = Phaser.Math.Clamp(Math.min(w, h) / 820, 0.55, 1.15);
      this.islas.forEach((isla, i) => {
        const ang = -Math.PI / 2 + (i / this.islas.length) * Math.PI * 2 + Math.PI / 6;
        isla.base = { x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry };
        isla.setPosition(isla.base.x, isla.base.y).setScale(escala);
      });
      this.plaza.base = { x: cx, y: cy };
      this.plaza.setPosition(cx, cy).setScale(escala);

      // Caminos punteados hacia la plaza
      this.caminos.clear();
      this.caminos.lineStyle(5, 0xffffff, 0.75);
      this.islas.forEach(isla => {
        const pasos = 14;
        for (let k = 1; k < pasos - 1; k += 2) {
          const a = k / pasos, b = (k + 1) / pasos;
          this.caminos.lineBetween(
            Phaser.Math.Linear(isla.base.x, cx, a), Phaser.Math.Linear(isla.base.y + 6, cy + 6, a),
            Phaser.Math.Linear(isla.base.x, cx, b), Phaser.Math.Linear(isla.base.y + 6, cy + 6, b));
        }
      });

      // Nubes repartidas
      this.nubes.forEach((n, i) => {
        n.x = (i / this.nubes.length) * (w + 200) - 100 + Phaser.Math.Between(-40, 40);
        n.y = Phaser.Math.Between(30, Math.max(60, h * 0.45));
      });
      this.ancho = w;
    }

    update(tiempo, delta) {
      if (SIN_MOVIMIENTO) return;
      const s = delta / 1000;
      this.nubes.forEach(n => {
        n.x += n.velocidad * s;
        if (n.x > this.ancho + 120) n.x = -120;
      });
      [...this.islas, this.plaza].forEach(isla => {
        if (!isla.base) return;
        isla.y = isla.base.y + Math.sin(tiempo / 1400 + isla.datos.fase) * 5;
      });
    }
  }

  window.iniciarFondo = function (idContenedor) {
    if (!window.Phaser) return null;
    return new Phaser.Game({
      type: Phaser.AUTO,
      parent: idContenedor,
      backgroundColor: '#cfe6ff',
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      scene: [EscenaFondo],
      banner: false,
      fps: { target: 30 }
    });
  };
})();
