## Lulu Finity 1.2.8 — lectura de chat LIVE

- Recuperación autónoma para voces de Windows que quedan esperando una señal de inicio; se intenta reanudar y, si hace falta, reintentar una vez sin duplicar la lectura.
- La síntesis local y online no puede dejar la cola bloqueada indefinidamente: tras 25 segundos sin respuesta se intenta la voz alternativa de Windows.
- Si un audio descargado no arranca en 12 segundos, se cierra antes de recurrir a Windows; evita que dos audios se reproduzcan juntos.
- Se conservan los mensajes aceptados y el límite de la cola de 1.2.7. No se modifica ni descarta la configuración personal.
- Pruebas automatizadas de reanudación sin recibir un segundo comentario, cancelación segura y límite de síntesis. La latencia del servidor externo y de TikTok LIVE depende también del servicio de origen.
