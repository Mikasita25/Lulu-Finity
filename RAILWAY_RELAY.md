# Configurar la rotación de API keys en Railway

El servicio está en `railway-relay/`. Lulu Finity nunca recibe las API keys del proveedor: solamente se conecta al relay mediante WebSocket.

## Railway

1. Crea un proyecto desde `Mikasita25/Lulu-Finity` usando la rama `agent/railway-api-key-rotation` mientras el PR siga abierto.
2. Configura el servicio para ejecutar `cd railway-relay && npm install --omit=dev --no-audit --no-fund && npm start`. Si Railway muestra **Root Directory**, también puedes usar `/railway-relay` y `npm start`.
3. Configura `EULER_API_KEYS` con un arreglo JSON: `["key-1","key-2","key-3"]`.
4. Configura `CLIENT_TOKENS` con uno o más tokens largos y distintos de las API keys.
5. Mantén una sola réplica del servicio; el estado de rotación está en memoria.
6. Genera el dominio público `lulu-finity-production.up.railway.app` y comprueba `/health`.

## Compilación oficial de Lulu Finity 0.21

La URL `wss://lulu-finity-production.up.railway.app/v1/tiktok/live` ya está dentro de la aplicación. Los usuarios no introducen ninguna configuración.

Antes de publicar la versión, crea en GitHub el secreto de Actions `LULU_RELAY_CLIENT_TOKEN` con exactamente el mismo token que está permitido en `CLIENT_TOKENS` de Railway. El workflow lo inserta únicamente en el instalador y mantiene el marcador sin secreto en el código fuente publicado.

## Cómo rota

- `4429`, `4555`, HTTP/rate limit o concurrencia: enfriamiento corto y siguiente key.
- Cuota mensual, saldo o billing: enfriamiento largo y siguiente key.
- Clave inválida o revocada: se desactiva hasta reiniciar el servicio con variables corregidas.
- LIVE offline o configuración inválida: no rota innecesariamente y devuelve el error a Lulu.

`KEY_COOLDOWN_MS`, `QUOTA_COOLDOWN_MS` y `MAX_CONNECTIONS_PER_KEY` permiten ajustar el comportamiento al plan contratado.

> Un token estático incluido en una aplicación de escritorio puede extraerse del instalador. Este token solamente protege el acceso básico al relay; las API keys pagadas siguen permaneciendo exclusivamente en Railway. Usa límites, monitoreo y rotación del token si detectas abuso.
