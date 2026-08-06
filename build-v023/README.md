# Parche Lulu Finity 0.23.0

Este parche se aplica sobre `Lulu-Finity-Source-0.22.0.zip` y añade mensajes automáticos configurables en el chat del LIVE usando una sesión local de TikTok.

Incluye:

- Ventana persistente de TikTok para iniciar sesión con la cuenta creadora.
- Plantillas por evento: canción agregada, iniciada, terminada, saltada y conexión al LIVE.
- Variables `{cancion}`, `{usuario}`, `{posicion}`, `{cola}`, `{proveedor}`, `{comando}` y `{live}`.
- Prueba de envío, comprobación de sesión y restablecimiento local.
- Cola con espera mínima y prevención de duplicados consecutivos.

El código fuente conserva el marcador `__LULU_RELAY_CLIENT_TOKEN__`. GitHub Actions inyecta el secreto únicamente al compilar el instalador oficial.
