## Lulu Finity 1.1.7

- Reconoce comandos con espacios especiales o invisibles, `！` o `¡`, mayúsculas, acentos y separadores como `:` o `;`.
- Exige que el comando esté al inicio y evita coincidencias parciales como `!saldos` para `!saldo`.
- Incluye `!true` activado para continuar la música y `!stop` creado pero desactivado para pausarla.
- Corrige los comandos con costo: al configurarlos activa Economía y nunca deja pasar la acción gratis si el cobro está deshabilitado o falla.
- Conserva saldos, evita cobros duplicados y mantiene los reembolsos cuando una canción, audio o imagen no puede ejecutarse.
- Muestra el widget de Monedas durante ocho segundos al usar `!saldo`.
- Muestra Juegos durante la partida y unos segundos después del resultado; Alertas y Regalos se ocultan al vencer su evento.
- Mantiene una Meta sólo cuando está habilitada y el widget musical sólo mientras existe una solicitud o cola.
- Aplica estas reglas tanto en el enlace local como en la fuente HTTPS de OBS o TikTok LIVE Studio.
- Evita la limitación de YouTube en segundo plano y conecta el vigilante a la ventana de reproducción correcta.
- Reanuda pausas inesperadas de YouTube y Spotify, pero respeta una pausa manual hecha por la usuaria.
- Conserva el HTTPS fijo, la personalización por widget y las correcciones de estabilidad anteriores.

El instalador fue compilado, abierto y recorrido automáticamente en Windows antes de publicarse.
