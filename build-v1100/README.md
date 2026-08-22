# Lulu Finity 1.1.0

Super rediseño reproducible sobre la fuente oficial 1.0.5.

- Coordina los doce temas con texto, campos, botones, casillas, radios, estados y navegación.
- Añade una galería visual de temas y compositores guiados para comandos y automatizaciones.
- Incorpora catorce temas independientes para Música, Monedas, Juegos, Alertas, Metas y Regalos.
- Muestra previews permanentes sin actividad del LIVE y actualiza automáticamente las fuentes HTTPS/OBS conectadas al cambiar su diseño.
- Conserva servicios activos al navegar, minimizar o ejecutar una liberación manual de recursos.
- Cambia Ahorro a 30 segundos y Equilibrado a 3 minutos, siempre con detección de actividad real.
- Usa `powerSaveBlocker` de Electron únicamente durante LIVE o HTTPS activo.
- Empaqueta y comprueba `cloudflared.exe`, mantiene la recuperación oficial y busca un puerto libre automáticamente.

## Reconstrucción

```bash
python build-v1100/apply-v1100.py app
python build-v1100/test-v1100.py app
node --check app/src/main.js
node --check app/src/renderer.js
node build-v1005/test-main-startup.js app
```
