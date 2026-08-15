# Lulú Finity Mobile 1.1.1

- Corrige la recepción de paquetes agrupados de EulerStream (`messages`), que antes se descartaban y dejaban el Dashboard sin comentarios ni eventos.
- Los comentarios vuelven a activar TTS, sonidos, automatizaciones, metas, historial y rankings.
- Lee correctamente paquetes de texto, `Blob`, `ArrayBuffer` y vistas binarias recibidas por el WebSocket de Android.
- El estado “LIVE conectado” solo aparece después de que el relay confirme la conexión real con TikTok.
- Distingue compartidos y follows en eventos sociales; antes algunos compartidos podían contarse como follow.
- Añade compatibilidad con estadísticas de `roomInfo`, `roomStats` y `roomUpdate`.
- La cola TTS conserva los comentarios recientes y reintenta con la voz predeterminada si Android eliminó la voz elegida.
- Los builds oficiales ahora fallan si no se inyectó el token del relay, evitando generar APK que abren pero nunca reciben eventos.
- Añade pruebas automáticas del contrato real del LIVE antes de compilar el APK.
