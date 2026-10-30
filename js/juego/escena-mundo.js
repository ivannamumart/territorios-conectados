/* =========================================================================
   Territorios Conectados — El mapa del mundo
   Islas de los grupos alrededor de la Plaza Central, unidas por puentes.
   ========================================================================= */
(function () {
  'use strict';

  const M = window.MundoDatos;
  const { rotulo, emoji, hex, mezclar } = window.EscenaComun;

  const DECORACION = {
    ciudad_luz:     ['🏢', '🏬', '💡', '🚦', '🏢', '🛴'],
    puerto_mercado: ['📦', '⚓', '🦀', '📦', '🛒', '🐦'],
    valle_verde:    ['🌾', '🌻', '🌳', '🐄', '🥕', '🌾'],
    montana_alta:   ['🌲', '🪨', '🐐', '🌲', '🏔️', '🌲'],
    isla_sol:       ['🌴', '🐚', '🦩', '🌴', '☀️', '🥥'],
    pueblo_rio:     ['🌿', '🐟', '🏡', '🌿', '🦆', '🪷']
  };

  class EscenaMundo extends Phaser.Scene {
    constructor() { super('Mundo'); }

    init(datos) { this.llegada = datos && datos.llegada; }

    create() {
      this.mundo = Juego.mundo;
      this.cameras.main.setBackgroundColor('#bfe4f6');
      this.cameras.main.setBounds(0, 0, M.ANCHO, M.ALTO);
      this.dibujarAgua();
      // El suelo (puentes, plaza, islas) se dibuja una vez y se guarda como imagen
      this.suelo = this.make.graphics({ add: false });
      this.dibujarPuentes(this.suelo);
      this.dibujarPlaza(this.suelo);
      this.mundo.islas.forEach(i => this.dibujarIsla(i, this.suelo));
      this.hornearSuelo();
      this.mundo.edificios.forEach(e => this.dibujarEdificio(e));

      const j = Juego.estado.jugador;
      const ini = this.llegada || Juego.posicionInicial();
      this.yo = new Avatar(this, { id: j.id, nombre: j.nombre, avatar: j.avatar, grupo: Juego.estado.grupo.emoji, estado: j.estado, x: ini.x, y: ini.y }, 'yo');
      this.cameras.main.startFollow(this.yo.cont, true, 0.12, 0.12);
      this.cameras.main.centerOn(ini.x, ini.y);
      this.cameras.main.fadeIn(350, 207, 230, 255);

      this.teclas = EscenaComun.crearControles(this);
      this.gente = new EscenaComun.Gente(this);
      this.region = null;
      this.cerca = null;
      this.relojRegion = 0;
      this.input.on('gameobjectdown', (p, obj) => {
        if (p.event && p.event.target && p.event.target !== this.game.canvas) return;
        if (obj.edificio) this.intentarEntrar(obj.edificio);
      });

      Juego.alEntrarEscena(this, 'mundo', ini);
      this.events.once('shutdown', () => { Red.salir(); this.gente.vaciar(); });
    }

    // ------------------------------------------------------------- dibujo
    dibujarAgua() {
      if (!this.textures.exists('agua')) {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xbfe4f6, 1); g.fillRect(0, 0, 400, 400);
        g.lineStyle(4, 0xffffff, 0.35);
        const r = M.semilla(7);
        for (let k = 0; k < 9; k++) {
          const x = 30 + r() * 340, y = 30 + r() * 340, w = 22 + r() * 26;
          g.beginPath(); g.arc(x, y, w, Math.PI * 1.15, Math.PI * 1.85); g.strokePath();
        }
        g.generateTexture('agua', 400, 400); g.destroy();
      }
      this.add.tileSprite(0, 0, M.ANCHO, M.ALTO, 'agua').setOrigin(0).setDepth(-1000);
      const r = M.semilla(9);
      const deco = ['⛵', '🐠', '🐳', '🪸', '🦭', '⛵'];
      for (let k = 0; k < 18; k++) {
        const x = r() * M.ANCHO, y = r() * M.ALTO;
        if (this.mundo.caminable(x, y) || Math.hypot(x - M.CX, y - M.CY) < 600) continue;
        let cerca = false;
        for (const i of this.mundo.islas) { const c = M.centroIsla(i); if (Math.hypot(x - c.x, y - c.y) < M.ISLA_R + 90) cerca = true; }
        if (cerca) continue;
        emoji(this, x, y, deco[k % deco.length], 34).setAlpha(0.85).setDepth(-900);
      }
    }

    /** Pasa el dibujo del suelo a 4 imágenes (más rápido que redibujar en cada cuadro). */
    hornearSuelo() {
      const cw = M.ANCHO / 2, ch = M.ALTO / 2;
      for (let fx = 0; fx < 2; fx++) for (let fy = 0; fy < 2; fy++) {
        const rt = this.add.renderTexture(fx * cw, fy * ch, cw, ch).setOrigin(0).setDepth(-800);
        rt.draw(this.suelo, -fx * cw, -fy * ch);
      }
      this.suelo.destroy();
    }

    dibujarPuentes(g) {
      this.mundo.puentes.forEach(p => {
        const dx = p.x2 - p.x1, dy = p.y2 - p.y1, L = Math.hypot(dx, dy);
        const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, w = M.PUENTE_MEDIO;
        const ext = 40; // se mete un poco en la tierra
        const ax = p.x1 - ux * ext, ay = p.y1 - uy * ext, bx = p.x2 + ux * ext, by = p.y2 + uy * ext;
        g.fillStyle(0x9fcde6, 1);
        g.fillPoints([{ x: ax + nx * (w + 10), y: ay + ny * (w + 10) }, { x: bx + nx * (w + 10), y: by + ny * (w + 10) },
                      { x: bx - nx * (w + 10), y: by - ny * (w + 10) }, { x: ax - nx * (w + 10), y: ay - ny * (w + 10) }], true);
        g.fillStyle(0xe9c89d, 1);
        g.fillPoints([{ x: ax + nx * w, y: ay + ny * w }, { x: bx + nx * w, y: by + ny * w },
                      { x: bx - nx * w, y: by - ny * w }, { x: ax - nx * w, y: ay - ny * w }], true);
        g.lineStyle(3, 0xc9a173, 1);
        for (let t = 0; t < L + ext * 2; t += 26) {
          const cx = ax + ux * t, cy = ay + uy * t;
          g.lineBetween(cx + nx * w, cy + ny * w, cx - nx * w, cy - ny * w);
        }
        g.lineStyle(6, 0xb88a5a, 1);
        g.lineBetween(ax + nx * w, ay + ny * w, bx + nx * w, by + ny * w);
        g.lineBetween(ax - nx * w, ay - ny * w, bx - nx * w, by - ny * w);
      });
    }

    dibujarPlaza(g) {
      g.fillStyle(0xd7eef9, 1); g.fillCircle(M.CX, M.CY, M.PLAZA_R + 26);
      g.fillStyle(0xffe1ec, 1); g.fillCircle(M.CX, M.CY, M.PLAZA_R);
      g.lineStyle(3, 0xf6c5d6, 1);
      for (let r = 80; r < M.PLAZA_R; r += 70) g.strokeCircle(M.CX, M.CY, r);
      for (let a = 0; a < 16; a++) {
        const an = a * Math.PI / 8;
        g.lineBetween(M.CX + Math.cos(an) * 80, M.CY + Math.sin(an) * 80, M.CX + Math.cos(an) * (M.PLAZA_R - 6), M.CY + Math.sin(an) * (M.PLAZA_R - 6));
      }
      const f = this.mundo.fuente;
      g.fillStyle(0xffffff, 1); g.fillCircle(f.x, f.y, f.r + 8);
      g.fillStyle(0x8fd3f0, 1); g.fillCircle(f.x, f.y, f.r);
      emoji(this, f.x, f.y + 22, '⛲', 70).setDepth(f.y);
      rotulo(this, M.CX, M.CY + M.PLAZA_R + 42, '🤝 Plaza Central · aquí se comercia', 30).setDepth(5000);
      // Bancas y faroles
      [[-200, 120, '🪑'], [200, 120, '🪑'], [-150, 220, '🌳'], [150, 220, '🌳'], [-250, -40, '🏮'], [250, -40, '🏮']].forEach(([dx, dy, e]) => {
        emoji(this, M.CX + dx, M.CY + dy, e, 40).setDepth(M.CY + dy);
      });
    }

    dibujarIsla(i, g) {
      const grupo = Juego.grupoPorIsla(i);
      const terr = grupo && window.TERRITORIOS[grupo.territorio] || window.TERRITORIOS.ciudad_luz;
      const c = M.centroIsla(i);
      g.fillStyle(0xd7eef9, 1); g.fillCircle(c.x, c.y, M.ISLA_R + 28);
      g.fillStyle(0xf6e2bb, 1); g.fillCircle(c.x, c.y, M.ISLA_R);
      g.fillStyle(hex(terr.color), 1); g.fillCircle(c.x, c.y, M.ISLA_R - 30);
      g.fillStyle(mezclar(terr.color, '#ffffff', 0.35), 1);
      const r = M.semilla(i + 11);
      for (let k = 0; k < 26; k++) {
        const a = r() * Math.PI * 2, d = r() * (M.ISLA_R - 60);
        g.fillEllipse(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 26 + r() * 30, 12 + r() * 10);
      }
      // Pradito central donde está el Archivo
      g.fillStyle(mezclar(terr.color, '#ffffff', 0.55), 1); g.fillCircle(c.x, c.y, 120);
      if (grupo) {
        rotulo(this, c.x, c.y - M.ISLA_R - 34, grupo.emoji + ' ' + grupo.nombre, 30).setDepth(5000);
        rotulo(this, c.x, c.y - M.ISLA_R - 2, terr.emoji + ' ' + terr.nombre, 20, terr.tinta).setDepth(5000);
      }
      // Decoración según el territorio, lejos de edificios y del puente
      const deco = DECORACION[grupo ? grupo.territorio : 'ciudad_luz'];
      const edifs = this.mundo.edificios.filter(e => e.isla === i);
      const puente = this.mundo.puentes.find(p => p.isla === i);
      let puestos = 0, intentos = 0;
      while (puestos < 14 && intentos < 300) {
        intentos++;
        const a = r() * Math.PI * 2, d = 90 + r() * (M.ISLA_R - 140);
        const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
        if (edifs.some(e => x > e.rect.x1 - 40 && x < e.rect.x2 + 40 && y > e.rect.y1 - 40 && y < e.rect.y2 + 90)) continue;
        if (puente && M.distSegmento(x, y, puente) < M.PUENTE_MEDIO + 40) continue;
        if (Math.hypot(x - c.x, y - c.y) < 90) continue;
        emoji(this, x, y, deco[puestos % deco.length], 34 + r() * 10).setDepth(y);
        puestos++;
      }
    }

    texturaEdificio(lugar) {
      const clave = 'ed-' + lugar;
      if (this.textures.exists(clave)) return clave;
      const L = M.LUGARES[lugar];
      const w = M.EDIF_W, h = M.EDIF_H, W = w + 30, H = h + 50;
      const x = W / 2, top = 22, base = top + h;
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x40507a, 0.16); g.fillEllipse(x, base + 6, w + 20, 22);
      g.fillStyle(0xfffaf0, 1); g.fillRoundedRect(x - w / 2 + 8, top + 30, w - 16, base - top - 30, 12);
      g.lineStyle(3, 0xe2d4bd, 1); g.strokeRoundedRect(x - w / 2 + 8, top + 30, w - 16, base - top - 30, 12);
      g.fillStyle(hex(L.techo), 1);
      g.fillTriangle(x - w / 2 - 4, top + 38, x + w / 2 + 4, top + 38, x, top - 14);
      g.fillRoundedRect(x - w / 2 - 4, top + 26, w + 8, 16, 6);
      g.fillStyle(mezclar(L.techo, '#40507a', 0.35), 1);
      g.fillRoundedRect(x - 18, base - 44, 36, 44, { tl: 16, tr: 16, bl: 0, br: 0 });
      g.fillStyle(0xbfe4f6, 1);
      g.fillRoundedRect(x - w / 2 + 20, top + 50, 24, 20, 5); g.fillRoundedRect(x + w / 2 - 44, top + 50, 24, 20, 5);
      g.generateTexture(clave, W, H); g.destroy();
      return clave;
    }

    dibujarEdificio(e) {
      const L = M.LUGARES[e.lugar];
      const grupo = e.isla != null ? Juego.grupoPorIsla(e.isla) : null;
      const terr = grupo ? window.TERRITORIOS[grupo.territorio] : null;
      const x = e.x, y = e.y, w = M.EDIF_W, h = M.EDIF_H;
      const top = y - h * 0.62, base = y + h * 0.38;
      const NL = M.nombreLugar(e.lugar, grupo && grupo.territorio, grupo && Juego.parametrosTerritorio(grupo.territorio));
      this.add.image(x, top - 22, this.texturaEdificio(e.lugar)).setOrigin(0.5, 0).setDepth(base);
      emoji(this, x, top + 30, NL.emoji, 40).setDepth(base + 1);
      const nombre = this.add.text(x, base + 4, NL.nombre, {
        fontSize: '15px', fontFamily: 'Nunito, system-ui, sans-serif', fontStyle: '800', color: '#33405a',
        backgroundColor: '#fffaf0', padding: { x: 8, y: 2 }, resolution: RES_TEXTO
      }).setOrigin(0.5, 0).setDepth(base + 2);
      if (terr && e.lugar === 'consola') {
        const barras = '▂▄▆█'.slice(0, Math.max(1, terr.rasgos[0].nivel));
        this.add.text(x + w / 2 - 6, top - 6, barras, { fontSize: '16px', color: '#3d4b6b', fontStyle: '800', resolution: RES_TEXTO }).setOrigin(1, 0).setDepth(base + 2);
      }
      const zona = this.add.zone(x, y - 10, w, h + 30).setInteractive({ useHandCursor: true });
      zona.edificio = e;
      e._nombre = nombre;
    }

    // ------------------------------------------------------------- lógica
    intentarEntrar(e) {
      const d = Math.hypot(this.yo.x - e.puerta.x, this.yo.y - e.puerta.y);
      if (d > 110) { Juego.aviso('Acércate a la puerta para entrar.'); return; }
      Juego.entrarLugar(e, { x: this.yo.x, y: this.yo.y });
    }

    update(tiempo, delta) {
      const mov = EscenaComun.moverYo(this.yo, this.teclas, this.game.loop.rawDelta, this.mundo.caminable, tiempo);
      if (mov.recorrido) Juego.sumarDistancia(mov.recorrido);
      Juego.posicionActual = { x: this.yo.x, y: this.yo.y };
      if (Juego.movimientoMapa() !== 'apagado') Red.reportar(this.yo.x, this.yo.y, mov.vx, mov.vy);
      this.gente.actualizar(tiempo, this.mundo.caminable);

      // Zona del mapa (cada zona es un canal de tiempo real)
      if (tiempo - this.relojRegion > 600) {
        this.relojRegion = tiempo;
        const reg = this.mundo.region(this.yo.x, this.yo.y);
        if (reg !== this.region) {
          this.region = reg;
          this.gente.vaciar();
          if (Juego.movimientoMapa() !== 'apagado') Juego.unirseCanal('mundo-' + reg, this.gente, { x: this.yo.x, y: this.yo.y });
          else Red.salir();
        }
      }

      // ¿Hay una puerta cerca?
      let cerca = null, mejor = 85;
      for (const e of this.mundo.edificios) {
        const d = Math.hypot(this.yo.x - e.puerta.x, this.yo.y - e.puerta.y);
        if (d < mejor) { mejor = d; cerca = e; }
      }
      if (cerca !== this.cerca) {
        this.cerca = cerca;
        if (cerca) {
          const gr = cerca.isla != null ? Juego.grupoPorIsla(cerca.isla) : null;
          const NL = M.nombreLugar(cerca.lugar, gr && gr.territorio, gr && Juego.parametrosTerritorio(gr.territorio));
          Juego.prompt('Entrar a ' + NL.nombre + (gr ? ' de ' + gr.emoji + ' ' + gr.nombre : ''));
        } else Juego.prompt(null);
      }
      if (cerca && EscenaComun.usar(this.teclas)) Juego.entrarLugar(cerca, { x: this.yo.x, y: this.yo.y });
    }

    /** Ubicaciones para el minimapa. */
    posicionYo() { return { x: this.yo.x, y: this.yo.y }; }
  }

  window.EscenaMundo = EscenaMundo;
})();
