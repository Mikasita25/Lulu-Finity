# Railway API Relay de Lulu Finity

Este servicio conserva las API keys de EulerStream en Railway, rota las claves al alcanzar límites, entrega un contador diario aproximado, genera el audio TTS Microsoft para Android y aloja las fuentes HTTPS estables de Lulu Finity PC.

## Fuentes HTTPS estables

- Lulu crea una capacidad secreta por instalación y sólo expone una identidad pública derivada dentro de la URL de OBS/TikTok Studio.
- Widgets, rankings y pantallas conservan la misma dirección tras reinicios. Los cambios de tema y contenido aparecen en esa URL sin reemplazar la fuente.
- Los estados se guardan de forma atómica y las imágenes se validan por nombre, extensión, MIME, tamaño, firma y SHA-256.
- Monta un Railway Volume y configura `OVERLAY_STATE_DIR=/data/lulu-overlays`. Si el volumen se pierde, Lulu vuelve a registrar las fuentes activas con la misma identidad.

## Uso diario

- El límite predeterminado es **7500 usos por día**.
- Cada conexión de Lulu suma aproximadamente **2 usos**.
- `GET /usage` devuelve el uso global. Con `?uniqueId=usuario` también devuelve el uso individual.
- Cada usuario tiene **600 conexiones diarias** por defecto; el identificador se guarda como hash en el contador local del relay.
- El contador se reinicia cada día UTC.
- El archivo `.lulu-usage.json` conserva el contador mientras el almacenamiento siga disponible. Para persistencia entre despliegues, configura un Railway Volume y `USAGE_STATE_FILE=/data/lulu-usage.json`.

## Despliegue

Configura `EULER_API_KEYS`, conserva una sola réplica, monta el volumen y genera un dominio público. Además de `GET /health`, `GET /usage`, TTS y el WebSocket `/v1/tiktok/live`, el relay sirve `/overlays/:id/:tipo/:nombre` y sincroniza estados/recursos bajo `/v1/overlays/:id/*` mediante capacidad Bearer.

## TTS Microsoft para Android

`POST /v1/tts/microsoft` acepta JSON con `text`, `voice`, `rate` y `pitch`, y devuelve audio MP3. El texto se limita a 240 caracteres. El relay aplica token, límite por IP, concurrencia máxima y una caché breve; `edge-tts-universal` se ejecuta únicamente en Node porque el navegador no puede abrir directamente el WebSocket personalizado de Microsoft.

## Rotación

Se elige la key con menor carga. Los límites temporales usan un enfriamiento corto, las cuotas agotadas un enfriamiento largo y las claves inválidas se desactivan hasta corregirlas.

Consulta `.env.example` para todos los valores configurables.
