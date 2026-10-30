/* =========================================================================
   Territorios Conectados — Pantalla final (para proyectar en clase)
   ========================================================================= */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, props, ...hijos) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v);
    });
    hijos.flat().forEach(h => { if (h == null || h === false) return; e.appendChild(typeof h === 'string' || typeof h === 'number' ? document.createTextNode(String(h)) : h); });
    return e;
  }
  function svg(tag, attrs, texto) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (texto != null) e.textContent = texto;
    return e;
  }

  /**
   * Barras horizontales de una sola serie (un color), con el valor escrito
   * al final de cada barra y una escala común que empieza en cero.
   */
  function barras(titulo, filas, unidad, explicacion) {
    const caja = el('div', { class: 'caja grafico-caja' }, el('h2', { text: titulo }));
    if (explicacion) caja.appendChild(el('p', { class: 'subtitulo', text: explicacion }));
    const W = 640, filaH = 46, izq = 190, der = 70, arriba = 8;
    const H = arriba + filas.length * filaH + 10;
    const max = Math.max(1, ...filas.map(f => f.valor));
    const ancho = W - izq - der;
    const s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': titulo });
    // guía suave en el cero
    s.appendChild(svg('line', { x1: izq, x2: izq, y1: arriba - 4, y2: H - 6, stroke: '#c9cfdc', 'stroke-width': 2 }));
    filas.forEach((f, i) => {
      const y = arriba + i * filaH;
      const w = Math.max(f.valor > 0 ? 6 : 0, f.valor / max * ancho);
      s.appendChild(svg('text', { x: izq - 12, y: y + filaH / 2 + 6, 'text-anchor': 'end', fill: '#33405a', 'font-size': 18, 'font-weight': 800, 'font-family': 'Nunito, sans-serif' }, f.etiqueta));
      const g = svg('g');
      g.appendChild(svg('title', {}, f.etiqueta + ': ' + f.valor + ' ' + unidad));
      g.appendChild(svg('rect', { x: izq, y: y + 9, width: w, height: filaH - 18, rx: 4, fill: '#5b78f0' }));
      g.appendChild(svg('rect', { x: izq, y: y + 2, width: ancho, height: filaH - 4, fill: 'transparent' }));
      s.appendChild(g);
      s.appendChild(svg('text', { x: izq + w + 10, y: y + filaH / 2 + 6, fill: '#33405a', 'font-size': 18, 'font-weight': 800, 'font-family': 'Nunito, sans-serif' }, String(f.valor)));
    });
    caja.appendChild(s);
    // Tabla equivalente (accesible)
    const det = el('details', {}, el('summary', { text: 'Ver como tabla' }));
    const t = el('table', { class: 'tabla-panel' }, el('tr', {}, el('th', { text: 'Territorio' }), el('th', { text: unidad })));
    filas.forEach(f => t.appendChild(el('tr', {}, el('td', { text: f.etiqueta }), el('td', { text: f.valor }))));
    det.appendChild(t); caja.appendChild(det);
    return caja;
  }

  function pintar(r) {
    const caja = $('contenido');
    caja.innerHTML = '';
    const rk = r.ranking;
    $('subtitulo').textContent = r.estado === 'terminado' ? 'El juego terminó. Esto fue lo que pasó en el mundo.' : 'Vista previa para el equipo docente (el juego aún no termina).';
    if (!rk.length) { caja.appendChild(el('p', { class: 'caja', text: 'Aún no hay grupos en el mundo.' })); return; }

    const g1 = rk[0], t1 = window.TERRITORIOS[g1.territorio];
    caja.appendChild(el('section', { class: 'ganador' },
      el('span', { class: 'copa', text: '🏆' }),
      el('div', {}, el('p', { class: 'paso', text: g1.completo_en ? 'Primer grupo en completar su texto' : 'El grupo que más huecos llenó' }),
        el('h2', {}, el('span', { class: 'emoji-grupo', text: g1.emoji }), ' ', g1.nombre),
        el('p', { text: t1.emoji + ' ' + t1.nombre + ' · tema ' + g1.tema + ' · ' + g1.fallos + (Number(g1.fallos) === 1 ? ' palabra fallada' : ' palabras falladas') })),
      el('div', { class: 'pts' }, g1.resueltos + '/18', el('small', { text: 'huecos' }))));

    const podio = el('section', { class: 'podio' }, el('h2', { text: 'Cómo terminó cada grupo' }));
    rk.forEach((g, i) => {
      const t = window.TERRITORIOS[g.territorio];
      const gente = el('div', { class: 'gente' });
      g.integrantes.forEach(p => gente.appendChild(el('span', { title: p.huecos + ' huecos', text: p.avatar + ' ' + p.nombre + ' · ' + p.huecos })));
      podio.appendChild(el('div', { class: 'fila-final' },
        el('span', { class: 'pos', text: ['🥇', '🥈', '🥉'][i] || String(i + 1) }),
        el('span', { class: 'emoji', text: g.emoji }),
        el('div', { class: 'nom' }, el('b', { text: g.nombre }),
          el('small', { text: t.emoji + ' ' + t.nombre + ' · tema ' + g.tema + ' · ' + g.consultas + ' consultas · ' + g.fallos + ' fallos · ' + g.oport_armadas + ' 🎟️ armadas' + (g.completo_en ? ' · 🏆 completo' : '') }), gente),
        el('span', { class: 'pts', text: g.resueltos + '/18' })));
    });
    podio.appendChild(el('p', { class: 'subtitulo', text: 'Gana el primer grupo en completar su texto. Si nadie lo completa, gana el que más huecos llenó (y en empate, el que falló menos).' }));
    caja.appendChild(podio);

    // Las ideas de cada texto (para la reflexión individual)
    const ideas = el('section', { class: 'caja' }, el('h2', { text: '💡 Lo que dice cada texto' }));
    const lista = el('ol', { class: 'preguntas' });
    (r.textos || []).forEach(tx => lista.appendChild(el('li', {},
      el('b', { text: tx.emoji + ' ' + tx.grupo + ' · ' + tx.pregunta + ' ' }),
      tx.completo || r.estado === 'terminado' ? tx.idea : '(se revela cuando completen el texto)')));
    ideas.appendChild(lista);
    caja.appendChild(ideas);

    const ter = r.territorios.filter(t => t.personas > 0);
    const et = t => { const x = window.TERRITORIOS[t.id]; return x.emoji + ' ' + x.nombre; };
    const brecha = el('section', { class: 'dos-columnas' });
    brecha.appendChild(barras('⚡ Energía gastada por consulta', ter.map(t => ({ etiqueta: et(t), valor: t.consultas ? Math.round(t.energia_consultas / t.consultas * 10) / 10 : 0 })), 'energía por consulta',
      'La misma pregunta no cuesta lo mismo en todos los territorios.'));
    brecha.appendChild(barras('📜 Huecos llenos por territorio', ter.map(t => ({ etiqueta: et(t), valor: Number(t.huecos) })), 'huecos'));
    caja.appendChild(brecha);

    const coop = el('section', { class: 'dos-columnas' });
    coop.appendChild(barras('🤝 Intercambios por territorio', ter.map(t => ({ etiqueta: et(t), valor: Number(t.intercambios) })), 'intercambios',
      'Cuántos tratos hicieron sus integrantes en el Mercado Central.'));
    coop.appendChild(barras('🎁 Envíos a otras personas', ter.map(t => ({ etiqueta: et(t), valor: Number(t.ayudas) })), 'envíos',
      'Cuántas veces sus integrantes regalaron energía o productos.'));
    caja.appendChild(coop);

    const a = r.api;
    const api = el('section', { class: 'caja' }, el('h2', { text: '🔎 Lo que pasó con la API' }));
    const datos = el('div', { class: 'datos-api' });
    [[a.consultas, 'consultas hechas'], ['⚡' + a.energia, 'energía gastada en consultas'], [a.kb_promedio + ' KB', 'tamaño medio de una respuesta'],
     [a.con_error, 'consultas con error'], [a.cortes, 'cortes de señal'], [a.aciertos + ' de ' + a.intentos, 'palabras acertadas'],
     [a.intercambios, 'intercambios'], [a.oportunidades_armadas, 'oportunidades armadas']].forEach(([n, t]) => datos.appendChild(el('div', { class: 'dato' }, el('b', { text: n }), el('span', { text: t }))));
    api.appendChild(datos);
    caja.appendChild(api);

    caja.appendChild(el('section', { class: 'caja' }, el('h2', { text: '💬 Para conversar' }),
      el('ol', { class: 'preguntas' },
        el('li', { text: '¿Todos tuvimos las mismas oportunidades de investigar? ¿Qué territorio la tuvo más fácil y cuál más difícil?' }),
        el('li', { text: '¿Quién gastó más energía por consulta? ¿Se parece a algo que pase en Colombia?' }),
        el('li', { text: '¿Qué tuvieron que hacer cuando se quedaron sin oportunidades? ¿De quién dependieron?' }),
        el('li', { text: '¿Qué pudimos descubrir y qué quedó fuera de nuestro alcance?' }),
        el('li', { text: '¿Cómo se conecta la idea de su texto con la de los otros grupos?' }))));
  }

  async function cargar() {
    let token = null;
    try { const s = JSON.parse(localStorage.getItem('tc_equipo') || 'null'); token = s && s.token; } catch (e) { /* nada */ }
    try {
      const r = await Servidor.rpc('resultados', { p_token_equipo: token });
      pintar(r);
    } catch (e) {
      $('subtitulo').textContent = e.message;
    }
  }

  if (!Servidor.configurado() || !Servidor.iniciar()) { $('subtitulo').textContent = 'Falta conectar el juego con Supabase (js/config.js).'; return; }
  cargar();
  setInterval(cargar, 20000);
})();
