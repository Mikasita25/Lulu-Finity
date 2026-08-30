# Cambios

## 1.1.4

- Mantiene el widget musical transparente mientras está inactivo y lo muestra únicamente cuando existe una canción solicitada o en cola.
- Oculta nuevamente la fuente al terminar las solicitudes; las recomendaciones automáticas no la mantienen visible.
- Añade un editor propio e independiente para Música, Monedas, Juegos, Alertas, Metas y Regalos.
- Permite ajustar color principal, color secundario, texto, fondo, opacidad y bordes; la meta también permite cambiar el grosor de su barra.
- Guarda cada diseño y lo sincroniza con la vista previa, el enlace local y la URL HTTPS estable usada en OBS o TikTok LIVE Studio.
- Hace compatibles los catorce temas y los doce fondos con el alojamiento HTTPS, incluyendo la personalización de rankings.
- Elimina las animaciones continuas de widgets, previews y páginas HTTPS para reducir trabajo visual innecesario.
- Mantiene la URL HTTPS de cada fuente al reiniciar y vuelve a publicar su diseño automáticamente.

## 1.1.2

- Añade HTTPS fijo por instalación para widgets, rankings y pantallas, con el token de escritura separado de la URL pública.
- Sincroniza estado, manifiesto y recursos con Railway; las fuentes activas se reconstruyen tras reinicios o pérdida de volumen sin cambiar de dirección.
- Conserva Cloudflared sólo como alternativa y mantiene sin cambios los enlaces locales HTTP.
- Evita la limitación de YouTube y Spotify en segundo plano y recupera procesos o reproducción estancada sin deshacer pausas manuales visibles.
- Aplica el sistema de botones de Update 3.0 a los 12 temas.
- Separa el aviso de primera instalación del aviso de actualización; ambos se muestran una sola vez y resumen el parche actual.
- Acorta textos de comandos, automatizaciones y rendimiento, y corrige los avisos que todavía describían el HTTPS como temporal.

## 1.1.1

- Incluye una biblioteca local de 24 efectos CC0 de Kenney para Comandos, Automatizaciones y Eventos, sin quitar la importación de archivos propios.
- Permite buscar, filtrar y escuchar cada sonido antes de aplicarlo; las selecciones incluidas siguen funcionando al cambiar la carpeta de instalación.
- Añade el ajuste **Ignorar conversaciones con @usuario** para que las respuestas dirigidas sigan visibles pero no entren en la cola TTS.
- Conserva la ejecución normal de comandos, música, juegos y automatizaciones antes del filtro de lectura del bot.
- Añade 12 fondos procedurales independientes para cada fuente de Música, Monedas, Juegos/Ruleta, Alertas, Metas y Regalos.
- Guarda tema y fondo dentro de cada enlace HTTPS/local y recarga automáticamente las fuentes conectadas cuando cambia cualquiera de los dos.
- Empaqueta sonidos y licencias fuera de ASAR para que Electron pueda reproducirlos de forma confiable en Windows y sin conexión.

## 1.1.0

- Añade catorce temas independientes para las fuentes de Música, Monedas, Juegos, Alertas, Metas y Regalos: Lulu Rosa, Aurora, Cyber, Arcade, Holograma, Sakura, Miku, Lavanda, Atardecer, Dorado, Menta, Océano, Vampiro y Monocromo.
- Guarda un tema distinto por cada fuente, lo integra en los enlaces HTTPS/locales y actualiza automáticamente las fuentes conectadas al cambiar de diseño.
- Mantiene vistas previas permanentes con datos de muestra para comparar diseños sin comentarios, comandos, regalos, canciones ni actividad del LIVE.
- Unifica los doce temas de Lulu Finity: acentos, títulos, texto, campos, botones, casillas, radios y estados ahora comparten contraste y color de tema.
- Convierte Apariencia en una galería visual para elegir cada tema con una vista previa reconocible.
- Rediseña la creación de comandos y automatizaciones como experiencias guiadas de tres pasos con resumen en vivo, jerarquía clara y acciones persistentes.
- Mantiene automatizaciones, metas, LIVE, voz, música, juegos y fuentes conectadas aunque el usuario cambie de categoría, minimice la aplicación o libere recursos inactivos.
- Amplía Ahorro a 30 segundos y Equilibrado a 3 minutos; ambos liberan únicamente recursos realmente inactivos y nunca interrumpen una función en curso.
- Usa el bloqueador oficial de suspensión de Electron únicamente mientras una función activa lo necesita, sin mantener despierto el equipo cuando Lulu está inactiva.
- Da prioridad a un `cloudflared.exe` verificado y empaquetado, conserva la descarga oficial como recuperación y añade un puerto local automático si el rango preferido está ocupado.
- Protege los enlaces HTTPS activos para que una limpieza de memoria o un cambio de categoría no apague la fuente de OBS/TikTok LIVE Studio.
- Añade estados, enlaces y mensajes de HTTPS más legibles, además de soporte para movimiento reducido y diseño adaptable en los nuevos editores.

