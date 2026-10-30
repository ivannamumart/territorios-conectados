/* =========================================================================
   Territorios Conectados — Cómo se ve y cómo se describe cada territorio
   Los niveles van de 1 (muy poco) a 4 (mucho).
   ========================================================================= */
window.TERRITORIOS = {
  ciudad_luz: {
    nombre: 'Ciudad Luz', emoji: '🏙️', color: '#a9b8ff', tinta: '#3a4aa8',
    lema: 'Todo conectado, pero la tierra no da mucho.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 4, nota: 'Fibra rápida' },
      { icono: '⚡', nombre: 'Energía', nivel: 4, nota: 'Se recarga rápido' },
      { icono: '🌸', nombre: 'Producto', nivel: 1, nota: 'Flores: 1 cada minuto' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 1, nota: 'Poca' }
    ],
    especial: 'Consultar la API te cuesta muy poca energía.'
  },
  puerto_mercado: {
    nombre: 'Puerto Mercado', emoji: '⚓', color: '#ffc38a', tinta: '#9a5414',
    lema: 'Aquí todo se cambia por algo.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 3, nota: 'Media' },
      { icono: '⚡', nombre: 'Energía', nivel: 3, nota: 'Media' },
      { icono: '🧂', nombre: 'Producto', nivel: 3, nota: 'Sal: 2 cada 45 s' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 2, nota: 'Media' }
    ],
    especial: 'Buen punto medio: vale la pena comerciar.'
  },
  valle_verde: {
    nombre: 'Valle Verde', emoji: '🌾', color: '#a8e0a0', tinta: '#2f7a3a',
    lema: 'La tierra da, la señal no.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 2, nota: 'Lenta' },
      { icono: '⚡', nombre: 'Energía', nivel: 2, nota: 'Se recarga lento' },
      { icono: '🌽', nombre: 'Producto', nivel: 4, nota: 'Maíz: 2 cada 45 s' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 3, nota: 'Buena' }
    ],
    especial: 'Producen mucho, pero consultar les cuesta más.'
  },
  montana_alta: {
    nombre: 'Montaña Alta', emoji: '⛰️', color: '#b9d3c9', tinta: '#3d6658',
    lema: 'Poca señal, mucha gente que ayuda.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 1, nota: 'Casi sin señal' },
      { icono: '⚡', nombre: 'Energía', nivel: 1, nota: 'Escasa' },
      { icono: '☕', nombre: 'Producto', nivel: 4, nota: 'Café: 2 cada 40 s' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 4, nota: 'Muy fuerte' }
    ],
    especial: 'Enviar energía entre vecinos no pierde nada en el camino.'
  },
  isla_sol: {
    nombre: 'Isla Sol', emoji: '🏝️', color: '#ffe08a', tinta: '#8a6a00',
    lema: 'Sol de sobra, datos carísimos.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 2, nota: 'Satélite, cara' },
      { icono: '⚡', nombre: 'Energía', nivel: 4, nota: 'Solar, se recarga rápido' },
      { icono: '🥥', nombre: 'Producto', nivel: 3, nota: 'Cocos: 2 cada 45 s' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 2, nota: 'Media' }
    ],
    especial: 'Tienen energía de sobra, pero cada consulta les cuesta 6 veces más que en Ciudad Luz.'
  },
  pueblo_rio: {
    nombre: 'Pueblo del Río', emoji: '🛶', color: '#9fd8e8', tinta: '#22677a',
    lema: 'Lo que es de uno es de todos.',
    rasgos: [
      { icono: '📶', nombre: 'Conexión', nivel: 2, nota: 'Media, con cortes' },
      { icono: '⚡', nombre: 'Energía', nivel: 3, nota: 'Media' },
      { icono: '🐟', nombre: 'Producto', nivel: 3, nota: 'Pescado: 2 cada 45 s' },
      { icono: '🤝', nombre: 'Comunidad', nivel: 4, nota: 'Cooperativa' }
    ],
    especial: 'La señal se corta seguido: a veces la consulta no llega.'
  }
};
window.ORDEN_TERRITORIOS = ['ciudad_luz', 'puerto_mercado', 'valle_verde', 'montana_alta', 'isla_sol', 'pueblo_rio'];
