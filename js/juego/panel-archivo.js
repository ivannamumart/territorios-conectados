/* =========================================================================
   Territorios Conectados — Archivo: consola de la API, misiones, hoja de
   ayuda e historial de consultas.
   ========================================================================= */
(function () {
  'use strict';

  const { el, fmt, conBoton } = Paneles.util;
  let ultimaConsulta = '';       // lo que quedó escrito en la consola
  let ultimoResultado = null;

  // ---------------------------------------------------------------- utilidades
  function colorear(texto) {
    const esc = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(/("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?)/g, m => {
      if (/^"/.test(m)) return /:$/.test(m) ? '<span class="k">' + m + '</span>' : '<span class="s">' + m + '</span>';
      if (/true|false|null/.test(m)) return '<span class="z">' + m + '</span>';
      return '<span class="n">' + m + '</span>';
    });
  }
  const kb = b => b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' KB';
  const espera = ms => new Promise(r => setTimeout(r, ms));

  function consejos(texto, r, cobro) {
    const c = [];
    const t = texto || '';
    if (r && r.errores && r.errores.length) {
      const e = r.errores[0];
      if (/Cannot query field/.test(e)) c.push('🔎 Pediste un campo que no existe. Revisa cómo se escribe en la Hoja de ayuda' + (/Did you mean/.test(e) ? ' (la API te sugiere uno parecido).' : '.'));
      else if (/Syntax Error|Expected/.test(e)) c.push('🧩 Hay un error de escritura: revisa que cada { tenga su } y cada ( su ).');
      else if (/must have a selection/.test(e)) c.push('📦 Ese campo es una caja: dentro de él tienes que pedir otros campos con { }.');
      else if (/introspection/.test(e)) c.push('🔒 Esta API no deja ver su esquema completo. Usa la Hoja de ayuda.');
      c.push('Aunque la respuesta fue un error, igual se gastó al menos 1 de energía: pedir datos siempre cuesta.');
    }
    if (/\bcontent\b/.test(t)) c.push('🐘 Pediste content: es el campo más pesado. Si no lo necesitas, quítalo y gastarás menos energía.');
    if (/\b(slug|categories|tipo)\b/.test(t) && cobro && cobro.necesarios > 4) c.push('✂️ ¿Necesitas todos esos campos? Cada campo extra se cobra.');
    if (r && r.bytes > 8 * 1024) c.push('📦 Esta respuesta fue grande (' + kb(r.bytes) + '). Con first: N puedes pedir menos resultados.');
    if (/first\s*:\s*100/.test(t) && /hasNextPage[\s\S]*true/.test(r ? r.texto : '')) c.push('➡️ Hay más resultados: copia el endCursor y úsalo en after: "…" para traer la siguiente página.');
    if (cobro && cobro.alcanzo < 1) c.push('🔋 Te quedaste sin energía a mitad de camino: solo llegó una parte. Espera a que se recargue o pide energía a tu grupo.');
    if (r && r.ok && /"nodes"\s*:\s*\[\s*\]/.test(r.texto || '')) c.push('🔎 La búsqueda no encontró nada. Prueba otra palabra, más corta o sin tildes, o busca en la otra colección (eventos o documentos).');
    return c;
  }

  // ---------------------------------------------------------------- Consola
  Paneles.registrar('consola', {
    icono: '💻', titulo: ctx => 'Consola' + (ctx.grupoLugar ? ' · ' + ctx.grupoLugar.emoji + ' ' + ctx.grupoLugar.nombre : ''), ancho: true,
    render(cuerpo, ctx, panel) {
      const g = ctx.grupoLugar;
      const terr = window.TERRITORIOS[g.territorio];
      const visita = g.id !== Juego.estado.grupo.id;

      const info = el('div', { class: 'info-conexion' }, el('span', { text: 'Conectando con la API…' }));
      const area = el('textarea', { id: 'consola-texto', class: 'consola', rows: 9, placeholder: '{ pages { nodes { title } } }', 'aria-label': 'Consulta GraphQL' });
      area.value = ultimaConsulta;
      const proteccion = Teclado.proteger(area, { alBloquear: t => Juego.aviso(t, 'error') });
      area.addEventListener('input', () => { ultimaConsulta = area.value; });
      area.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar.click(); } });

      const enviar = el('button', { class: 'boton grande' }, '📨 Enviar consulta');
      const borrar = el('button', { class: 'boton suave' }, 'Borrar');
      const ayuda = el('button', { class: 'boton suave', onclick: () => Paneles.abrir('ayuda', {}) }, '📖 Hoja de ayuda');
      borrar.addEventListener('click', () => { area.value = ''; ultimaConsulta = ''; proteccion.reiniciar(); area.focus(); });

      const izquierda = el('div', { class: 'col-consola' },
        info,
        el('label', { for: 'consola-texto', class: 'rotulo-campo', text: 'Escribe tu consulta (a mano: no se puede pegar)' }),
        area,
        el('div', { class: 'fila-botones' }, enviar, el('span', {}, borrar, ' ', ayuda)),
        el('p', { class: 'subtitulo', text: 'Atajo: Ctrl + Enter envía. Tab agrega dos espacios.' }));

      const medidas = el('div', { class: 'medidas' });
      const progreso = el('div', { class: 'progreso', hidden: true }, el('div', { class: 'barra-progreso' }, el('i')), el('span', { class: 'texto-progreso' }));
      const salida = el('pre', { class: 'json', 'aria-live': 'polite' });
      const listaConsejos = el('ul', { class: 'consejos' });
      const derecha = el('div', { class: 'col-consola' }, el('h3', { text: 'Respuesta' }), medidas, progreso, salida, listaConsejos);

      cuerpo.appendChild(el('div', { class: 'consola-columnas' }, izquierda, derecha));
      const guia = el('div', { class: 'guia-m0', hidden: true });
      cuerpo.prepend(guia);

      function pintarMedidas(items) {
        medidas.innerHTML = '';
        items.forEach(([rotulo, valor, clase]) => medidas.appendChild(el('div', { class: 'medida ' + (clase || '') }, el('span', { text: rotulo }), el('b', { text: valor }))));
      }

      function mostrar(res) {
        if (!res) {
          pintarMedidas([['Fuente', '—'], ['Tamaño', '—'], ['Energía', '—'], ['Tiempo', '—']]);
          salida.innerHTML = 'Aquí aparecerá el JSON que responde la API.';
          return;
        }
        pintarMedidas([
          ['Fuente', res.fuente === 'real' ? 'API real' : res.fuente === 'respaldo' ? 'Copia guardada' : '—', res.fuente],
          ['Tamaño', res.bytes != null ? kb(res.bytes) : '—'],
          ['Energía', res.cobrado != null ? '⚡' + String(res.cobrado) + (res.necesarios > res.cobrado ? ' de ' + res.necesarios : '') : '—', 'megas'],
          ['Tiempo', res.ms != null ? (res.ms / 1000).toFixed(1) + ' s' : '—']
        ]);
        if (res.corte) salida.innerHTML = '<span class="z">📵 Se cortó la señal antes de que llegara la respuesta.\nInténtalo otra vez (o busca un lugar con mejor conexión).</span>';
        else {
          let txt = res.texto || '';
          if (res.alcanzo < 1) txt = txt.slice(0, Math.floor(txt.length * res.alcanzo)) + '\n\n✂️ … (se acabó tu energía: no llegó el resto)';
          salida.innerHTML = colorear(txt);
        }
        listaConsejos.innerHTML = '';
        (res.consejos || []).forEach(c => listaConsejos.appendChild(el('li', { text: c })));
      }
      mostrar(ultimoResultado && ultimoResultado.lugar === g.id ? ultimoResultado : null);

      // Información de la conexión de este lugar
      Servidor.accion('ver_lugar', { p_lugar_grupo: g.id }).then(p => {
        const a = p.archivo;
        info.innerHTML = '';
        info.appendChild(el('span', { class: 'senal-mini' }, ...[1, 2, 3, 4].map(k => el('i', { class: k <= terr.rasgos[0].nivel ? 'on' : '' }))));
        info.appendChild(el('span', { text: terr.rasgos[0].nota + ' · cada KB cuesta ' + a.mult_megas + ' de energía · espera ~' + a.retardo + ' s · cortes ' + Math.round(a.corte * 100) + '%' + (visita ? ' · visitantes pagan ' + a.entrada + ' de energía al entrar' : '') }));
      }).catch(() => {});

      // Guía corta
      if (!visita) {
        guia.hidden = false;
        guia.append(
          el('b', { text: '🧭 ¿Qué escribo aquí?' }),
          el('ol', {},
            el('li', {}, 'En el edificio 🔎 Pistas de tu isla está la consulta que necesitas, con algunas letras escondidas.'),
            el('li', { text: 'Escríbela aquí a mano, completando la palabra que falta, y presiona «Enviar consulta».' }),
            el('li', { text: 'Busca el dato en la respuesta y llévalo al 📜 Archivo para probarlo en su hueco.' })));
      }

      enviar.addEventListener('click', async () => {
        const texto = area.value.trim();
        if (!texto) { Juego.aviso('Escribe una consulta primero.', 'error'); return; }
        const metricas = proteccion.metricas();
        enviar.disabled = true;
        let inicio;
        try {
          inicio = await Juego.accion('iniciar_consulta', { p_lugar_grupo: g.id }, { silencioso: true });
        } catch (e) { Juego.aviso(e.message, 'error'); enviar.disabled = false; return; }
        if (inicio.entrada > 0) Juego.aviso('Pagaste ' + inicio.entrada + ' de energía por usar esta Consola como visitante.', 'ok');

        progreso.hidden = false;
        const barra = progreso.querySelector('i');
        const txt = progreso.querySelector('.texto-progreso');
        const nombreConexion = { 4: 'Fibra', 3: 'Conexión media', 2: 'Conexión lenta', 1: 'Casi sin señal' }[terr.rasgos[0].nivel];
        txt.textContent = '📶 ' + nombreConexion + ': enviando consulta…';
        barra.style.transition = 'none'; barra.style.width = '0%';
        void barra.offsetWidth;
        const msEspera = Math.max(400, inicio.retardo * 1000);
        barra.style.transition = 'width ' + msEspera + 'ms linear'; barra.style.width = '100%';

        const t0 = performance.now();
        const peticion = inicio.corte ? Promise.resolve(null) : HistoriaAPI.consultar(texto).catch(e => ({ ok: false, errores: [e.message], bytes: 0, texto: '', fuente: 'real' }));
        const [r] = await Promise.all([peticion, espera(msEspera)]);
        const ms = Math.round(performance.now() - t0);

        let cobro;
        try {
          cobro = await Juego.accion('terminar_consulta', {
            p_consulta: inicio.id, p_texto: texto, p_bytes: r ? r.bytes : 0, p_ms: ms,
            p_fuente: r ? r.fuente : 'corte', p_ok: r ? r.ok : false,
            p_errores: r && r.errores.length ? r.errores.join(' | ') : (inicio.corte ? 'corte de señal' : null),
            p_metricas: metricas
          }, { silencioso: true });
        } catch (e) { cobro = null; }
        progreso.hidden = true;
        proteccion.reiniciar();
        const res = {
          lugar: g.id, fuente: r ? r.fuente : null, bytes: r ? r.bytes : 0, ms, corte: inicio.corte,
          texto: r ? r.texto : '', cobrado: cobro ? cobro.cobrado : null, necesarios: cobro ? cobro.necesarios : null,
          alcanzo: cobro ? Number(cobro.alcanzo) : 1
        };
        res.consejos = consejos(texto, r, cobro);
        if (inicio.corte) res.consejos.unshift('📵 En este territorio la señal se cae a veces. Se cobró 1 de energía por el intento.');
        ultimoResultado = res;
        mostrar(res);
        if (cobro) Juego.aviso('Esta consulta gastó ⚡' + cobro.cobrado + ' de energía.', cobro.alcanzo < 1 ? 'error' : 'ok');
        enviar.disabled = false;
      });
    }
  });

  // ---------------------------------------------------------------- El texto con huecos
  Paneles.registrar('texto', {
    icono: '📜', titulo: 'El texto del grupo', ancho: true,
    render(cuerpo, ctx, panel) {
      const borradores = panel.borradores = panel.borradores || {};
      panel.pintar = async () => {
        let d;
        try { d = await Servidor.accion('mi_texto'); }
        catch (e) { cuerpo.innerHTML = ''; cuerpo.appendChild(el('p', { class: 'error-campo', text: e.message })); return; }
        // Guardar lo que estaban escribiendo antes de repintar
        cuerpo.querySelectorAll('input.hueco').forEach(i => { borradores[i.dataset.n] = i.value; });
        const enfocado = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.n : null;
        const e = Juego.estado;
        const aqui = e.jugador.escena === e.grupo.id + ':archivo' || Juego.escenaId === e.grupo.id + ':archivo';
        cuerpo.innerHTML = '';
        cuerpo.appendChild(el('div', { class: 'texto-cabeza' },
          el('div', {}, el('p', { class: 'rotulo-campo', text: 'Tema ' + d.tema + ' · ' + d.titulo }), el('h3', { class: 'pregunta-grupo', text: d.pregunta })),
          el('div', { class: 'texto-contadores' },
            el('span', { class: 'contador-grande' + (d.oportunidades === 0 ? ' critico' : ''), title: 'Oportunidades del grupo' }, '🎟️ ', el('b', { text: String(d.oportunidades) }), el('small', { text: 'oportunidades' })),
            el('span', { class: 'contador-grande', title: 'Huecos llenos' }, '📜 ', el('b', { text: d.resueltos + '/18' }), el('small', { text: 'huecos' })))));
        if (!aqui && !d.completo) cuerpo.appendChild(el('p', { class: 'nota-texto', text: '👀 Aquí solo puedes leer. Para probar palabras ve al 📜 Archivo de tu isla.' }));
        else if (!d.completo) cuerpo.appendChild(el('p', { class: 'nota-texto', text: 'Escribe la palabra en su hueco y presiona Enter o «Probar». Si aciertas, queda fija. Si fallas, el grupo pierde una oportunidad 🎟️.' }));

        const hoja = el('div', { class: 'texto-huecos' });
        const porN = new Map(d.huecos.map(h => [h.n, h]));
        let ultimaCaja = null;
        d.texto.split(/(\{\d+\})/).forEach(trozo => {
          const m = trozo.match(/^\{(\d+)\}$/);
          if (!m) {
            // La puntuación que sigue a un hueco se queda pegada a él (no salta de línea)
            const p = trozo.match(/^[.,;:)]+/);
            if (p && ultimaCaja) { ultimaCaja.appendChild(document.createTextNode(p[0])); trozo = trozo.slice(p[0].length); }
            hoja.appendChild(document.createTextNode(trozo));
            ultimaCaja = null;
            return;
          }
          const n = Number(m[1]), h = porN.get(n);
          if (h && h.resuelto) {
            ultimaCaja = el('span', { class: 'hueco-caja' }, el('span', { class: 'hueco-listo', title: 'Hueco ' + n + (h.por ? ' · lo llenó ' + h.por : '') }, h.respuesta));
            hoja.appendChild(ultimaCaja);
            return;
          }
          const input = el('input', { class: 'hueco', 'data-n': n, maxlength: 40, autocomplete: 'off', spellcheck: 'false',
            placeholder: String(n), 'aria-label': 'Hueco ' + n, disabled: !aqui || d.oportunidades < 1 || e.reloj.estado !== 'corriendo' });
          input.value = borradores[n] || '';
          input.style.width = Math.max(4, (input.value.length || 4) + 1) + 'ch';
          input.addEventListener('input', () => { borradores[n] = input.value; input.style.width = Math.max(4, input.value.length + 1) + 'ch'; });
          Teclado.proteger(input, { alBloquear: t => Juego.aviso(t, 'error') });
          const probar = el('button', { class: 'boton mini probar', disabled: input.disabled, title: 'Probar el hueco ' + n }, 'Probar');
          const enviar = () => conBoton(probar, '…', async () => {
            if (!input.value.trim()) { Juego.aviso('Escribe una palabra en el hueco ' + n + '.', 'error'); return; }
            const r = await Juego.accion('probar_hueco', { p_n: n, p_respuesta: input.value }, { silencioso: true }).catch(err => { Juego.aviso(err.message, 'error'); return null; });
            if (!r) return;
            Juego.aviso(r.mensaje, r.correcta ? 'ok' : 'error');
            if (r.correcta) delete borradores[n];
            else { input.classList.add('mal'); setTimeout(() => input.classList.remove('mal'), 900); }
            setTimeout(panel.pintar, r.correcta ? 300 : 900);
          });
          input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); enviar(); } });
          probar.addEventListener('click', enviar);
          ultimaCaja = el('span', { class: 'hueco-caja' }, input, probar);
          hoja.appendChild(ultimaCaja);
        });
        cuerpo.appendChild(hoja);
        if (d.completo) {
          cuerpo.appendChild(el('div', { class: 'idea-final' },
            el('p', { class: 'rotulo-campo', text: '🏆 ¡Completaron el texto! La idea clave para tu reflexión:' }),
            el('p', { class: 'idea', text: d.idea })));
        } else if (aqui && d.oportunidades < 1) {
          cuerpo.appendChild(el('div', { class: 'sin-oportunidades' },
            el('b', { text: '🎟️ Se acabaron las oportunidades.' }),
            ' Recolecten el producto de su isla, cámbienlo en el Mercado Central por productos de otras islas y armen una oportunidad aquí con 3 productos distintos.'));
        }
        if (enfocado) { const f = cuerpo.querySelector('input.hueco[data-n="' + enfocado + '"]'); if (f && !f.disabled) f.focus(); }
      };
      cuerpo.appendChild(el('p', { text: 'Cargando el texto…' }));
      panel.pintar();
    },
    refrescar(panel) {
      // No repintar mientras alguien escribe
      if (panel.pintar && !(document.activeElement && document.activeElement.classList.contains('hueco'))) panel.pintar();
    }
  });

  // ---------------------------------------------------------------- Pistas
  Paneles.registrar('pistas', {
    icono: '🔎', titulo: 'Tablero de pistas', ancho: true,
    render(cuerpo, ctx, panel) {
      panel.pintar = async () => {
        let d;
        try { d = await Servidor.accion('mis_pistas'); }
        catch (e) { cuerpo.innerHTML = ''; cuerpo.appendChild(el('p', { class: 'error-campo', text: e.message })); return; }
        cuerpo.innerHTML = '';
        cuerpo.appendChild(el('p', { text: 'Cada pista dice qué buscar y te da la consulta con letras escondidas. Complétala, escríbela en la 💻 Consola y lleva el dato al 📜 Archivo. Cuando llenan un hueco se abre la pista siguiente; cada vez esconden más letras.' }));
        const niveles = { 1: 'Pistas fáciles', 2: 'Pistas medias', 3: 'Pistas difíciles' };
        let nivelActual = 0, lista = null;
        d.pistas.forEach(p => {
          if (p.nivel !== nivelActual) {
            nivelActual = p.nivel;
            cuerpo.appendChild(el('h3', { class: 'nivel-pistas n' + p.nivel, text: niveles[p.nivel] + (p.nivel === 1 ? ' (huecos 1 a 6)' : p.nivel === 2 ? ' (huecos 7 a 12)' : ' (huecos 13 a 18)') }));
            lista = el('div', { class: 'lista-pistas' });
            cuerpo.appendChild(lista);
          }
          if (p.bloqueada) {
            lista.appendChild(el('div', { class: 'pista-tarjeta bloqueada' }, el('span', { class: 'num', text: p.n }), el('span', { class: 'subtitulo', text: '🔒 Se abre cuando llenen el hueco ' + (p.n - 1) + '.' })));
            return;
          }
          lista.appendChild(el('div', { class: 'pista-tarjeta' + (p.resuelto ? ' resuelta' : '') },
            el('span', { class: 'num', text: p.resuelto ? '✓' : p.n }),
            el('div', {},
              el('p', { class: 'pista-pregunta', text: 'Hueco ' + p.n + ': ' + p.pregunta }),
              /^\{/.test(p.consulta) ? el('code', { class: 'pista-consulta', text: p.consulta }) : el('p', { class: 'subtitulo', text: p.consulta }))));
        });
      };
      cuerpo.appendChild(el('p', { text: 'Cargando pistas…' }));
      panel.pintar();
    },
    refrescar(panel) { if (panel.pintar) panel.pintar(); }
  });

  // ---------------------------------------------------------------- Hoja de ayuda
  const EJ = (titulo, codigo, nota) => el('div', { class: 'ejemplo' }, el('b', { text: titulo }), el('pre', { class: 'json chico', text: codigo }), nota ? el('p', { class: 'subtitulo', text: nota }) : null);

  Paneles.registrar('ayuda', {
    icono: '📖', titulo: 'Hoja de ayuda', ancho: true,
    render(cuerpo) {
      const sec = (titulo, ...contenido) => el('details', { class: 'seccion-ayuda' }, el('summary', { text: titulo }), el('div', {}, ...contenido));
      cuerpo.append(
        el('p', { class: 'grande-texto', text: 'Todo lo que necesitas para jugar y para hablar con la API de Historia del Internet en Colombia.' }),
        sec('🧭 Cómo se juega',
          el('ol', {},
            el('li', {}, el('b', { text: '📜 Archivo' }), ' (en el centro de tu isla): ahí está la pregunta de tu grupo y un texto con 18 huecos. Escriben la palabra y presionan «Probar».'),
            el('li', {}, el('b', { text: '🔎 Pistas' }), ': cada hueco tiene una pista con la consulta que deben escribir (con letras escondidas). Al llenar un hueco se abre la pista siguiente.'),
            el('li', {}, el('b', { text: '💻 Consola' }), ': ahí escriben la consulta a mano. Consultar gasta energía ⚡.'),
            el('li', {}, el('b', { text: '🎟️ Oportunidades' }), ': empiezan con 4. Cada palabra equivocada cuesta una. Para conseguir más: recolecten el producto de su isla 🌱, cámbienlo en el 🤝 Mercado Central por productos de otras islas y, en el Archivo, cambien 3 productos distintos por una oportunidad.'),
            el('li', { text: 'Cuando llenen los 18 huecos aparece la idea clave del texto. ¡Gana el primer grupo en completarlo!' }))),
        sec('🍽️ ¿Qué es una API?',
          el('p', { text: 'Una API es como el mesero de un restaurante: tú no entras a la cocina (la base de datos); le haces un pedido al mesero y él te trae lo que pediste.' }),
          el('p', { text: 'Esta API vive en https://historiasinternetpre.uniandes.edu.co/graphql y guarda eventos, personajes, entrevistas, documentos y términos de la historia del internet en Colombia.' })),
        sec('🧩 ¿Qué es GraphQL?',
          el('p', { text: 'GraphQL es el idioma para hacer el pedido. Su gracia: pides exactamente los campos que quieres, ni uno más. Por eso, si pides poco, gastas pocos megas.' }),
          EJ('Anatomía de una consulta', '{                    ← empieza el pedido\n  eventos(first: 5) { ← qué datos y cuántos\n    nodes {          ← la lista de resultados\n      title          ← los campos que quieres\n      fecha\n    }\n  }\n}                    ← termina el pedido', 'Cada { necesita su }. Los saltos de línea son opcionales: { eventos(first: 5) { nodes { title fecha } } } es lo mismo.')),
        sec('📚 Qué datos hay y qué campos tienen',
          el('table', { class: 'tabla-ayuda' },
            el('tr', {}, el('th', { text: 'Tipo' }), el('th', { text: 'Campos' })),
            ...[['eventos', 'title, slug, fecha (solo el año), tipo (colombia o tecnologico), content'],
                ['personajes', 'title, slug, content, entrevistas { nodes { title fecha } }'],
                ['entrevistas', 'title, slug, fecha, personajes { nodes { title } }'],
                ['documentos', 'title, slug, tituloCorto, descripcion, fecha (MES/DÍA/AÑO), autores, fuente'],
                ['terminos', 'title, slug, content (el glosario)'],
                ['categories', 'name, slug, count, description'],
                ['pages', 'title, slug (las páginas del sitio)']].map(([t, c]) => el('tr', {}, el('td', {}, el('code', { text: t })), el('td', { text: c }))))),
        sec('🔎 Buscar y filtrar',
          EJ('Buscar por palabra', '{ eventos(where: { search: "satélite" }) {\n    nodes { title fecha }\n} }'),
          EJ('Un personaje por su slug', '{ personajeBy(slug: "hugo-sin-triana") {\n    title\n    entrevistas { nodes { fecha } }\n} }'),
          EJ('Un término del glosario', '{ terminoBy(slug: "arpanet") { title content } }')),
        sec('📄 Paginación: más de 100 resultados',
          el('p', { text: 'La API entrega máximo 100 resultados por consulta. Para traer más, pides la siguiente página con el "cursor" que te dio la anterior.' }),
          EJ('Paso 1: primera página', '{ terminos(first: 100) {\n    pageInfo { hasNextPage endCursor }\n    nodes { title }\n} }'),
          EJ('Paso 2: la siguiente', '{ terminos(first: 100, after: "YXJyYXljb25uZWN0aW9uOjk5") {\n    pageInfo { hasNextPage endCursor }\n    nodes { title }\n} }', 'Escribe en after el endCursor que te llegó (cada respuesta trae el suyo). Si hasNextPage es false, ya no hay más.')),
        sec('🧾 Cómo leer el JSON',
          el('p', { text: 'La respuesta tiene la misma forma que tu pedido. Lo que pediste está dentro de "data". Los corchetes [ ] son listas y las llaves { } son cajas con campos.' }),
          EJ('Ejemplo de respuesta', '{\n  "data": {\n    "eventos": {\n      "nodes": [\n        { "title": "Mosaic, primer navegador.", "fecha": "1993" },\n        { "title": "Surge Google como buscador.", "fecha": "1998" }\n      ]\n    }\n  }\n}')),
        sec('🚧 Errores comunes',
          el('ul', {},
            el('li', {}, el('b', { text: 'Cannot query field "titulo"' }), ': ese campo no existe. Se escribe title. La API a veces te sugiere el correcto.'),
            el('li', {}, el('b', { text: 'Syntax Error: Expected "}"' }), ': falta cerrar una llave.'),
            el('li', {}, el('b', { text: 'must have a selection of subfields' }), ': ese campo es una caja; pide campos dentro con { }.'),
            el('li', { text: 'Los errores también gastan megas (mínimo 1). Revisa antes de enviar.' }))),
        sec('⚡ ¿Por qué consultar cuesta energía?',
          el('p', { text: 'Cada consulta trae datos por la red y los datos pesan. El juego cobra energía según el tamaño real de la respuesta, multiplicado por lo cara que sea la conexión del territorio donde consultas.' }),
          el('ul', {},
            el('li', { text: '20 eventos con title y fecha: unos 2,3 KB.' }),
            el('li', { text: 'Los mismos 20 con todos los campos: unos 5,4 KB (más del doble).' }),
            el('li', { text: 'En Ciudad Luz cada KB cuesta medio punto de energía; en Isla Sol, tres. La misma pregunta no cuesta lo mismo para todos.' }),
            el('li', { text: 'La energía se recarga sola con el tiempo, más rápido en unos territorios que en otros.' }))),
        sec('🎮 Controles del juego',
          el('ul', {},
            el('li', { text: 'Flechas o W A S D: caminar. En el celular, la palanca de la pantalla.' }),
            el('li', { text: 'E, Enter o Espacio: entrar a un lugar o usar lo que tienes cerca.' }),
            el('li', { text: 'M: el texto del grupo · G: mi grupo · H: esta hoja · Esc: cerrar ventanas.' }),
            el('li', { text: '1 👋 2 😀 3 ❤️ 4 🆘 5 👍 6 🤝: gestos que ven quienes están cerca.' })))
      );
      cuerpo.querySelector('details').open = true;
    }
  });

  // ---------------------------------------------------------------- Historial
  Paneles.registrar('historial', {
    icono: '🗂️', titulo: 'Mis consultas', ancho: true,
    async render(cuerpo) {
      cuerpo.appendChild(el('p', { text: 'Cargando…' }));
      try {
        const filas = await Servidor.accion('mis_consultas');
        cuerpo.innerHTML = '';
        if (!filas.length) { cuerpo.appendChild(el('p', { text: 'Aún no has hecho consultas.' })); return; }
        const total = filas.reduce((a, f) => a + (f.megas || 0), 0);
        cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Tus últimas ' + filas.length + ' consultas gastaron ⚡' + total + ' de energía.' }));
        filas.forEach(f => {
          const t = window.TERRITORIOS[f.territorio];
          cuerpo.appendChild(el('div', { class: 'consulta-pasada' + (f.ok ? '' : ' fallida') },
            el('div', { class: 'cabeza' },
              el('span', { text: new Date(f.momento).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + ' · ' + (t ? t.emoji + ' ' + t.nombre : '') }),
              el('b', { text: (f.corte ? '📵 corte · ' : f.ok ? '' : '⚠️ error · ') + kb(f.bytes || 0) + ' · ⚡' + f.megas })),
            el('pre', { class: 'json chico', text: f.texto })));
        });
      } catch (e) { cuerpo.innerHTML = ''; cuerpo.appendChild(el('p', { class: 'error-campo', text: e.message })); }
    }
  });
})();