## 1.0.5

- Mantiene el LIVE y el bot de voz activos aunque el usuario cambie de categoría, minimice Lulu o use los perfiles Ahorro y Equilibrado.
- Recupera automáticamente cortes temporales de red, reinicios de Railway, cierres por inactividad y límites de duración del proveedor.
- Usa retroceso progresivo y un máximo de ocho intentos para evitar bucles de conexión y consumo innecesario de la cuota diaria.
- No reconecta cuando el usuario pulsa Desconectar, TikTok confirma que terminó el LIVE, se agota el límite diario o el relay rechaza el protocolo por seguridad.
- Elimina del relay el cierre explícito tras 300 segundos sin eventos, para que un LIVE tranquilo no desconecte al bot.
- Añade pruebas de política de reconexión, ciclo de vida en segundo plano y persistencia del relay.

## 1.0.4

- Corrige las categorías vacías causadas por la sección Cuenta sin cerrar en el HTML de 1.0.3.
- Mantiene todas las categorías dentro de una sola ventana y permite que exactamente una página esté visible y activa a la vez.
- Suspende las vistas previas de overlays, alertas y juegos al salir de su categoría, sin cerrar fuentes OBS/TikTok LIVE Studio que sigan conectadas.
- Evita que eventos del relay vuelvan a cargar vistas previas ocultas y que Automatizaciones despierte fuera de su categoría si no fue conservada en Rendimiento.
- Agrupa las ventanas auxiliares de TikTok, YouTube y Spotify dentro de Lulu sin mostrarlas como aplicaciones independientes en la barra de tareas.
- Amplía el catálogo de TikTok a seis voces en español: cuatro de España y dos de México, con nombres claros y un contador visible.
- Añade una prueba real que recorre todas las categorías en el ejecutable de Windows y exige una sola pantalla visible en cada cambio.

## 1.0.3

- Convierte el WebSocket del LIVE en un canal de confianza cero y solo recepción para la aplicación.
- El cliente nunca responde al relay con cookies, sesión de TikTok, archivos, ajustes, credenciales o datos del dispositivo.
- Acepta únicamente tipos exactos de eventos públicos y conserva solo los campos requeridos por comentarios, regalos, likes y actividad del LIVE.
- Rechaza solicitudes remotas, RPC, comandos, métodos, canales IPC, tipos desconocidos, paquetes binarios y cargas excesivas.
- Limita tamaño, frecuencia, texto, números, listas y URLs de cada evento antes de enviarlo a la interfaz.
- Endurece el contador de uso: sin redirecciones, máximo 32 KB y respuesta reducida a métricas numéricas permitidas.
- Añade pruebas de servidor malicioso, campos privados, URLs peligrosas, saturación y ausencia de respuestas WebSocket desde Lulu.
- Corrige el orden de inicialización que cerraba 1.0.2 antes de crear la ventana y añade una prueba real del ejecutable de Windows hasta que el renderer queda listo.

## 1.0.2

