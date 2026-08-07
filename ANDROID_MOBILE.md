# Lulu Finity Mobile

Adaptación Android nativa de Lulu Finity.

## Beta 0.1.0

- Conexión directa a TikTok LIVE desde Android mediante TikTokLiveJava.
- Eventos de comentarios, regalos, likes, compartidos, seguidores, entradas, suscripciones y stickers.
- Lectura de comentarios y regalos con el TTS instalado en Android.
- Cola básica de solicitudes `!cancion` y apertura de la siguiente búsqueda en YouTube.
- Rankings persistentes de monedas, likes, comentarios, regalos, compartidos, seguidores, entradas, suscripciones y stickers.
- Servidor HTTP local para usar el ranking como fuente de navegador en OBS desde otro dispositivo conectado a la misma red Wi-Fi.
- Diseño móvil rosa y morado inspirado en Lulu Finity.

## Límites de esta primera beta

- La app debe permanecer abierta mientras escucha el LIVE.
- El enlace para OBS es local por HTTP; todavía no genera un túnel HTTPS para TikTok LIVE Studio.
- Los comandos de imágenes y sonidos personalizados de escritorio todavía no están migrados.
- La conexión usa una biblioteca no oficial y puede requerir una clave de Euler Stream si TikTok limita la conexión directa.

## Fuente y compilación

La fuente Android se guarda comprimida en cinco partes dentro de `build-mobile-v010/source`. El workflow `.github/workflows/android-apk.yml` reconstruye el ZIP, valida su SHA-256, compila el APK y publica el artefacto.

SHA-256 de la fuente 0.1.0:

```text
d9a641b1b50054ddbbce09fc650a976d56e2424528a6767bad503f3a4d7b0d07
```

El APK de depuración se genera como `Lulu-Finity-Mobile-0.1.0-beta.apk`.
