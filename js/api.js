/* =========================================================================
   Territorios Conectados — Conector de la API "Historia del Internet en Colombia"
   -------------------------------------------------------------------------
   Qué hace este archivo:
   1. Envía la consulta GraphQL que escribe el estudiante a la API real.
   2. Si la API no responde (o tarda demasiado), responde la MISMA consulta
      usando la copia local datos/respaldo.json. Así el taller nunca se cae.
   3. Mide cuántos bytes trae la respuesta y cuánto tardó. El juego usa
      esos bytes para cobrar "megas".

   Uso:
     const r = await HistoriaAPI.consultar('{ pages { nodes { title } } }');
     r.json        -> la respuesta como objeto
     r.texto       -> la respuesta como texto (bonito, con sangría)
     r.bytesDatos  -> tamaño de la parte "data" (lo que cobra el juego)
     r.ms          -> milisegundos que tardó
     r.fuente      -> "real" o "respaldo"
   ========================================================================= */
(function () {
  'use strict';

  const API_URL = 'https://historiasinternetpre.uniandes.edu.co/graphql';
  // El respaldo vive en datos/respaldo.js (se carga con <script> y funciona
  // incluso abriendo el archivo con doble clic). Si no está, se busca el .json.
  const RUTA_RESPALDO = 'datos/respaldo.json';
  const LIMITE_MAXIMO = 100;      // la API real nunca devuelve más de 100
  const LIMITE_POR_DEFECTO = 10;  // si no se escribe "first", la API real trae 10

  /* ---------------------------------------------------------------------
     1. CARGA DEL RESPALDO (se hace una sola vez y se normaliza)
     --------------------------------------------------------------------- */
  let respaldoPromesa = null;

  function slugDe(texto) {
    return String(texto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function normalizarRespaldo(d) {
    const comoObjeto = (arr, campos) => (arr || []).map(x => {
      if (!Array.isArray(x)) return x;
      const o = {};
      campos.forEach((c, i) => { o[c] = x[i] === undefined ? null : x[i]; });
      return o;
    });
    const R = {};
    R.eventos = (d.eventos || []).map(e => ({ ...e, categories: e.categories && e.categories.nodes ? e.categories.nodes : (e.categories || []) }));
    R.personajes = (d.personajes || []).map(p => ({ ...p, entrevistas: (p.entrevistas && p.entrevistas.nodes ? p.entrevistas.nodes.map(n => n.slug) : (p.entrevistas || [])) }));
    R.entrevistas = (d.entrevistas || []).map(e => ({
      ...e,
      personajes: e.personajes && e.personajes.nodes ? e.personajes.nodes.map(n => n.slug) : (e.personajes || []),
      transcripciones: e.transcripciones && e.transcripciones.nodes
        ? (Array.isArray(e.transcripciones.nodes) ? e.transcripciones.nodes : [])
        : Array.from({ length: Number(e.transcripciones) || 0 }, (_, i) => ({ title: 'Transcripción ' + (i + 1) + ' (copia sin conexión)', transcripcion: null }))
    }));
    R.terminos = comoObjeto(d.terminos, ['title', 'slug', 'content']);
    R.documentos = comoObjeto(d.documentos, ['title', 'fecha']).map(x => ({ slug: slugDe(x.title), ...x }));
    R.categories = comoObjeto(d.categories, ['name', 'slug', 'count', 'parent']).map(c => ({
      ...c, parent: c.parent && typeof c.parent === 'object' ? (c.parent.node ? c.parent.node.slug : c.parent.slug) : c.parent
    }));
    R.pages = comoObjeto(d.pages, ['title', 'slug']);
    return R;
  }

  function cargarRespaldo() {
    if (!respaldoPromesa) {
      respaldoPromesa = (window.RESPALDO_INCRUSTADO
        ? Promise.resolve(window.RESPALDO_INCRUSTADO)
        : fetch(RUTA_RESPALDO).then(r => { if (!r.ok) throw new Error('No se encontró ' + RUTA_RESPALDO); return r.json(); })
      ).then(normalizarRespaldo);
    }
    return respaldoPromesa;
  }

  /* ---------------------------------------------------------------------
     2. LECTOR DE GRAPHQL (versión pequeña, suficiente para el taller)
     --------------------------------------------------------------------- */
  class ErrorGQL extends Error {}

  function tokenizar(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s|,/.test(c)) { i++; continue; }
      if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if ('{}():[]!$@='.includes(c)) { t.push({ k: 'p', v: c }); i++; continue; }
      if (c === '.' && src.slice(i, i + 3) === '...') { t.push({ k: 'p', v: '...' }); i += 3; continue; }
      if (c === '"') {
        let j = i + 1, s = '';
        while (j < src.length && src[j] !== '"') { if (src[j] === '\\') { s += src[j + 1]; j += 2; } else s += src[j++]; }
        if (j >= src.length) throw new ErrorGQL('Syntax Error: Unterminated string.');
        t.push({ k: 's', v: s }); i = j + 1; continue;
      }
      const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
      if (num) { t.push({ k: 'n', v: Number(num[0]) }); i += num[0].length; continue; }
      const nom = /^[_A-Za-z][_0-9A-Za-z]*/.exec(src.slice(i));
      if (nom) { t.push({ k: 'i', v: nom[0] }); i += nom[0].length; continue; }
      throw new ErrorGQL('Syntax Error: Unexpected character: "' + c + '".');
    }
    return t;
  }

  function analizar(src) {
    const t = tokenizar(src); let p = 0;
    const ver = () => t[p];
    const esperar = v => {
      const x = t[p];
      if (!x || x.v !== v) throw new ErrorGQL('Syntax Error: Expected "' + v + '", found ' + (x ? '"' + x.v + '"' : '<EOF>') + '.');
      p++; return x;
    };
    function valor() {
      const x = t[p++];
      if (!x) throw new ErrorGQL('Syntax Error: Unexpected <EOF>.');
      if (x.k === 's' || x.k === 'n') return x.v;
      if (x.k === 'i') return x.v === 'true' ? true : x.v === 'false' ? false : x.v === 'null' ? null : { enum: x.v };
      if (x.v === '{') { const o = {}; while (ver() && ver().v !== '}') { const k = t[p++].v; esperar(':'); o[k] = valor(); } esperar('}'); return o; }
      if (x.v === '[') { const a = []; while (ver() && ver().v !== ']') a.push(valor()); esperar(']'); return a; }
      if (x.v === '$') throw new ErrorGQL('En este taller escribe los valores directamente, sin variables ($).');
      throw new ErrorGQL('Syntax Error: Unexpected "' + x.v + '".');
    }
    function seleccion() {
      esperar('{'); const campos = [];
      while (ver() && ver().v !== '}') {
        const x = t[p++];
        if (x.v === '...') throw new ErrorGQL('En este taller no se usan fragmentos (...).');
        if (x.k !== 'i') throw new ErrorGQL('Syntax Error: Expected Name, found "' + x.v + '".');
        let nombre = x.v, alias = x.v;
        if (ver() && ver().v === ':') { p++; const y = t[p++]; if (!y || y.k !== 'i') throw new ErrorGQL('Syntax Error: Expected Name after alias.'); nombre = y.v; }
        const args = {};
        if (ver() && ver().v === '(') { p++; while (ver() && ver().v !== ')') { const k = t[p++]; if (k.k !== 'i') throw new ErrorGQL('Syntax Error: Expected argument name.'); esperar(':'); args[k.v] = valor(); } esperar(')'); }
        const sub = ver() && ver().v === '{' ? seleccion() : null;
        campos.push({ nombre, alias, args, sub });
      }
      esperar('}');
      return campos;
    }
    if (!t.length) throw new ErrorGQL('GraphQL Request must include at least one of those two parameters: "query" or "queryId"');
    if (ver().k === 'i' && ver().v === 'query') { p++; if (ver() && ver().k === 'i') p++; }
    else if (ver().k === 'i' && (ver().v === 'mutation' || ver().v === 'subscription')) throw new ErrorGQL('Esta API solo permite leer datos (query).');
    const raiz = seleccion();
    if (p < t.length) throw new ErrorGQL('Syntax Error: Unexpected "' + t[p].v + '".');
    return raiz;
  }

  /* ---------------------------------------------------------------------
     3. EJECUTOR: responde la consulta con los datos del respaldo
     --------------------------------------------------------------------- */
  function cursor(i) { return btoa('arrayconnection:' + i); }
  function desdeCursor(c) {
    try { const s = atob(String(c)); const n = Number(s.split(':')[1]); return Number.isFinite(n) ? n : -1; }
    catch (e) { return -1; }
  }

  // Sugerencias como las de la API real: Did you mean "title" or "tipo"?
  function distancia(a, b) {
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function sugerir(malo, opciones) {
    const lim = Math.max(1, Math.floor(malo.length * 0.4));
    const s = opciones.filter(o => o.toLowerCase().startsWith(malo.toLowerCase().slice(0, 3)) || distancia(malo.toLowerCase(), o.toLowerCase()) <= lim)
      .sort((x, y) => distancia(malo, x) - distancia(malo, y)).slice(0, 3);
    if (!s.length) return '';
    return ' Did you mean ' + s.map(x => '"' + x + '"').join(s.length === 2 ? ' or ' : ', ').replace(/, ([^,]*)$/, ', or $1') + '?';
  }

  function construirEjecutor(D) {
    const porSlug = (lista, s) => lista.find(x => x.slug === s) || null;
    const conexion = (tipo, lista) => ({ __conexion: true, tipo, lista });

    // Cada tipo: campo -> función(registro, args) que devuelve el valor.
    const TIPOS = {
      Evento: {
        id: r => btoa('post:' + r.slug), databaseId: r => D.eventos.indexOf(r) + 1,
        title: r => r.title, slug: r => r.slug, fecha: r => r.fecha, tipo: r => r.tipo,
        content: r => r.content, status: () => 'publish', uri: r => '/eventos/' + r.slug + '/',
        categories: r => conexion('Category', (r.categories || []).map(c => porSlug(D.categories, c.slug) || { name: c.name, slug: c.slug, count: null, parent: null }))
      },
      Personaje: {
        id: r => btoa('post:' + r.slug), title: r => r.title, slug: r => r.slug, content: r => r.content,
        uri: r => '/personajes/' + r.slug + '/', featuredImage: () => null,
        entrevistas: r => conexion('Entrevista', (r.entrevistas || []).map(s => porSlug(D.entrevistas, s)).filter(Boolean))
      },
      Entrevista: {
        id: r => btoa('post:' + r.slug), title: r => r.title, slug: r => r.slug, fecha: r => r.fecha,
        uri: r => '/entrevistas/' + r.slug + '/', ordenTranscripciones: () => null,
        personajes: r => conexion('Personaje', (r.personajes || []).map(s => porSlug(D.personajes, s)).filter(Boolean)),
        transcripciones: r => conexion('Transcripcion', r.transcripciones || [])
      },
      Transcripcion: { title: r => r.title, transcripcion: r => r.transcripcion || null },
      Documento: {
        id: r => btoa('post:' + r.slug), title: r => r.title, slug: r => r.slug,
        tituloCorto: r => r.tituloCorto || r.title, descripcion: r => r.descripcion || null,
        fecha: r => r.fecha, autores: r => r.autores || null, fuente: r => r.fuente || null,
        identificador: r => r.identificador || null, archivos: () => null, featuredImage: () => null,
        tiposDeDocumentos: () => conexion('Category', []), categories: () => conexion('Category', [])
      },
      Termino: { id: r => btoa('post:' + r.slug), title: r => r.title, slug: r => r.slug, content: r => r.content || null, uri: r => '/terminos/' + r.slug + '/' },
      Category: {
        id: r => btoa('term:' + r.slug), name: r => r.name, slug: r => r.slug, count: r => r.count,
        description: r => r.description || null,
        children: r => conexion('Category', D.categories.filter(c => c.parent === r.slug)),
        parent: r => (r.parent ? { __nodo: true, tipo: 'Category', node: porSlug(D.categories, r.parent) } : null)
      },
      Page: { id: r => btoa('post:' + r.slug), title: r => r.title, slug: r => r.slug, content: () => null, descripcion: () => null, menuOrder: (r) => D.pages.indexOf(r), uri: r => '/' + r.slug + '/' }
    };

    function filtrar(lista, where) {
      if (!where) return lista;
      let out = lista;
      if (where.search) { const q = slugDe(where.search); out = out.filter(x => slugDe((x.title || x.name || '') + ' ' + (x.content || '')).includes(q)); }
      if (where.categoryName) { const q = slugDe(where.categoryName); out = out.filter(x => (x.categories || []).some(c => c.slug === q || slugDe(c.name) === q)); }
      if (where.name) { const q = slugDe(where.name); out = out.filter(x => slugDe(x.name) === q); }
      if (where.parent === 0 || where.parent === '0') out = out.filter(x => !x.parent);
      return out;
    }

    function resolverConexion(con, args, campos, ruta) {
      let lista = filtrar(con.lista, args.where);
      if (args.last !== undefined || args.before !== undefined) throw new ErrorGQL('En este taller se pagina hacia adelante: usa "first" y "after".');
      let desde = 0;
      if (args.after) { const n = desdeCursor(args.after); if (n < 0) throw new ErrorGQL('Cursor "after" no válido. Copia exactamente el endCursor de la respuesta anterior.'); desde = n + 1; }
      let cuantos = args.first === undefined ? LIMITE_POR_DEFECTO : Number(args.first);
      if (!Number.isFinite(cuantos) || cuantos < 0) throw new ErrorGQL('Argument "first" has invalid value.');
      cuantos = Math.min(cuantos, LIMITE_MAXIMO);
      const trozo = lista.slice(desde, desde + cuantos);
      const out = {};
      for (const f of campos) {
        if (f.nombre === 'nodes') out[f.alias] = trozo.map(r => resolverObjeto(con.tipo, r, f.sub, ruta + '.nodes'));
        else if (f.nombre === 'edges') out[f.alias] = trozo.map((r, i) => {
          const e = {};
          for (const g of (f.sub || [])) {
            if (g.nombre === 'cursor') e[g.alias] = cursor(desde + i);
            else if (g.nombre === 'node') e[g.alias] = resolverObjeto(con.tipo, r, g.sub, ruta + '.edges.node');
            else throw new ErrorGQL('Cannot query field "' + g.nombre + '" on type "' + con.tipo + 'ConnectionEdge".');
          }
          return e;
        });
        else if (f.nombre === 'pageInfo') {
          const pi = {
            hasNextPage: desde + trozo.length < lista.length, hasPreviousPage: desde > 0,
            startCursor: trozo.length ? cursor(desde) : null, endCursor: trozo.length ? cursor(desde + trozo.length - 1) : null
          };
          const o = {};
          for (const g of (f.sub || [])) {
            if (!(g.nombre in pi)) throw new ErrorGQL('Cannot query field "' + g.nombre + '" on type "PageInfo".');
            o[g.alias] = pi[g.nombre];
          }
          out[f.alias] = o;
        } else if (f.nombre === '__typename') out[f.alias] = 'RootQueryTo' + con.tipo + 'Connection';
        else throw new ErrorGQL('Cannot query field "' + f.nombre + '" on type "RootQueryTo' + con.tipo + 'Connection".' + sugerir(f.nombre, ['nodes', 'edges', 'pageInfo']));
      }
      return out;
    }

    function resolverObjeto(tipo, r, campos, ruta) {
      if (r == null) return null;
      if (!campos) throw new ErrorGQL('Field "' + ruta + '" of type "' + tipo + '" must have a selection of subfields. Did you mean "' + ruta + ' { ... }"?');
      const def = TIPOS[tipo]; const out = {};
      for (const f of campos) {
        if (f.nombre === '__typename') { out[f.alias] = tipo; continue; }
        if (!def[f.nombre]) throw new ErrorGQL('Cannot query field "' + f.nombre + '" on type "' + tipo + '".' + sugerir(f.nombre, Object.keys(def)));
        let v = def[f.nombre](r, f.args);
        if (v && v.__conexion) v = f.sub ? resolverConexion(v, f.args, f.sub, f.nombre) : (() => { throw new ErrorGQL('Field "' + f.nombre + '" must have a selection of subfields. Did you mean "' + f.nombre + ' { ... }"?'); })();
        else if (v && v.__nodo) v = f.sub ? (() => { const o = {}; for (const g of f.sub) { if (g.nombre !== 'node') throw new ErrorGQL('Cannot query field "' + g.nombre + '".'); o[g.alias] = resolverObjeto(v.tipo, v.node, g.sub, g.nombre); } return o; })() : null;
        else if (v !== null && typeof v === 'object' && !f.sub) v = null;
        else if (f.sub && (v === null || typeof v !== 'object')) {
          if (v !== null) throw new ErrorGQL('Field "' + f.nombre + '" must not have a selection since type "String" has no subfields.');
        }
        out[f.alias] = v;
      }
      return out;
    }

    const RAIZ = {
      eventos: a => conexion('Evento', D.eventos),
      personajes: a => conexion('Personaje', D.personajes),
      entrevistas: a => conexion('Entrevista', D.entrevistas),
      documentos: a => conexion('Documento', D.documentos),
      documentosTipo: a => conexion('Documento', D.documentos),
      terminos: a => conexion('Termino', D.terminos),
      categories: a => conexion('Category', D.categories),
      pages: a => conexion('Page', D.pages),
      personajeBy: a => ({ tipo: 'Personaje', r: porSlug(D.personajes, a.slug) }),
      terminoBy: a => ({ tipo: 'Termino', r: porSlug(D.terminos, a.slug) }),
      entrevistaBy: a => ({ tipo: 'Entrevista', r: porSlug(D.entrevistas, a.slug) }),
      eventoBy: a => ({ tipo: 'Evento', r: porSlug(D.eventos, a.slug) }),
      documentoBy: a => ({ tipo: 'Documento', r: porSlug(D.documentos, a.slug) }),
      page: a => ({ tipo: 'Page', r: porSlug(D.pages, String(a.id || '').replace(/^\/|\/$/g, '')) }),
      category: a => ({ tipo: 'Category', r: porSlug(D.categories, a.id) })
    };

    return function ejecutar(consulta) {
      const campos = analizar(consulta);
      const data = {};
      for (const f of campos) {
        if (f.nombre === '__schema' || f.nombre === '__type')
          throw new ErrorGQL('The query contained __schema or __type, however GraphQL introspection is not allowed for public requests by default.');
        const fn = RAIZ[f.nombre];
        if (!fn) throw new ErrorGQL('Cannot query field "' + f.nombre + '" on type "RootQuery".' + sugerir(f.nombre, Object.keys(RAIZ)));
        const v = fn(f.args);
        if (!f.sub) throw new ErrorGQL('Field "' + f.nombre + '" must have a selection of subfields. Did you mean "' + f.nombre + ' { ... }"?');
        data[f.alias] = v.__conexion ? resolverConexion(v, f.args, f.sub, f.nombre) : resolverObjeto(v.tipo, v.r, f.sub, f.nombre);
      }
      return { data };
    };
  }

  let ejecutorPromesa = null;
  function ejecutarEnRespaldo(consulta) {
    if (!ejecutorPromesa) ejecutorPromesa = cargarRespaldo().then(construirEjecutor);
    return ejecutorPromesa.then(ejecutar => {
      try { return ejecutar(consulta); }
      catch (e) {
        if (e instanceof ErrorGQL) return { errors: [{ message: e.message }] };
        throw e;
      }
    });
  }

  /* ---------------------------------------------------------------------
     4. CONSULTA PRINCIPAL
     --------------------------------------------------------------------- */
  const medir = s => new TextEncoder().encode(s).length;

  function empaquetar(json, fuente, ms) {
    // Quitamos las "extensions" de depuración del servidor: no son datos.
    const limpio = { ...json }; delete limpio.extensions;
    const texto = JSON.stringify(limpio, null, 2);
    return {
      ok: !limpio.errors,
      json: limpio,
      texto,
      bytes: medir(JSON.stringify(limpio)),
      bytesDatos: limpio.data ? medir(JSON.stringify(limpio.data)) : 0,
      ms: Math.round(ms),
      fuente,
      errores: (limpio.errors || []).map(e => e.message)
    };
  }

  async function consultarReal(consulta, timeoutMs) {
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: consulta }),
        signal: ctrl.signal
      });
      const txt = await r.text();
      let json;
      try { json = JSON.parse(txt); } catch (e) { throw new Error('La API respondió algo que no es JSON (código ' + r.status + ').'); }
      if (r.status >= 500) throw new Error('La API tiene un problema (código ' + r.status + ').');
      return json;
    } finally { clearTimeout(reloj); }
  }

  /**
   * consultar(consulta, opciones)
   *   opciones.modo: "auto" (real y, si falla, respaldo) | "real" | "respaldo"
   *   opciones.timeoutMs: cuánto esperar a la API real (por defecto 8000)
   */
  async function consultar(consulta, opciones = {}) {
    const modo = opciones.modo || 'auto';
    const timeoutMs = opciones.timeoutMs || 8000;
    const t0 = performance.now();
    if (modo !== 'respaldo') {
      try {
        const json = await consultarReal(consulta, timeoutMs);
        return empaquetar(json, 'real', performance.now() - t0);
      } catch (e) {
        if (modo === 'real') {
          return { ok: false, json: null, texto: '', bytes: 0, bytesDatos: 0, ms: Math.round(performance.now() - t0), fuente: 'real',
                   errores: [e.name === 'AbortError' ? 'La API tardó demasiado en responder.' : (e.message || String(e))] };
        }
        // modo auto: seguimos con el respaldo
      }
    }
    const t1 = performance.now();
    const json = await ejecutarEnRespaldo(consulta);
    const r = empaquetar(json, 'respaldo', performance.now() - (modo === 'respaldo' ? t1 : t0));
    return r;
  }

  /** Revisa en segundos si la API real está disponible. */
  async function apiDisponible(timeoutMs = 6000) {
    try { const j = await consultarReal('{ pages(first:1) { nodes { title } } }', timeoutMs); return !!(j && j.data); }
    catch (e) { return false; }
  }

  /** Descarga todo desde la API real y arma un respaldo nuevo y completo. */
  async function generarRespaldoCompleto(alAvanzar) {
    const tipos = {
      eventos: 'title slug fecha tipo content categories { nodes { name slug } }',
      personajes: 'title slug content entrevistas { nodes { slug } }',
      entrevistas: 'title slug fecha personajes { nodes { slug } } transcripciones { nodes { title } }',
      terminos: 'title slug content',
      documentos: 'title slug tituloCorto descripcion fecha autores fuente identificador',
      categories: 'name slug count description parent { node { slug } }'
    };
    const salida = { _info: { descripcion: 'Copia de respaldo de la API Historia del Internet en Colombia (Uniandes).', fuente: API_URL, fecha_copia: new Date().toISOString().slice(0, 10) } };
    for (const [nombre, campos] of Object.entries(tipos)) {
      let after = null, todos = [];
      do {
        const arg = after ? ', after: "' + after + '"' : '';
        const j = await consultarReal('{ ' + nombre + '(first: 100' + arg + ') { pageInfo { hasNextPage endCursor } nodes { ' + campos + ' } } }', 20000);
        if (j.errors) throw new Error(nombre + ': ' + j.errors[0].message);
        todos = todos.concat(j.data[nombre].nodes);
        after = j.data[nombre].pageInfo.hasNextPage ? j.data[nombre].pageInfo.endCursor : null;
        if (alAvanzar) alAvanzar(nombre, todos.length);
      } while (after);
      salida[nombre] = todos;
    }
    const pj = await consultarReal('{ pages { nodes { title slug } } }', 20000);
    salida.pages = pj.data.pages.nodes;
    const limpiar = s => s == null ? null : String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#8217;|&#8216;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&#8211;/g, '-').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() || null;
    ['eventos', 'personajes', 'terminos'].forEach(k => salida[k].forEach(x => { x.content = limpiar(x.content); }));
    salida.documentos.forEach(x => { x.descripcion = limpiar(x.descripcion); x.fuente = limpiar(x.fuente); });
    salida.categories.forEach(x => { x.description = limpiar(x.description); });
    return salida;
  }

  /** Convierte un respaldo en el texto del archivo datos/respaldo.js */
  function respaldoComoArchivoJS(respaldo) {
    return '/* Respaldo de la API Historia del Internet en Colombia. Lo usa el juego si la API no responde. */\n' +
      'window.RESPALDO_INCRUSTADO = ' + JSON.stringify(respaldo) + ';\n';
  }

  window.HistoriaAPI = {
    respaldoComoArchivoJS,
    URL: API_URL,
    consultar,
    apiDisponible,
    generarRespaldoCompleto,
    cargarRespaldo,
    /** Convierte bytes a "megas" del juego. 1 mega del juego = 1 KB real. */
    bytesAMegas: b => Math.max(1, Math.ceil(b / 1024))
  };
})();
