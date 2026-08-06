# Configurar la rotación de API keys en Railway

El servicio está en `railway-relay/`. Lulu Finity nunca recibe las API keys del proveedor: solamente se conecta al relay mediante WebSocket.

## Railway

1. Crea un proyecto desde `Mikasita25/Lulu-Finity`.
2. Establece **Root Directory** en `/railway-relay`.
3. Configura `EULER_API_KEYS` con un arreglo JSON: `["key-1","key-2","key-3"]`.
4. Configura `CLIENT_TOKENS` con uno o más tokens largos y distintos de las API keys.
5. Mantén una sola réplica del servicio; el estado de rotación está en memoria.
6. Genera un dominio público y comprueba `https://TU-DOMINIO/health`.

## Lulu Finity 0.21

En **Ajustes → Servidor seguro de TikTok LIVE**, pega:

- URL: `wss://TU-DOMINIO/v1/tiktok/live`
- Token: uno de los valores de `CLIENT_TOKENS`

## Cómo rota

- `4429`, `4555`, HTTP/rate limit o concurrencia: enfriamiento corto y siguiente key.
- Cuota mensual, saldo o billing: enfriamiento largo y siguiente key.
- Clave inválida o revocada: se desactiva hasta reiniciar el servicio con variables corregidas.
- LIVE offline o configuración inválida: no rota innecesariamente y devuelve el error a Lulu.

`KEY_COOLDOWN_MS`, `QUOTA_COOLDOWN_MS` y `MAX_CONNECTIONS_PER_KEY` permiten ajustar el comportamiento al plan contratado.

> Un token estático dentro de una aplicación de escritorio puede ser extraído. Para una distribución pública, entrega un token distinto por instalación o usuario y revócalo desde `CLIENT_TOKENS` cuando sea necesario.
