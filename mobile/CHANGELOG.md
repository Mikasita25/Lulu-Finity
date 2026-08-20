# Lulú Finity Mobile

## 1.2.3

- Añade reproducción de música persistente en segundo plano mediante la sesión multimedia/foreground service de Android configurada con `expo-audio`.
- Mantiene una sesión multimedia activa mientras existe una canción actual para reducir que Android suspenda Lulú al minimizarla o bloquear la pantalla.
- Muestra la canción actual y quién la pidió en los controles multimedia/notificación de Android.
- Sincroniza **Pausar/Reanudar música** con el reproductor interno de YouTube y con los controles multimedia del sistema.
- Añade un control de volumen de música de 0% a 100%, con mute, subir y bajar volumen.
- El volumen se aplica en tiempo real al video de YouTube que ya está sonando y se guarda para las siguientes canciones.
- Añade el control de volumen tanto en **Música** como dentro de **Control del LIVE**.
- Separa claramente **Pausar música** de **Pausar solicitudes**: una controla la reproducción actual y la otra decide si el chat puede seguir usando `!cancion`, `!song` y `!sr`.
- El botón **Siguiente** desde Control del LIVE cambia directamente la canción del motor persistente sin abrir el navegador visible.
- Reinyecta el estado de reproducción y volumen cuando Android cambia Lulú entre primer plano, inactiva y segundo plano.
- Configura `expo-audio` con `enableBackgroundPlayback` para generar el servicio/permisos nativos de reproducción multimedia durante el prebuild Android.
- Añade pruebas de regresión para el servicio de segundo plano, controles multimedia, volumen en vivo y estado de pausa.
- Confirma TypeScript, pruebas del LIVE, pruebas de interfaz, Expo Doctor, prebuild Android y compilación APK Release ARM64 con el servicio multimedia habilitado.
- Actualiza Android a `versionCode` 12.

> La sesión multimedia de Android hace la reproducción en segundo plano mucho más resistente. Algunos fabricantes pueden aplicar optimizaciones de batería especialmente agresivas, y forzar el cierre de la app siempre detendrá la reproducción.

## 1.2.2

- Hace que `!cancion`, `!song` y `!sr` funcionen como en la versión de PC: si no hay canción activa, la primera solicitud pasa inmediatamente a **Ahora suena** y comienza a reproducirse sin intervención manual.
- Las solicitudes recibidas mientras ya hay una canción sonando se agregan automáticamente a la cola.
- Añade un **motor de reproducción persistente** (`MusicPlaybackHost`) montado a nivel de la app, por lo que la música sigue funcionando aunque el streamer esté en Inicio, LIVE, Metas, Ranking u otra pantalla.
- Lulú abre automáticamente la búsqueda móvil de YouTube, selecciona el primer resultado de video válido y ejecuta la reproducción.
- Cuando el video actual termina, el motor detecta el evento `ended` y comienza automáticamente la siguiente solicitud de la cola.
- Los pedidos manuales también empiezan a reproducirse inmediatamente cuando el reproductor está libre; si ya hay música, entran a la cola.
- Los botones **Siguiente** y **Reproducir siguiente** ahora controlan directamente el motor persistente sin obligar a abrir el navegador visible.
- Conserva **Lulú Browser** como vista opcional para inspeccionar/buscar manualmente, sin que sea necesario tenerlo abierto para reproducir las solicitudes.
- Mantiene el bloqueo de mejor esfuerzo para banners, overlays, popups y anuncios de video dentro del WebView automático.
- Mantiene el volumen configurado por Lulú y solicita reproducción sin gesto manual mediante `mediaPlaybackRequiresUserAction={false}`.
- Añade pruebas de regresión que exigen: reproducción automática de la primera solicitud, motor persistente global, selección del primer resultado, `video.play()` y avance automático al terminar.
- Confirma TypeScript, pruebas del LIVE, pruebas de interfaz, Expo Doctor, prebuild Android y compilación APK Release ARM64 con el motor automático.
- Actualiza Android a `versionCode` 11.

> La automatización de YouTube y el bloqueo de anuncios dependen de la estructura de la página web de YouTube y pueden necesitar ajustes futuros si YouTube cambia su interfaz.

## 1.2.1

- Sustituye la apertura externa de YouTube por **Lulú Browser**, un navegador/reproductor de YouTube integrado dentro de la app.
- Añade `react-native-webview` 13.16.1, la versión compatible recomendada para Expo SDK 57.
- Las canciones de la cola, `!cancion`, `!song` y `!sr` ahora pueden reproducirse sin salir de Lulú Finity.
- Añade buscador de YouTube dentro del reproductor para cambiar de canción manualmente.
- Añade controles **Atrás**, **Recargar** y **Siguiente** dentro del navegador.
- El botón **Siguiente** consume directamente la siguiente solicitud de la cola y carga su búsqueda dentro del mismo navegador.
- Añade un bloqueador de mejor esfuerzo para elementos publicitarios de YouTube: limpia banners/overlays promocionales, intenta pulsar los botones de omitir anuncios y acelera al final los segmentos detectados como anuncio de video.
- Bloquea popups publicitarios conocidos y desactiva la apertura de ventanas adicionales desde WebView.
- Limita la navegación integrada a dominios de YouTube/Google necesarios para reproducción e inicio de sesión, bloqueando esquemas externos como `intent:`, `market:` y `vnd.youtube:`.
- Muestra un contador de elementos publicitarios bloqueados durante la sesión del navegador.
- Desde **Control del LIVE**, “Abrir reproductor interno” y “Siguiente” ya usan Lulú Browser en vez de `Linking.openURL()`.
- Mantiene cookies y almacenamiento web para que YouTube pueda conservar sesión/preferencias dentro del navegador.
- Añade pruebas de regresión que exigen el navegador interno, WebView, limpieza publicitaria y ausencia de apertura externa en Música/Control del LIVE.
- Confirma TypeScript, pruebas del LIVE, pruebas de interfaz, Expo Doctor, prebuild Android y compilación APK Release ARM64 con WebView.
- Actualiza Android a `versionCode` 10.

