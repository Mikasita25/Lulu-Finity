# Lulu Finity

Aplicación de escritorio para Windows que escucha comentarios de TikTok LIVE, los reproduce mediante TTS y administra solicitudes de canciones en YouTube.

## Funciones

- Conexión a comentarios de TikTok LIVE mediante `tiktok-live-connector`.
- Voces instaladas en Windows y voces neuronales online opcionales.
- Cola de comentarios, filtros y límites por usuario.
- Solicitudes `!cancion` con selección automática del primer resultado normal de YouTube.
- Comprobación de versiones mediante GitHub Releases.
- Instalador por usuario: no requiere permisos de administrador.

## Publicar una versión

1. Cambia `version` en `package.json`.
2. Confirma los cambios en `main`.
3. GitHub Actions compilará el instalador, el ZIP y `latest.yml`.
4. La Release `v<versión>` se crea o actualiza automáticamente.

La actualización automática de Windows utiliza el instalador NSIS. Las copias abiertas desde el ZIP reciben el aviso y abren la página de la versión nueva.

## Avisos

TikTok LIVE Connector y las voces online se apoyan en servicios no oficiales que pueden cambiar sin previo aviso. Las voces online requieren internet; el texto que se lee se envía al servicio de voz para generar el audio.

## Licencia

AGPL-3.0-or-later.
