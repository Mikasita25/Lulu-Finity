## Lulu Finity 1.2.9 — arranque rápido de voz

- Reduce el tiempo máximo de preparación de voces locales y online de 25 a 8 segundos para pasar antes a la alternativa si la síntesis se queda congelada.
- Acorta de 9 a 4 segundos el intento de recuperar una voz de Windows que no inicia, sin necesitar otro comentario para desbloquearla.
- Limita a 5 segundos la espera a que comience a reproducirse un audio obtenido del proveedor.
- Mantiene el filtro de IDs repetidos, las configuraciones guardadas y la cola; estas mejoras también ayudan cuando hay un solo comentario.
- El servidor Railway solicita entrega individual de eventos TikTok en vez de agruparlos para intentar reducir la latencia de recepción.

El cambio no puede eliminar la latencia externa de TikTok o de los servicios de síntesis. Si el proveedor es lento, puede haber cambio a la voz alternativa.
