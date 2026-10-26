# Territorios Conectados

Juego multijugador en el navegador para el taller de Narrativas Digitales sobre la brecha digital.
Cada grupo vive en un territorio con distinta conexión, energía y comida. Para sobrevivir tienen que
consultar a mano la API de Historia del Internet en Colombia, comerciar entre islas y ayudarse.

## Páginas

| Página | Para quién |
|---|---|
| `index.html` | Estudiantes: el juego. |
| `admin.html` | Profesora, monitor y observadora: panel docente. |
| `final.html` | Pantalla final para proyectar (se abre sola cuando la profe termina el juego). |
| `probar-api.html` | Consola para probar la API y descargar un respaldo nuevo de sus datos. |

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/config.js` | **Aquí van los dos datos de Supabase** (dirección y llave pública). |
| `supabase/base-de-datos.sql` | Crea toda la base de datos. Se pega una vez en Supabase > SQL Editor. |
| `supabase/borrar-pruebas.sql` | Borra grupos y jugadores (el panel también tiene un botón para esto). |
| `js/territorios.js` | Textos y colores de los 6 territorios. |
| `js/mundo-datos.js` | Dónde va cada isla, puente y edificio (lo usan el juego y el panel). |
| `js/servidor.js` | Conexión con Supabase (con respaldo si el tiempo real falla). |
| `js/red.js` | Movimiento de los avatares en tiempo real. |
| `js/api.js` + `datos/respaldo.js` | Consultas a la API real; si no responde, usa la copia guardada. |
| `js/teclado.js` | Bloquea pegar/arrastrar y mide el ritmo de tecleo. |
| `js/entrada.js`, `js/fondo.js` | Registro, grupos y fondo animado. |
| `js/juego/*` | Mapa (Phaser 3), interiores, barra de recursos y paneles de cada lugar. |
| `js/admin.js`, `js/final.js`, `css/panel.css` | Panel docente y pantalla final. |

## Reglas principales

- **Recursos:** energía y comida (0 a 100) bajan 0,5 por minuto de juego (ajustable). Caminar gasta energía.
  Megas y monedas no bajan solos.
- **Rescate:** si energía o comida llegan a 0, el grupo tiene 15 minutos de juego (ajustable) para enviarle
  recursos. Si nadie llega, la persona queda como fantasma. Quien rescata gana 10 monedas.
- **Territorios:** cada uno tiene precios, costo de megas, retardo, cortes de señal y un trabajo propio
  (servidor de datos, intermediario, huerta, minga, paneles solares, pesca). Montaña Alta envía gratis;
  Pueblo del Río tiene fondo común.
- **Archivo:** cada consulta cobra megas según el tamaño real de la respuesta × el costo del territorio.
  Los visitantes pagan entrada. Si te quedas sin megas, solo llega parte de la respuesta.
- **Misiones:** 9 misiones (de la guiada a paginación). Cada estudiante tiene su propia variante según su nombre.
- **Puntaje del grupo:** monedas + energía + comida + megas ÷ 5 + 25 por misión. Los fantasmas solo suman misiones.

## Seguridad

- El navegador solo puede **leer** lo público. Todo cambio pasa por funciones de la base de datos que revisan
  las reglas (no se pueden regalar monedas desde la consola del navegador).
- Los códigos de grupo, las sesiones, las respuestas de las misiones y las claves del equipo docente no se
  pueden leer desde el navegador. Las claves están cifradas.
- La llave de `js/config.js` es pública por diseño. Nunca pongas ahí la llave secreta de Supabase.

## API Historia del Internet (verificada el 22 de octubre de 2026)

- `https://historiasinternetpre.uniandes.edu.co/graphql` (POST, JSON, sin llave). Acepta peticiones del navegador (CORS abierto).
- Máximo 100 resultados por consulta; sin `first` devuelve 10. Búsqueda: `where: { search: "..." }`.
- Fechas de eventos: solo el año. Entrevistas y documentos: `MM/DD/AAAA`. `entrevistas` no tiene `content`.
