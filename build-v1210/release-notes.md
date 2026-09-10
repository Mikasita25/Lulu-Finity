# Lulu Finity 1.2.1

Esta versión corrige dos problemas de la 1.2.0: cortes de música y actualizaciones que no podían llegar a quienes ya estaban en 1.2.0.

- **Música estable:** corrige recuperaciones falsas del watchdog que podían pausar o recargar YouTube aunque la canción siguiera funcionando.
- **Telemetría restaurada:** vuelve a registrar `lastPayloadAt`, dato que se perdió al construir 1.2.0 y que el sistema de recuperación necesita para distinguir un buffer de un reproductor realmente congelado.
- **Menos trabajo sobre YouTube:** el observador del reproductor agrupa cambios de la página en lugar de reaccionar a cada modificación visual.
- **Recuperación menos agresiva:** primero intenta continuar la canción; una recarga completa queda reservada para fallos repetidos.
- **Audio sin mute pegado:** el silenciamiento preventivo usado durante la detección de anuncios tiene un seguro y se libera si el detector no confirma un anuncio.
- **Updates reparadas:** 1.2.1 es superior a 1.2.0 y publica `latest.yml`, instalador y `.blockmap`, por lo que `electron-updater` sí puede ofrecerla.
- **Sin perder el Studio:** conserva los widgets, personalización, comandos, TTS, economía y conexión al servidor LIVE público de la 1.2.0.