- Retira por completo la Voz Oficial y el motor descargable OpenVoice que no funcionaba correctamente.
- Conserva las voces online de Microsoft/Edge, las voces instaladas de Windows y Lulu Local.
- Añade más de 70 voces auténticas de TikTok, incluidas Warm, Jessie, Story Teller, Wacky, Ghost Face, C3PO, Stitch y Stormtrooper.
- Rediseña Cuenta con dominio oficial visible, una explicación extensa del relay WebSocket, datos transmitidos, sesión local, permisos bloqueados y borrado completo con un botón.
- Usa de forma local la sesión enlazada en Cuenta para solicitar audio directamente a TikTok; la cookie nunca se muestra ni se envía al relay.
- Las voces Microsoft, Windows y Lulu Local funcionan sin vincular una cuenta de TikTok.
- Permite desplazarse verticalmente por todas las funciones cuando la ventana no está maximizada.
- Añade carga bajo demanda: al iniciar no abre YouTube/Spotify, TTS, rankings, overlays, juegos, economía ni automatizaciones; en Música solo permanece el proveedor elegido.
- Libera el buscador temporal de YouTube después de resolver una canción y cierra el proveedor musical inactivo al cambiar de servicio.
- Corrige Rendimiento para sumar todos los procesos de Lulu, igual que el grupo del Administrador de tareas, y muestra el consumo separado de la interfaz, Spotify/YouTube, gráficos y servicios de Electron.
- Hace reales los perfiles: Ahorro libera el reproductor inactivo en 5 segundos, Equilibrado en 60 segundos y Respuesta inmediata lo conserva; ninguno interrumpe una canción o cola activa.
- Permite personalizar Equilibrado por categoría, conservando sólo los módulos elegidos después de usarlos y sin precargarlos al iniciar.
- Reduce el retraso del bot preparando únicamente el siguiente comentario mientras suena el actual, sin pausas artificiales entre voces.
- Omite comentarios normales que no empiecen dentro del límite configurable, conserva comandos prioritarios y acelera gradualmente hasta 25% cuando se acumula la cola.
- Muestra la latencia real y su promedio desde que llega el comentario hasta que comienza la voz.

## 1.0.1

- Corrige la regresión que ocultaba las voces Microsoft/online cuando Lulu Local estaba seleccionada.
- Carga automáticamente el catálogo gratuito completo al abrir TTS y permite actualizarlo manualmente.
- Organiza las voces online por idioma y país, con búsqueda por nombre, región y género.
- Guarda el último catálogo válido y amplía la lista de respaldo para funcionar ante fallos temporales.
- Omite voces CJK del catálogo, de acuerdo con el filtro de lectura inteligente de Lulu Finity.
- Conserva Lulu Local y todas las voces instaladas de Windows.
- Añade la **Voz Oficial De Lulu Finity**, creada con una muestra autorizada y un motor de clonación local que se descarga sólo cuando se instala.
- Mantiene el instalador ligero: el motor OpenVoice V2 se verifica por SHA-256 y se obtiene desde la Release oficial.

## 1.0.0

- Reorganiza toda la interfaz por tareas: LIVE, voz y audio, pantalla, interacciones, comunidad y sistema, sin crear categorías internas en el Panel.
- Añade búsqueda global de funciones para llegar directamente a TTS, diccionario, overlays, rendimiento y demás herramientas.
- Estrena Lulu Local: TTS sin Internet con voz mexicana incluida, proceso aislado y biblioteca para importar paquetes `.lfvoice`.
- Añade limpieza inteligente Unicode, normalización de letras decorativas, nombres sin emojis, bloqueo opcional CJK y detección de alfabetos mezclados.
- Añade diccionario de pronunciación y conserva voces por usuario, voz del sistema y voces online como respaldo.
- Reduce consumo al iniciar: overlays, widgets, catálogo online, navegador de resolución y motor local se cargan sólo al usarse.
- Añade perfiles de rendimiento, estado de módulos y liberación manual de recursos inactivos.
- Conserva Railway, YouTube con anti anuncios, Spotify, comandos, juegos, economía, automatizaciones, metas y temas de Lulu Studio.

## 0.34.2

