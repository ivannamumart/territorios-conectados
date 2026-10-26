/* =========================================================================
   Territorios Conectados — Interiores (cada lugar al que se entra)
   ========================================================================= */
(function () {
  'use strict';

  const { rotulo, emoji, hex, mezclar } = window.EscenaComun;
  const W = 1000, H = 700, PARED = 150, PUERTA = { x: 500, y: 676 };

  /** Estaciones (cosas con las que se interactúa) de cada lugar. */
  function estaciones(lugar, grupo, esMio) {
    const terr = grupo ? window.TERRITORIOS[grupo.territorio] : null;
    const params = grupo ? Juego.parametrosTerritorio(grupo.territorio) : null;
    const trabajo = params && params.trabajo;
    const lista = [];
    const add = (id, x, y, e, nombre, accion) => lista.push({ id, x, y, emoji: e, nombre, accion });
    if (lugar === 'casa') {
      add('grupo', 280, 300, '🪑', 'Mesa del grupo', 'Ver mi grupo');
      add('ayudar', 500, 470, '📮', 'Buzón de ayudas', 'Enviar recursos');
      if (esMio && trabajo && trabajo.lugar === 'casa') add('trabajo', 720, 300, trabajo.icono, trabajo.nombre, trabajo.tipo === 'cultivo' ? 'Sembrar o cosechar' : 'Trabajar');
      if (esMio && params && params.fondo_comun) add('fondo', 500, 250, '🏺', 'Fondo común', 'Abrir el fondo');
    } else if (lugar === 'archivo') {
      add('consola', 500, 290, '🖥️', 'Consola de la API', 'Escribir una consulta');
      add('misiones', 240, 330, '📜', 'Tablero de misiones', 'Ver misiones');
      add('ayuda', 760, 330, '📖', 'Hoja de ayuda', 'Leer la hoja de ayuda');
      add('historial', 760, 520, '🗂️', 'Mis consultas', 'Ver mis consultas');
    } else if (lugar === 'mercado') {
      add('mercado', 500, 300, '🧺', 'Puesto del mercado', 'Comprar o vender');
      if (esMio && trabajo && trabajo.lugar === 'mercado') add('trabajo', 770, 330, trabajo.icono, trabajo.nombre, 'Trabajar');
      add('ayudar', 230, 470, '🎁', 'Dar a alguien aquí', 'Enviar recursos');
    } else if (lugar === 'plaza') {
      add('tablero', 500, 280, '📋', 'Tablero de ofertas', 'Ver y publicar ofertas');
      add('ayudar', 260, 470, '🎁', 'Dar a alguien aquí', 'Enviar recursos');
    } else if (lugar === 'antena') {
      add('megas', 380, 300, '📶', 'Recargar megas', 'Comprar megas');
      add('senal', 640, 300, '📡', 'Estado de la señal', 'Ver la conexión');
      if (esMio && trabajo && trabajo.lugar === 'antena') add('trabajo', 780, 500, trabajo.icono, trabajo.nombre, 'Trabajar');
    } else if (lugar === 'salon') {
      add('salon', 500, 280, '📣', 'Tablero central', 'Ver el estado del juego');
      add('ayudar', 760, 470, '🎁', 'Dar a alguien aquí', 'Enviar recursos');
    }
    return lista;
  }

  const DECO = {
    casa:    [['🛋️', 130, 230], ['🖼️', 380, 120], ['🪴', 880, 230], ['🖼️', 640, 120], ['🧸', 860, 560], ['🪴', 140, 590]],
    archivo: [['📚', 120, 150], ['📚', 210, 150], ['📚', 790, 150], ['📚', 880, 150], ['🪴', 120, 600], ['🗄️', 300, 560]],
    mercado: [['🍎', 140, 240], ['🥕', 230, 240], ['🧀', 780, 240], ['🍌', 870, 240], ['📦', 860, 600], ['🧺', 140, 600]],
    plaza:   [['🌳', 130, 240], ['🌳', 870, 240], ['🪑', 760, 500], ['⛲', 500, 560], ['🌷', 140, 600], ['🌷', 860, 600]],
    antena:  [['🔌', 140, 240], ['📻', 860, 240], ['🛰️', 500, 120], ['🔋', 140, 580], ['💡', 860, 580]],
    salon:   [['🎈', 130, 140], ['🎈', 870, 140], ['🎉', 300, 120], ['🎉', 700, 120], ['🪑', 240, 560], ['🪑', 760, 300]]
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
      const terr = this.grupoLugar ? window.TERRITORIOS[this.grupoLugar.territorio] : { color: '#ffd9e6', tinta: '#a0446c', emoji: '🎪', nombre: 'Plaza Central' };
      const L = window.MundoDatos.LUGARES[this.lugar];
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
      const titulo = L.emoji + ' ' + L.nombre + (this.grupoLugar ? ' · ' + this.grupoLugar.emoji + ' ' + this.grupoLugar.nombre : '');
      rotulo(this, W / 2, 44, titulo, 30).setDepth(5000);
      if (this.grupoLugar) rotulo(this, W / 2, 86, terr.emoji + ' ' + terr.nombre + (this.esMio ? ' · tu territorio' : ' · estás de visita'), 18, terr.tinta).setDepth(5000);

      (DECO[this.lugar] || []).forEach(([e, x, y]) => emoji(this, x, y, e, 46).setDepth(y));
      if (this.lugar === 'archivo' && this.grupoLugar) this.dibujarSenal(terr);

      // Estaciones
      this.estaciones = estaciones(this.lugar, this.grupoLugar, this.esMio);
      this.estaciones.forEach(s => {
        const sg = this.add.graphics().setDepth(s.y - 30);
        sg.fillStyle(0xffffff, 0.75); sg.fillEllipse(s.x, s.y - 6, 120, 44);
        sg.lineStyle(3, hex(L.techo), 1); sg.strokeEllipse(s.x, s.y - 6, 120, 44);
        s.obj = emoji(this, s.x, s.y, s.emoji, 60).setDepth(s.y).setInteractive({ useHandCursor: true });
        s.obj.on('pointerdown', () => this.usarEstacion(s, true));
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
