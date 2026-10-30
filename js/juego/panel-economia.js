/* =========================================================================
   Territorios Conectados — Señal de cada isla y tablero de ofertas del Mercado Central
   ========================================================================= */
(function () {
  'use strict';

  const { el, RECURSOS, conBoton, mensajeLocal, selectorRecurso, valorRadio } = Paneles.util;
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- Comparación entre territorios
  function tablaComparativa(columnas) {
    const cfg = Juego.estado.config;
    const tabla = el('table', { class: 'tabla-ayuda comparativa' });
    tabla.appendChild(el('tr', {}, el('th', { text: 'Territorio' }), ...columnas.map(c => el('th', { text: c.titulo }))));
    window.ORDEN_TERRITORIOS.forEach(id => {
      const t = window.TERRITORIOS[id], p = Juego.parametrosTerritorio(id);
      const mio = Juego.estado.grupo.territorio === id;
      tabla.appendChild(el('tr', { class: mio ? 'mio' : '' }, el('td', { text: t.emoji + ' ' + t.nombre }), ...columnas.map(c => el('td', { text: c.valor(p, t, cfg) }))));
    });
    return tabla;
  }

  // ---------------------------------------------------------------- Antena: señal
  Paneles.registrar('senal', {
    icono: '📡', titulo: ctx => 'La señal de cada isla · ' + ctx.grupoLugar.emoji + ' ' + ctx.grupoLugar.nombre, ancho: true,
    render(cuerpo, ctx) {
      const t = window.TERRITORIOS[ctx.grupoLugar.territorio];
      const n = t.rasgos[0].nivel;
      cuerpo.appendChild(el('div', { class: 'senal-grande' },
        el('span', { class: 'senal-mini grande' }, ...[1, 2, 3, 4].map(k => el('i', { class: k <= n ? 'on' : '' }))),
        el('div', {}, el('h3', { text: t.rasgos[0].nota }), el('p', { text: t.emoji + ' ' + t.nombre + ': ' + t.lema }))));
      cuerpo.appendChild(el('p', { text: 'Así se conecta cada territorio a la API. Compárenlo: ¿quién puede investigar más con la misma energía?' }));
      cuerpo.appendChild(tablaComparativa([
        { titulo: 'Conexión', valor: (p, tt) => tt.rasgos[0].nota },
        { titulo: 'Cada KB', valor: (p, tt, c) => '⚡' + (p.mult_megas * c.mult_megas).toFixed(1) },
        { titulo: 'Recarga', valor: (p, tt, c) => '⚡' + (p.recarga * c.mult_desgaste).toFixed(1) + '/min' },
        { titulo: 'Espera', valor: p => '~' + p.retardo + ' s' },
        { titulo: 'Cortes', valor: p => Math.round(p.corte * 100) + '%' },
        { titulo: 'Produce', valor: p => p.producto ? p.producto.icono + ' ' + p.producto.nombre : '' }
      ]));
      cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Puedes usar la Consola de otra isla pagando una entrada de energía, como en un café internet.' }));
    }
  });

  // ---------------------------------------------------------------- Plaza: tablero de ofertas
  Paneles.registrar('tablero', {
    icono: '📋', titulo: 'Tablero de ofertas · Mercado Central', ancho: true,
    render(cuerpo, ctx, panel) {
      const yo = Juego.yoId();
      const lista = el('div', { class: 'lista-ofertas' }, el('p', { text: 'Cargando ofertas…' }));
      const ofertas = new Map();

      function pintar() {
        lista.innerHTML = '';
        const abiertas = [...ofertas.values()].filter(o => o.estado === 'abierta').sort((a, b) => b.id - a.id);
        if (!abiertas.length) { lista.appendChild(el('p', { class: 'subtitulo', text: 'No hay ofertas todavía. ¡Publica la primera!' })); return; }
        abiertas.forEach(o => {
          const mia = o.autor_id === yo;
          const b = el('button', { class: 'boton ' + (mia ? 'suave' : 'sol') }, mia ? 'Cancelar' : 'Aceptar trato');
          b.addEventListener('click', () => conBoton(b, '…', async () => {
            const r = await Juego.accion(mia ? 'cancelar_oferta' : 'aceptar_oferta', { p_oferta: o.id });
            if (r) { o.estado = mia ? 'cancelada' : 'aceptada'; pintar(); }
          }));
          lista.appendChild(el('div', { class: 'oferta' + (mia ? ' mia' : '') },
            el('span', { class: 'cara', text: o.autor_avatar }),
            el('div', { class: 'detalle' },
              el('b', { text: o.autor_nombre + (mia ? ' (tú)' : '') }),
              el('p', { class: 'trato' },
                'Ofrece ', el('strong', { text: o.da_cant + ' ' + RECURSOS[o.da_recurso].icono + ' ' + RECURSOS[o.da_recurso].nombre.toLowerCase() }),
                ' · pide ', el('strong', { text: o.pide_cant + ' ' + RECURSOS[o.pide_recurso].icono + ' ' + RECURSOS[o.pide_recurso].nombre.toLowerCase() })),
              o.mensaje ? el('p', { class: 'mensaje-oferta', text: '«' + o.mensaje + '»' }) : null),
            b));
        });
      }

      async function cargar() {
        try {
          const filas = await Servidor.leer('ofertas', '*', null, q => q.is('lugar_grupo', null).eq('estado', 'abierta').order('id', { ascending: false }).limit(60));
          ofertas.clear(); filas.forEach(o => ofertas.set(o.id, o));
          pintar();
        } catch (e) { lista.innerHTML = ''; lista.appendChild(el('p', { class: 'error-campo', text: e.message })); }
      }
      cargar();
      panel.limpiar.push(Servidor.escuchar({
        tabla: 'ofertas', cadaSegundos: 15,
        alCambiar: c => { if (!c) return cargar(); if (c.nuevo && c.nuevo.id && c.nuevo.lugar_grupo == null) { ofertas.set(c.nuevo.id, c.nuevo); pintar(); } }
      }));

      // Formulario
      const p0 = Juego.parametrosTerritorio(Juego.estado.grupo.territorio).producto;
      const miProducto = p0 ? p0.id : 'energia';
      const mensaje = el('input', { id: 'oferta-mensaje', maxlength: 140, placeholder: 'Ej.: Tengo café de sobra, necesito cocos' });
      const proteccion = Teclado.proteger(mensaje, { alBloquear: t => Juego.aviso(t, 'error') });

      const publicar = el('button', { class: 'boton grande' }, 'Publicar oferta');
      const form = el('div', { class: 'bloque form-oferta' },
        el('h3', { text: 'Publicar una oferta' }),
        el('div', { class: 'columnas' },
          el('div', {}, el('p', { class: 'rotulo-campo', text: 'Ofrezco' }), selectorRecurso('oferta-da', null, miProducto),
            el('div', { class: 'campo' }, el('label', { for: 'oferta-da-cant', text: 'Cantidad que doy' }), el('input', { id: 'oferta-da-cant', type: 'number', min: 1, value: 1 }))),
          el('div', {}, el('p', { class: 'rotulo-campo', text: 'Pido' }), selectorRecurso('oferta-pide', null, 'energia'),
            el('div', { class: 'campo' }, el('label', { for: 'oferta-pide-cant', text: 'Cantidad que pido' }), el('input', { id: 'oferta-pide-cant', type: 'number', min: 1, value: 1 })))),
        el('div', { class: 'campo' }, el('label', { for: 'oferta-mensaje', text: 'Mensaje (opcional, escrito a mano)' }), mensaje),
        el('p', { class: 'subtitulo', text: 'Lo que ofreces queda guardado mientras la oferta esté abierta. Si la cancelas, te lo devuelven. Máximo 3 ofertas abiertas.' }),
        publicar);
      publicar.addEventListener('click', () => conBoton(publicar, 'Publicando…', async () => {
        const r = await Juego.accion('ofertar', {
          p_da_recurso: valorRadio(form, 'oferta-da'), p_da_cant: parseInt($('oferta-da-cant').value, 10),
          p_pide_recurso: valorRadio(form, 'oferta-pide'), p_pide_cant: parseInt($('oferta-pide-cant').value, 10),
          p_mensaje: mensaje.value, p_metricas: proteccion.metricas()
        });
        if (r) { mensaje.value = ''; proteccion.reiniciar(); cargar(); }
      }));

      cuerpo.appendChild(el('p', { text: 'Aquí comercian todos los grupos. Cambia el producto de tu isla por los de otras: con 3 productos distintos armas una oportunidad 🎟️ en tu Archivo. Para aceptar una oferta tienes que estar aquí.' }));
      cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Tienes: ' + Paneles.util.textoBolsa(Juego.recursos().energia, Juego.recursos().bolsa) }));
      cuerpo.appendChild(lista);
      cuerpo.appendChild(form);
    }
  });
})();