- Corrige el **Error al iniciar** introducido con Automatizaciones: el preload de Electron estaba intentando cargar un módulo local mientras la ventana usa `sandbox: true`.
- Mantiene el sandbox de seguridad y mueve la evaluación de automatizaciones, metas y estadísticas de regalos al proceso principal mediante IPC seguro.
- Evita que falle `window.voiceStudio` durante el arranque y conserva Automatizaciones, Metas del LIVE y Top regalos.
- Añade una regresión específica para impedir que un `require('./...')` vuelva a entrar en el preload sandboxed.
- Conserva el arranque local-first de 0.34.1, Lulu Studio, juegos, rankings, economía, TTS, música y Railway.

## 0.34.1

- Corrige el arranque que podía quedarse esperando servicios de Internet y hacer que Lulu pareciera desconectada.
- Inicio, ajustes y funciones locales cargan primero sin depender de GitHub, Cloudflare, Railway ni YouTube.
- Los enlaces HTTPS de overlays se crean únicamente al pedir **Copiar HTTPS**; las vistas y enlaces locales ya no levantan Cloudflare durante el inicio.
- El contador de uso de Railway se actualiza en segundo plano y tiene tiempo límite, por lo que una caída del servidor no bloquea la interfaz.
- El anti anuncios avanzado de YouTube se prepara después de mostrar la aplicación y continúa aislado en la sesión de YouTube.
- Mantiene Lulu Studio, las tres Miku, Automatizaciones, Juegos del LIVE, rankings, economía, TTS y música.

## 0.34.0

- Añade **Lulu Studio**, una nueva familia de temas para Inicio con variantes Lavanda, Rosa y Menta.
- Reorganiza Inicio en un panel más compacto con actividad reciente, accesos, sesión, meta, alertas, último regalo y ranking.
- Mantiene todas las páginas y funciones existentes; cambiar de tema no modifica overlays ni configuraciones del stream.
- Mejora la presentación de las tres ilustraciones de Miku con más luz, contraste y brillo suave, usando los dibujos originales.
- Corrige también la iluminación de Miku Menta, Miku Rosa y Miku Lavanda en los temas anteriores.
- Añade cambio rápido entre las tres variantes Studio desde Inicio.
- Ajusta la distribución para ventanas medianas y estrechas sin perder acceso a la navegación.

# Cambios

## 0.33.0

- Añade **Automatizaciones**, un motor de Actions & Events integrado con la estética de Lulu.
- Permite disparadores por regalos, seguidores, likes, compartidos, suscripciones, entradas y comentarios, con filtros por regalo/palabra, usuario, mínimo, racha y cooldown.
- Cada regla puede combinar varias acciones: **TTS, mensaje al chat, sonido personalizado, alerta en pantalla y webhook HTTP/HTTPS**.
- Los sonidos se importan desde el equipo y Lulu conserva una copia dentro de sus datos locales para que no se rompan al mover el archivo original.
- Añade **Metas del LIVE** para likes, monedas, regalos, follows, compartidos, subs, entradas y comentarios, con progreso y reinicio individual.
- Añade tres nuevas pantallas para OBS/TikTok LIVE Studio: **Alertas**, **Meta activa** y **Top regalos / mejor racha**.
- Registra top regalo, mejor racha, último regalo, total de regalos y monedas de la sesión.
- Añade webhooks para conectar Lulu con Streamer.bot, automatizaciones propias, servidores locales u otros servicios compatibles sin acoplar Lulu a un proveedor específico.
- Mantiene Juegos del LIVE, rankings, economía, música, Railway, temas Miku y el diseño visual existente.

# Cambios

## 0.32.0

- Retira por completo **Voces divertidas** y el proveedor externo StreamElements; Voz TTS vuelve al sistema anterior de Lulu.
- Añade **Juegos del LIVE** con comandos y apuestas usando únicamente la moneda virtual configurada en Economía.
- Incluye Blackjack interactivo (`!blackjack`, `!pedir`, `!plantar`), Rasca y gana, Ruleta, Dados, Piedra/Papel/Tijera y Tragamonedas.
- Permite configurar comandos, activar/desactivar cada juego, apuesta mínima/máxima/predeterminada y cooldown por usuario.
- Añade una pantalla HTTPS/local para el stream que muestra jugador, apuesta, cartas/símbolos y resultado en tiempo real.
- Los cobros y premios pasan por la economía de Lulu y quedan registrados en el historial de movimientos.
- Los resultados pueden anunciarse opcionalmente por TTS y por el chat de TikTok enlazado.
- Mantiene el anti anuncios avanzado de YouTube, Railway, overlays, rankings, rollback a 0.27 y correcciones de arranque.

