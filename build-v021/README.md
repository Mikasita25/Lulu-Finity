# Parche 0.21.0

`script/part-*.txt` reconstruye Lulu Finity 0.21.0 partiendo de la fuente publicada de 0.20.0. El parche está comprimido, dividido y validado mediante SHA-256.

La aplicación incluye automáticamente `wss://lulu-finity-production.up.railway.app/v1/tiktok/live`. El token de cliente no se publica en el repositorio: GitHub Actions lo inyecta durante la compilación desde el secreto `LULU_RELAY_CLIENT_TOKEN`. Por ello, los usuarios finales no tienen que introducir URL, token ni API keys.
