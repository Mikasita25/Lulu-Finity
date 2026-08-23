# Lulu Finity

Aplicación de escritorio para Windows que conecta con comentarios de TikTok LIVE, reproduce TTS y administra música de YouTube desde una cola continua.

## Funciones

- Comentarios de TikTok LIVE mediante `tiktok-live-connector`.
- Voces de Windows y voces neuronales online opcionales.
- Reproductor persistente de YouTube con cola, progreso, volumen y recomendaciones.
- Selección automática del primer resultado normal de YouTube.
- Comandos personalizados creados desde la interfaz.
- Editor inmersivo de comandos y automatizaciones con tres pasos y resumen en vivo.
- Permisos de música para todos, seguidores, miembros o usuarios elegidos.
- Filtros, límites por usuario y simulador local.
- Actualizaciones mediante GitHub Releases.
- Instalador por usuario sin permisos de administrador.
- Mensajes automáticos configurables en el chat del LIVE desde la cuenta creadora iniciada localmente.
- Doce temas coordinados que aplican color y contraste a texto, campos, botones, casillas, radios y estados.
- Optimización segura que libera solo recursos inactivos y conserva LIVE, TTS, música, automatizaciones, juegos y fuentes conectadas.
- Biblioteca incluida de 24 sonidos CC0, con escucha previa y opción de agregar archivos propios.
- Filtro opcional para dejar visibles las conversaciones que empiezan con `@usuario` sin leerlas por TTS.
- Doce fondos independientes para cada fuente HTTPS/local de Música, Monedas, Juegos/Ruleta, Alertas, Metas y Regalos.

## Publicar una versión

Al subir a `main`, GitHub Actions valida el código, compila Windows y crea o actualiza la Release correspondiente a la versión de `package.json`.

## Compatibilidad

La versión 0.9.0 corrige la detección de la carpeta de instalación en Windows y evita depender de una ruta `localAppData` no admitida por Electron.

## Avisos

TikTok LIVE Connector es un proyecto de ingeniería inversa. Algunas insignias de seguidor o miembro pueden no venir incluidas en todos los comentarios; la lista manual de usuarios permitidos no depende de esas insignias. Las voces online requieren internet.

## Licencia

AGPL-3.0-or-later.


## Novedades de 0.9.0

- Panel principal más limpio sin la mascota lateral.
- La tarjeta de conexión y usuario permanece visible.
- Cola de YouTube ordenable, límite de duración, duplicados y listas de bloqueo.
- Apariencia configurable con temas, brillo, transparencia, bordes y paneles visibles.


## 0.10.0

Incluye Eventos de TikTok LIVE, Spotify persistente y la sección Sobre Lulu.

## Versión 0.12.0

- Una instalación controla un LIVE de TikTok a la vez; cada computadora guarda su propia configuración y sesiones.
- El propietario elige YouTube o Spotify como proveedor del comando general de música.
- Los permisos de lectura TTS son independientes de los permisos para pedir canciones.
- Es posible asignar una voz local u online a usuarios concretos.
- El botón **Actualizar ahora** instala la nueva versión automáticamente al terminar la descarga.


## Comandos multimedia

Los comandos personalizados pueden reproducir sonidos o mostrar imágenes locales. En Eventos también se pueden crear reglas para regalos o stickers específicos.


## Cierre completo

Al cerrar la ventana principal, Lulu Finity desconecta el LIVE, cierra YouTube y Spotify y termina todos sus procesos.


## Economía y stickers de Fan

La economía se guarda localmente en cada instalación. Las recompensas y costos son configurables. Los stickers de Fan se reciben mediante el evento `emote` del conector y se pueden vincular a sonidos por ID.


## Superposición del stream

Desde **Comandos → Superposición del stream**, copia el enlace y agrégalo como fuente de navegador de 1920 × 1080 en OBS o TikTok LIVE Studio. Las acciones de imagen y GIF se envían a esa fuente local.


## Rankings en pantalla

La sección **Rankings** genera cuatro enlaces locales para fuentes de navegador. Puedes mostrar Top Gifters, tap taps, monedas de Lulu y otros datos del LIVE, además de personalizar fuente, colores, opacidad, estilo y texto RGB.


## Widgets del stream

La sección Rankings también ofrece una lista de reproducción y una tarjeta compacta de monedas. Juegos y Automatizaciones añaden fuentes para partidas, alertas, metas y regalos. Las seis fuentes generan enlaces HTTPS para TikTok LIVE Studio y enlaces locales para OBS.

