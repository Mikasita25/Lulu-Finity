Lulu Finity PC 1.1.9 — estabilidad de conexión y música

- Corrige la dirección del servidor de PC: el anterior devuelve HTTP 404; el nuevo servidor configurado por el usuario responde correctamente. LIVE, uso y overlays apuntan al mismo servidor activo.
- Los cortes temporales del LIVE siguen reintentándose con una espera máxima de dos minutos; se respetan la desconexión manual, el final del directo y los errores definitivos.
- Railway dispone de hasta 45 segundos para recuperar su conexión antes de que la app abra otra sesión.
- La música no ejecuta recuperaciones simultáneas mientras carga. Los intentos se separan para evitar ciclos de recarga.
- El estado de buffering ya no cancela la recuperación pendiente. Solo el avance real de la canción confirma que volvió a funcionar.
- Pausar durante una recarga impide que la recuperación vuelva a activar la música.

Validación: pruebas del código de reconexión y reproducción con interrupciones simuladas, rotación de Railway, carga lenta y pausa manual. La estabilidad en un LIVE real requiere comprobarse con la cuenta y red del usuario.
