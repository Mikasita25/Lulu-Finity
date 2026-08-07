from pathlib import Path
import json, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
main_p = ROOT/'src/main.js'
html_p = ROOT/'src/index.html'
pkg_p = ROOT/'package.json'
change_p = ROOT/'CHANGELOG.md'

m = main_p.read_text(encoding='utf-8')
h = html_p.read_text(encoding='utf-8')
pkg = json.loads(pkg_p.read_text(encoding='utf-8'))

# State for the EasyList/uBlock-compatible Electron blocker.
state_anchor = "let youtubeAdBlockInstalled = false;\nlet youtubeAdBlockEnabled = true;\n"
state_new = "let youtubeAdBlockInstalled = false;\nlet youtubeAdBlockEnabled = true;\nlet youtubeFilterEngine = null;\nlet youtubeFilterEnginePromise = null;\nlet youtubeFilterEngineEnabled = false;\n"
if 'let youtubeFilterEngine = null;' not in m:
    if state_anchor not in m: raise RuntimeError('No se encontró el estado del anti anuncios de YouTube.')
    m = m.replace(state_anchor, state_new, 1)

old_func = '''function installYoutubeAdBlocker() {
  if (youtubeAdBlockInstalled) return;
  youtubeAdBlockInstalled = true;
  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);
  const filters = {
    urls: [
      '*://*.doubleclick.net/*',
      '*://*.googlesyndication.com/*',
      '*://*.googleadservices.com/*',
      '*://*.googletagservices.com/*',
      '*://*.adservice.google.com/*',
      '*://*.imasdk.googleapis.com/*',
      '*://*.2mdn.net/*',
      '*://*.google.com/pagead/*',
    ]
  };
  youtubeSession.webRequest.onBeforeRequest(filters, (_details, callback) => {
    callback({ cancel: youtubeAdBlockEnabled });
  });
}
'''
new_func = '''function installYoutubeAdBlocker() {
  if (youtubeAdBlockInstalled) return;
  youtubeAdBlockInstalled = true;
  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);
  // Respaldo local inmediato: funciona incluso si las listas avanzadas todavía no cargaron.
  const filters = {
    urls: [
      '*://*.doubleclick.net/*',
      '*://*.googlesyndication.com/*',
      '*://*.googleadservices.com/*',
      '*://*.googletagservices.com/*',
      '*://*.adservice.google.com/*',
      '*://*.imasdk.googleapis.com/*',
      '*://*.2mdn.net/*',
      '*://*.google.com/pagead/*',
    ]
  };
  youtubeSession.webRequest.onBeforeRequest(filters, (_details, callback) => {
    callback({ cancel: youtubeAdBlockEnabled });
  });
}

async function ensureYoutubeNetworkAdBlocker() {
  installYoutubeAdBlocker();
  if (!youtubeAdBlockEnabled) return null;
  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);

  if (youtubeFilterEngine) {
    if (!youtubeFilterEngineEnabled) {
      try {
        youtubeFilterEngine.enableBlockingInSession(youtubeSession);
        youtubeFilterEngineEnabled = true;
      } catch (error) {
        console.warn('No se pudo reactivar el anti anuncios avanzado:', error?.message || error);
      }
    }
    return youtubeFilterEngine;
  }

  if (!youtubeFilterEnginePromise) {
    youtubeFilterEnginePromise = (async () => {
      try {
        const module = await import('@ghostery/adblocker-electron');
        const ElectronBlocker = module.ElectronBlocker || module.default?.ElectronBlocker;
        if (!ElectronBlocker) throw new Error('ElectronBlocker no está disponible.');

        const cacheDirectory = path.join(app.getPath('userData'), 'adblock');
        const cachePath = path.join(cacheDirectory, 'youtube-ads.bin');
        await fsp.mkdir(cacheDirectory, { recursive: true });
        const blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
          path: cachePath,
          read: (file) => fsp.readFile(file),
          write: (file, data) => fsp.writeFile(file, data)
        });

        youtubeFilterEngine = blocker;
        if (youtubeAdBlockEnabled) {
          blocker.enableBlockingInSession(youtubeSession);
          youtubeFilterEngineEnabled = true;
        }
        console.info('Anti anuncios avanzado de YouTube activo (filtros EasyList/uBlock).');
        return blocker;
      } catch (error) {
        console.warn('Anti anuncios avanzado no disponible; se mantiene el bloqueo integrado:', error?.message || error);
        return null;
      }
    })();
  }
  return youtubeFilterEnginePromise;
}

function setYoutubeNetworkAdBlockEnabled(enabled) {
  youtubeAdBlockEnabled = Boolean(enabled);
  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);
  if (!youtubeAdBlockEnabled) {
    setYoutubeAdGuardMuted(false);
    if (youtubeFilterEngine && youtubeFilterEngineEnabled) {
      try { youtubeFilterEngine.disableBlockingInSession(youtubeSession); } catch {}
      youtubeFilterEngineEnabled = false;
    }
    return;
  }
  void ensureYoutubeNetworkAdBlocker();
}
'''
if 'async function ensureYoutubeNetworkAdBlocker()' not in m:
    if old_func not in m: raise RuntimeError('No se encontró installYoutubeAdBlocker().')
    m = m.replace(old_func, new_func, 1)

