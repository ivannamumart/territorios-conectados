/* =========================================================================
   Territorios Conectados — Avatar (emoji con sombra y nombre encima)
   ========================================================================= */
(function () {
  'use strict';

  const FUENTE_EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const RES = Math.min(window.devicePixelRatio || 1, 2);

  class Avatar {
    /**
     * tipo: 'yo' | 'grupo' | 'otro'
     */
    constructor(escena, datos, tipo) {
      this.escena = escena;
      this.id = datos.id;
      this.tipo = tipo;
      this.datos = { ...datos };
      this.cont = escena.add.container(datos.x || 0, datos.y || 0);
      this.sombra = escena.add.ellipse(0, 2, 40, 13, 0x40507a, 0.22);
      this.cuerpo = escena.add.text(0, 4, datos.avatar || '🙂', {
        fontSize: '46px', fontFamily: FUENTE_EMOJI, resolution: RES
      }).setOrigin(0.5, 1);
      const colorFondo = tipo === 'yo' ? '#5b78f0' : tipo === 'grupo' ? '#3e9a68' : 'rgba(45,55,80,0.82)';
      this.etiqueta = escena.add.text(0, -54, this.textoEtiqueta(), {
        fontSize: '15px', fontFamily: 'Nunito, system-ui, sans-serif', fontStyle: '800',
        color: '#ffffff', backgroundColor: colorFondo, padding: { x: 8, y: 3 }, resolution: RES
      }).setOrigin(0.5, 1);
      this.globo = escena.add.text(0, -80, '', {
        fontSize: '26px', fontFamily: FUENTE_EMOJI, resolution: RES
      }).setOrigin(0.5, 1).setVisible(false);
      this.cont.add([this.sombra, this.cuerpo, this.etiqueta, this.globo]);
      this.cont.setDepth(this.cont.y);
      this.fase = Math.random() * 6;
      this.objetivo = null;         // para avatares remotos
      this.relojGlobo = null;
      this.setEstado(datos.estado || 'vivo');
    }

    textoEtiqueta() {
      return (this.datos.grupo ? this.datos.grupo + ' ' : '') + (this.datos.nombre || '');
    }

    get x() { return this.cont.x; }
    get y() { return this.cont.y; }

    setPosicion(x, y) { this.cont.setPosition(x, y); this.cont.setDepth(y); }

    setEstado(estado) {
      if (this.estadoAplicado === estado) return;   // sin cambios: no tocar el globo de gestos
      this.estadoAplicado = estado;
      this.datos.estado = estado;
      if (this.tweenAlerta) { this.tweenAlerta.stop(); this.tweenAlerta = null; }
      if (estado === 'fantasma') {
        this.cuerpo.setText('👻'); this.cont.setAlpha(0.6); this.globo.setVisible(false);
      } else {
        this.cuerpo.setText(this.datos.avatar || '🙂'); this.cont.setAlpha(1);
        if (estado === 'rescate') {
          this.globo.setText('🆘').setVisible(true);
          this.tweenAlerta = this.escena.tweens.add({ targets: this.globo, scale: 1.25, yoyo: true, repeat: -1, duration: 500 });
        } else {
          this.globo.setVisible(false).setScale(1);
        }
      }
    }

    mostrarEmote(e) {
      if (this.datos.estado === 'rescate') return;
      clearTimeout(this.relojGlobo);
      this.globo.setText(e).setVisible(true).setScale(0.4);
      this.escena.tweens.add({ targets: this.globo, scale: 1, duration: 200, ease: 'Back.Out' });
      this.relojGlobo = setTimeout(() => { if (this.datos.estado !== 'rescate') this.globo.setVisible(false); }, 2600);
    }

    /** Animación de pasos (un saltito suave). */
    pasos(moviendo, tiempo) {
      if (moviendo) {
        this.cuerpo.y = 4 - Math.abs(Math.sin(tiempo / 110 + this.fase)) * 6;
        this.sombra.scaleX = 0.9 + Math.abs(Math.cos(tiempo / 110 + this.fase)) * 0.12;
      } else {
        this.cuerpo.y = 4 + Math.sin(tiempo / 700 + this.fase) * 1.5;
        this.sombra.scaleX = 1;
      }
      if (this.datos.estado === 'fantasma') this.cuerpo.y -= 6 + Math.sin(tiempo / 500) * 4;
    }

    /** Para avatares de otras personas: nuevo dato de movimiento. */
    recibir(p) {
      const ahora = performance.now();
      if (!this.objetivo || Math.hypot(p.x - this.x, p.y - this.y) > 400) this.setPosicion(p.x, p.y);
      this.objetivo = { x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0, t: ahora };
    }

    actualizarRemoto(tiempo, caminable) {
      if (!this.objetivo) { this.pasos(false, tiempo); return; }
      const o = this.objetivo;
      const dt = Math.min((performance.now() - o.t) / 1000, 3);
      let px = o.x + o.vx * dt, py = o.y + o.vy * dt;
      if (caminable && !caminable(px, py)) { px = this.x; py = this.y; }
      const nx = this.x + (px - this.x) * 0.22, ny = this.y + (py - this.y) * 0.22;
      const moviendo = Math.hypot(nx - this.x, ny - this.y) > 0.6;
      this.setPosicion(nx, ny);
      this.pasos(moviendo, tiempo);
    }

    destruir() {
      clearTimeout(this.relojGlobo);
      if (this.tweenAlerta) this.tweenAlerta.stop();
      this.cont.destroy();
    }
  }

  window.Avatar = Avatar;
  window.FUENTE_EMOJI = FUENTE_EMOJI;
  window.RES_TEXTO = RES;
})();
