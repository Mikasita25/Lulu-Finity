# Lulu Finity 1.0.5

Corrección de persistencia del LIVE y del bot de voz sobre la fuente reproducible 1.0.4.

- El LIVE deja de depender de la categoría visible o del perfil de recursos.
- La interfaz y la cola TTS continúan trabajando cuando Lulu está minimizada.
- Los cortes temporales se recuperan con ocho intentos y retroceso progresivo.
- Desconectar, terminar el LIVE, agotar la cuota o rechazar el protocolo cancelan la recuperación.
- El relay ya no solicita cerrar una sala tras 300 segundos sin eventos.
- La simulación integral cubre cambio de pantalla, liberación forzada, reconexión, cierre terminal y cancelación manual.

```bash
python build-v1005/apply-v1005.py app
python build-v1005/test-v1005.py app
python build-v1005/test-v1004-regressions.py app
node build-v1005/test-main-startup.js app
node build-v1005/test-live-reconnect.js app
```
