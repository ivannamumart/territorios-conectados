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
    comida:  { icono: '🍎', nombre: 'Comida' },
    datos:   { icono: '📶', nombre: 'Megas' },
    monedas: { icono: '🪙', nombre: 'Monedas' }
  };

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
    setTimeout(() => {
      const f = cuerpo.querySelector('textarea, input:not([type=hidden]):not([type=range]), select, button');
      if (f) f.focus();
    }, 50);
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
            el('span', { class: 'cara', text: m.estado === 'fantasma' ? '👻' : m.avatar }),
            el('span', { class: 'nom', text: m.nombre + (yo ? ' (tú)' : '') }),
            el('span', { class: 'mini-recursos', text: '⚡' + Math.round(rec.energia) + ' 🍎' + Math.round(rec.comida) + ' 📶' + rec.datos + ' 🪙' + rec.monedas }),
            m.estado === 'rescate' ? el('span', { class: 'etiqueta rescate', text: '🆘 En rescate' }) : null,
            m.estado === 'fantasma' ? el('span', { class: 'etiqueta fantasma', text: 'Fantasma' }) : null,
            !yo && m.estado !== 'fantasma' ? el('button', { class: 'boton mini sol', onclick: () => abrir('ayudar', { para: m.id }) }, 'Enviar') : null));
        });
        const cols = el('div', { class: 'columnas' },
          el('div', { class: 'bloque' }, el('h3', { text: 'Integrantes' }), lista),
          tarjetaTerritorio(g.territorio));
        cuerpo.appendChild(cols);

        const params = Juego.parametrosTerritorio(g.territorio);
        if (params.fondo_comun) {
          const f = g.fondo || {};
          cuerpo.appendChild(el('div', { class: 'bloque' }, el('h3', { text: '🏺 Fondo común de la cooperativa' }),
            el('p', { text: '⚡ ' + (f.energia || 0) + '  ·  🍎 ' + (f.comida || 0) + '  ·  📶 ' + (f.datos || 0) + '  ·  🪙 ' + (f.monedas || 0) }),
            el('p', { class: 'subtitulo', text: 'Se usa en la Casa Común de tu isla.' })));
        }

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
          el('span', { class: 'subtitulo', text: 'Atajos: M misiones · G grupo · H ayuda · 1–6 gestos' })));
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
      Juego.miembros.forEach(m => { if (m.id !== yo && m.estado !== 'fantasma') candidatos.set(m.id, { ...m, grupo: true }); });
      Red.presentes().forEach(p => { if (p.id !== yo && !candidatos.has(p.id) && p.estado !== 'fantasma') candidatos.set(p.id, { ...p, grupo: false }); });
      if (!candidatos.size) {
        cuerpo.appendChild(el('p', { text: 'No hay a quién enviar. Puedes enviar a las personas de tu grupo desde cualquier lugar, o a personas de otros grupos que estén en el mismo lugar que tú.' }));
        return;
      }
      const lista = el('div', { class: 'lista-personas', role: 'radiogroup' });
      [...candidatos.values()].sort((a, b) => (b.estado === 'rescate') - (a.estado === 'rescate')).forEach((p, i) => {
        const id = 'para-' + p.id;
        lista.appendChild(el('label', { class: 'persona' + (p.estado === 'rescate' ? ' rescate' : ''), for: id },
          el('input', { type: 'radio', name: 'para', id, value: p.id, checked: ctx.para ? ctx.para === p.id : i === 0 }),
          el('span', { class: 'cara', text: p.avatar }),
          el('span', {}, el('b', { text: p.nombre }), el('small', { text: (p.grupo ? 'Tu grupo' : 'Está aquí') + (p.estado === 'rescate' ? ' · 🆘 necesita ayuda' : '') }))));
      });
      cuerpo.appendChild(el('h3', { text: '¿A quién?' }));
      cuerpo.appendChild(lista);
      cuerpo.appendChild(el('h3', { text: '¿Qué le envías?' }));
      cuerpo.appendChild(selectorRecurso('rec-dar', null, 'comida'));
      cuerpo.appendChild(campoNumero('cant-dar', 'Cantidad', 10));
      cuerpo.appendChild(el('p', { class: 'subtitulo', text: params.envio_gratis ? '🫶 En tu territorio el envío es gratis.' : '📦 Enviar cuesta 10%: si mandas 10, llegan 9.' }));
      const b = el('button', { class: 'boton grande' }, 'Enviar');
      b.addEventListener('click', () => conBoton(b, 'Enviando…', async () => {
        const r = await Juego.accion('dar', { p_para: valorRadio(cuerpo, 'para'), p_recurso: valorRadio(cuerpo, 'rec-dar'), p_cantidad: parseInt($('cant-dar').value, 10) });
        if (r) { mensajeLocal(cuerpo, r.mensaje, 'ok'); Juego.cargarMiembros().catch(() => {}); }
      }));
      cuerpo.appendChild(b);
    }
  });

  // ------------------------------------------------------------------ Trabajo del territorio
  registrar('trabajo', {
    icono: '🛠️', titulo: () => {
      const t = Juego.parametrosTerritorio(Juego.estado.grupo.territorio).trabajo;
      return t ? t.icono + ' ' + t.nombre : 'Trabajo';
    },
    render(cuerpo, ctx, panel) {
      const t = Juego.parametrosTerritorio(Juego.estado.grupo.territorio).trabajo;
      const da = Object.entries(t.da).map(([k, v]) => '+' + v + ' ' + RECURSOS[k].nombre.toLowerCase()).join(' y ');
      let desc;
      if (t.tipo === 'cultivo') desc = 'Siembra pagando ' + (t.cuesta ? t.cuesta.monedas : 0) + ' monedas. Después de ' + t.espera_min + ' minutos de juego vuelve y cosecha ' + da + '.';
      else if (t.tipo === 'minga') desc = 'Trabajo en comunidad: si hay al menos ' + t.minimo + ' personas de tu grupo aquí en la Casa Común, cada una gana ' + da + '. Se puede repetir cada ' + t.espera_min + ' minutos de juego.';
      else desc = 'Produce ' + da + '. Puedes repetirlo cada ' + t.espera_min + ' minutos de juego.';
      cuerpo.appendChild(el('p', { class: 'grande-texto', text: desc }));
      const estado = el('p', { class: 'estado-trabajo' });
      cuerpo.appendChild(estado);
      const b = el('button', { class: 'boton grande' }, 'Trabajar');
      cuerpo.appendChild(b);
      function pintar() {
        const j = Juego.estado.jugador, seg = Juego.segJuego();
        if (t.tipo === 'cultivo') {
          if (j.cultivo_listo_seg == null) { estado.textContent = 'La huerta está vacía.'; b.textContent = '🌱 Sembrar'; b.disabled = false; }
          else if (seg < j.cultivo_listo_seg) { estado.textContent = '🌱 Creciendo… faltan ' + fmt(j.cultivo_listo_seg - seg) + ' de juego.'; b.textContent = 'Aún no está lista'; b.disabled = true; }
          else { estado.textContent = '🌽 ¡La cosecha está lista!'; b.textContent = 'Cosechar'; b.disabled = false; }
        } else {
          const listo = j.ultimo_trabajo_seg == null ? 0 : Number(j.ultimo_trabajo_seg) + t.espera_min * 60;
          if (seg < listo) { estado.textContent = '😮‍💨 Descansando… faltan ' + fmt(listo - seg) + ' de juego.'; b.disabled = true; }
          else {
            let extra = '';
            if (t.tipo === 'minga') { const n = 1 + Red.presentes().filter(p => Juego.esDeMiGrupo(p.id)).length; extra = ' Ahora hay ' + n + (n === 1 ? ' persona' : ' personas') + ' de tu grupo aquí.'; }
            estado.textContent = '✅ Listo para trabajar.' + extra; b.disabled = false;
          }
          b.textContent = t.icono + ' ' + t.nombre;
        }
      }
      pintar();
      const reloj = setInterval(pintar, 1000);
      panel.limpiar.push(() => clearInterval(reloj));
      b.addEventListener('click', () => conBoton(b, 'Trabajando…', async () => {
        const r = await Juego.accion('trabajar', {});
        if (r) mensajeLocal(cuerpo, r.mensaje, 'ok');
      }).then(pintar));
    }
  });

  // ------------------------------------------------------------------ Fondo común (Pueblo del Río)
  registrar('fondo', {
    icono: '🏺', titulo: 'Fondo común',
    render(cuerpo, ctx, panel) {
      cuerpo.appendChild(el('p', { text: 'En la cooperativa lo de uno es de todos: guarden aquí lo que les sobre y saque quien lo necesite.' }));
      const hay = el('div', { class: 'recursos' });
      cuerpo.appendChild(hay);
      function pintar() {
        const f = Juego.estado.grupo.fondo || {};
        hay.innerHTML = '';
        Object.keys(RECURSOS).forEach(k => hay.appendChild(el('div', { class: 'recurso' }, el('span', { class: 'ico', text: RECURSOS[k].icono }), el('b', { text: f[k] || 0 }), el('span', { text: RECURSOS[k].nombre }))));
      }
      pintar();
      cuerpo.appendChild(selectorRecurso('rec-fondo', null, 'comida'));
      cuerpo.appendChild(campoNumero('cant-fondo', 'Cantidad', 10));
      const fila = el('div', { class: 'fila-botones' });
      ['depositar', 'retirar'].forEach(op => {
        const b = el('button', { class: 'boton ' + (op === 'retirar' ? 'sol' : '') }, op === 'depositar' ? 'Guardar en el fondo' : 'Sacar del fondo');
        b.addEventListener('click', () => conBoton(b, '…', async () => {
          const r = await Juego.accion('fondo_comun', { p_operacion: op, p_recurso: valorRadio(cuerpo, 'rec-fondo'), p_cantidad: parseInt($('cant-fondo').value, 10) });
          if (r) { pintar(); mensajeLocal(cuerpo, r.mensaje, 'ok'); }
        }));
        fila.appendChild(b);
      });
      cuerpo.appendChild(fila);
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
        cuerpo.appendChild(el('h3', { text: '🏆 Ranking de los grupos' }));
        try {
          const rk = await Servidor.rpc('ranking_vivo');
          const tabla = el('div', { class: 'ranking' });
          rk.sort((a, b) => b.puntaje - a.puntaje).forEach((g, i) => {
            const t = window.TERRITORIOS[g.territorio];
            tabla.appendChild(el('div', { class: 'fila-ranking' + (g.nombre === e.grupo.nombre ? ' mio' : '') },
              el('span', { class: 'pos', text: ['🥇', '🥈', '🥉'][i] || String(i + 1) }),
              el('span', { class: 'emoji', text: g.emoji }),
              el('span', { class: 'nom' }, el('b', { text: g.nombre }), el('small', { text: t.emoji + ' ' + t.nombre + ' · ' + g.vivos + ' vivos · ' + g.muertos + ' fantasmas · ' + g.misiones + (g.misiones === 1 ? ' misión' : ' misiones') })),
              el('span', { class: 'puntos-ranking', text: Math.round(g.puntaje) })));
          });
          cuerpo.appendChild(tabla);
          cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Puntaje = monedas + energía + comida + megas ÷ 5 + 25 por misión resuelta. Los fantasmas solo suman sus misiones.' }));
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
    util: { el, RECURSOS, fmt, tarjetaTerritorio, selectorRecurso, valorRadio, campoNumero, conBoton, mensajeLocal }
  };
})();
