/* =========================================================================
   Territorios Conectados — Registro, grupos y tablero del grupo (Fase 2)
   ========================================================================= */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------------
  // Listas de emojis
  // ---------------------------------------------------------------------
  const AVATARES = {
    'Animales': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦉','🦇','🐺','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐢','🦎','🐙','🦀','🐠','🐬','🐳','🦈','🐊','🦓','🦒','🐘','🦛','🦙','🦥','🦦','🦩','🦚','🦜','🐿️','🦔','🐌'],
    'Personas': ['🧑‍🚀','🧑‍🌾','🧑‍🎨','🧑‍🔬','🧑‍💻','🧑‍🍳','🧑‍🎤','🧑‍🏫','🧙','🧚','🧜','🦸','🥷','🤖','👾','👻','🎃','⛄','😎','🤠','🥳','🤓','😺','👽'],
    'Comida': ['🍉','🍓','🍍','🥭','🍌','🥑','🌽','🥕','🍄','🍩','🧁','🍪','🍦','🥐','🫐','🍋','🥥','☕','🧋','🍿'],
    'Cosas': ['⚽','🎸','🎨','🚀','🛸','🎈','🪁','🔮','💎','🌈','⭐','🌙','☀️','⚡','🔥','💧','🌵','🌻','🌴','🎲','🧩','📡','🎧','🛶']
  };
  // Quitamos repetidos por si acaso
  Object.keys(AVATARES).forEach(k => { AVATARES[k] = [...new Set(AVATARES[k])]; });

  const EMOJIS_GRUPO = ['🐦','🌊','🔥','⭐','🌙','🌈','🍀','🌻','🐝','🦋','🐢','🐬','🦜','🌵','🍉','🎈','🚀','🎸','🎨','⚽',
    '🏔️','🌋','🌴','🍄','💡','📡','🛰️','🧭','🗺️','🪐','🌟','💫','🎯','🧩','🪁','🏆','🌽','☕','🦙','🐆'];

  // ---------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------
  const estado = {
    avatar: { crear: null, entrar: null },
    emojiGrupo: null,
    sesion: null,
    entrarPendiente: null    // { nombre, codigo } mientras elige avatar
  };

  // ---------------------------------------------------------------------
  // Utilidades de pantalla
  // ---------------------------------------------------------------------
  function mostrar(id) {
    document.querySelectorAll('#ui > .cartel').forEach(s => { s.hidden = s.id !== id; });
    const primero = $(id).querySelector('input:not([type=hidden])');
    if (primero) setTimeout(() => primero.focus(), 60);
    window.scrollTo({ top: 0 });
  }

  let relojAviso = null;
  function aviso(texto, tipo) {
    const a = $('aviso');
    a.textContent = texto; a.className = tipo || ''; a.hidden = false;
    clearTimeout(relojAviso);
    relojAviso = setTimeout(() => { a.hidden = true; }, 4200);
  }

  function mostrarError(id, texto) {
    const e = $(id);
    if (!texto) { e.hidden = true; return; }
    e.textContent = texto; e.hidden = false;
  }

  async function conBoton(boton, textoEspera, fn) {
    const original = boton.innerHTML;
    boton.disabled = true; boton.textContent = textoEspera;
    try { return await fn(); }
    finally { boton.disabled = false; boton.innerHTML = original; }
  }

  const limpio = t => String(t || '').replace(/\s+/g, ' ').trim();

  // ---------------------------------------------------------------------
  // Selector de emojis
  // ---------------------------------------------------------------------
  function crearSelector(contenedor, categorias, alElegir) {
    const nombres = Object.keys(categorias);
    const pestanas = document.createElement('div');
    pestanas.className = 'pestanas'; pestanas.setAttribute('role', 'tablist');
    const rejilla = document.createElement('div');
    rejilla.className = 'emojis';
    let elegido = null;

    function pintar(cat) {
      rejilla.innerHTML = '';
      categorias[cat].forEach(e => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = e;
        b.setAttribute('aria-label', 'Emoji ' + e);
        b.setAttribute('aria-pressed', String(e === elegido));
        b.addEventListener('click', () => {
          elegido = e;
          rejilla.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.textContent === e)));
          alElegir(e);
        });
        rejilla.appendChild(b);
      });
      pestanas.querySelectorAll('.pestana').forEach(p => p.setAttribute('aria-selected', String(p.dataset.cat === cat)));
    }

    if (nombres.length > 1) {
      nombres.forEach(cat => {
        const p = document.createElement('button');
        p.type = 'button'; p.className = 'pestana'; p.textContent = cat; p.dataset.cat = cat;
        p.setAttribute('role', 'tab');
        p.addEventListener('click', () => pintar(cat));
        pestanas.appendChild(p);
      });
      contenedor.appendChild(pestanas);
    }
    contenedor.appendChild(rejilla);
    pintar(nombres[0]);
  }

  function actualizarVista(idVista, nombre, avatar) {
    const v = $(idVista);
    v.querySelector('.nombre').textContent = limpio(nombre) || 'Tu nombre';
    v.querySelector('.cuerpo').textContent = avatar || '❔';
  }

  // ---------------------------------------------------------------------
  // Crear grupo
  // ---------------------------------------------------------------------
  function prepararCrear() {
    $('crear-nombre').addEventListener('input', () => actualizarVista('vista-crear', $('crear-nombre').value, estado.avatar.crear));
    $('crear-grupo').addEventListener('input', () => { $('vista-grupo-nombre').textContent = limpio($('crear-grupo').value) || 'Nombre del grupo'; });

    $('crear-siguiente').addEventListener('click', () => {
      const n = limpio($('crear-nombre').value);
      if (n.length < 2) return mostrarError('error-crear-1', 'Escribe tu nombre (mínimo 2 letras).');
      if (!estado.avatar.crear) return mostrarError('error-crear-1', 'Elige un emoji para tu avatar.');
      mostrarError('error-crear-1', null);
      mostrar('p-crear-2');
    });

    $('crear-listo').addEventListener('click', () => {
      const g = limpio($('crear-grupo').value);
      if (g.length < 2) return mostrarError('error-crear-2', 'Escribe el nombre del grupo (mínimo 2 letras).');
      if (!estado.emojiGrupo) return mostrarError('error-crear-2', 'Elige un emoji para tu grupo.');
      mostrarError('error-crear-2', null);
      conBoton($('crear-listo'), 'Creando…', async () => {
        try {
          const s = await Servidor.crearGrupo(limpio($('crear-nombre').value), estado.avatar.crear, g, estado.emojiGrupo);
          estado.sesion = s;
          revelar(s, true);
        } catch (e) { mostrarError('error-crear-2', e.message); }
      });
    });

    [['crear-nombre', 'crear-siguiente'], ['crear-grupo', 'crear-listo']].forEach(([campo, boton]) => {
      $(campo).addEventListener('keydown', e => { if (e.key === 'Enter') $(boton).click(); });
    });
  }

  // ---------------------------------------------------------------------
  // Entrar con código
  // ---------------------------------------------------------------------
  function prepararEntrar() {
    const enviar = () => {
      const nombre = limpio($('entrar-nombre').value);
      const codigo = limpio($('entrar-codigo').value);
      if (nombre.length < 2) return mostrarError('error-entrar', 'Escribe tu nombre (mínimo 2 letras).');
      if (codigo.length < 4) return mostrarError('error-entrar', 'Escribe el código del grupo, por ejemplo MANGO-482.');
      mostrarError('error-entrar', null);
      conBoton($('entrar-listo'), 'Buscando…', async () => {
        try {
          const r = await Servidor.entrar(nombre, codigo, null);
          if (r && r.necesita_avatar) {
            estado.entrarPendiente = { nombre, codigo };
            $('unirse-emoji').textContent = r.grupo.emoji;
            $('unirse-nombre').textContent = r.grupo.nombre;
            actualizarVista('vista-entrar', nombre, estado.avatar.entrar);
            mostrar('p-entrar-avatar');
            return;
          }
          estado.sesion = r;
          aviso('¡Hola de nuevo, ' + r.jugador.nombre + '!', 'ok');
          abrirJuego(r);
        } catch (e) { mostrarError('error-entrar', e.message); }
      });
    };
    $('entrar-listo').addEventListener('click', enviar);
    ['entrar-nombre', 'entrar-codigo'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); }));

    $('entrar-unirme').addEventListener('click', () => {
      if (!estado.avatar.entrar) return mostrarError('error-entrar-avatar', 'Elige un emoji para tu avatar.');
      mostrarError('error-entrar-avatar', null);
      const p = estado.entrarPendiente;
      conBoton($('entrar-unirme'), 'Entrando…', async () => {
        try {
          const s = await Servidor.entrar(p.nombre, p.codigo, estado.avatar.entrar);
          estado.sesion = s;
          revelar(s, false);
        } catch (e) { mostrarError('error-entrar-avatar', e.message); }
      });
    });
  }

  // ---------------------------------------------------------------------
  // Revelar el territorio (sorteo animado)
  // ---------------------------------------------------------------------
  function revelar(s, esNuevoGrupo) {
    const t = window.TERRITORIOS[s.grupo.territorio];
    $('revelar-paso').textContent = esNuevoGrupo ? '¡Grupo creado!' : '¡Ya eres parte de ' + s.grupo.nombre + '!';
    $('revelar-codigo-caja').hidden = !esNuevoGrupo;
    $('revelar-codigo').textContent = s.grupo.codigo;
    $('revelar-texto').textContent = esNuevoGrupo ? 'Ahora, el sorteo de su territorio…' : 'Tu grupo vive en…';
    $('revelar-territorio').innerHTML = '&nbsp;';
    $('revelar-lema').innerHTML = '&nbsp;';
    $('revelar-seguir').disabled = true;
    const ruleta = $('ruleta');
    ruleta.className = 'ruleta girando';
    ruleta.style.background = ''; ruleta.style.borderColor = '';
    mostrar('p-revelar');

    const ids = window.ORDEN_TERRITORIOS;
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let vueltas = 0, i = 0;
    const total = sinMovimiento ? 0 : (esNuevoGrupo ? 22 : 10);
    (function girar() {
      if (vueltas < total) {
        ruleta.textContent = window.TERRITORIOS[ids[i % ids.length]].emoji;
        i++; vueltas++;
        setTimeout(girar, 70 + vueltas * 9);
        return;
      }
      ruleta.textContent = t.emoji;
      ruleta.className = 'ruleta listo';
      ruleta.style.background = t.color; ruleta.style.borderColor = '#fff';
      $('revelar-territorio').textContent = t.nombre;
      $('revelar-lema').textContent = t.lema;
      $('revelar-seguir').disabled = false;
      $('revelar-seguir').focus();
    })();
  }

  // ---------------------------------------------------------------------
  // Empezar a jugar
  // ---------------------------------------------------------------------
  let jugando = false;
  async function abrirJuego(s) {
    if (jugando) return;
    jugando = true;
    estado.sesion = s;
    try {
      if (window.__fondo) { window.__fondo.destroy(true); window.__fondo = null; }
      document.getElementById('fondo').remove();
      await Juego.iniciar(s);
    } catch (e) {
      jugando = false;
      aviso('No se pudo abrir el mapa: ' + e.message, 'error');
      mostrar('p-inicio');
    }
  }

  function prepararTablero() {
    $('revelar-seguir').addEventListener('click', () => abrirJuego(estado.sesion));
  }

  // ---------------------------------------------------------------------
  // Arranque
  // ---------------------------------------------------------------------
  function prepararNavegacion() {
    $('ir-crear').addEventListener('click', () => mostrar('p-crear-1'));
    $('ir-entrar').addEventListener('click', () => mostrar('p-entrar'));
    document.querySelectorAll('[data-volver]').forEach(b => b.addEventListener('click', () => mostrar(b.dataset.volver)));

    document.querySelectorAll('[data-selector="avatar"]').forEach(c => {
      const destino = c.dataset.destino;
      crearSelector(c, AVATARES, e => {
        estado.avatar[destino] = e;
        if (destino === 'crear') actualizarVista('vista-crear', $('crear-nombre').value, e);
        else actualizarVista('vista-entrar', estado.entrarPendiente ? estado.entrarPendiente.nombre : '', e);
      });
    });
    document.querySelectorAll('[data-selector="grupo"]').forEach(c => {
      crearSelector(c, { 'Emojis': EMOJIS_GRUPO }, e => { estado.emojiGrupo = e; $('vista-grupo-emoji').textContent = e; });
    });
  }

  async function arrancar() {
    try { window.__fondo = window.iniciarFondo && window.iniciarFondo('fondo'); } catch (e) { /* el fondo es decorativo */ }
    prepararNavegacion();
    prepararCrear();
    prepararEntrar();
    prepararTablero();

    if (!Servidor.configurado()) { mostrar('p-sin-config'); return; }
    if (!Servidor.iniciar()) {
      mostrar('p-inicio');
      aviso('No se pudo cargar la conexión con Supabase. Revisa el internet y recarga la página.', 'error');
      return;
    }
    try {
      const s = await Servidor.miSesion();
      if (s) { abrirJuego(s); aviso('¡Hola de nuevo, ' + s.jugador.nombre + '!', 'ok'); }
      else mostrar('p-inicio');
    } catch (e) {
      mostrar('p-inicio');
      aviso(e.message, 'error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
