from pathlib import Path
import json, sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'app')
main=(root/'src/main.js').read_text(encoding='utf-8')
renderer=(root/'src/renderer.js').read_text(encoding='utf-8')
package=json.loads((root/'package.json').read_text(encoding='utf-8'))
assert package['version']=='0.34.1'
assert 'function currentOverlayTunnelInfo()' in main
assert main.count('forceTunnel ? await ensureOverlayHttpsTunnel(true) : currentOverlayTunnelInfo()') == 3
assert 'const tunnel = await ensureOverlayHttpsTunnel(forceTunnel);' not in main
assert "ipcMain.handle('overlay:copy-url'" in main and 'overlayInfo(details?.screen, true)' in main
assert "ipcMain.handle('ranking:copy-url'" in main and 'rankingInfo(details?.slot, true)' in main
assert "ipcMain.handle('widget:copy-url'" in main and 'streamWidgetInfo(details?.type, true)' in main
assert 'signal: controller.signal' in main
assert 'controller.abort(), 4500' in main
assert 'const adBlockWarmup = setTimeout' in main
init=renderer[renderer.index('async function init()'):]
assert 'await refreshRelayUsage();' not in init
assert 'void refreshRelayUsage();' in init
assert 'await loadOnlineVoices(false);' not in init
assert 'void loadOnlineVoices(false);' in init
assert '<span class="version" id="versionLabel">v0.34.1</span>' in (root/'src/index.html').read_text(encoding='utf-8')
print('Pruebas de arranque sin red: OK')
