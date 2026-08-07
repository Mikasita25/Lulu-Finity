# Lulú Finity Mobile — Android

Versión Android, mobile-first, de Lulú Finity. Vive junto a la aplicación de escritorio y reutiliza el mismo relay de Railway; no introduce un backend de TikTok paralelo.

## Stack

- Expo SDK 57 + React Native 0.86 + TypeScript
- React Navigation 7 (native stack + bottom tabs)
- Zustand + AsyncStorage
- NativeWind 4
- Reanimated 4 (animaciones en UI thread)
- WebSocket nativo hacia el relay actual de Lulú Finity
- Expo Notifications, Haptics, Audio, Document Picker y Sharing

## Pantallas

- Splash animado y onboarding
- Conexión por usuario de TikTok LIVE
- Dashboard en tiempo real
- Vista en Vivo (sustituto móvil de los overlays/browser sources)
- Metas con progreso animado, sonido, haptic y celebración visual
- Ranking / Top Fans con distintos criterios y apariencia RGB
- Historial persistente con filtros
- Sonidos personalizados con selector y preview
- Apariencia / skins
- Perfil
- Ajustes
- Modo Streamer y modo Espectador

## Tiempo real

El cliente se conecta a:

`wss://lulu-finity-production.up.railway.app/v1/tiktok/live?uniqueId=<usuario>`

El token de acceso del relay se lee de `EXPO_PUBLIC_LULU_RELAY_CLIENT_TOKEN`. Las API keys del proveedor no se guardan en la app móvil.

El parser normaliza los eventos del relay/proveedor a un contrato interno (`gift`, `comment`, `like`, `follow`, `share`, `member`, `subscribe`). De esta forma las pantallas, metas y ranking no dependen directamente del esquema externo.

## Desarrollo local

```bash
cd mobile
cp .env.example .env
# Rellena EXPO_PUBLIC_LULU_RELAY_CLIENT_TOKEN con el token cliente del relay.
npm install
npx expo install --check
npm run typecheck
npm run android
```

## APK desde GitHub Actions

El workflow `.github/workflows/mobile-android.yml` instala dependencias, valida TypeScript, ejecuta Expo Doctor, genera el proyecto Android nativo y compila `app-release.apk`.

Debe existir el secreto de GitHub `LULU_RELAY_CLIENT_TOKEN`, con el mismo token cliente permitido por Railway. El token cliente puede extraerse de una app distribuida; sirve como control básico de acceso, no como secreto de proveedor. Las claves pagadas permanecen exclusivamente en Railway.

## Notificaciones en segundo plano

Las notificaciones heads-up locales funcionan mientras el proceso de la app mantiene la sesión WebSocket. Android puede suspender o matar una app en segundo plano, por lo que no se promete recepción continua después de que el proceso sea detenido. Para push remoto garantizado con la app cerrada hace falta registrar dispositivos y enviar Expo/FCM push desde un servicio backend; el relay actual de PC no implementa ese registro y esta primera versión no inventa un backend nuevo.

## Diseño responsive

Las pantallas usan una sola columna y controles táctiles en teléfonos, con ancho máximo centrado para tablets Android. No hay atajos de teclado, multi-monitor, browser-source ni ventanas always-on-top.

### Nota sobre Moti

La especificación original pedía Moti. En Expo SDK 57, Reanimated 4 es la línea compatible, mientras Moti 0.30 mantiene un problema abierto con Reanimated 4 que puede romper o bloquear la app. Por estabilidad, esta versión implementa las mismas microinteracciones directamente con Reanimated 4 y deja Moti fuera del runtime hasta que exista una versión compatible.
