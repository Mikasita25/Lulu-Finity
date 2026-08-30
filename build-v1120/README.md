# Parche reproducible de Lulu Finity 1.1.2

Este directorio transforma el ZIP oficial `Lulu-Finity-Source-1.1.1.zip` en la fuente 1.1.2. `apply-v1120.py` valida la versión y el SHA-256 de cada archivo base antes de copiar el payload.

Prioridades de esta versión:

- URL HTTPS fija por instalación para los seis widgets, cuatro rankings y cuatro pantallas;
- capacidad secreta de escritura separada de la identidad pública que se pega en OBS/TikTok Studio;
- sincronización y recuperación automática de estados y recursos mediante Railway;
- Cloudflared conservado sólo como alternativa y servidor local HTTP sin cambios;
- reproducción persistente de YouTube y Spotify, con recuperación de bloqueo, suspensión y proceso caído;
- botones Update 3.0 coherentes con los 12 temas;
- avisos separados para primera instalación y actualización, mostrados una sola vez por versión;
- textos más breves y estados HTTPS acordes con las URL fijas.

Uso local sobre una extracción limpia:

```bash
python build-v1120/apply-v1120.py app
python build-v1120/test-v1120.py app
```

El relay necesita un dominio público y, de forma recomendada, un Railway Volume con `OVERLAY_STATE_DIR=/data/lulu-overlays`. Aunque el volumen se pierda, Lulu vuelve a publicar las fuentes activas con la misma identidad y URL.
