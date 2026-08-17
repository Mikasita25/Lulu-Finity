# Lulú Finity Mobile

## 1.1.4

- Usa el logo oficial de Lulú Finity también dentro de la app móvil y como icono de Android.
- Sustituye los PNG de icono dañados por una copia limpia del recurso original para que Expo pueda generar correctamente los iconos nativos.
- Corrige la revisión automática para conservar la actualización encontrada entre reinicios de la app.
- Un fallo temporal de red o de GitHub ya no bloquea nuevas comprobaciones durante 24 horas; se permite reintentar automáticamente después de 15 minutos.
- Al encontrar una versión nueva, la app muestra un aviso automático con acceso directo al APK móvil.
- Vuelve a comprobar actualizaciones cuando la app regresa al primer plano.
- Invalida el estado guardado del actualizador después de instalar una versión/build diferente.
- Amplía la búsqueda de releases y evita respuestas cacheadas para detectar publicaciones móviles recién creadas.
- Automatiza la publicación del APK móvil al cambiar la versión nativa en `app.json`, sin reemplazar la release "Latest" de PC.
- Añade estado de última comprobación correcta y pruebas de regresión del actualizador.
- Actualiza Android a `versionCode` 7.

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
