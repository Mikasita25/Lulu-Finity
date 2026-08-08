# Lulu Finity 1.0.2

Hotfix de TTS, seguridad de cuenta e interfaz para la fuente reproducible 1.0.1.

- Retira la Voz Oficial, OpenVoice, su descarga opcional y sus archivos de referencia.
- Conserva Edge TTS/Microsoft, las voces instaladas de Windows y Lulu Local.
- Integra más de 70 códigos de voz de TikTok y usa de manera interna la sesión enlazada en Cuenta.
- Hace opcional la cuenta: Microsoft, Windows y Lulu Local funcionan sin iniciar sesión.
- Muestra el dominio oficial y una explicación extensa de privacidad: el servidor de Lulú solo opera la API WebSocket del LIVE, nunca recibe la sesión, detalla los datos transmitidos, bloquea permisos y permite borrar toda la sesión local.
- Migra únicamente la Voz Oficial retirada a Microsoft Dalia; conserva las selecciones Microsoft existentes.
- Mantiene el scroll en ventanas no maximizadas, navegación, búsqueda y diálogos.
- Carga cada módulo bajo demanda: el arranque no crea reproductores, TTS, overlays, rankings, economía, juegos ni automatizaciones.
- En modo de uso musical solo conserva el proveedor elegido; el buscador temporal de YouTube se libera al terminar.
- Expone en Rendimiento qué módulos se han activado sin despertarlos para consultar su estado.

```bash
python build-v1002/apply-v1002.py app
python build-v1002/test-v1002.py app
node --test app/src/online-voice-catalog.test.js app/src/tiktok-voice-catalog.test.js app/src/tiktok-tts-client.test.js app/src/text-processor.test.js
```
