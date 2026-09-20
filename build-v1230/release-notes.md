# Lulu Finity 1.2.3

Esta versión mejora la configuración de regalos con sonido para que no tengas que esperar a que alguien envíe primero cada regalo.

- **Catálogo de regalos TikTok:** busca por nombre antes de iniciar el LIVE.
- **México / Global:** el filtro de México prioriza los regalos disponibles en el catálogo regional y Global permite consultar todos los nombres rastreados.
- **Catálogo actualizado:** Lulu consulta una lista pública actual y guarda una copia local para reutilizarla si el servicio no responde temporalmente.
- **Ligero:** conserva el catálogo completo en memoria, pero solo renderiza los primeros resultados relevantes para evitar lag.
- **Detección real del LIVE:** cuando entra un regalo, Lulu guarda el `giftName` y `giftId` que recibió realmente y lo muestra en “Detectados en tu LIVE”.
- **Botón Usar:** tanto los regalos del catálogo como los detectados copian automáticamente el nombre a la regla de tipo Regalo.
- **Avance de música reparado:** al saltar una canción, Lulu ignora señales tardías del reproductor anterior para no repetir o saltar la siguiente.
- **Duplicados de YouTube:** corrige la identidad del video usada por el filtro para que la misma canción no vuelva a entrar por un error de precedencia.
- **Comentarios al día:** conserva la hora original del comentario, deduplica mensajes recientes al reconectar y descarta los que ya excedieron el límite configurado antes de TTS, comandos o automatizaciones.
- **Compatibilidad:** mantiene el volumen individual por acción de 1.2.2 y las correcciones de estabilidad musical/updater de 1.2.1.

TikTok cambia disponibilidad, nombres y precios según región, temporada y cuenta. Por eso los regalos detectados directamente en el LIVE tienen prioridad como referencia real cuando difieren del catálogo público.