# Ensure the advanced blocker is ready before YouTube starts network navigation.
needle = "async function resolveYoutubeRequest(rawQuery, suffix = '') {\n  const query = String(rawQuery || '').trim().slice(0, 180);\n"
replacement = "async function resolveYoutubeRequest(rawQuery, suffix = '') {\n  await ensureYoutubeNetworkAdBlocker();\n  const query = String(rawQuery || '').trim().slice(0, 180);\n"
if replacement not in m:
    if needle not in m: raise RuntimeError('No se encontró resolveYoutubeRequest().')
    m = m.replace(needle, replacement, 1)

needle = "async function controlYoutubePlayer(action, value) {\n  const win = createYoutubeWindow();\n"
replacement = "async function controlYoutubePlayer(action, value) {\n  await ensureYoutubeNetworkAdBlocker();\n  const win = createYoutubeWindow();\n"
if replacement not in m:
    if needle not in m: raise RuntimeError('No se encontró controlYoutubePlayer().')
    m = m.replace(needle, replacement, 1)

needle = "async function openYoutube(rawQuery, suffix = '') {\n  const rawTarget = youtubeTarget(rawQuery, suffix);\n"
replacement = "async function openYoutube(rawQuery, suffix = '') {\n  await ensureYoutubeNetworkAdBlocker();\n  const rawTarget = youtubeTarget(rawQuery, suffix);\n"
if replacement not in m:
    if needle not in m: raise RuntimeError('No se encontró openYoutube().')
    m = m.replace(needle, replacement, 1)

needle = "ipcMain.handle('youtube:show', async () => {\n  const win = createYoutubeWindow();\n"
replacement = "ipcMain.handle('youtube:show', async () => {\n  await ensureYoutubeNetworkAdBlocker();\n  const win = createYoutubeWindow();\n"
if replacement not in m:
    if needle not in m: raise RuntimeError('No se encontró youtube:show.')
    m = m.replace(needle, replacement, 1)

# Keep the existing toggle meaningful for both the advanced blocker and the fallback.
m = m.replace("  youtubeAdBlockEnabled = settings.youtubeAdBlockEnabled !== false;\n  return {", "  setYoutubeNetworkAdBlockEnabled(settings.youtubeAdBlockEnabled !== false);\n  return {", 1)
m = m.replace("  youtubeAdBlockEnabled = next.youtubeAdBlockEnabled !== false;\n  if (!youtubeAdBlockEnabled) setYoutubeAdGuardMuted(false);\n", "  setYoutubeNetworkAdBlockEnabled(next.youtubeAdBlockEnabled !== false);\n", 1)

# Warm the engine in the background without delaying Lulu's main window.
ready = "app.whenReady().then(async () => {\n  await ensureDataFiles();\n  initializeUpdater();\n  createWindow();\n"
ready_new = "app.whenReady().then(async () => {\n  await ensureDataFiles();\n  initializeUpdater();\n  createWindow();\n  void ensureYoutubeNetworkAdBlocker();\n"
if ready_new not in m:
    if ready not in m: raise RuntimeError('No se encontró app.whenReady().')
    m = m.replace(ready, ready_new, 1)

# New version and clearer UI copy.
pkg['version'] = '0.29.0'
pkg.setdefault('dependencies', {})['@ghostery/adblocker-electron'] = '2.18.1'
h = h.replace('v0.28.2', 'v0.29.0')
h = h.replace('<h3>Anti anuncios de YouTube</h3><p>Silencia y omite anuncios automáticamente.</p>', '<h3>Anti anuncios de YouTube</h3><p>Bloquea anuncios desde la red con filtros tipo AdBlock/Brave y usa omisión automática como respaldo.</p>')

main_p.write_text(m, encoding='utf-8', newline='\n')
html_p.write_text(h, encoding='utf-8', newline='\n')
pkg_p.write_text(json.dumps(pkg, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')

if change_p.exists():
    c = change_p.read_text(encoding='utf-8')
    if '## 0.29.0' not in c:
        c = '''# Cambios\n\n## 0.29.0\n\n- Añade un anti anuncios avanzado al navegador integrado de YouTube usando un motor de filtros compatible con EasyList/uBlock.\n- El bloqueo avanzado solo se aplica a la sesión aislada `persist:lulu-youtube`; TikTok, Railway y el resto de Lulu no son afectados.\n- Mantiene el bloqueo local de dominios publicitarios y la detección/silenciado/omisión de anuncios como capas de respaldo.\n- Guarda en caché el motor de filtros para acelerar aperturas posteriores y continúa funcionando con el bloqueo integrado si el motor avanzado no puede cargarse.\n- El interruptor Anti anuncios de YouTube activa y desactiva tanto el motor avanzado como las capas de respaldo.\n\n''' + c
        change_p.write_text(c, encoding='utf-8', newline='\n')

# Regression checks.
m2 = main_p.read_text(encoding='utf-8')
h2 = html_p.read_text(encoding='utf-8')
assert pkg['dependencies']['@ghostery/adblocker-electron'] == '2.18.1'
for token in (
    "import('@ghostery/adblocker-electron')",
    'ElectronBlocker.fromPrebuiltAdsOnly(fetch',
    'enableBlockingInSession(youtubeSession)',
    'disableBlockingInSession(youtubeSession)',
    "const YOUTUBE_PARTITION = 'persist:lulu-youtube'",
    'async function ensureYoutubeNetworkAdBlocker()',
    'void ensureYoutubeNetworkAdBlocker();',
):
    assert token in m2, token
assert 'persist:lulu-tiktok-chat' in m2
assert 'filtros tipo AdBlock/Brave' in h2
assert 'v0.29.0' in h2
print('Lulu Finity 0.29.0: anti anuncios avanzado de YouTube preparado.')
