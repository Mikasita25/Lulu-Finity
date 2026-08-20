# Lulú Finity Mobile — Android

Versión Android, mobile-first, de Lulú Finity. Vive junto a la aplicación de escritorio y reutiliza el mismo relay de Railway; no introduce un backend de TikTok paralelo.

## Stack

- Expo SDK 57 + React Native 0.86 + TypeScript
- React Navigation 7 (native stack + bottom tabs)
- Zustand + AsyncStorage
- NativeWind 4
- Reanimated 4
- WebSocket nativo hacia el relay actual de Lulú Finity
- Expo Notifications, Haptics, Audio, Video, Speech, Application, Document Picker y Sharing

## Funciones principales

- Splash con video local centrado, onboarding y conexión por usuario de TikTok LIVE
- Dashboard y Vista en Vivo
- TTS Bot para comentarios
- Metas animadas
- Top Fans / rankings, incluido **Fan Stickers**
- Historial persistente con nombre/ID de Fan Stickers
- Sonidos personalizados
- **Automatizaciones** por comando, Fan Sticker, regalo, follow, share, suscripción o entrada
- Acciones de automatización: sonido, TTS o ambos
- Apariencia, perfil, ajustes y modos Streamer/Espectador
- **Actualizador Android** con comprobación diaria y changelog

## Fan Stickers

El móvil usa el nombre y la métrica de PC: `fanStickers`. Los eventos de emote/fan del proveedor se normalizan a `fanSticker`; no se considera Fan Sticker cualquier sticker visual genérico del chat.

En `Más → Automatizaciones` se puede crear, por ejemplo:

`Fan Sticker corazón → reproducir sonido + decir TTS`

El Historial muestra el nombre y el ID recibido para poder crear coincidencias exactas.

## Tiempo real

El cliente se conecta a:

`wss://lulu-finity-production.up.railway.app/v1/tiktok/live?uniqueId=<usuario>`

El token de acceso del relay se lee de `EXPO_PUBLIC_LULU_RELAY_CLIENT_TOKEN`. Las API keys del proveedor no se guardan en la app móvil.

## Sistema de actualizaciones

PC y Android tienen canales separados. El móvil solo reconoce tags de GitHub con formato:

`mobile-vX.Y.Z`

La app consulta los releases públicos de `Mikasita25/Lulu-Finity`, compara la versión instalada y localiza el asset `.apk`. Si hay una versión superior, muestra el changelog y abre la descarga del APK.

El workflow `.github/workflows/mobile-release.yml` compila y publica automáticamente el APK cuando se crea un tag móvil. Ejemplo para 1.1.3:

```bash
git tag mobile-v1.1.3
git push origin mobile-v1.1.3
```

El tag debe coincidir con `mobile/package.json` y `mobile/app.json`. El `android.versionCode` debe incrementarse en cada release instalable.

## Desarrollo local

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --check
npm run typecheck
npm run android
```

## APK de pruebas desde GitHub Actions

`.github/workflows/mobile-android.yml` valida TypeScript y Expo Doctor, genera Android y compila un APK Release ARM64 autocontenido. Debe existir el secreto `LULU_RELAY_CLIENT_TOKEN`.

## Notificaciones en segundo plano

Las notificaciones heads-up locales funcionan mientras el proceso conserva la sesión WebSocket. Android puede suspender o matar el proceso; recepción push garantizada con la app cerrada requeriría envío FCM/Expo desde servidor.

## Diseño responsive

Las pantallas usan controles táctiles y una columna adaptable a teléfonos/tablets Android. No se incluyen funciones específicas de iOS, multi-monitor, browser-source ni ventanas always-on-top.
