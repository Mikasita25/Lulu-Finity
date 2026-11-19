# Lulu Finity Rust Beta

La beta de Windows usa Tauri 2 y WebView2. Rust gestiona la aplicación, las ventanas, la comunicación con la interfaz, el acceso a archivos y el perfil de Windows. El proceso de Node incluido conserva la lógica de TikTok LIVE, el TTS local y en línea, los juegos, las automatizaciones, la economía y los widgets a partir de la versión 1.3.3 publicada.

La beta se instala por usuario con un identificador propio. Al arrancar por primera vez copia ajustes, rankings, economía, voces importadas y archivos multimedia de Lulu Finity. Las conexiones iniciadas en TikTok, YouTube y Spotify se guardan en perfiles de WebView2, así que se inicia sesión en cada servicio la primera vez. Los enlaces de widgets de la beta se generan al habilitarlos en su perfil y se pueden copiar en la interfaz.

## Compilar en Windows

Instala Node 22, Rust estable y las herramientas de compilación para C++ de Visual Studio. Desde esta carpeta ejecuta:

```powershell
npm ci
npm run build:windows -- --target x86_64-pc-windows-msvc
npm test
```

La preparación descarga el código fuente de 1.3.3 y verifica el SHA-256 de GitHub antes de aplicar los cambios. También se puede ejecutar con `LULU_SOURCE_ARCHIVE` apuntando al ZIP original. El flujo de GitHub Actions publica el instalador de prueba como artefacto de compilación.

La beta comprueba GitHub para ver si existe una versión en el canal `rust-v*`. Para activar la instalación automática firmada, configura `LULU_TAURI_UPDATE_PUBLIC_KEY` al compilar, genera los artefactos con la clave de firma de Tauri y publica `latest-rust.json` en la release `rust-updates`. Conserva la clave privada en los secretos del repositorio. Los instaladores de este canal usan un nombre y un identificador distintos del canal estable.

## Verificación en Windows

La prueba de arranque abre el instalador, recorre las pantallas y valida las vistas previas de widgets. Las funciones que dependen de cuentas o servicios externos requieren además probar un LIVE, voz y audio, el inicio de sesión en TikTok, YouTube y Spotify, y la recepción de los overlays en OBS.
