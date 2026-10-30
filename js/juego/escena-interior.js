/* =========================================================================
   Territorios Conectados — Interiores (cada lugar al que se entra)
   ========================================================================= */
(function () {
  'use strict';

  const { rotulo, emoji, hex, mezclar } = window.EscenaComun;
  const W = 1000, H = 700, PARED = 150, PUERTA = { x: 500, y: 676 };

  /** Estaciones (cosas con las que se interactúa) de cada lugar. */
  function estaciones(lugar, grupo, esMio) {
    const params = grupo ? Juego.parametrosTerritorio(grupo.territorio) : null;
    const prod = params && params.producto;
    const lista = [];
    const add = (id, x, y, e, nombre, accion) => lista.push({ id, x, y, emoji: e, nombre, accion });
    if (lugar === 'archivo') {
      if (esMio) {
        add('texto', 500, 300, '📜', 'El texto del grupo', 'Llenar los huecos');
        add('oportunidad', 250, 470, '🎟️', 'Armar oportunidad', 'Cambiar 3 productos por una oportunidad');
        add('grupo', 760, 470, '🪑', 'Mesa del grupo', 'Ver mi grupo');
      } else add('visita', 500, 300, '🔒', 'Texto de otro grupo', 'Ver de quién es este Archivo');
    } else if (lugar === 'pistas') {
      if (esMio) add('pistas', 500, 290, '🔎', 'Tablero de pistas', 'Leer las pistas');
      else add('visita', 500, 290, '🔒', 'Pistas de otro grupo', 'Ver de quién son estas pistas');
      add('ayuda', 760, 450, '📖', 'Hoja de ayuda', 'Leer la hoja de ayuda');
    } else if (lugar === 'consola') {
      add('consola', 500, 290, '💻', 'Consola de la API', 'Escribir una consulta');
      add('ayuda', 240, 400, '📖', 'Hoja de ayuda', 'Leer la hoja de ayuda');
      add('historial', 760, 400, '🗂️', 'Mis consultas', 'Ver mis consultas');
      add('senal', 760, 560, '📡', 'Señal de cada isla', 'Comparar la conexión');
    } else if (lugar === 'campo') {
      if (esMio && prod) add('recolectar', 500, 300, prod.icono, prod.lugar, 'Recolectar ' + prod.nombre.toLowerCase());
      else if (prod) add('visita', 500, 300, prod.icono, prod.lugar + ' de otro grupo', 'Ver de quién es');
      add('ayudar', 260, 480, '🎁', 'Dar a alguien', 'Enviar energía o productos');
    } else if (lugar === 'salon') {
      add('tablero', 500, 280, '📋', 'Tablero de ofertas', 'Ver y publicar ofertas');
      add('ayudar', 240, 480, '🎁', 'Dar a alguien aquí', 'Enviar energía o productos');
      add('salon', 760, 480, '🏆', 'Cómo van los grupos', 'Ver el avance de todos');
    }
    return lista;
  }

  const DECO = {
    archivo: [['📚', 120, 150], ['📚', 210, 150], ['📚', 790, 150], ['📚', 880, 150], ['🪴', 120, 600], ['🗄️', 880, 600]],
    pistas:  [['🗺️', 140, 240], ['🧭', 860, 240], ['🔦', 140, 580], ['🗝️', 300, 560], ['🪴', 880, 600]],
    consola: [['🔌', 140, 240], ['📻', 860, 240], ['🛰️', 500, 120], ['🔋', 140, 580], ['💡', 400, 600]],
    campo:   [['🌳', 130, 240], ['🌳', 870, 240], ['🧺', 760, 300], ['🌷', 140, 600], ['🌾', 860, 600], ['🐝', 640, 180]],
    salon:   [['🎈', 130, 140], ['🎈', 870, 140], ['🎉', 300, 120], ['🎉', 700, 120], ['🧺', 130, 300], ['📦', 870, 300]]
  };

  class EscenaInterior extends Phaser.Scene {
    constructor() { super('Interior'); }

    init(datos) {
      this.edificio = datos.edificio;
      this.lugar = datos.edificio.lugar;
      this.grupoLugar = datos.edificio.isla != null ? Juego.grupoPorIsla(datos.edificio.isla) : null;
      this.esMio = this.grupoLugar && this.grupoLugar.id === Juego.estado.grupo.id;
      this.escenaId = this.lugar === 'salon' ? 'salon' : this.grupoLugar.id + ':' + this.lugar;
    }

    create() {
      const terr = this.grupoLugar ? window.TERRITORIOS[this.grupoLugar.territorio] : { color: '#ffd9e6', tinta: '#a0446c', emoji: '🤝', nombre: 'Plaza Central' };
      const L = window.MundoDatos.LUGARES[this.lugar];
      const NL = window.MundoDatos.nombreLugar(this.lugar, this.grupoLugar && this.grupoLugar.territorio, this.grupoLugar && Juego.parametrosTerritorio(this.grupoLugar.territorio));
      this.cameras.main.setBackgroundColor('#33405a');
      this.cameras.main.setBounds(-200, -120, W + 400, H + 240);

      const g = this.make.graphics({ add: false });
      // Piso
      g.fillStyle(mezclar(terr.color, '#ffffff', 0.62), 1); g.fillRoundedRect(0, 0, W, H, 30);
      g.fillStyle(mezclar(terr.color, '#ffffff', 0.45), 1);
      for (let x = 0; x < W; x += 80) for (let y = PARED; y < H; y += 80) if (((x + y) / 80) % 2 === 0) g.fillRect(x, y, 80, 80);
      // Pared
      g.fillStyle(hex(L.techo), 1); g.fillRoundedRect(0, 0, W, PARED, { tl: 30, tr: 30, bl: 0, br: 0 });
      g.fillStyle(mezclar(L.techo, '#ffffff', 0.35), 1);
      for (let x = 30; x < W; x += 60) g.fillRect(x, 20, 26, PARED - 40);
      g.fillStyle(mezclar(L.techo, '#40507a', 0.25), 1); g.fillRect(0, PARED - 12, W, 12);
      // Puerta de salida
      g.fillStyle(mezclar(L.techo, '#40507a', 0.4), 1); g.fillRoundedRect(PUERTA.x - 60, H - 34, 120, 34, { tl: 14, tr: 14, bl: 0, br: 0 });
      const clave = 'sala-' + this.lugar + '-' + (this.grupoLugar ? this.grupoLugar.territorio : 'plaza');
      if (!this.textures.exists(clave)) g.generateTexture(clave, W, H);
      g.destroy();
      this.add.image(0, 0, clave).setOrigin(0).setDepth(-1000);
      rotulo(this, PUERTA.x, H + 26, '⬇ Salir', 20).setDepth(5000);
      // Título del lugar
      const titulo = NL.emoji + ' ' + NL.nombre + (this.grupoLugar ? ' · ' + this.grupoLugar.emoji + ' ' + this.grupoLugar.nombre : '');
      rotulo(this, W / 2, 44, titulo, 30).setDepth(5000);
      if (this.grupoLugar) rotulo(this, W / 2, 86, terr.emoji + ' ' + terr.nombre + (this.esMio ? ' · tu territorio' : ' · estás de visita'), 18, terr.tinta).setDepth(5000);

      (DECO[this.lugar] || []).forEach(([e, x, y]) => emoji(this, x, y, e, 46).setDepth(y));
      if (this.lugar === 'consola' && this.grupoLugar) this.dibujarSenal(terr);

      // Estaciones
      this.estaciones = estaciones(this.lugar, this.grupoLugar, this.esMio);
      this.estaciones.forEach(s => {
        const sg = this.add.graphics().setDepth(s.y - 30);
        sg.fillStyle(0xffffff, 0.75); sg.fillEllipse(s.x, s.y - 6, 120, 44);
        sg.lineStyle(3, hex(L.techo), 1); sg.strokeEllipse(s.x, s.y - 6, 120, 44);
        s.obj = emoji(this, s.x, s.y, s.emoji, 60).setDepth(s.y).setInteractive({ useHandCursor: true });
        s.obj.on('pointerdown', p => { if (p.event && p.event.target && p.event.target !== this.game.canvas) return; this.usarEstacion(s, true); });
        this.add.text(s.x, s.y + 22, s.nombre, {
          fontSize: '15px', fontFamily: 'Nunito, system-ui, sans-serif', fontStyle: '800', color: '#33405a',
          backgroundColor: '#ffffff', padding: { x: 8, y: 2 }, resolution: RES_TEXTO
        }).setOrigin(0.5, 0).setDepth(s.y + 1);
        this.tweens.add({ targets: s.obj, y: s.y - 6, yoyo: true, repeat: -1, duration: 1400 + Math.random() * 400, ease: 'Sine.InOut' });
      });

      const j = Juego.estado.jugador;
      this.yo = new Avatar(this, { id: j.id, nombre: j.nombre, avatar: j.avatar, grupo: Juego.estado.grupo.emoji, estado: j.estado, x: PUERTA.x, y: H - 90 }, 'yo');
      this.cameras.main.startFollow(this.yo.cont, true, 0.15, 0.15);
      this.cameras.main.fadeIn(300, 51, 64, 90);
      this.teclas = EscenaComun.crearControles(this);
      this.gente = new EscenaComun.Gente(this);
      this.cerca = null;
      this.listoParaSalir = false;
      this.ajustarZoom();
      this.scale.on('resize', this.ajustarZoom, this);
      this.events.once('shutdown', () => { this.scale.off('resize', this.ajustarZoom, this); Red.salir(); this.gente.vaciar(); });

      Juego.alEntrarEscena(this, this.escenaId, { x: PUERTA.x, y: H - 90 });
      Juego.unirseCanal(this.escenaId, this.gente, { x: PUERTA.x, y: H - 90 });
    }

    ajustarZoom() {
      const z = Math.min(1, this.scale.width / (W + 120), this.scale.height / (H + 160));
      this.cameras.main.setZoom(Math.max(0.55, z));
    }

    dibujarSenal(terr) {
      const n = terr.rasgos[0].nivel;
      const x = 900, y = 70;
      const g = this.add.graphics().setDepth(5000);
      for (let k = 0; k < 4; k++) {
        g.fillStyle(k < n ? 0x33405a : 0xffffff, k < n ? 1 : 0.6);
        g.fillRoundedRect(x + k * 14, y - 8 - k * 8, 10, 12 + k * 8, 3);
      }
      rotulo(this, x + 26, y + 26, 'Señal', 14);
    }

    caminable(x, y) {
      if (x < 34 || x > W - 34 || y < PARED + 20 || y > H - 20) {
        return y > H - 40 && y <= H + 10 && Math.abs(x - PUERTA.x) < 54; // puerta
      }
      for (const s of this.estaciones) if (Math.hypot(x - s.x, (y - s.y) * 1.6) < 52) return false;
      return true;
    }

    usarEstacion(s, conClick) {
      if (conClick && Math.hypot(this.yo.x - s.x, this.yo.y - s.y) > 140) { Juego.aviso('Acércate un poco más.'); return; }
      Juego.usarEstacion(s.id, this.grupoLugar, this.lugar);
    }

    update(tiempo, delta) {
      const mov = EscenaComun.moverYo(this.yo, this.teclas, this.game.loop.rawDelta, (x, y) => this.caminable(x, y), tiempo);
      if (mov.recorrido) Juego.sumarDistancia(mov.recorrido);
      Red.reportar(this.yo.x, this.yo.y, mov.vx, mov.vy);
      this.gente.actualizar(tiempo, (x, y) => this.caminable(x, y));

      if (this.yo.y < H - 70) this.listoParaSalir = true;
      if (this.listoParaSalir && this.yo.y > H - 32) { this.listoParaSalir = false; Juego.salirLugar(); return; }

      let cerca = null, mejor = 110;
      for (const s of this.estaciones) {
        const d = Math.hypot(this.yo.x - s.x, this.yo.y - s.y);
        if (d < mejor) { mejor = d; cerca = s; }
      }
      const cercaPuerta = Math.hypot(this.yo.x - PUERTA.x, this.yo.y - (H - 40)) < 70;
      const clave = cerca ? cerca.id : (cercaPuerta ? 'puerta' : null);
      if (clave !== this.cerca) {
        this.cerca = clave;
        Juego.prompt(cerca ? cerca.accion : (cercaPuerta ? 'Salir al mapa' : null));
      }
      if (EscenaComun.usar(this.teclas)) {
        if (cerca) this.usarEstacion(cerca, false);
        else if (cercaPuerta) Juego.salirLugar();
      }
    }
  }

  window.EscenaInterior = EscenaInterior;
})();
