from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
main = (root / 'src/main.js').read_text(encoding='utf-8')
preload = (root / 'src/preload.js').read_text(encoding='utf-8')
renderer = (root / 'src/renderer.js').read_text(encoding='utf-8')

assert 'sandbox: true' in main, 'La ventana principal debe conservar sandbox: true.'
assert "require('./automation-engine')" not in preload, 'Un preload sandboxed no puede cargar automation-engine con require local.'
assert (
    "const automationEngine = require('./automation-engine');" in main
    or "automationEngine=require('./automation-engine')" in main
), 'El motor debe permanecer en el proceso principal, aunque se cargue bajo demanda.'

for channel in ('automations:evaluate', 'goals:apply-event', 'goals:reset', 'gifts:update-stats'):
    assert f"ipcMain.handle('{channel}'" in main, f'Falta handler IPC {channel}.'
    assert f"ipcRenderer.invoke('{channel}'" in preload, f'Falta puente IPC {channel}.'

for token in ('await api.applyGoalEvent', 'await api.updateGiftStats', 'await api.evaluateAutomations', 'await api.resetGoal'):
    assert token in renderer, f'El renderer debe esperar la respuesta IPC: {token}.'

# En un preload sandboxed sólo permitimos imports integrados compatibles con Electron.
local_requires = [line.strip() for line in preload.splitlines() if "require('./" in line or 'require("./' in line]
assert not local_requires, f'Require local no permitido en preload sandboxed: {local_requires}'

print('Preload sandbox 0.34.2: OK')
