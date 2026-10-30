/* =========================================================================
   Territorios Conectados — Paneles (ventanas de cada lugar)
   Aquí: el administrador de paneles y los paneles del grupo, trabajo,
   ayudas, fondo común, salón y avisos.
   ========================================================================= */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const RECURSOS = {
    energia: { icono: '⚡', nombre: 'Energía' },
    flores:  { icono: '🌸', nombre: 'Flores' },
    sal:     { icono: '🧂', nombre: 'Sal' },
    maiz:    { icono: '🌽', nombre: 'Maíz' },
    cafe:    { icono: '☕', nombre: 'Café' },
    cocos:   { icono: '🥥', nombre: 'Cocos' },
    pescado: { icono: '🐟', nombre: 'Pescado' }
  };
  const PRODUCTOS = ['flores', 'sal', 'maiz', 'cafe', 'cocos', 'pescado'];
  /** Texto corto con la energía y los productos de alguien. */
  function textoBolsa(energia, bolsa) {
    const b = bolsa || {};
    return '⚡' + Math.round(energia) + ' ' + PRODUCTOS.filter(k => Number(b[k]) > 0).map(k => RECURSOS[k].icono + b[k]).join(' ');
  }

  /** Crea elementos sin usar innerHTML con datos de otras personas. */
  function el(tag, props, ...hijos) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    hijos.flat().forEach(h => { if (h == null || h === false) return; e.appendChild(typeof h === 'string' || typeof h === 'number' ? document.createTextNode(String(h)) : h); });
    return e;
  }

  const fmt = s => {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  // ------------------------------------------------------------------ administrador
  const registro = {};
  let actual = null;

  function registrar(id, def) { registro[id] = def; }

  function iniciar() {
    $('panel-cerrar').addEventListener('click', cerrar);
    $('panel-capa').addEventListener('mousedown', e => { if (e.target.id === 'panel-capa') cerrar(); });
  }

  function abrir(id, ctx) {
    const def = registro[id];
    if (!def) return;
    cerrar();
    const cuerpo = $('panel-cuerpo');
    cuerpo.innerHTML = '';
    $('panel-icono').textContent = def.icono || '';
    $('panel-titulo').textContent = typeof def.titulo === 'function' ? def.titulo(ctx || {}) : def.titulo;
    $('panel').className = 'panel ' + (def.ancho ? 'ancho' : '');
    $('panel-capa').hidden = false;
    actual = { id, ctx: ctx || {}, def, cuerpo, limpiar: [] };
    HUD.prompt(null);
    try { def.render(cuerpo, actual.ctx, actual); }
    catch (e) { cuerpo.appendChild(el('p', { class: 'error-campo', text: 'No se pudo abrir: ' + e.message })); }
    // En celulares no se enfoca nada solo (el teclado tapaba la pantalla)
    if (!document.body.classList.contains('modo-tactil')) {
      setTimeout(() => {
        const f = cuerpo.querySelector('textarea, input:not([type=hidden]):not([type=range]), select, button');
        if (f) f.focus();
      }, 50);
    }
  }

  function cerrar() {
    if (actual) actual.limpiar.forEach(f => { try { f(); } catch (e) { /* nada */ } });
    actual = null;
    if (document.activeElement && $('panel-capa').contains(document.activeElement)) document.activeElement.blur();
    $('panel-capa').hidden = true;
    const cv = document.querySelector('#juego canvas');
    if (cv) cv.focus && cv.focus();
  }

  function refrescar(id) {
    if (actual && actual.id === id && actual.def.refrescar) actual.def.refrescar(actual);
  }

  // ------------------------------------------------------------------ piezas comunes
  function tarjetaTerritorio(idT) {
    const t = window.TERRITORIOS[idT];
    const caja = el('div', { class: 'territorio-tarjeta', style: 'background:' + t.color });
    caja.appendChild(el('div', { class: 'arriba' },
      el('span', { class: 'emoji', text: t.emoji }),
      el('div', {}, el('h3', { text: t.nombre }), el('p', { class: 'lema', text: t.lema }))));
    const rasgos = el('div', { class: 'rasgos' });
    t.rasgos.forEach(r => {
      const pts = el('span', { class: 'puntos', role: 'img', 'aria-label': r.nivel + ' de 4' });
      for (let k = 1; k <= 4; k++) pts.appendChild(el('i', { class: k <= r.nivel ? 'lleno' : '' }));
      rasgos.appendChild(el('div', { class: 'rasgo' }, el('span', { class: 'ico', text: r.icono }), el('b', { text: r.nombre }), pts, el('span', { class: 'nota', text: r.nota })));
    });
    caja.appendChild(rasgos);
    caja.appendChild(el('p', { class: 'especial', text: '✨ ' + t.especial }));
    return caja;
  }

  function selectorRecurso(nombre, opciones, valor) {
    const grupo = el('div', { class: 'chips-recurso', role: 'radiogroup' });
    (opciones || Object.keys(RECURSOS)).forEach(r => {
      const id = nombre + '-' + r;
      grupo.appendChild(el('label', { class: 'chip-recurso', for: id },
        el('input', { type: 'radio', name: nombre, id, value: r, checked: r === valor }),
        el('span', { text: RECURSOS[r].icono + ' ' + RECURSOS[r].nombre })));
    });
    return grupo;
  }
  const valorRadio = (raiz, nombre) => { const r = raiz.querySelector('input[name="' + nombre + '"]:checked'); return r ? r.value : null; };

  function campoNumero(id, etiqueta, valor, max) {
    return el('div', { class: 'campo' }, el('label', { for: id, text: etiqueta }),
      el('input', { id, type: 'number', min: 1, max: max || 9999, step: 1, value: valor || 10, inputmode: 'numeric' }));
  }

  function conBoton(boton, texto, fn) {
    const original = boton.textContent;
    boton.disabled = true; boton.textContent = texto;
    return Promise.resolve().then(fn).catch(() => {}).finally(() => { boton.disabled = false; boton.textContent = original; });
  }

  function mensajeLocal(cuerpo, texto, tipo) {
    let m = cuerpo.querySelector('.mensaje-panel');
    if (!m) { m = el('p', { class: 'mensaje-panel' }); cuerpo.appendChild(m); }
    m.className = 'mensaje-panel ' + (tipo || '');
    m.textContent = texto;
  }

  // ------------------------------------------------------------------ Mi grupo
  registrar('grupo', {
    icono: '👥', titulo: 'Mi grupo', ancho: true,
    render(cuerpo, ctx, panel) {
      panel.pintar = async () => {
        const e = Juego.estado, g = e.grupo;
        cuerpo.innerHTML = '';
        const cab = el('div', { class: 'cabeza-grupo' },
          el('div', { class: 'quien' }, el('span', { class: 'emoji', text: g.emoji }), el('div', {}, el('h3', { class: 'grande', text: g.nombre }))),
          el('div', { class: 'caja-codigo' }, el('span', { class: 'rotulo', text: 'Código del grupo' }),
            el('div', { class: 'fila' }, el('span', { class: 'codigo-grande', id: 'p-codigo', text: g.codigo || '' }),
              el('button', { class: 'boton suave', onclick: async () => {
                try { await navigator.clipboard.writeText(g.codigo); Juego.aviso('Código copiado: ' + g.codigo, 'ok'); }
                catch (err) { const r = document.createRange(); r.selectNodeContents($('p-codigo')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); Juego.aviso('Código seleccionado: presiona Ctrl + C.'); }
              } }, 'Copiar'))));
        cuerpo.appendChild(cab);

        const miembros = [...Juego.miembros.values()].sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
        let enLinea = new Set();
        try {
          const act = await Servidor.leer('actividad', 'jugador_id, visto_en, escena', null, q => q.in('jugador_id', miembros.map(m => m.id)));
          const lim = Juego.ahoraServidor() - 3 * 60 * 1000;
          enLinea = new Set(act.filter(a => Date.parse(a.visto_en) > lim).map(a => a.jugador_id));
        } catch (err) { /* sin datos de conexión */ }
        enLinea.add(Juego.yoId());

        const lista = el('div', { class: 'integrantes' });
        miembros.forEach(m => {
          const yo = m.id === Juego.yoId();
          const rec = yo ? Juego.recursos() : m;
          lista.appendChild(el('div', { class: 'integrante' + (yo ? ' yo' : '') + (enLinea.has(m.id) ? ' en-linea' : '') + ' ' + m.estado },
            el('span', { class: 'punto', title: enLinea.has(m.id) ? 'En línea' : 'Desconectado' }),
            el('span', { class: 'cara', text: m.avatar }),
            el('span', { class: 'nom', text: m.nombre + (yo ? ' (tú)' : '') }),
            el('span', { class: 'mini-recursos', text: textoBolsa(rec.energia, rec.bolsa) + ' · 📜' + (m.huecos_ok || 0) }),
            !yo ? el('button', { class: 'boton mini sol', onclick: () => abrir('ayudar', { para: m.id }) }, 'Enviar') : null));
        });
        const cols = el('div', { class: 'columnas' },
          el('div', { class: 'bloque' }, el('h3', { text: 'Integrantes' }), lista),
          tarjetaTerritorio(g.territorio));
        cuerpo.appendChild(cols);


        const mundo = el('div', { class: 'mundo' });
        Juego.grupos.slice().sort((a, b) => (a.isla || 0) - (b.isla || 0)).forEach(o => {
          const t = window.TERRITORIOS[o.territorio];
          mundo.appendChild(el('div', { class: 'isla-grupo' + (o.id === g.id ? ' mio' : ''), style: 'border-left-color:' + t.color },
            el('span', { class: 'emoji', text: o.emoji }), el('b', { text: o.nombre }), el('small', { text: t.emoji + ' ' + t.nombre })));
        });
        cuerpo.appendChild(el('div', { class: 'bloque' }, el('h3', { text: 'El mundo' }), mundo));

        const confirmar = el('div', { class: 'confirmar', hidden: true },
          el('p', {}, el('b', { text: '¿Seguro que quieres salir de este computador? ' }), 'Para volver necesitas tu nombre y el código ', el('b', { text: g.codigo }), '.'),
          el('div', { class: 'fila-botones' },
            el('button', { class: 'boton suave', onclick: () => { confirmar.hidden = true; } }, 'Cancelar'),
            el('button', { class: 'boton coral', onclick: () => Juego.salir() }, 'Sí, salir')));
        cuerpo.appendChild(el('div', { class: 'fila-botones' },
          el('button', { class: 'enlace', onclick: () => { confirmar.hidden = false; } }, 'Salir de este computador'),
          el('span', { class: 'subtitulo', text: 'Atajos: M texto · G grupo · H ayuda · 1–6 gestos' })));
        cuerpo.appendChild(confirmar);
      };
      panel.pintar();
    },
    refrescar(panel) { if (panel.pintar && !panel.cuerpo.querySelector('.confirmar:not([hidden])')) panel.pintar(); }
  });

  // ------------------------------------------------------------------ Enviar recursos
  registrar('ayudar', {
    icono: '🎁', titulo: 'Enviar recursos',
    render(cuerpo, ctx) {
      const yo = Juego.yoId();
      const params = Juego.parametrosTerritorio(Juego.estado.grupo.territorio);
      const candidatos = new Map();
      Juego.miembros.forEach(m => { if (m.id !== yo) candidatos.set(m.id, { ...m, grupo: true }); });
      Red.presentes().forEach(p => { if (p.id !== yo && !candidatos.has(p.id)) candidatos.set(p.id, { ...p, grupo: false }); });
      if (!candidatos.size) {
        cuerpo.appendChild(el('p', { text: 'No hay a quién enviar. Puedes enviar a las personas de tu grupo desde cualquier lugar, o a personas de otros grupos que estén en el mismo lugar que tú.' }));
        return;
      }
      const lista = el('div', { class: 'lista-personas', role: 'radiogroup' });
      [...candidatos.values()].sort((a, b) => b.grupo - a.grupo).forEach((p, i) => {
        const id = 'para-' + p.id;
        lista.appendChild(el('label', { class: 'persona', for: id },
          el('input', { type: 'radio', name: 'para', id, value: p.id, checked: ctx.para ? ctx.para === p.id : i === 0 }),
          el('span', { class: 'cara', text: p.avatar }),
          el('span', {}, el('b', { text: p.nombre }), el('small', { text: p.grupo ? 'Tu grupo' : 'Está aquí' }))));
      });
      cuerpo.appendChild(el('h3', { text: '¿A quién?' }));
      cuerpo.appendChild(lista);
      cuerpo.appendChild(el('h3', { text: '¿Qué le envías?' }));
      cuerpo.appendChild(selectorRecurso('rec-dar', null, 'energia'));
      cuerpo.appendChild(campoNumero('cant-dar', 'Cantidad', 1));
      cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Tienes: ' + textoBolsa(Juego.recursos().energia, Juego.recursos().bolsa) }));
      cuerpo.appendChild(el('p', { class: 'subtitulo', text: params.envio_gratis ? '🫶 En tu territorio enviar energía no pierde nada.' : '📦 Los productos llegan completos. La energía pierde 10% en el camino: si mandas 10, llegan 9.' }));
      const b = el('button', { class: 'boton grande' }, 'Enviar');
      b.addEventListener('click', () => conBoton(b, 'Enviando…', async () => {
        const r = await Juego.accion('dar', { p_para: valorRadio(cuerpo, 'para'), p_recurso: valorRadio(cuerpo, 'rec-dar'), p_cantidad: parseInt($('cant-dar').value, 10) });
        if (r) { mensajeLocal(cuerpo, r.mensaje, 'ok'); Juego.cargarMiembros().catch(() => {}); }
      }));
      cuerpo.appendChild(b);
    }
  });

  // ------------------------------------------------------------------ Recolectar (campo de la isla)
  registrar('recolectar', {
    icono: '🌱', titulo: () => {
      const p = Juego.parametrosTerritorio(Juego.estado.grupo.territorio).producto;
      return p ? p.lugar_icono + ' ' + p.lugar : 'Recolectar';
    },
    render(cuerpo, ctx, panel) {
      const p = Juego.parametrosTerritorio(Juego.estado.grupo.territorio).producto;
      cuerpo.appendChild(el('p', { class: 'grande-texto', text: 'Tu isla produce ' + p.icono + ' ' + p.nombre.toLowerCase() + '. Cada vez que recolectas ganas ' + p.por_vez + ' y gastas ' + p.cuesta + ' de energía. Puedes repetirlo cada ' + p.espera_seg + ' segundos de juego.' }));
      cuerpo.appendChild(el('p', { text: 'Para ganar una oportunidad 🎟️ necesitas productos de 3 islas distintas: el tuyo y dos más. Cámbialos con otros grupos en el Mercado Central (en la Plaza del centro).' }));
      const estado = el('p', { class: 'estado-trabajo' });
      const b = el('button', { class: 'boton grande' }, p.icono + ' Recolectar');
      cuerpo.appendChild(estado);
      cuerpo.appendChild(b);
      function pintar() {
        const j = Juego.estado.jugador, seg = Juego.segJuego();
        const listo = j.ultimo_recolecto_seg == null ? 0 : Number(j.ultimo_recolecto_seg) + Number(p.espera_seg);
        const tengo = (Juego.recursos().bolsa || {})[p.id] || 0;
        if (Juego.estado.reloj.estado !== 'corriendo') { estado.textContent = 'El juego no está corriendo.'; b.disabled = true; return; }
        if (seg < listo) { estado.textContent = '⏳ Creciendo… faltan ' + fmt(listo - seg) + ' de juego. Tienes ' + tengo + ' ' + p.icono + '.'; b.disabled = true; }
        else { estado.textContent = '✅ Listo para recolectar. Tienes ' + tengo + ' ' + p.icono + '.'; b.disabled = false; }
      }
      pintar();
      const reloj = setInterval(pintar, 1000);
      panel.limpiar.push(() => clearInterval(reloj));
      b.addEventListener('click', () => conBoton(b, 'Recolectando…', async () => {
        const r = await Juego.accion('recolectar', {});
        if (r) mensajeLocal(cuerpo, r.mensaje, 'ok');
      }).then(pintar));
    }
  });

  // ------------------------------------------------------------------ Armar una oportunidad
  registrar('oportunidad', {
    icono: '🎟️', titulo: 'Armar una oportunidad',
    render(cuerpo, ctx, panel) {
      cuerpo.appendChild(el('p', { class: 'grande-texto', text: 'Una oportunidad 🎟️ = 1 producto de 3 islas distintas.' }));
      cuerpo.appendChild(el('p', { text: 'Las oportunidades son de todo el grupo: sirven para probar palabras en el texto. Elige 3 productos distintos de tu bolsa.' }));
      const caja = el('div', { class: 'elegir-productos' });
      const nota = el('p', { class: 'subtitulo' });
      const b = el('button', { class: 'boton grande' }, '🎟️ Armar oportunidad');
      cuerpo.append(caja, nota, b);
      const elegidos = new Set();
      function pintar() {
        const bolsa = Juego.recursos().bolsa || {};
        caja.innerHTML = '';
        PRODUCTOS.forEach(k => {
          const n = Number(bolsa[k]) || 0;
          if (!n) elegidos.delete(k);
          const t = el('button', { class: 'ficha-producto' + (elegidos.has(k) ? ' elegido' : ''), disabled: n < 1, 'aria-pressed': elegidos.has(k) ? 'true' : 'false' },
            el('span', { class: 'ico', text: RECURSOS[k].icono }), el('b', { text: RECURSOS[k].nombre }), el('small', { text: 'Tienes ' + n }));
          t.addEventListener('click', () => {
            if (elegidos.has(k)) elegidos.delete(k);
            else if (elegidos.size < 3) elegidos.add(k);
            pintar();
          });
          caja.appendChild(t);
        });
        const distintos = PRODUCTOS.filter(k => Number(bolsa[k]) > 0).length;
        nota.textContent = elegidos.size === 3 ? 'Listo: ' + [...elegidos].map(k => RECURSOS[k].icono).join(' + ') + ' = 🎟️'
          : distintos < 3 ? 'Tienes productos de ' + distintos + (distintos === 1 ? ' isla' : ' islas') + '. Consigue los que faltan en el Mercado Central.'
          : 'Elige ' + (3 - elegidos.size) + ' más.';
        b.disabled = elegidos.size !== 3;
      }
      pintar();
      b.addEventListener('click', () => conBoton(b, 'Armando…', async () => {
        const r = await Juego.accion('armar_oportunidad', { p_productos: [...elegidos] });
        if (r) { elegidos.clear(); mensajeLocal(cuerpo, r.mensaje, 'ok'); }
      }).then(pintar));
      panel.pintar = pintar;
    },
    refrescar(panel) { if (panel.pintar) panel.pintar(); }
  });

  // ------------------------------------------------------------------ Lugar de otro grupo
  registrar('visita', {
    icono: '🔒', titulo: 'Estás de visita',
    render(cuerpo, ctx) {
      const g = ctx.grupoLugar;
      cuerpo.appendChild(el('p', { class: 'grande-texto', text: 'Este lugar es de ' + g.emoji + ' ' + g.nombre + '.' }));
      cuerpo.appendChild(el('p', { text: 'Cada grupo tiene su propio texto, sus pistas y su producto. Puedes usar la Consola de otra isla (pagando la entrada de visitante) y comerciar en el Mercado Central.' }));
    }
  });

  // ------------------------------------------------------------------ Salón de Reunión
  registrar('salon', {
    icono: '📣', titulo: 'Tablero central', ancho: true,
    render(cuerpo, ctx, panel) {
      async function pintar() {
        const e = Juego.estado;
        cuerpo.innerHTML = '';
        const estados = { espera: '⏳ El juego aún no empieza.', corriendo: '▶ El juego está corriendo.', pausado: '⏸ El juego está en pausa.', terminado: '🏁 El juego terminó.' };
        cuerpo.appendChild(el('p', { class: 'grande-texto', text: estados[e.reloj.estado] }));
        if ((e.config.anuncio || '').trim()) cuerpo.appendChild(el('div', { class: 'anuncio-grande' }, el('b', { text: '📣 La profe dice: ' }), e.config.anuncio));
        cuerpo.appendChild(el('h3', { text: '🏆 Cuántos huecos ha llenado cada grupo' }));
        try {
          const rk = await Servidor.rpc('ranking_vivo');
          const tabla = el('div', { class: 'ranking' });
          rk.sort((a, b) => b.resueltos - a.resueltos).forEach((g, i) => {
            const t = window.TERRITORIOS[g.territorio];
            tabla.appendChild(el('div', { class: 'fila-ranking' + (g.nombre === e.grupo.nombre ? ' mio' : '') },
              el('span', { class: 'pos', text: ['🥇', '🥈', '🥉'][i] || String(i + 1) }),
              el('span', { class: 'emoji', text: g.emoji }),
              el('span', { class: 'nom' }, el('b', { text: g.nombre }), el('small', { text: t.emoji + ' ' + t.nombre + ' · 🎟️ ' + g.oportunidades + (g.completo ? ' · 🏆 ¡texto completo!' : '') })),
              el('span', { class: 'puntos-ranking', text: g.resueltos + '/18' })));
          });
          cuerpo.appendChild(tabla);
          cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Gana el grupo que complete su texto primero. Cada grupo tiene un texto distinto sobre la historia del internet en Colombia.' }));
        } catch (err) { cuerpo.appendChild(el('p', { class: 'error-campo', text: err.message })); }
        if (e.reloj.estado === 'terminado') cuerpo.appendChild(el('a', { class: 'boton grande', href: 'final.html' }, '🏁 Ver resultados finales'));
      }
      pintar();
      const reloj = setInterval(pintar, 20000);
      panel.limpiar.push(() => clearInterval(reloj));
    }
  });

  // ------------------------------------------------------------------ Historial de avisos
  registrar('avisos', {
    icono: '🔔', titulo: 'Avisos',
    render(cuerpo) {
      HUD.limpiarContador();
      const h = HUD.historial();
      if (!h.length) { cuerpo.appendChild(el('p', { text: 'Aún no tienes avisos.' })); return; }
      const lista = el('ul', { class: 'lista-avisos' });
      h.forEach(a => lista.appendChild(el('li', {}, el('small', { text: a.hora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) }), ' ', a.texto)));
      cuerpo.appendChild(lista);
    }
  });

  window.Paneles = {
    iniciar, registrar, abrir, cerrar, refrescar,
    abierto: () => !!actual,
    util: { el, RECURSOS, PRODUCTOS, textoBolsa, fmt, tarjetaTerritorio, selectorRecurso, valorRadio, campoNumero, conBoton, mensajeLocal }
  };
})();