Cada fuente conserva su propio diseño entre catorce temas: **Lulu Rosa, Aurora, Cyber, Arcade, Holograma, Sakura, Miku, Lavanda, Atardecer, Dorado, Menta, Océano, Vampiro y Monocromo**. El tema forma parte del enlace copiado y las fuentes ya conectadas se actualizan automáticamente al elegir otro, así que TikTok LIVE Studio u OBS coincide con la muestra de Lulu. Todas las tarjetas muestran datos permanentes de ejemplo para elegir el diseño sin esperar comentarios, comandos, regalos, canciones ni actividad del LIVE.

Además del tema, cada una de las seis fuentes permite elegir independientemente entre 12 fondos: **Esencia, Estrellas, Aurora viva, Cuadrícula, Cristal, Burbujas, Vinilo, Pixel party, Ondas, Confeti, Reflectores y Medianoche**. Tema y fondo viajan en el enlace HTTPS/local y se sincronizan con fuentes ya conectadas.

## Biblioteca de sonidos

Comandos, Automatizaciones y Eventos comparten una galería de 24 sonidos incluidos. Puedes buscar, filtrar y escuchar cada efecto antes de elegirlo, o pulsar **Agregar sonido propio** para conservar el flujo de archivos personalizados. Los efectos incluidos proceden de los paquetes Interface Sounds y Casino Audio de Kenney y se distribuyen bajo CC0.

## Conversaciones entre usuarios

En **TTS y voces → Lectura inteligente** puedes activar o desactivar **Ignorar conversaciones con @usuario**. Cuando está activo, un comentario que comienza con una mención sigue apareciendo en el panel y puede alimentar las funciones del LIVE, pero no se agrega a la cola de voz.

## Relay de Railway

Despliega la carpeta `railway-relay` y configura `EULER_API_KEYS` y `CLIENT_TOKENS`. La aplicación oficial ya incluye el dominio del relay; el token del cliente se inyecta como secreto durante la compilación y los usuarios no deben configurar nada.


## Mensajes automáticos del LIVE

En **Ajustes → Mensajes automáticos en el LIVE**, abre TikTok e inicia sesión con la cuenta creadora. Lulu puede enviar plantillas al agregar, iniciar, terminar o saltar una canción y al conectarse al LIVE. La sesión se conserva en una partición local de Electron y no se manda a Railway. La integración depende de la interfaz web de TikTok, por lo que incluye un botón para comprobar y probar el envío.


## Lulu Finity 1.0

Lulu Local permite leer el chat sin Internet e importar voces `.lfvoice`. La interfaz está organizada por tareas e incluye búsqueda global, limpieza Unicode y perfiles de rendimiento.


## Frontera de seguridad del relay

El WebSocket del LIVE es un canal de recepción con una lista cerrada de eventos públicos. El servidor no puede invocar IPC, pedir archivos, leer ajustes ni solicitar la sesión de TikTok. Lulu filtra y limita cada paquete en el proceso principal antes de entregarlo a la interfaz; una solicitud remota prohibida cierra la conexión. Un servidor comprometido aún podría fabricar un evento público, pero no leer datos locales mediante el protocolo.


## Navegación de una sola ventana

Lulu Finity usa una sola ventana principal para todas las categorías. Solo la página visible participa en la interfaz y las vistas previas con contenido web se suspenden al salir; los servicios que estén realmente en uso, como un LIVE, una canción, una partida o una fuente conectada, continúan funcionando.

## HTTPS para overlays y widgets

Los instaladores oficiales incluyen `cloudflared.exe` dentro de los recursos de la aplicación y Lulu lo valida antes de abrir el túnel. Si el recurso no está disponible, la aplicación intenta recuperarlo desde la publicación oficial de Cloudflare. El enlace HTTPS permanece activo mientras exista una fuente conectada o un túnel solicitado, aunque cambies de categoría o uses un perfil de rendimiento.

## Optimización segura

Los perfiles Ahorro y Equilibrado esperan 30 segundos y 3 minutos respectivamente antes de liberar componentes inactivos. Las funciones activas se detectan por su estado real y se protegen; Electron evita la suspensión del proceso solo mientras LIVE, voz, música, juegos, automatizaciones o fuentes HTTPS necesitan seguir trabajando.
