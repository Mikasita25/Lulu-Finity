# Lulu Finity 1.3.3 — Nuevo servidor para streams

- Conecta TikTok LIVE al nuevo relay de Railway `lulu-finity-relay-production.up.railway.app`.
- Mantiene lectura de comentarios, voz Microsoft TTS, medidor de uso y fuentes HTTPS de widgets y rankings a través del mismo servidor.
- Conserva las mejoras de voz y ruleta de la 1.3.2.
- Mantiene las API keys de EulerStream exclusivamente en Railway; el instalador no las incluye.
- Comprueba en GitHub Actions el dominio incluido, el instalador, el ZIP y `latest.yml`.

**Nota:** Es necesario probar la recepción de comentarios en un LIVE real, además de la disponibilidad de `/health`, para verificar la conexión de EulerStream.
