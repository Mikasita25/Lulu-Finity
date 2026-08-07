from pathlib import Path
import json, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
mp = ROOT/'src/main.js'; pp = ROOT/'src/preload.js'; rp = ROOT/'src/renderer.js'; hp = ROOT/'src/index.html'; pkgp = ROOT/'package.json'; cp = ROOT/'CHANGELOG.md'
m = mp.read_text(encoding='utf-8'); p = pp.read_text(encoding='utf-8'); r = rp.read_text(encoding='utf-8'); h = hp.read_text(encoding='utf-8')

if "require('stream/promises')" not in m:
    m = m.replace("const { EventEmitter } = require('events');", "const { EventEmitter } = require('events');\nconst { Readable, Transform } = require('stream');\nconst { pipeline } = require('stream/promises');", 1)

const_marker = "const UPDATE_RELEASES_URL = `${UPDATE_REPOSITORY_URL}/releases/latest`;"
consts = """const ROLLBACK_VERSION = '0.27.0';
const ROLLBACK_ASSET_NAME = 'Lulu-Finity-Setup-0.27.0.exe';
const ROLLBACK_ASSET_URL = 'https://github.com/Mikasita25/Lulu-Finity/releases/download/v0.27.0/Lulu-Finity-Setup-0.27.0.exe';
const ROLLBACK_ASSET_SHA256 = 'ea5b446a4eabf8bf359494a9a3391a597ff7cb523b79baddcfad205b16fce140';"""
if "const ROLLBACK_VERSION" not in m:
    if const_marker not in m: raise RuntimeError('No se encontró el bloque de actualización.')
    m = m.replace(const_marker, const_marker+'\n'+consts, 1)

old_handler = """ipcMain.handle('update:rollback-v027', async () => {
  const url='https://github.com/Mikasita25/Lulu-Finity/releases/download/v0.27.0/Lulu-Finity-Setup-0.27.0.exe';
  await shell.openExternal(url); return {ok:true,version:'0.27.0',url};
});
"""
rollback_code = r'''async function downloadVerifiedRollbackInstaller() {
  if (process.platform !== 'win32') throw new Error('Regresar de versión está disponible en Windows.');
  const response = await fetch(ROLLBACK_ASSET_URL, {
    redirect: 'follow',
    headers: { 'User-Agent': `Lulu-Finity/${app.getVersion()} rollback` }
  });
  if (!response.ok || !response.body) throw new Error(`No se pudo descargar Lulu Finity ${ROLLBACK_VERSION} (${response.status}).`);

  const total = Number(response.headers.get('content-length') || 0);
  const targetPath = path.join(app.getPath('temp'), ROLLBACK_ASSET_NAME);
  const partialPath = `${targetPath}.download`;
  await fsp.rm(partialPath, { force: true }).catch(() => {});
  await fsp.rm(targetPath, { force: true }).catch(() => {});

  let transferred = 0, lastProgressAt = 0;
  const hash = createHash('sha256');
  const meter = new Transform({ transform(chunk, _enc, callback) {
    hash.update(chunk); transferred += chunk.length;
    const now = Date.now();
    if (now - lastProgressAt >= 180 || (total && transferred >= total)) {
      lastProgressAt = now;
      sendUpdateStatus('rollback-downloading', {
        targetVersion: ROLLBACK_VERSION,
        percent: total ? (transferred / total) * 100 : 0,
        transferred, total,
        message: `Descargando Lulu Finity ${ROLLBACK_VERSION}…`
      });
    }
    callback(null, chunk);
  }});

  try {
    await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(partialPath));
    if (hash.digest('hex').toLowerCase() !== ROLLBACK_ASSET_SHA256) throw new Error('La versión 0.27.0 descargada no pasó la verificación de seguridad.');
    await fsp.rename(partialPath, targetPath);
    return targetPath;
  } catch (error) {
    await fsp.rm(partialPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function rollbackToStableVersion() {
  if (updatePromptOpen || !mainWindow || mainWindow.isDestroyed()) return { ok:false, busy:true, version:ROLLBACK_VERSION };
  updatePromptOpen = true;
  try {
    const answer = await dialog.showMessageBox(mainWindow, {
      type: 'warning', title: 'Regresar una versión',
      message: `¿Regresar a Lulu Finity ${ROLLBACK_VERSION}?`,
      detail: '¿Encontraste un bug molesto? Puedes regresar a la versión 0.27.0 hasta que la creadora lo solucione (:\n\nLulu descargará el instalador oficial, verificará que sea exactamente el publicado y después lo abrirá. Tus ajustes locales se conservan.',
      buttons: [`Regresar a ${ROLLBACK_VERSION}`, 'Cancelar'], defaultId: 1, cancelId: 1, noLink: true
    });
    if (answer.response !== 0) { sendUpdateStatus('current', {message:'No se cambió la versión.'}); return {ok:false,cancelled:true,version:ROLLBACK_VERSION}; }
    sendUpdateStatus('rollback-downloading', {targetVersion:ROLLBACK_VERSION,percent:0,message:`Preparando Lulu Finity ${ROLLBACK_VERSION}…`});
    const installerPath = await downloadVerifiedRollbackInstaller();
    sendUpdateStatus('rollback-installing', {targetVersion:ROLLBACK_VERSION,message:`Descarga verificada. Abriendo Lulu Finity ${ROLLBACK_VERSION}…`});
    const child = spawn(installerPath, [], {detached:true,stdio:'ignore',windowsHide:false}); child.unref();
    setTimeout(() => { void shutdownApplication(`regresar a ${ROLLBACK_VERSION}`); }, 650);
    return {ok:true,version:ROLLBACK_VERSION};
  } catch (error) {
    const message = friendlyUpdateError(error);
    sendUpdateStatus('error',{message:`No se pudo regresar a ${ROLLBACK_VERSION}: ${message}`});
    return {ok:false,version:ROLLBACK_VERSION,message};
  } finally { updatePromptOpen = false; }
}

'''
if old_handler not in m: raise RuntimeError('No se encontró el rollback básico de 0.28.2.')
m = m.replace(old_handler, '', 1)
marker = 'async function promptForAvailableUpdate(info) {'
if 'async function rollbackToStableVersion()' not in m:
    if marker not in m: raise RuntimeError('No se encontró el actualizador.')
    m = m.replace(marker, rollback_code+marker, 1)