> El bloqueo de anuncios funciona por limpieza e interacción con la página y puede requerir ajustes si YouTube cambia su estructura interna.

## 1.2.0

- Convierte **En Vivo** en un **Control del LIVE** para manejar TTS, música, actividad reciente, metas y ranking desde una sola pantalla.
- Añade controles rápidos para activar/desactivar TTS y solicitudes de música sin salir del LIVE.
- Añade una nueva sección **Música** con cola persistente de solicitudes.
- Acepta solicitudes desde comentarios con `!cancion`, `!song` y `!sr`.
- Permite agregar canciones manualmente, iniciar una solicitud, pasar a la siguiente, eliminar canciones y vaciar la cola.
- Permite pausar temporalmente nuevas solicitudes del chat sin borrar la cola existente.
- Abre la canción elegida mediante búsqueda directa en YouTube para evitar depender de reproductores web no oficiales dentro de Android.
- Añade límites de cola, límite por usuario y cooldown para reducir spam de solicitudes.
- Añade una nueva pantalla **Actividad reciente** totalmente configurable.
- Permite mostrar u ocultar comentarios, regalos, follows, compartidos, suscripciones, Fan Stickers, likes y entradas al LIVE.
- Permite mostrar todos, ocultar todos y elegir 10, 25 o 50 eventos visibles.
- Los filtros de Actividad reciente se aplican también al Control del LIVE.
- Añade pestaña **Música** dentro del Control del LIVE y conserva los modos Todo, Eventos, Meta y Ranking.
- Mantiene la cola, filtros y preferencias nuevas entre reinicios mediante almacenamiento persistente.
- Integra las solicitudes de canciones directamente en el runtime normalizado del LIVE, junto a automatizaciones, TTS y efectos existentes.
- Añade pruebas de regresión para navegación, Control del LIVE, Actividad reciente, comandos de música y runtime.
- Añade un workflow rápido de calidad que valida TypeScript, contrato del LIVE y contrato de interfaz móvil por separado del build nativo.
- Corrige el build Android para alinear automáticamente los parches compatibles de Expo 57 antes de ejecutar `expo install --check`.
- Actualiza Android a `versionCode` 9.

## 1.1.4

- Usa el logo oficial de Lulú Finity también dentro de la app móvil y como icono de Android.
- Sustituye los PNG de icono dañados por una copia limpia y compatible con Expo del recurso original.
- Corrige la revisión automática para conservar la actualización encontrada entre reinicios de la app.
- Un fallo temporal de red o de GitHub ya no bloquea nuevas comprobaciones durante 24 horas; se permite reintentar automáticamente después de 15 minutos.
- Al encontrar una versión nueva, la app muestra un aviso automático con acceso directo al APK móvil.
- Vuelve a comprobar actualizaciones cuando la app regresa al primer plano.
- Invalida el estado guardado del actualizador después de instalar una versión/build diferente.
- Amplía la búsqueda de releases y evita respuestas cacheadas para detectar publicaciones móviles recién creadas.
- Automatiza la publicación del APK móvil al cambiar la versión nativa en `app.json`, sin reemplazar la release "Latest" de PC.
- Añade estado de última comprobación correcta y pruebas de regresión del actualizador.
- Actualiza Android a `versionCode` 8.

## 1.1.3

- Integra el video directamente en la pantalla de inicio, sin marco, borde ni esquinas redondeadas.
- Sustituye el degradado rosado del arranque por negro profundo para fundir el fondo del MP4 con toda la pantalla.
- Mantiene el video centrado con `contain`, sin recortarlo ni deformarlo.
- Actualiza Android a `versionCode` 5.

## 1.1.2

- Muestra `1000127063.mp4` al iniciar, centrado y conservando su proporción 16:9 sin estirarlo horizontalmente.
- Reproduce el video completo una vez y continúa automáticamente; incluye una salida segura si Android no logra abrirlo.
- Coloca el texto exacto “Iniciando Lulu Finity” debajo del video.
- Lleva el panel de conexión al inicio, como en PC, con usuario, estado “Desconectado / Conectando / LIVE conectado” y el botón “Conectar al LIVE”.
- Mantiene visible “Conectando…” hasta que el relay confirme la conexión real con TikTok.
- Actualiza Android a `versionCode` 4.

## 1.1.1

- Corrige la recepción de paquetes agrupados de EulerStream (`messages`), que antes se descartaban y dejaban el Dashboard sin comentarios ni eventos.
- Los comentarios vuelven a activar TTS, sonidos, automatizaciones, metas, historial y rankings.
- Lee correctamente paquetes de texto, `Blob`, `ArrayBuffer` y vistas binarias recibidas por el WebSocket de Android.
- El estado “LIVE conectado” solo aparece después de que el relay confirme la conexión real con TikTok.
- Distingue compartidos y follows en eventos sociales; antes algunos compartidos podían contarse como follow.
- Añade compatibilidad con estadísticas de `roomInfo`, `roomStats` y `roomUpdate`.
- La cola TTS conserva los comentarios recientes y reintenta con la voz predeterminada si Android eliminó la voz elegida.
- Los builds oficiales ahora fallan si no se inyectó el token del relay, evitando generar APK que abren pero nunca reciben eventos.
- Añade pruebas automáticas del contrato real del LIVE antes de compilar el APK.