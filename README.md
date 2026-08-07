# Lulu Finity

Aplicación de escritorio para Windows que escucha comentarios de TikTok LIVE, los reproduce mediante TTS y administra solicitudes de canciones en YouTube.

## Funciones

- Conexión a comentarios de TikTok LIVE mediante el relay configurado para Lulu Finity.
- Voces instaladas en Windows y voces neuronales online opcionales.
- Cola de comentarios, filtros y límites por usuario.
- Solicitudes `!cancion` con selección automática del primer resultado normal de YouTube.
- Comprobación de versiones mediante GitHub Releases.
- Instalador por usuario: no requiere permisos de administrador.

## Publicar una versión

1. Cambia `version` en `package.json`.
2. Confirma los cambios en `main`.
3. GitHub Actions compilará únicamente los artefactos necesarios para ejecutar/actualizar Lulu Finity.
4. No se debe publicar ningún paquete `Lulu-Finity-Source-*` ni una copia del código fuente.

La actualización automática de Windows utiliza el instalador NSIS.

## Avisos

Algunas funciones dependen de servicios y componentes de terceros sujetos a sus propias licencias y condiciones. Esas licencias no otorgan derechos sobre el código original de Lulu Finity.

## Licencia

**Software propietario. Todos los derechos reservados.**

El código fuente original de Lulu Finity no se distribuye bajo una licencia de código abierto. No se concede permiso para copiar, modificar, redistribuir, sublicenciar ni publicar el código fuente de Lulu Finity, salvo autorización expresa de su titular.
