# Aviso de terceros

Lulu Finity utiliza `tiktok-live-connector`, un proyecto no oficial y no afiliado con TikTok ni ByteDance. El conector se distribuye bajo su propia licencia AGPL modificada. Consulta el paquete incluido y su repositorio para los términos completos.

La conexión puede dejar de funcionar temporalmente si TikTok cambia su servicio interno. Esta aplicación no solicita la contraseña ni las cookies de tu cuenta para la conexión básica por nombre de usuario.

Las canciones que agregues permanecen de forma local en la carpeta de datos de la aplicación. Debes contar con permiso para utilizar y retransmitir el audio que reproduzcas.

## Sonidos incluidos de Kenney

Lulu Finity incluye una selección de efectos de **Kenney Interface Sounds** y **Kenney Casino Audio**. Ambos paquetes se publican bajo **CC0 1.0 Universal**; pueden utilizarse y modificarse, incluso comercialmente, sin atribución obligatoria. Los textos originales de licencia se conservan en `src/default-sounds/` y dentro de los recursos del instalador.

Fuentes: <https://kenney.nl/assets/interface-sounds>, <https://kenney.nl/assets/casino-audio> y <https://kenney.nl/support>.

## Voces neuronales online

Las voces neuronales opcionales utilizan `edge-tts-universal`, un proyecto no oficial que se conecta al servicio de lectura en voz alta de Microsoft Edge. Cuando seleccionas una voz online, el texto del comentario se envía por internet al servicio para generar el audio. Lulu Finity vuelve automáticamente a una voz local de Windows si el servicio no responde.

## Actualizaciones

La aplicación consulta las publicaciones de GitHub Releases del repositorio oficial configurado. Solo descarga instaladores publicados desde ese repositorio; las copias ejecutadas desde ZIP abren la página de la versión nueva y no se reemplazan automáticamente.


Lulu Finity 0.14.0 añade economía local y detección de emotes/stickers Fan.



## Voces de TikTok

Las voces TikTok usan una interfaz interna no documentada por TikTok y pueden cambiar sin aviso. Lulu Finity toma la sesión únicamente del perfil local enlazado en Cuenta, la envía solo a dominios fijos de TikTok para generar el audio y nunca la expone al renderer, al relay ni a archivos de registro. La contraseña se introduce directamente en el sitio oficial y no se guarda en los ajustes de Lulu.
