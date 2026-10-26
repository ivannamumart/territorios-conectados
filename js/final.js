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
      el('div', {}, el('p', { class: 'paso', text: 'Grupo ganador' }),
        el('h2', {}, el('span', { class: 'emoji-grupo', text: g1.emoji }), ' ', g1.nombre),
        el('p', { text: t1.emoji + ' ' + t1.nombre + ' · ' + g1.vivos + ' sobrevivieron · ' + g1.muertos + ' fantasmas · ' + g1.misiones + (g1.misiones === 1 ? ' misión resuelta' : ' misiones resueltas') })),
      el('div', { class: 'pts' }, Math.round(g1.puntaje), el('small', { text: 'puntos' }))));

    const podio = el('section', { class: 'podio' }, el('h2', { text: 'Ranking de los grupos' }));
    rk.forEach((g, i) => {
      const t = window.TERRITORIOS[g.territorio];
      const gente = el('div', { class: 'gente' });
      g.integrantes.forEach(p => gente.appendChild(el('span', { class: p.estado === 'fantasma' ? 'muerto' : '', title: p.estado === 'fantasma' ? 'Murió ' + (p.causa || '') : 'Sobrevivió', text: (p.estado === 'fantasma' ? '👻 ' : p.avatar + ' ') + p.nombre })));
      podio.appendChild(el('div', { class: 'fila-final' },
        el('span', { class: 'pos', text: ['🥇', '🥈', '🥉'][i] || String(i + 1) }),
        el('span', { class: 'emoji', text: g.emoji }),
        el('div', { class: 'nom' }, el('b', { text: g.nombre }),
          el('small', { text: t.emoji + ' ' + t.nombre + ' · sobrevivieron ' + g.vivos + ' de ' + (g.vivos + g.muertos) + ' · ' + g.misiones + (g.misiones === 1 ? ' misión' : ' misiones') }), gente),
        el('span', { class: 'pts', text: Math.round(g.puntaje) })));
    });
    podio.appendChild(el('p', { class: 'subtitulo', text: 'Puntaje = monedas + energía + comida + megas ÷ 5 + 25 por misión. Los fantasmas solo suman sus misiones.' }));
    caja.appendChild(podio);

    const ter = r.territorios.filter(t => t.personas > 0);
    const et = t => { const x = window.TERRITORIOS[t.id]; return x.emoji + ' ' + x.nombre; };
    const graficos = el('section', { class: 'dos-columnas' });
    graficos.appendChild(barras('🎁 Recursos que regaló cada territorio', ter.map(t => ({ etiqueta: et(t), valor: Number(t.recursos_regalados) })), 'unidades',
      'Suma de energía, comida, megas y monedas que sus integrantes enviaron a otras personas.'));
    graficos.appendChild(barras('🤝 Ayudas que dio cada territorio', ter.map(t => ({ etiqueta: et(t), valor: Number(t.ayudas) })), 'envíos',
      'Cuántas veces sus integrantes enviaron recursos. Rescates logrados: ' + ter.map(t => window.TERRITORIOS[t.id].emoji + ' ' + t.rescates).join('  ·  ')));
    caja.appendChild(graficos);

    const a = r.api;
    const api = el('section', { class: 'caja' }, el('h2', { text: '🔎 Lo que pasó con la API' }));
    const datos = el('div', { class: 'datos-api' });
    [[a.consultas, 'consultas hechas'], [a.megas, 'megas gastados'], [a.kb_promedio + ' KB', 'tamaño medio de una respuesta'],
     [a.con_error, 'consultas con error'], [a.cortes, 'cortes de señal'], [a.con_content, 'consultas que pidieron content'],
     [a.misiones, 'misiones resueltas'], [a.marcadas, 'consultas marcadas']].forEach(([n, t]) => datos.appendChild(el('div', { class: 'dato' }, el('b', { text: n }), el('span', { text: t }))));
    api.appendChild(datos);
    if (a.mas_liviana) api.appendChild(el('div', {}, el('h3', { text: '🪶 La consulta más liviana que funcionó (' + a.mas_liviana.bytes + ' bytes, de ' + a.mas_liviana.nombre + ')' }), el('pre', { class: 'json chico', text: a.mas_liviana.texto })));
    caja.appendChild(api);

    const megasPorConsulta = ter.map(t => ({ etiqueta: et(t), valor: t.consultas ? Math.round(t.megas / t.consultas * 10) / 10 : 0 }));
    const brecha = el('section', { class: 'dos-columnas' });
    brecha.appendChild(barras('📶 Megas gastados por consulta', megasPorConsulta, 'megas por consulta',
      'La misma pregunta no cuesta lo mismo en todos los territorios.'));
    brecha.appendChild(barras('📜 Misiones resueltas por territorio', ter.map(t => ({ etiqueta: et(t), valor: Number(t.misiones) })), 'misiones'));
    caja.appendChild(brecha);

    const muertes = el('section', { class: 'caja' }, el('h2', { text: '👻 Quiénes no sobrevivieron' }));
    if (!r.muertes.length) muertes.appendChild(el('p', { text: '¡Nadie murió! Todo el mundo sobrevivió.' }));
    else {
      const t = el('table', { class: 'tabla-panel' }, el('tr', {}, ...['Quién', 'Grupo', 'Hora', 'Causa', 'Pudieron ayudar'].map(h => el('th', { text: h }))));
      r.muertes.forEach(m => t.appendChild(el('tr', {},
        el('td', { text: m.avatar + ' ' + m.nombre }), el('td', { text: m.grupo }),
        el('td', { text: new Date(m.momento).toLocaleString('es-CO', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) }),
        el('td', { text: m.causa }), el('td', { text: (m.pudieron_ayudar || []).join(', ') || 'nadie estaba en línea' }))));
      muertes.appendChild(el('div', { class: 'tabla-scroll' }, t));
    }
    caja.appendChild(muertes);

    caja.appendChild(el('section', { class: 'caja' }, el('h2', { text: '💬 Para conversar' }),
      el('ol', { class: 'preguntas' },
        el('li', { text: '¿Qué territorio la tuvo más fácil y cuál más difícil? ¿Por qué?' }),
        el('li', { text: '¿Quién gastó más megas por pregunta? ¿Se parece a algo que pase en Colombia?' }),
        el('li', { text: '¿Quiénes ayudaron más? ¿Tiene que ver con tener más o con tener comunidad?' }),
        el('li', { text: '¿Alguien murió teniendo compañeros en línea? ¿Qué pasó ahí?' }),
        el('li', { text: '¿Qué aprendieron sobre pedir solo los datos que necesitan?' }))));
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
