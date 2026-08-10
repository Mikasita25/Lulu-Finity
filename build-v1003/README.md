# Lulu Finity 1.0.3

Hotfix de frontera de confianza para la fuente reproducible 1.0.2.

- Convierte el WebSocket del LIVE en un canal de solo recepción.
- Añade una lista cerrada de mensajes y esquemas públicos permitidos.
- Reconoce los tipos oficiales del esquema v2; los que Lulu no utiliza se descartan con un objeto vacío.
- Elimina alias genéricos como `method`, `event` y `payload` en la frontera del relay.
- Descarta todos los campos no necesarios antes de entregar un evento a la interfaz.
- Cierra la conexión ante solicitudes remotas o abuso repetido del protocolo.
- Limita paquetes a 512 KB, lotes a 128 eventos y 500 eventos por segundo.
- Bloquea redirecciones y respuestas mayores a 32 KB en `/usage`.
- Mantiene cookies, sesión de TikTok, archivos y ajustes fuera del protocolo.

```bash
python build-v1003/apply-v1003.py app
python build-v1003/test-v1003.py app
node --test app/src/relay-protocol.test.js
```
