# Cambios

## 1.3.3

- Reemplaza Ranking, Metas y el panel recargado por pestañas directas de Voz, Música y Automatizaciones.
- Simplifica Inicio para conectar el LIVE, activar lo esencial y comprobar el estado antes de volver al juego.
- Reserva Ajustes para opciones poco frecuentes y elimina la personalización de rankings de la interfaz móvil.

## 1.3.2

- El móvil deja de abrir el WebSocket de Microsoft desde Android y utiliza el mismo `edge-tts-universal` que la versión de PC, ejecutado por el servidor de Lulú.
- La compilación se bloquea si el servidor no devuelve un MP3 Microsoft real; ya no basta con que las pruebas simuladas pasen.
- Los errores ahora diferencian entre ruta no desplegada, autorización incorrecta, límite temporal y audio inválido.

## 1.3.1

- Corrige la conexión directa con Microsoft Edge TTS usando los encabezados actuales del servicio y una cookie MUID nueva en cada intento.
- Reintenta una vez la apertura del canal cuando Microsoft rechaza temporalmente la primera sesión.
- Mantiene la coordinación de audio de la versión 1.3.0 para que la voz y la música no se cancelen entre sí.

## 1.3.0

- Interfaz móvil reorganizada con nombres simples y descripciones más claras.
- Nueva pantalla de inicio con accesos rápidos para voz y música.
- Menú dividido entre herramientas del LIVE y opciones de la aplicación.
- Botón Atrás visible en todas las pantallas secundarias.
- Tarjetas más ligeras y navegación inferior más fácil de reconocer.
- Textos técnicos sustituidos por explicaciones directas en español.
- TTS y música coordinan el foco de audio para que Android no interrumpa la voz.
- El reproductor ya no interpreta interrupciones internas como una pausa del usuario.
- Se eliminó la segunda ventana de YouTube que quedaba cargando y competía con la canción activa.
- Estado visible de reproducción, mensajes de error y botón para reintentar una canción.

## 0.7.0

- Actualizador integrado mediante GitHub Releases.
- Aviso al encontrar una versión nueva; descarga e instalación para la versión instalada.
- En la versión ZIP, apertura de la página oficial de descarga.
- Voces neuronales online y selector por idioma.
- Conservación de todas las voces instaladas en Windows.
- Panel de estado de actualizaciones y botón de búsqueda manual.

## 0.6.0

- Cambio de nombre a Lulu Finity.
- Instalador por usuario sin elevación de administrador.
