# Railway API Relay de Lulu Finity

Este servicio conserva las API keys de EulerStream en Railway, rota las claves al alcanzar límites y entrega a la aplicación un contador diario aproximado.

## Seguridad obligatoria

- El relay **no debe ejecutarse en modo público**. `CLIENT_TOKENS` (o `CLIENT_TOKEN`) es obligatorio y el proceso falla al iniciar si falta.
- Usa secretos aleatorios de al menos 32 bytes y distintos de las API keys de EulerStream y de cualquier token de GitHub.
- Si un token se incluyó alguna vez dentro de una build distribuida, considéralo recuperable desde el binario y **rótalo**.
- Mantén `EULER_API_KEYS`, `CLIENT_TOKENS` y cualquier `GITHUB_RELEASE_TOKEN` únicamente en variables privadas de Railway/GitHub Actions; nunca los subas al repositorio.
- El relay mantiene límites por IP/usuario y un máximo de clientes para reducir abuso. Estos controles complementan la autenticación, no la sustituyen.

> Importante: un cliente de escritorio no puede guardar un secreto permanente de forma imposible de extraer. Para una autenticación fuerte por dispositivo, Lulu debe evolucionar a credenciales de corta duración emitidas por el servidor y, preferiblemente, asociadas a una cuenta/licencia o a un mecanismo de attestation. Un token fijo embebido solo sirve como barrera adicional y debe poder rotarse.

## Uso diario

- El límite predeterminado es **7500 usos por día**.
- Cada conexión de Lulu suma aproximadamente **2 usos**.
- `GET /usage` devuelve el uso global. Con `?uniqueId=usuario` también devuelve el uso individual.
- Cada usuario tiene **600 conexiones diarias** por defecto; el identificador se guarda como hash en el contador local del relay.
- El contador se reinicia cada día UTC.
- El archivo `.lulu-usage.json` conserva el contador mientras el almacenamiento siga disponible. Para persistencia entre despliegues, configura un Railway Volume y `USAGE_STATE_FILE=/data/lulu-usage.json`.

## Despliegue

Configura como mínimo `EULER_API_KEYS` y `CLIENT_TOKENS`, conserva una sola réplica y genera un dominio HTTPS público en Railway. Los endpoints disponibles son `GET /health`, `GET /usage` y el WebSocket `/v1/tiktok/live`.

Antes de cambiar el relay protegido a producción, confirma que la versión de Lulu que vas a distribuir usa el token vigente; después revoca los tokens presentes en versiones antiguas.

## Actualizaciones con repositorio privado

No metas un PAT/GitHub token dentro de Electron. Para mantener el código fuente privado, el patrón recomendado es:

1. Repositorio `Mikasita25/Lulu-Finity` privado.
2. GitHub Actions compila únicamente binarios y **no publica ZIPs de código fuente**.
3. Railway conserva un `GITHUB_RELEASE_TOKEN` de solo lectura y consulta las releases privadas del lado servidor.
4. Lulu consulta un endpoint de updates de Railway; Railway devuelve metadatos/descargas firmadas o temporales sin revelar credenciales del repositorio.
5. Los instaladores deben estar firmados y la aplicación debe validar la integridad de la actualización antes de instalarla.

Ocultar el endpoint a usuarios normales es posible, pero no existe una forma absoluta de garantizar que "solo la app" pueda hacer una petición si no hay identidad de usuario/dispositivo: una app instalada puede ser inspeccionada e imitada. La seguridad real debe apoyarse en tokens de corta duración, límites, rotación y firma de artefactos.

## Rotación

Se elige la key con menor carga. Los límites temporales usan un enfriamiento corto, las cuotas agotadas un enfriamiento largo y las claves inválidas se desactivan hasta corregirlas.

Consulta `.env.example` para todos los valores configurables.
