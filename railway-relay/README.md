# Railway API Relay de Lulu Finity

Este servicio mantiene las API keys de EulerStream en Railway. La aplicación de escritorio solamente conoce la URL del relay y, opcionalmente, un token de acceso propio; nunca recibe las keys del proveedor.

## Despliegue en Railway

1. Crea un servicio desde el repositorio `Mikasita25/Lulu-Finity`.
2. En **Settings → Root Directory** usa `/railway-relay`.
3. Agrega `EULER_API_KEYS` como arreglo JSON, por ejemplo `["key1","key2","key3"]`.
4. Agrega `CLIENT_TOKENS` con uno o más tokens largos para autorizar la app. Déjalo vacío solamente para una prueba privada.
5. Genera un dominio público en Railway.
6. En Lulu Finity usa `wss://TU-DOMINIO.up.railway.app/v1/tiktok/live` y el mismo token de cliente.

## Rotación

- Se elige la key con menos conexiones activas.
- Una respuesta de límite temporal o concurrencia pone esa key en enfriamiento y usa la siguiente.
- Una cuota mensual agotada usa un enfriamiento más largo.
- Una key inválida se desactiva hasta reiniciar/corregir las variables.
- Durante la rotación la conexión entre Lulu Finity y Railway permanece abierta.

## Variables

Consulta `.env.example`. `MAX_CONNECTIONS_PER_KEY` debe coincidir con el límite real de tu plan. El endpoint `GET /health` muestra únicamente cantidades y nunca secretos.

Mantén una sola réplica del servicio porque el estado del pool está en memoria. Usa únicamente keys que te pertenezcan y verifica que el contrato de tu proveedor permita repartir tráfico entre ellas.
