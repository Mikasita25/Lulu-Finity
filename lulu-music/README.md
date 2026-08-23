# Lulu Music 1.0.0

Aplicación independiente de Windows dedicada exclusivamente a solicitudes de música en TikTok LIVE.

## Qué incluye

- Conexión a una cuenta que esté transmitiendo en TikTok LIVE.
- Un único comando musical configurable (`!cancion` por defecto).
- Filtro en el proceso principal: los comentarios que no coinciden con el comando no se entregan a la interfaz.
- Cola automática y manual, reordenamiento, eliminación, límite, control por usuario y prevención de duplicados.
- Permisos para todos, seguidores, suscriptores o una lista de usuarios.
- YouTube ligero: búsqueda por red sin abrir la página completa y reproducción oficial incrustada en una sola ventana reutilizable.
- Las solicitudes nuevas siempre entran en cola; ninguna canción crea otra ventana de YouTube.
- Spotify permanece disponible y ambos proveedores incluyen controles de volumen, pausa, reinicio y salto.
- El motor ligero evita cargar inicio, comentarios, recomendaciones y el bloqueador avanzado que necesitaba el sitio completo.
- Sin TTS, lectura de chat, juegos, regalos, automatizaciones, widgets, servidor local ni enlaces HTTPS de stream.

## Desarrollo

```bash
npm install
npm test
npm start
```

## Compilación para Windows

```bash
npm run build:win
```

La compilación oficial debe sustituir el marcador privado del relay por el secreto de CI. Si no hay token integrado, el modo de desarrollo usa directamente `tiktok-live-connector`.

Lulu Music no sustituye ni modifica Lulu Finity; se instala con un identificador y un directorio de datos distintos.