# Cambios

## 0.29.0

- Añade un anti anuncios avanzado al navegador integrado de YouTube usando un motor de filtros compatible con EasyList/uBlock.
- El bloqueo avanzado solo se aplica a la sesión aislada `persist:lulu-youtube`; TikTok, Railway y el resto de Lulu no son afectados.
- Mantiene el bloqueo local de dominios publicitarios y la detección/silenciado/omisión de anuncios como capas de respaldo.
- Guarda en caché el motor de filtros para acelerar aperturas posteriores y continúa funcionando con el bloqueo integrado si el motor avanzado no puede cargarse.
- El interruptor Anti anuncios de YouTube activa y desactiva tanto el motor avanzado como las capas de respaldo.

# Cambios

## 0.28.2

- Corrige el error al iniciar restante de 0.28.1.
- Protege controles de Spotify eliminados de la interfaz 0.28.
- Añade **Regresar a 0.27** con acceso al instalador oficial 0.27.0.

# Cambios

## 0.28.1

- Restaura la conexión al LIVE y los controles de la interfaz que 0.28.0 dejó sin eventos por una transformación incorrecta de renderer.js.
- Restaura los controles de música y la sincronización de reproducción recomendada sin volver a añadir Brave.
- Mantiene el relay, el arreglo de Windows, las pestañas internas y el anti anuncios de 0.28.0.
- Añade validaciones para impedir publicar otra versión si desaparecen las funciones críticas del renderer.

# Cambios

## 0.28.0

- Quita por completo la opción de Brave y mantiene YouTube dentro de Lulu Finity.
- Refuerza el anti anuncios de YouTube: silencia la ventana durante anuncios, detecta antes los botones para saltarlos y acelera su omisión sin dejar sonar el inicio.
- Organiza Música, Cuenta, Comandos, Overlays, Economía y Ajustes con pestañas internas, igual que Voz TTS. El Panel se mantiene sin pestañas.
- Mantiene indicadores compactos de audio dentro de Voz TTS, Música y Comandos, sin añadir una categoría extra.
- Cambia el medidor individual a Tu uso diario y siempre consulta la cuenta de TikTok guardada en Lulu, sin permitir consultar otro usuario desde la interfaz.
- Corrige el arranque que podía quedarse mostrando v0.19.0 y dejar secciones sin cargar.

# Cambios

## 0.27.0

- Añade Brave como opción opcional para abrir YouTube; viene desactivado y la reproducción controlada por Lulu sigue usando su navegador integrado.
- Elimina Filtros como categoría y mueve sus controles dentro de Voz TTS con accesos rápidos por secciones.
- Simplifica textos de Cuenta, Comandos, Overlays, Economía y Música.
- Mueve Mensajes automáticos al final de Comandos y oculta la configuración de superposición hasta que exista un comando de imagen/GIF.
- Cambia el título a Servidor seguro de Lulu Finity y añade un medidor individual de 600 conexiones diarias por usuario.
- Los iconos de la aplicación adoptan el color del tema activo.
- El relay guarda el contador individual con identificadores hash y bloquea nuevas conexiones al llegar al límite diario por usuario.

# Cambios

## 0.26.0

- Elimina la categoría independiente Permisos.
- Mueve el proveedor de música, quién puede pedir canciones y la lista de usuarios permitidos dentro de Música.
- Mueve quién puede ser leído y la lista de usuarios permitidos para TTS dentro de Voz TTS.
- Conserva los mismos valores, IDs y lógica de permisos para no perder configuraciones existentes.

# Cambios

## 0.25.0

