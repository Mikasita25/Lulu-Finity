# Lulu Finity 1.1.8

Esta versión se concentra en estabilidad de Lulu Finity para PC.

- **Música más fluida:** el monitor interno de YouTube deja de reaccionar a cada cambio visual de toda la página. El mantenimiento se agrupa y se reduce el trabajo innecesario que podía provocar tirones.
- **Recuperación menos agresiva:** un buffer corto ya no se trata tan rápido como un reproductor bloqueado. Lulu usa la telemetría del reproductor para decidir cuándo intervenir.
- **Reanudación segura:** al volver de suspensión primero intenta continuar la reproducción en lugar de recargar inmediatamente la página del reproductor.
- **LIVE más estable:** cuando Railway informa que el flujo interno de TikTok se desconectó, Lulu cierra esa conexión y entra inmediatamente al sistema de reconexión automática.
- **Socket congelado:** se vigila la actividad del transporte WebSocket; una conexión que queda abierta pero sin responder se fuerza a reconectar.
- **Comandos reforzados:** se aceptan variantes Unicode frecuentes del signo de exclamación como `❗comando`, `‼comando` y `﹗comando`, además del `!comando` normal.

No cambia la configuración existente del usuario, sus comandos, widgets, TTS, economía ni colas guardadas.
