# Railway API Relay de Lulu Finity

Este servicio conserva las API keys de EulerStream en Railway, rota las claves al alcanzar límites y entrega a la aplicación un contador diario aproximado.

## Uso diario

- El límite predeterminado es **7500 usos por día**.
- Cada conexión de Lulu suma aproximadamente **2 usos**.
- `GET /usage` devuelve el uso global. Con `?uniqueId=usuario` también devuelve el uso individual.
- Cada usuario tiene **600 conexiones diarias** por defecto; el identificador se guarda como hash en el contador local del relay.
- El contador se reinicia cada día UTC.
- El archivo `.lulu-usage.json` conserva el contador mientras el almacenamiento siga disponible. Para persistencia entre despliegues, configura un Railway Volume y `USAGE_STATE_FILE=/data/lulu-usage.json`.

## Despliegue

Configura `EULER_API_KEYS`, conserva una sola réplica y genera un dominio público. Los endpoints disponibles son `GET /health`, `GET /usage` y el WebSocket `/v1/tiktok/live`.

## Rotación

Se elige la key con menor carga. Los límites temporales usan un enfriamiento corto, las cuotas agotadas un enfriamiento largo y las claves inválidas se desactivan hasta corregirlas.

Consulta `.env.example` para todos los valores configurables.
