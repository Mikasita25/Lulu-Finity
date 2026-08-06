from pathlib import Path
import json

root = Path(__file__).resolve().parent
main = root / 'src' / 'main.js'
s = main.read_text(encoding='utf-8')

old = "let lastUpdateCheckWasManual = false;\nconst knownFollowers = new Set();"
new = "let lastUpdateCheckWasManual = false;\nlet isQuitting = false;\nlet shutdownPromise = null;\nconst knownFollowers = new Set();"
if old not in s:
    raise RuntimeError('No se encontró el marcador de variables de cierre.')
s = s.replace(old, new, 1)

old = "function createWindow() {\n  mainWindow = new BrowserWindow({"
new = """function clearRuntimeAutomation() {
  liveConnectNonce += 1;
  youtubeAutomationNonce += 1;
  spotifyAutomationNonce += 1;
  if (youtubeAutomationTimer) clearTimeout(youtubeAutomationTimer);
  if (spotifyAutomationTimer) clearTimeout(spotifyAutomationTimer);
  youtubeAutomationTimer = null;
  spotifyAutomationTimer = null;
}

function destroyWindowSafely(windowRef) {
  if (!windowRef || windowRef.isDestroyed()) return;
  try {
    windowRef.removeAllListeners('close');
    windowRef.destroy();
  } catch (error) {
    console.warn('No se pudo cerrar una ventana auxiliar:', error?.message || error);
  }
}

function destroyAuxiliaryWindows() {
  destroyWindowSafely(youtubeResolverWindow);
  destroyWindowSafely(youtubeWindow);
  destroyWindowSafely(spotifyWindow);
  youtubeResolverWindow = null;
  youtubeWindow = null;
  spotifyWindow = null;
}

async function shutdownApplication(reason = 'user') {
  if (shutdownPromise) return shutdownPromise;
  isQuitting = true;
  clearRuntimeAutomation();

  shutdownPromise = (async () => {
    const forceExitTimer = setTimeout(() => app.exit(0), 5000);
    forceExitTimer.unref?.();

    try {
      const currentConnection = liveConnection;
      liveConnection = null;
      await safeDisconnect(currentConnection);
    } finally {
      destroyAuxiliaryWindows();
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.removeAllListeners('close');
          mainWindow.destroy();
        } catch (error) {
          console.warn('No se pudo cerrar la ventana principal:', error?.message || error);
        }
      }
      mainWindow = null;
      clearTimeout(forceExitTimer);
      app.quit();

      // Respaldo para procesos de Chromium o audio que no respondan al cierre.
      const finalExitTimer = setTimeout(() => app.exit(0), 1200);
      finalExitTimer.unref?.();
      console.info(`Lulu Finity cerrada por: ${reason}`);
    }
  })();

  return shutdownPromise;
}

function createWindow() {
  mainWindow = new BrowserWindow({"""
if old not in s:
    raise RuntimeError('No se encontró createWindow().')
s = s.replace(old, new, 1)

old = "  mainWindow.on('closed', () => { mainWindow = null; });\n  mainWindow.webContents.setWindowOpenHandler(({ url }) => {"
new = """  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    void shutdownApplication('botón cerrar');
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {"""
if old not in s:
    raise RuntimeError('No se encontró el evento closed de la ventana principal.')
s = s.replace(old, new, 1)

old = """app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (liveConnection) liveConnection.disconnect().catch(() => {});
});"""
new = """app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isQuitting) {
    void shutdownApplication('todas las ventanas cerradas');
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  clearRuntimeAutomation();
  destroyAuxiliaryWindows();
  const currentConnection = liveConnection;
  liveConnection = null;
  if (currentConnection) currentConnection.disconnect().catch(() => {});
});

app.on('will-quit', () => {
  clearRuntimeAutomation();
  destroyAuxiliaryWindows();
});"""
if old not in s:
    raise RuntimeError('No se encontró el ciclo de cierre anterior.')
s = s.replace(old, new, 1)

old = "ipcMain.on('window:close', () => mainWindow?.close());"
new = "ipcMain.on('window:close', () => { void shutdownApplication('botón cerrar'); });"
if old not in s:
    raise RuntimeError('No se encontró el IPC window:close.')
s = s.replace(old, new, 1)
main.write_text(s, encoding='utf-8')

package_path = root / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = '0.13.1'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

changelog_path = root / 'CHANGELOG.md'
changelog = changelog_path.read_text(encoding='utf-8')
entry = """# Cambios

## 0.13.1

- Cerrar Lulu Finity con la X termina completamente la aplicación.
- Se cierran las ventanas ocultas de YouTube, Spotify y el buscador auxiliar.
- Se cancelan temporizadores, automatizaciones y conexiones pendientes de TikTok LIVE.
- Se añadió una salida de respaldo para procesos de Chromium o audio que no respondan.
- El instalador de actualizaciones conserva su flujo de cierre y reinicio.

"""
changelog_path.write_text(entry + changelog, encoding='utf-8')

readme_path = root / 'README.md'
readme = readme_path.read_text(encoding='utf-8').replace('0.13.0', '0.13.1')
if '## Cierre completo' not in readme:
    readme += "\n\n## Cierre completo\n\nAl cerrar la ventana principal, Lulu Finity desconecta el LIVE, cierra YouTube y Spotify y termina todos sus procesos.\n"
readme_path.write_text(readme, encoding='utf-8')