- Reemplaza las ilustraciones de Miku Classic, Miku Soft y Miku Dark por las imágenes elegidas para cada tema.
- Añade la categoría Cuenta para enlazar y administrar la sesión local de TikTok.
- Mueve la configuración de mensajes automáticos al área de Comandos.
- Une YouTube y Spotify bajo una sola categoría visible llamada Música.
- Renombra Rankings como Overlays sin cambiar el funcionamiento interno de los rankings y widgets.
- Permite hacer los paneles mucho más transparentes para ver mejor el fondo de Miku.
- Actualiza la imagen de Sobre Lulu con la nueva ilustración elegida.

# Cambios

## 0.24.0

- Añade los temas seleccionables Miku Classic, Miku Soft y Miku Dark.
- Conserva la distribución, tarjetas, navegación y funciones existentes de Lulu Finity.
- Cada tema cambia paleta, fondo, iluminación y una ilustración decorativa de Miku únicamente dentro de la aplicación.
- Los rankings, reproductores y demás widgets que se muestran en el stream no reciben la decoración de Miku.

# Cambios

## 0.23.0

- Añade mensajes automáticos al chat del LIVE usando la cuenta de TikTok iniciada localmente en Lulu Finity.
- Permite elegir cuándo enviar: al agregar, iniciar, terminar o saltar canciones, y al conectar Lulu al LIVE.
- Cada evento tiene una plantilla editable con variables de canción, usuario, posición, cola, proveedor, comando y cuenta del LIVE.
- Guarda la sesión de TikTok únicamente en la computadora y añade prueba, comprobación y restablecimiento de sesión.
- Añade una cola con espera mínima y protección contra mensajes duplicados consecutivos.

# Cambios

## 0.21.1

- Publica una actualización automática para las instalaciones 0.21.0 que no recibieron el token del relay.
- Incluye el token oficial durante la compilación para todos los usuarios.
- Mantiene los ajustes existentes y no requiere desinstalar ni reinstalar Lulu Finity.
- Añade compatibilidad del relay con launchers ya distribuidos y conserva límites por IP y máximo de clientes.

# Cambios

## 0.21.0

- Mueve las API keys de EulerStream fuera de la aplicación y las conserva únicamente en Railway.
- Añade un relay WebSocket autenticado que rota automáticamente cuando una key alcanza cuota, concurrencia o rate limit.
- Mantiene abierta la conexión de Lulu con Railway mientras el servidor cambia a la siguiente key disponible.
- Elimina la API key anterior del archivo local de ajustes durante la migración.
- Incluye la URL oficial del relay dentro de la aplicación e inyecta el token del cliente durante la compilación, sin pedir configuración a los usuarios.

# Cambios

## 0.20.0

- Sustituye la ruta de firma que empezó a exigir Business por el WebSocket Cloud del plan Community gratuito.
- Añade un campo seguro en Ajustes para guardar una API key gratuita de EulerStream.
- Incluye acceso directo al registro gratuito y no requiere tarjeta ni suscripción Business.
- Traduce los códigos de cierre del servicio para explicar claves inválidas, LIVE offline y límites gratuitos.
- Mantiene comentarios, regalos, likes, seguidores, compartidos, miembros, suscripciones y espectadores en la nueva conexión.
- La API key no aparece en el resumen exportado de ajustes ni en los registros de diagnóstico.

# Cambios

## 0.19.0

- Nueva superposición de lista de reproducción con canción actual y hasta cinco solicitudes pendientes.
- Nueva tarjeta compacta de economía con foto, nombre y cantidad de monedas del último usuario cuyo saldo cambió.
- Ambos widgets incluyen vista previa, enlace HTTPS para TikTok LIVE Studio y enlace local para OBS.
- Corrige regalos que no entregaban monedas al cargar la información extendida del catálogo de TikTok.
- El valor del regalo se obtiene desde todos los campos disponibles y usa la cantidad enviada como respaldo cuando TikTok no entrega diamantes.
- Las cuentas de economía ahora conservan la foto de perfil para rankings y tarjeta de saldo.
- La recompensa por regalos queda activada por defecto en instalaciones nuevas, con una moneda por unidad detectada.

# Cambios

## 0.18.0

