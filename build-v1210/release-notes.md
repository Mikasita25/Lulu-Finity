# Lulu Finity 1.2.1

Actualización de estabilidad sobre Lulu Finity Studio 1.2.0.

- **Música más fluida:** reduce el trabajo continuo del monitor interno de YouTube y evita tirones provocados por cambios visuales de la página.
- **Buffers normales ya no provocan recargas agresivas:** Lulu usa telemetría reciente para distinguir entre una pausa breve y un bloqueo real.
- **LIVE más estable:** cuando TikTok corta el flujo interno, Lulu entra al sistema de reconexión automática en lugar de quedarse aparentemente conectada sin recibir eventos.
- **Sockets congelados:** una conexión abierta pero sin actividad se detecta y se recupera automáticamente.
- **Comandos reforzados:** además de `!comando`, reconoce variantes Unicode frecuentes como `❗comando`, `❕comando`, `‼comando` y `﹗comando`.
- **Studio 1.2.0 se conserva:** mantiene el editor de widgets, la interfaz renovada y el servidor LIVE público sin credenciales incrustadas en la aplicación.

Los ajustes, comandos, widgets, TTS, economía y colas existentes del usuario se conservan.
