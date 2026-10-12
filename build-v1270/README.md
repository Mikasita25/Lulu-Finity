# Lectura de usuarios y cola de voz

Corrección preparada sobre la fuente publicada 1.2.6. El parche genera la versión 1.2.7 sin publicar ni desplegar automáticamente.

- Los datos parciales dentro de `user`, `sender`, `fromUser` o `member` conservan el usuario, nombre y avatar que vienen en el nivel superior. Los datos del relay siguen pasando por su lista permitida.
- Los nombres con puntos y guiones bajos se preparan para voz sin confundirse con enlaces. Si el apodo solo contiene emojis, se usa el identificador del usuario.
- El retraso máximo al recibir sigue configurándose por separado. Los comentarios ya aceptados no vencen por defecto. La nueva espera máxima en cola permite activar un vencimiento de hasta 600 segundos; 0 lo desactiva.
- La cola mantiene el límite configurado, hasta 100 pendientes. Cuando está llena rechaza el mensaje entrante y muestra el motivo, sin borrar uno previamente aceptado. Un vencimiento configurado libera espacio antes de comprobar el límite.
- Los comandos de voz se insertan antes de los comentarios normales, conservando el orden entre comandos. Los comentarios normales mantienen su orden.

Validación: pruebas de identidad parcial, nombres decorados, cola completa de 100 entradas, espera, vencimiento explícito, prioridades y liberación de bloqueos, junto con la suite existente.

La revisión no verifica un LIVE real ni genera un instalador Windows. Los demás filtros de lectura, permisos y cooldowns siguen aplicándose.
