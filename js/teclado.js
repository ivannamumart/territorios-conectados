/* =========================================================================
   Territorios Conectados — Escritura obligatoria a mano
   -------------------------------------------------------------------------
   Protege un campo de texto: no deja pegar, arrastrar, cortar ni
   autocompletar, y mide el ritmo de tecleo. El servidor usa esas medidas
   para marcar consultas sospechosas en el panel de la profe.
   ========================================================================= */
(function () {
  'use strict';

  function proteger(campo, opciones) {
    const op = opciones || {};
    campo.setAttribute('autocomplete', 'off');
    campo.setAttribute('autocorrect', 'off');
    campo.setAttribute('autocapitalize', 'off');
    campo.setAttribute('spellcheck', 'false');
    campo.setAttribute('data-gramm', 'false');            // extensiones de corrección
    campo.setAttribute('data-enable-grammarly', 'false');

    let m;
    function reiniciar() {
      m = {
        base: campo.value.length,
        teclado: 0, grandes: 0, pegar: 0, teclas: 0,
        tiempos: [], inicio: 0, ultima: 0
      };
    }
    reiniciar();

    const avisar = texto => { if (op.alBloquear) op.alBloquear(texto); };

    ['paste', 'drop', 'cut'].forEach(tipo => campo.addEventListener(tipo, e => {
      e.preventDefault();
      if (tipo !== 'cut') m.pegar++;
      avisar(tipo === 'cut' ? 'Aquí no se puede cortar texto.' : 'Aquí todo se escribe a mano: no se puede pegar ni arrastrar texto.');
    }));
    campo.addEventListener('dragover', e => e.preventDefault());
    campo.addEventListener('contextmenu', e => e.preventDefault());

    campo.addEventListener('beforeinput', e => {
      const t = e.inputType || '';
      if (/^insertFrom(Paste|Drop|Yank|PasteAsQuotation)$/.test(t) || t === 'insertReplacementText' || t === 'deleteByCut') {
        e.preventDefault();
        m.pegar++;
        avisar('Aquí todo se escribe a mano.');
      }
    });

    campo.addEventListener('keydown', e => {
      // Tabulador: dos espacios (para ordenar las llaves de GraphQL)
      if (e.key === 'Tab' && campo.tagName === 'TEXTAREA') {
        e.preventDefault();
        const ini = campo.selectionStart, fin = campo.selectionEnd;
        campo.setRangeText('  ', ini, fin, 'end');
        m.teclado += 2;
        registrarTecla();
        return;
      }
      if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') registrarTecla();
    });

    function registrarTecla() {
      const ahora = performance.now();
      if (!m.inicio) m.inicio = ahora;
      if (m.ultima) {
        const d = ahora - m.ultima;
        if (d < 2000) m.tiempos.push(d);   // las pausas largas (pensar) no cuentan
      }
      m.ultima = ahora;
      m.teclas++;
    }

    campo.addEventListener('input', e => {
      const t = e.inputType || '';
      const dato = e.data || '';
      if (t === 'insertText' || t === 'insertCompositionText') {
        if (dato.length <= 2) m.teclado += dato.length || 1;
        else m.grandes++;
      } else if (t === 'insertLineBreak' || t === 'insertParagraph') {
        m.teclado++;
      } else if (/^insert/.test(t)) {
        m.grandes++;
      }
    });

    function metricas() {
      const ts = m.tiempos;
      const media = ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : 0;
      const desv = ts.length > 1 ? Math.sqrt(ts.reduce((a, b) => a + (b - media) * (b - media), 0) / ts.length) : 0;
      return {
        crecimiento: Math.max(0, campo.value.length - m.base),
        insertados_teclado: m.teclado,
        insertados_grandes: m.grandes,
        intentos_pegar: m.pegar,
        teclas: m.teclas,
        media_ms: Math.round(media),
        desv_ms: Math.round(desv),
        duracion_ms: m.inicio ? Math.round(performance.now() - m.inicio) : 0
      };
    }

    return { metricas, reiniciar };
  }

  window.Teclado = { proteger };
})();