install = "ipcMain.handle('update:install', async () => {\n  if (!updateDownloaded) return false;\n  setImmediate(() => autoUpdater.quitAndInstall(false, true));\n  return true;\n});"
if "ipcMain.handle('update:rollback'" not in m:
    m = m.replace(install, install+"\nipcMain.handle('update:rollback', async () => rollbackToStableVersion());", 1)

p = p.replace("  rollbackToV027: () => ipcRenderer.invoke('update:rollback-v027'),", "  rollbackVersion: () => ipcRenderer.invoke('update:rollback'),")
h = h.replace('id="rollbackVersionBtn">Regresar a 0.27</button>', 'id="rollbackVersionBtn">Regresar una versión</button>')
h = h.replace('Puedes regresar a la versión 0.27 hasta que la creadora lo solucione (:', 'Puedes regresar a la versión 0.27.0 hasta que la creadora lo solucione (:')
h = h.replace('v0.28.2', 'v0.28.3')

old_listener = "  $('rollbackVersionBtn')?.addEventListener('click', async () => { if(!window.confirm('¿Regresar a Lulu Finity 0.27.0? Se abrirá el instalador oficial de esa versión.'))return; try{await api.rollbackToV027();toast('Regresar a 0.27','Se abrió la descarga oficial. Cierra Lulu e instala 0.27.0.','info');}catch(error){toast('No se pudo abrir 0.27',error.message||String(error),'error');} });"
new_listener = """  $('rollbackVersionBtn')?.addEventListener('click', async () => {
    try {
      const result = await api.rollbackVersion();
      if (result?.cancelled) return;
      if (result && !result.ok && result.message) toast('No se pudo regresar de versión', result.message, 'error');
    } catch (error) { toast('No se pudo regresar de versión', error.message || String(error), 'error'); }
  });"""
if old_listener not in r: raise RuntimeError('No se encontró el listener básico de rollback.')
r = r.replace(old_listener, new_listener, 1)

if "const rollbackButton = $('rollbackVersionBtn');" not in r:
    r = r.replace("  const installButton = $('installUpdateBtn');", "  const installButton = $('installUpdateBtn');\n  const rollbackButton = $('rollbackVersionBtn');", 1)
r = r.replace("  checkButton.disabled = status === 'checking' || status === 'downloading' || status === 'installing';", "  const busy = ['checking','downloading','installing','rollback-downloading','rollback-installing'].includes(status);\n  checkButton.disabled = busy;\n  if (rollbackButton) rollbackButton.disabled = busy;", 1)
r = r.replace("  progress.classList.toggle('hidden', status !== 'downloading');", "  progress.classList.toggle('hidden', status !== 'downloading' && status !== 'rollback-downloading');", 1)
r = r.replace("    installing: payload.message || 'Reiniciando para instalar la actualización…',", "    installing: payload.message || 'Reiniciando para instalar la actualización…',\n    'rollback-downloading': payload.message || `Descargando versión estable 0.27.0: ${Math.round(payload.percent || 0)}%`,\n    'rollback-installing': payload.message || 'Abriendo el instalador de Lulu Finity 0.27.0…',", 1)

pkg = json.loads(pkgp.read_text(encoding='utf-8')); pkg['version'] = '0.28.3'
pkgp.write_text(json.dumps(pkg, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
if cp.exists():
    c = cp.read_text(encoding='utf-8')
    entry = '# Cambios\n\n## 0.28.3\n\n- Mejora **Regresar una versión**: descarga, verifica y ejecuta automáticamente el instalador oficial 0.27.0.\n- Cambia el botón a **Regresar una versión** y mantiene el mensaje para volver temporalmente si aparece un bug molesto.\n- Conserva los arreglos de inicio y las protecciones de Spotify de 0.28.2.\n\n'
    if '## 0.28.3' not in c: c = entry+c
    cp.write_text(c, encoding='utf-8', newline='\n')

mp.write_text(m, encoding='utf-8', newline='\n'); pp.write_text(p, encoding='utf-8', newline='\n'); rp.write_text(r, encoding='utf-8', newline='\n'); hp.write_text(h, encoding='utf-8', newline='\n')
assert 'rollbackToV027' not in p+r and 'update:rollback-v027' not in m
assert 'async function rollbackToStableVersion()' in m and 'ROLLBACK_ASSET_SHA256' in m
assert 'rollbackVersion: ()' in p and 'api.rollbackVersion()' in r
assert 'Regresar una versión' in h and 'versión 0.27.0' in h
assert 'function setupAudioActivityIndicators()' in r
assert '<span class="version" id="versionLabel">v0.28.3</span>' in h
print('Lulu Finity 0.28.3 lista.')
