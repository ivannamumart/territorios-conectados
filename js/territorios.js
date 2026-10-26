/* =========================================================================
   Territorios Conectados — Cómo se ve y cómo se describe cada territorio
   Los niveles van de 1 (muy poco) a 4 (mucho).
   ========================================================================= */
window.TERRITORIOS = {
  ciudad_luz: {
    nombre: 'Ciudad Luz', emoji: '🏙️', color: '#a9b8ff', tinta: '#3a4aa8',
    lema: 'Todo conectado, pero cada quien en lo suyo.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 4, nota: 'Fibra rápida' },
      { icono: '⚡', nombre: 'Energía',  nivel: 4, nota: 'Abundante' },
      { icono: '🍎', nombre: 'Comida',   nivel: 1, nota: 'Cara y escasa' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 1, nota: 'Poca' }
    ],
    especial: 'Consultar el Archivo te cuesta muy pocos megas.'
  },
  puerto_mercado: {
    nombre: 'Puerto Mercado', emoji: '⚓', color: '#ffc38a', tinta: '#9a5414',
    lema: 'Aquí todo se compra y se vende.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 3, nota: 'Media' },
      { icono: '⚡', nombre: 'Energía',  nivel: 2, nota: 'Cara' },
      { icono: '🍎', nombre: 'Comida',   nivel: 2, nota: 'Media' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 2, nota: 'Media' }
    ],
    especial: 'Mucho comercio: los precios suben y bajan.'
  },
  valle_verde: {
    nombre: 'Valle Verde', emoji: '🌾', color: '#a8e0a0', tinta: '#2f7a3a',
    lema: 'La tierra da, la señal no.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 2, nota: 'Lenta' },
      { icono: '⚡', nombre: 'Energía',  nivel: 3, nota: 'Solar, barata y limitada' },
      { icono: '🍎', nombre: 'Comida',   nivel: 4, nota: 'Abundante' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 3, nota: 'Buena' }
    ],
    especial: 'Pueden sembrar y producir alimentos.'
  },
  montana_alta: {
    nombre: 'Montaña Alta', emoji: '⛰️', color: '#b9d3c9', tinta: '#3d6658',
    lema: 'Poca señal, mucha gente que ayuda.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 1, nota: 'Casi sin señal' },
      { icono: '⚡', nombre: 'Energía',  nivel: 1, nota: 'Escasa' },
      { icono: '🍎', nombre: 'Comida',   nivel: 2, nota: 'Media' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 4, nota: 'Muy fuerte' }
    ],
    especial: 'Ayuda gratis entre vecinos: compartir no cuesta nada.'
  },
  isla_sol: {
    nombre: 'Isla Sol', emoji: '🏝️', color: '#ffe08a', tinta: '#8a6a00',
    lema: 'Sol de sobra, datos carísimos.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 2, nota: 'Satélite, cara' },
      { icono: '⚡', nombre: 'Energía',  nivel: 4, nota: 'Solar, abundante' },
      { icono: '🍎', nombre: 'Comida',   nivel: 2, nota: 'Pesca, media' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 2, nota: 'Media' }
    ],
    especial: 'La energía es casi regalada; los megas, no.'
  },
  pueblo_rio: {
    nombre: 'Pueblo del Río', emoji: '🛶', color: '#9fd8e8', tinta: '#22677a',
    lema: 'Lo que es de uno es de todos.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 2, nota: 'Media, con cortes' },
      { icono: '⚡', nombre: 'Energía',  nivel: 3, nota: 'Media' },
      { icono: '🍎', nombre: 'Comida',   nivel: 3, nota: 'Buena' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 4, nota: 'Cooperativa' }
    ],
    especial: 'Cooperativa: el grupo comparte sus recursos.'
  }
};
window.ORDEN_TERRITORIOS = ['ciudad_luz', 'puerto_mercado', 'valle_verde', 'montana_alta', 'isla_sol', 'pueblo_rio'];
