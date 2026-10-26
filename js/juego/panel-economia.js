/* =========================================================================
   Territorios Conectados — Mercado, Antena (megas y señal) y Plaza (ofertas)
   ========================================================================= */
(function () {
  'use strict';

  const { el, RECURSOS, conBoton, mensajeLocal, selectorRecurso, valorRadio } = Paneles.util;
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- Mercado
  Paneles.registrar('mercado', {
    icono: '🧺', titulo: ctx => 'Mercado · ' + ctx.grupoLugar.emoji + ' ' + ctx.grupoLugar.nombre, ancho: true,
    render(cuerpo, ctx, panel) {
      const g = ctx.grupoLugar;
      const t = window.TERRITORIOS[g.territorio];
      cuerpo.appendChild(el('p', { text: 'Cada territorio tiene sus precios. Lo que aquí es barato, en otra isla puede ser caro: viajar y comerciar vale la pena.' }));
      const tendencia = el('p', { class: 'tendencia', hidden: true });
      cuerpo.appendChild(tendencia);
      const tarjetas = el('div', { class: 'puestos' });
      cuerpo.appendChild(tarjetas);
      let precios = null;

      ['energia', 'comida'].forEach(r => {
        const id = 'cant-' + r;
        const card = el('div', { class: 'puesto' },
          el('div', { class: 'puesto-cabeza' }, el('span', { class: 'ico', text: RECURSOS[r].icono }), el('h3', { text: RECURSOS[r].nombre })),
          el('p', { class: 'precio', 'data-r': r, text: '…' }),
          el('div', { class: 'campo' }, el('label', { for: id, text: 'Cantidad' }), el('input', { id, type: 'number', min: 1, max: 100, value: 10 })),
          el('div', { class: 'fila-botones' },
            el('button', { class: 'boton', 'data-op': 'comprar', 'data-r': r }, 'Comprar'),
            el('button', { class: 'boton sol', 'data-op': 'vender', 'data-r': r }, 'Vender')));
        tarjetas.appendChild(card);
      });
      tarjetas.querySelectorAll('button[data-op]').forEach(b => b.addEventListener('click', () => conBoton(b, '…', async () => {
        const r = b.dataset.r;
        const res = await Juego.accion('mercado', { p_lugar_grupo: g.id, p_operacion: b.dataset.op, p_recurso: r, p_cantidad: parseInt($('cant-' + r).value, 10) });
        if (res) mensajeLocal(cuerpo, res.mensaje, 'ok');
        cargar();
      })));
      cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Vendes al 60% del precio de compra. La energía y la comida llegan hasta 100.' }));

      async function cargar() {
        try { precios = await Servidor.accion('ver_lugar', { p_lugar_grupo: g.id }); } catch (e) { return; }
        ['energia', 'comida'].forEach(r => {
          tarjetas.querySelector('.precio[data-r="' + r + '"]').textContent =
            'Compra: ' + precios.comprar[r] + ' 🪙 c/u  ·  Venta: ' + precios.vender[r] + ' 🪙 c/u';
        });
        if (Number(precios.factor) !== 1) {
          tendencia.hidden = false;
          const f = Number(precios.factor);
          tendencia.textContent = (f > 1 ? '📈 Hoy los precios están altos' : '📉 Hoy los precios están bajos') + ' (×' + f.toFixed(2) + '). En ' + t.nombre + ' suben y bajan con el tiempo.';
        }
      }
      cargar();
      const reloj = setInterval(cargar, 8000);
      panel.limpiar.push(() => clearInterval(reloj));
    }
  });

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

  // ---------------------------------------------------------------- Antena: megas
  Paneles.registrar('megas', {
    icono: '📶', titulo: ctx => 'Recargar megas · ' + ctx.grupoLugar.emoji + ' ' + ctx.grupoLugar.nombre,
    render(cuerpo, ctx) {
      const g = ctx.grupoLugar;
      const precio = el('p', { class: 'grande-texto', text: 'Cargando precios…' });
      cuerpo.appendChild(precio);
      const fila = el('div', { class: 'fila-botones paquetes' });
      [1, 3, 5].forEach(n => {
        const b = el('button', { class: 'boton' }, n + (n === 1 ? ' paquete' : ' paquetes') + ' (' + (n * 10) + ' megas)');
        b.addEventListener('click', () => conBoton(b, '…', async () => {
          const r = await Juego.accion('comprar_megas', { p_lugar_grupo: g.id, p_paquetes: n });
          if (r) mensajeLocal(cuerpo, r.mensaje, 'ok');
        }));
        fila.appendChild(b);
      });
      cuerpo.appendChild(fila);
      Servidor.accion('ver_lugar', { p_lugar_grupo: g.id }).then(p => {
        precio.textContent = 'Aquí cada paquete de 10 megas cuesta ' + p.paquete_megas.precio + ' monedas.';
      }).catch(e => { precio.textContent = e.message; });
      cuerpo.appendChild(el('h3', { text: '¿Cuánto cuesta en cada territorio?' }));
      cuerpo.appendChild(tablaComparativa([
        { titulo: '10 megas', valor: (p, t, c) => Math.max(1, Math.round(p.precio_megas * c.mult_precios)) + ' 🪙' },
        { titulo: 'Cada KB consultado', valor: (p, t, c) => (p.mult_megas * c.mult_megas).toFixed(1) + ' megas' }
      ]));
      cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Compra donde estés. Si caminas a otra isla, paga sus precios (y caminar gasta energía).' }));
    }
  });

  // ---------------------------------------------------------------- Antena: señal
  Paneles.registrar('senal', {
    icono: '📡', titulo: ctx => 'Estado de la señal · ' + ctx.grupoLugar.emoji + ' ' + ctx.grupoLugar.nombre, ancho: true,
    render(cuerpo, ctx) {
      const t = window.TERRITORIOS[ctx.grupoLugar.territorio];
      const n = t.rasgos[0].nivel;
      cuerpo.appendChild(el('div', { class: 'senal-grande' },
        el('span', { class: 'senal-mini grande' }, ...[1, 2, 3, 4].map(k => el('i', { class: k <= n ? 'on' : '' }))),
        el('div', {}, el('h3', { text: t.rasgos[0].nota }), el('p', { text: t.emoji + ' ' + t.nombre + ': ' + t.lema }))));
      cuerpo.appendChild(el('p', { text: 'Así se conecta cada territorio al Archivo. Compárenlo: ¿quién puede investigar más con los mismos megas?' }));
      cuerpo.appendChild(tablaComparativa([
        { titulo: 'Conexión', valor: (p, tt) => tt.rasgos[0].nota },
        { titulo: 'Cada KB', valor: (p, tt, c) => (p.mult_megas * c.mult_megas).toFixed(1) + ' megas' },
        { titulo: 'Espera', valor: p => '~' + p.retardo + ' s' },
        { titulo: 'Cortes', valor: p => Math.round(p.corte * 100) + '%' },
        { titulo: 'Visitantes', valor: p => p.entrada_archivo + ' 🪙' }
      ]));
      cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Puedes usar el Archivo de otra isla pagando la entrada de visitante, como en un café internet.' }));
    }
  });

  // ---------------------------------------------------------------- Plaza: tablero de ofertas
  Paneles.registrar('tablero', {
    icono: '📋', titulo: ctx => 'Tablero de ofertas · ' + ctx.grupoLugar.emoji + ' ' + ctx.grupoLugar.nombre, ancho: true,
    render(cuerpo, ctx, panel) {
      const g = ctx.grupoLugar;
      const yo = Juego.yoId();
      const lista = el('div', { class: 'lista-ofertas' }, el('p', { text: 'Cargando ofertas…' }));
      const ofertas = new Map();

      function pintar() {
        lista.innerHTML = '';
        const abiertas = [...ofertas.values()].filter(o => o.estado === 'abierta').sort((a, b) => b.id - a.id);
        if (!abiertas.length) { lista.appendChild(el('p', { class: 'subtitulo', text: 'No hay ofertas en esta plaza. ¡Publica la primera!' })); return; }
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
          const filas = await Servidor.leer('ofertas', '*', ['lugar_grupo', g.id], q => q.eq('estado', 'abierta').order('id', { ascending: false }).limit(40));
          ofertas.clear(); filas.forEach(o => ofertas.set(o.id, o));
          pintar();
        } catch (e) { lista.innerHTML = ''; lista.appendChild(el('p', { class: 'error-campo', text: e.message })); }
      }
      cargar();
      panel.limpiar.push(Servidor.escuchar({
        tabla: 'ofertas', filtro: 'lugar_grupo=eq.' + g.id, cadaSegundos: 15,
        alCambiar: c => { if (!c) return cargar(); if (c.nuevo && c.nuevo.id) { ofertas.set(c.nuevo.id, c.nuevo); pintar(); } }
      }));

      // Formulario
      const mensaje = el('input', { id: 'oferta-mensaje', maxlength: 140, placeholder: 'Ej.: Tengo comida de sobra, necesito megas' });
      const proteccion = Teclado.proteger(mensaje, { alBloquear: t => Juego.aviso(t, 'error') });

      const publicar = el('button', { class: 'boton grande' }, 'Publicar oferta');
      const form = el('div', { class: 'bloque form-oferta' },
        el('h3', { text: 'Publicar una oferta' }),
        el('div', { class: 'columnas' },
          el('div', {}, el('p', { class: 'rotulo-campo', text: 'Ofrezco' }), selectorRecurso('oferta-da', null, 'comida'),
            el('div', { class: 'campo' }, el('label', { for: 'oferta-da-cant', text: 'Cantidad que doy' }), el('input', { id: 'oferta-da-cant', type: 'number', min: 1, value: 10 }))),
          el('div', {}, el('p', { class: 'rotulo-campo', text: 'Pido' }), selectorRecurso('oferta-pide', null, 'datos'),
            el('div', { class: 'campo' }, el('label', { for: 'oferta-pide-cant', text: 'Cantidad que pido' }), el('input', { id: 'oferta-pide-cant', type: 'number', min: 1, value: 20 })))),
        el('div', { class: 'campo' }, el('label', { for: 'oferta-mensaje', text: 'Mensaje (opcional, escrito a mano)' }), mensaje),
        el('p', { class: 'subtitulo', text: 'Lo que ofreces queda guardado mientras la oferta esté abierta. Si la cancelas, te lo devuelven. Máximo 3 ofertas abiertas.' }),
        publicar);
      publicar.addEventListener('click', () => conBoton(publicar, 'Publicando…', async () => {
        const r = await Juego.accion('ofertar', {
          p_lugar_grupo: g.id, p_da_recurso: valorRadio(form, 'oferta-da'), p_da_cant: parseInt($('oferta-da-cant').value, 10),
          p_pide_recurso: valorRadio(form, 'oferta-pide'), p_pide_cant: parseInt($('oferta-pide-cant').value, 10),
          p_mensaje: mensaje.value, p_metricas: proteccion.metricas()
        });
        if (r) { mensaje.value = ''; proteccion.reiniciar(); cargar(); }
      }));

      cuerpo.appendChild(el('p', { text: 'Aquí se hacen tratos con quienes visitan esta plaza. Para aceptar una oferta tienes que estar aquí.' }));
      cuerpo.appendChild(lista);
      cuerpo.appendChild(form);
    }
  });
})();