- Los comandos con voz o sonido entran en una cola exclusiva y no pueden volver a activarse hasta que termine su audio.
- Los sonidos de stickers y eventos también respetan el bloqueo para evitar mezclas y repeticiones superpuestas.
- Cada usuario puede tener voz, velocidad, tono y volumen propios, con edición y prueba individual.
- Los comandos que producen audio incluyen botones de prueba en la lista y dentro del editor.
- Las reglas de stickers y eventos permiten ajustar el volumen y probar cada sonido antes y después de guardarlo.
- El botón Detener limpia únicamente la voz pendiente sin interrumpir imágenes o música.

# Cambios

## 0.17.0

- Corrige los enlaces marcados como inválidos por TikTok LIVE Studio.
- Lulu genera automáticamente enlaces HTTPS temporales mediante Cloudflare Tunnel, sin abrir puertos del router.
- Se muestran por separado el enlace HTTPS para TikTok LIVE Studio y el enlace local para OBS.
- Rankings e imágenes usan actualización por sondeo compatible con los túneles HTTPS.
- El componente oficial de Cloudflare se descarga una sola vez y se valida con SHA-256.
- Se mejoraron los mensajes de conexión, reintento y estado del enlace seguro.

# Cambios

## 0.16.0

- Nueva sección Rankings con cuatro enlaces independientes para OBS y TikTok LIVE Studio.
- Rankings en tiempo real de Top Gifters/monedas, tap taps, monedas de Lulu, regalos, comentarios, compartidos, seguidores, entradas, suscripciones y stickers de Fan.
- Personalización de Top 3, 5, 7 o 10, título, cuatro estilos, siete fuentes, colores, opacidad, avatares, posiciones y cantidades.
- Nuevo texto RGB animado y estilo TikTok con rosa, cian, corona y reordenamiento visual.
- Vista previa con usuarios de muestra sin contaminar los datos reales.
- Datos de interacción persistentes y botón para reiniciar únicamente el ranking seleccionado.

# Cambios

## 0.15.0

- Nueva superposición local para OBS y TikTok LIVE Studio mediante fuente de navegador.
- Lulu genera cuatro enlaces independientes de superposición y permite copiarlos desde Comandos.
- Las acciones Mostrar imagen ahora envían PNG, JPG, WebP, GIF o BMP al stream en vez de mostrarlos encima de la aplicación.
- Cada comando de imagen puede elegir Superposición 1, 2, 3 o 4 y su duración.
- Incluye prueba, limpieza y estado de conexión de cada fuente.
- El servidor escucha únicamente en 127.0.0.1 y protege los enlaces con un token local.

# Cambios

## 0.14.0

- Detección separada de stickers enviados desde las pestañas Fan y Super Fan de TikTok.
- Los stickers detectados muestran su ID para asignar sonidos específicos desde Comandos.
- Nueva economía configurable con nombre, símbolo, saldo inicial y recompensas por actividad.
- Herramientas para añadir, quitar, establecer y consultar monedas de cualquier usuario.
- Cada comando puede tener un costo; si la acción falla, el saldo se devuelve automáticamente.
- Nuevos comandos predeterminados apagados: `!saldo` y `!revoke`.
- `!revoke` quita la última canción pendiente del usuario y devuelve las Lunitas cobradas por esa solicitud.

# Cambios

## 0.13.1

- Cerrar Lulu Finity con la X termina completamente la aplicación.
- Se cierran las ventanas ocultas de YouTube, Spotify y el buscador auxiliar.
- Se cancelan temporizadores, automatizaciones y conexiones pendientes de TikTok LIVE.
- Se añadió una salida de respaldo para procesos de Chromium o audio que no respondan.
- El instalador de actualizaciones conserva su flujo de cierre y reinicio.

# Cambios

## 0.13.0

- YouTube resuelve cada petición a un video concreto antes de agregarla a la cola.
- Pulsar Siguiente dentro de YouTube respeta la cola de solicitudes de Lulu.
- Eliminada la categoría Eventos; las reglas de regalos y stickers se administran dentro de Comandos.
- El catálogo de voces abre en Todos los idiomas, incluye búsqueda y muestra cuántas voces están visibles.
- Compatibilidad con nombres de voces neuronales que contienen regiones o alfabetos adicionales.
- Spotify Web conserva su sesión y, si falla, puede abrir la búsqueda en la aplicación de Spotify instalada.
- Se aclara que el modo de escritorio de Spotify es alternativo y no permite automatizar de forma fiable el final de cada canción.

