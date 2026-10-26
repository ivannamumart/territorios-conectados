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
      c.push('Aunque la respuesta fue un error, igual se gastó al menos 1 mega: pedir datos siempre cuesta.');
    }
    if (/\bcontent\b/.test(t)) c.push('🐘 Pediste content: es el campo más pesado. Si no lo necesitas, quítalo y gastarás menos megas.');
    if (/\b(slug|categories|tipo)\b/.test(t) && cobro && cobro.necesarios > 4) c.push('✂️ ¿Necesitas todos esos campos? Cada campo extra se cobra.');
    if (r && r.bytes > 8 * 1024) c.push('📦 Esta respuesta fue grande (' + kb(r.bytes) + '). Con first: N puedes pedir menos resultados.');
    if (/first\s*:\s*100/.test(t) && /hasNextPage[\s\S]*true/.test(r ? r.texto : '')) c.push('➡️ Hay más resultados: copia el endCursor y úsalo en after: "…" para traer la siguiente página.');
    if (cobro && cobro.alcanzo < 1) c.push('📵 Te quedaste sin megas a mitad de camino: solo llegó una parte. Recarga en la Antena.');
    return c;
  }

  // ---------------------------------------------------------------- Consola
  Paneles.registrar('consola', {
    icono: '🖥️', titulo: ctx => 'Consola del Archivo' + (ctx.grupoLugar ? ' · ' + ctx.grupoLugar.emoji + ' ' + ctx.grupoLugar.nombre : ''), ancho: true,
    render(cuerpo, ctx, panel) {
      const g = ctx.grupoLugar;
      const terr = window.TERRITORIOS[g.territorio];
      const visita = g.id !== Juego.estado.grupo.id;

      const info = el('div', { class: 'info-conexion' }, el('span', { text: 'Conectando con el Archivo…' }));
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
          pintarMedidas([['Fuente', '—'], ['Tamaño', '—'], ['Megas', '—'], ['Tiempo', '—']]);
          salida.innerHTML = 'Aquí aparecerá el JSON que responde la API.';
          return;
        }
        pintarMedidas([
          ['Fuente', res.fuente === 'real' ? 'API real' : res.fuente === 'respaldo' ? 'Copia guardada' : '—', res.fuente],
          ['Tamaño', res.bytes != null ? kb(res.bytes) : '—'],
          ['Megas', res.cobrado != null ? String(res.cobrado) + (res.necesarios > res.cobrado ? ' de ' + res.necesarios : '') : '—', 'megas'],
          ['Tiempo', res.ms != null ? (res.ms / 1000).toFixed(1) + ' s' : '—']
        ]);
        if (res.corte) salida.innerHTML = '<span class="z">📵 Se cortó la señal antes de que llegara la respuesta.\nInténtalo otra vez (o busca un lugar con mejor conexión).</span>';
        else {
          let txt = res.texto || '';
          if (res.alcanzo < 1) txt = txt.slice(0, Math.floor(txt.length * res.alcanzo)) + '\n\n✂️ … (se acabaron tus megas: no llegó el resto)';
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
        info.appendChild(el('span', { text: terr.rasgos[0].nota + ' · cada KB cuesta ' + a.mult_megas + ' megas · espera ~' + a.retardo + ' s · cortes ' + Math.round(a.corte * 100) + '%' + (visita ? ' · visitantes pagan ' + a.entrada + ' monedas' : '') }));
      }).catch(() => {});

      // Guía de la Misión 0
      Servidor.accion('mis_misiones').then(m => {
        const m0 = m.misiones.find(x => x.id === 'm0');
        if (m0 && !m0.resuelta) {
          guia.hidden = false;
          guia.append(
            el('b', { text: '🧭 Misión 0: tu primera consulta' }),
            el('ol', {},
              el('li', {}, 'Escribe a mano, letra por letra: ', el('code', { text: '{ pages { nodes { title } } }' })),
              el('li', { text: 'Presiona «Enviar consulta». La API responde con un JSON.' }),
              el('li', { text: 'Cada "title" es una página del sitio. Cuéntalas.' }),
              el('li', { text: 'Ve al Tablero de misiones (📜) y escribe tu respuesta.' })),
            el('p', { class: 'subtitulo', text: 'Las llaves { } son como cajas: pages contiene nodes, y cada nodo tiene un title. Pides solo lo que necesitas.' }));
        }
      }).catch(() => {});

      enviar.addEventListener('click', async () => {
        const texto = area.value.trim();
        if (!texto) { Juego.aviso('Escribe una consulta primero.', 'error'); return; }
        const metricas = proteccion.metricas();
        enviar.disabled = true;
        let inicio;
        try {
          inicio = await Juego.accion('iniciar_consulta', { p_lugar_grupo: g.id }, { silencioso: true });
        } catch (e) { Juego.aviso(e.message, 'error'); enviar.disabled = false; return; }
        if (inicio.entrada > 0) Juego.aviso('Pagaste ' + inicio.entrada + ' monedas por usar este Archivo como visitante.', 'ok');

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
        if (inicio.corte) res.consejos.unshift('📵 En este territorio la señal se cae a veces. Se cobró 1 mega por el intento.');
        ultimoResultado = res;
        mostrar(res);
        if (cobro) Juego.aviso('Esta consulta gastó ' + cobro.cobrado + (cobro.cobrado === 1 ? ' mega.' : ' megas.'), cobro.alcanzo < 1 ? 'error' : 'ok');
        enviar.disabled = false;
      });
    }
  });

  // ---------------------------------------------------------------- Misiones
  Paneles.registrar('misiones', {
    icono: '📜', titulo: 'Misiones del Archivo', ancho: true,
    render(cuerpo, ctx, panel) {
      cuerpo.appendChild(el('p', { text: 'Resuelve las misiones consultando la API en un Archivo. Cada estudiante tiene su propia versión de cada pregunta.' }));
      const lista = el('div', { class: 'lista-misiones' }, el('p', { text: 'Cargando misiones…' }));
      cuerpo.appendChild(lista);

      async function pintar() {
        let datos;
        try { datos = await Servidor.accion('mis_misiones'); }
        catch (e) { lista.innerHTML = ''; lista.appendChild(el('p', { class: 'error-campo', text: e.message })); return; }
        lista.innerHTML = '';
        const dif = { facil: 'fácil', media: 'media', dificil: 'difícil' }[datos.dificultad];
        lista.appendChild(el('p', { class: 'subtitulo', text: 'Dificultad: ' + dif + '. Una respuesta equivocada cuesta 2 monedas.' }));
        datos.misiones.forEach(m => {
          const tarjeta = el('div', { class: 'mision' + (m.resuelta ? ' resuelta' : '') + (m.bloqueada ? ' bloqueada' : '') });
          tarjeta.appendChild(el('div', { class: 'mision-cabeza' },
            el('span', { class: 'nivel ' + m.nivel.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), text: m.nivel }),
            el('b', { text: m.titulo }),
            el('span', { class: 'premio', text: m.resuelta ? '✅ +' + m.ganado : '🪙 ' + m.recompensa })));
          if (m.bloqueada) { tarjeta.appendChild(el('p', { class: 'subtitulo', text: '🔒 Resuelve primero la Misión 0.' })); lista.appendChild(tarjeta); return; }
          tarjeta.appendChild(el('p', { class: 'pregunta', text: m.pregunta }));
          if (m.pista && !m.resuelta) {
            const det = el('details', { class: 'pista' }, el('summary', { text: '💡 Ver pista' }), el('code', { text: m.pista }));
            tarjeta.appendChild(det);
          }
          if (!m.resuelta) {
            const id = 'resp-' + m.id;
            const input = el('input', { id, class: 'respuesta', maxlength: 100, placeholder: 'Tu respuesta', 'aria-label': 'Respuesta a ' + m.titulo });
            Teclado.proteger(input, { alBloquear: t => Juego.aviso(t, 'error') });
            input.addEventListener('keydown', e => { if (e.key === 'Enter') b.click(); });
            const b = el('button', { class: 'boton' }, 'Responder');
            const nota = el('p', { class: 'nota-mision' });
            if (m.espera_hasta && Date.parse(m.espera_hasta) > Date.parse(datos.ahora)) {
              nota.textContent = '⏳ Muchos intentos seguidos. Revisa tus datos y espera ' + fmt((Date.parse(m.espera_hasta) - Date.parse(datos.ahora)) / 1000) + '.';
            }
            b.addEventListener('click', () => conBoton(b, '…', async () => {
              if (!input.value.trim()) { nota.textContent = 'Escribe una respuesta.'; return; }
              try {
                const r = await Juego.accion('responder_mision', { p_mision: m.id, p_respuesta: input.value }, { silencioso: true });
                nota.textContent = r.mensaje;
                nota.className = 'nota-mision ' + (r.correcta ? 'ok' : 'mal');
                Juego.aviso(r.mensaje, r.correcta ? 'ok' : 'error');
                if (r.correcta) setTimeout(pintar, 900);
              } catch (e) { nota.textContent = e.message; nota.className = 'nota-mision mal'; }
            }));
            tarjeta.appendChild(el('div', { class: 'fila-respuesta' }, input, b));
            tarjeta.appendChild(nota);
          }
          lista.appendChild(tarjeta);
        });
      }
      pintar();
    }
  });

  // ---------------------------------------------------------------- Hoja de ayuda
  const EJ = (titulo, codigo, nota) => el('div', { class: 'ejemplo' }, el('b', { text: titulo }), el('pre', { class: 'json chico', text: codigo }), nota ? el('p', { class: 'subtitulo', text: nota }) : null);

  Paneles.registrar('ayuda', {
    icono: '📖', titulo: 'Hoja de ayuda', ancho: true,
    render(cuerpo) {
      const sec = (titulo, ...contenido) => el('details', { class: 'seccion-ayuda' }, el('summary', { text: titulo }), el('div', {}, ...contenido));
      cuerpo.append(
        el('p', { class: 'grande-texto', text: 'Todo lo que necesitas para hablar con la API de Historia del Internet en Colombia.' }),
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
        sec('📶 ¿Por qué cuesta megas?',
          el('p', { text: 'Cada consulta trae datos por la red y los datos pesan. El juego cobra según el tamaño real de la respuesta, multiplicado por lo cara que sea la conexión de tu territorio.' }),
          el('ul', {},
            el('li', { text: '20 eventos con title y fecha: unos 2,3 KB.' }),
            el('li', { text: 'Los mismos 20 con todos los campos: unos 5,4 KB (más del doble).' }),
            el('li', { text: 'En Ciudad Luz cada KB cuesta medio mega; en Montaña Alta, dos y medio. La misma pregunta no cuesta lo mismo para todos.' }))),
        sec('🎮 Controles del juego',
          el('ul', {},
            el('li', { text: 'Flechas o W A S D: caminar.' }),
            el('li', { text: 'E, Enter o Espacio: entrar a un lugar o usar lo que tienes cerca.' }),
            el('li', { text: 'M: misiones · G: mi grupo · H: esta hoja · Esc: cerrar ventanas.' }),
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
        cuerpo.appendChild(el('p', { class: 'subtitulo', text: 'Tus últimas ' + filas.length + ' consultas gastaron ' + total + ' megas.' }));
        filas.forEach(f => {
          const t = window.TERRITORIOS[f.territorio];
          cuerpo.appendChild(el('div', { class: 'consulta-pasada' + (f.ok ? '' : ' fallida') },
            el('div', { class: 'cabeza' },
              el('span', { text: new Date(f.momento).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + ' · ' + (t ? t.emoji + ' ' + t.nombre : '') }),
              el('b', { text: (f.corte ? '📵 corte · ' : f.ok ? '' : '⚠️ error · ') + kb(f.bytes || 0) + ' · ' + f.megas + ' megas' })),
            el('pre', { class: 'json chico', text: f.texto })));
        });
      } catch (e) { cuerpo.innerHTML = ''; cuerpo.appendChild(el('p', { class: 'error-campo', text: e.message })); }
    }
  });
})();
