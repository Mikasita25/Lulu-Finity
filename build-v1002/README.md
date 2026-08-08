# Lulu Finity 1.0.2

Hotfix de TTS e interfaz para la fuente reproducible 1.0.1.

- Retira la Voz Oficial, OpenVoice, su descarga opcional y sus archivos de referencia.
- Elimina Edge TTS y el catálogo Microsoft que se había presentado como catálogo gratuito.
- Integra más de 70 códigos de voz de TikTok y usa de manera interna la sesión enlazada en Cuenta.
- Migra selecciones antiguas a `Warm / Español MX` y conserva Piper/Windows como respaldo.
- Mantiene el scroll en ventanas no maximizadas, navegación, búsqueda y diálogos.

```bash
python build-v1002/apply-v1002.py app
python build-v1002/test-v1002.py app
node --test app/src/tiktok-voice-catalog.test.js app/src/tiktok-tts-client.test.js app/src/text-processor.test.js
```