# Cambios

## 0.12.0

- El panel principal cambia automáticamente entre YouTube y Spotify según el proveedor elegido.
- Los comandos incluidos por defecto quedan apagados hasta que el usuario los active.
- Nuevas acciones de comandos personalizados: reproducir un sonido y mostrar una imagen elegida desde la PC.
- Los archivos multimedia se copian al almacenamiento local de Lulu Finity para conservarlos entre reinicios.
- Nuevas reglas de eventos para reproducir sonidos con regalos, stickers, seguidores, suscripciones, compartidos, entradas o likes.
- Se puede detectar un regalo o sticker por su nombre, por ejemplo «sticker de fan».

# Cambios

## 0.11.0

- Cada instalación conserva su propia cuenta, sesión y configuración local; una instancia controla un LIVE a la vez.
- Selector único de proveedor musical: YouTube o Spotify.
- Eliminado el comando separado `!spotify`; el comando general de música usa el proveedor elegido.
- Corregido **Actualizar ahora** para descargar, cerrar e instalar directamente sin entrar después a Ajustes.
- Permisos independientes de TTS: todos, seguidores, miembros desde cierto nivel o usuarios elegidos.
- Lista manual de usuarios autorizados para TTS, separada de la lista de música.
- Voces personalizadas por usuario para comentarios y comandos de lectura.

# Cambios

## 0.10.0

- Detección de regalos/donaciones, seguidores, likes, compartidos, usuarios que entran y suscripciones de TikTok LIVE.
- Contadores y actividad reciente en una categoría independiente de Eventos.
- Avisos opcionales mediante TTS para cada tipo de evento.
- Sección Sobre Lulu con presentación, contacto de Discord e imagen proporcionada por Lulu.
- Spotify en una sesión persistente con búsqueda automática, cola, controles, volumen y reproducción continua.
- Comando `!spotify` incluido y sujeto a los mismos permisos de música.
- YouTube y Spotify se silencian durante el TTS cuando la opción correspondiente está activa.

# Cambios

## 0.9.0

- Eliminada la mascota grande del lateral sin quitar la tarjeta de estado y usuario.
- Panel principal simplificado: estadísticas, comentarios, reproductor y prueba local.
- Comandos y permisos permanecen únicamente en sus categorías.
- Barra de desplazamiento integrada con el tema, sin línea blanca exterior.
- Límite configurable de duración para videos de YouTube.
- Detección y rechazo de solicitudes duplicadas.
- Listas para bloquear canciones, términos, enlaces y canales.
- Controles para subir y bajar canciones dentro de la cola.
- Tema rosa y tema oscuro.
- Ajustes de brillo, transparencia y redondeo de los paneles.
- Opciones para ocultar estadísticas, comentarios, música o prueba local del panel principal.

## 0.8.1

- Corregido el error `Failed to get LocalAppData path` al abrir la aplicación.
- La detección del instalador usa ahora `LOCALAPPDATA` de Windows con una ruta alternativa segura.
- El comprobador de actualizaciones ya no puede cerrar la aplicación por una ruta no compatible de Electron.

## 0.8.0

- Rediseño completo en rosa y morado con navegación unificada.
- Reproductor persistente de YouTube: la misma sesión se reutiliza para toda la cola.
- Controles de pausa, reinicio, salto, volumen, progreso y mezcla desde Lulu Finity.
- Continuación automática con canciones recomendadas cuando la cola termina.
- Creador de comandos personalizados con acciones de voz, TTS, música y salto.
- Permisos para pedir música: todos, seguidores, miembros desde cierto nivel o usuarios elegidos.
- Identificación de seguidores y miembros mediante la información disponible en los comentarios de TikTok.
- Textos de la interfaz revisados y paneles coherentes en todas las secciones.

## 0.7.0

- Actualizador integrado mediante GitHub Releases.
- Voces neuronales online y voces instaladas en Windows.
- Instalador por usuario sin elevación de administrador.
