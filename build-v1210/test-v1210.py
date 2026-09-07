from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app').resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8-sig')

package = json.loads(read('package.json'))
lock = json.loads(read('package-lock.json'))
main = read('src/main.js')
renderer = read('src/renderer.js')
commands = read('src/command-matching-policy.js')
music = read('src/music-recovery-policy.js')
command_tests = read('src/command-matching-policy.test.js')
music_tests = read('src/music-recovery-policy.test.js')
index = read('src/index.html')

assert package['version'] == '1.2.1'
assert lock['version'] == '1.2.1'
assert lock['packages']['']['version'] == '1.2.1'
assert 'v1.2.1' in index

# Preserve Studio 1.2.0 features and credential-free LIVE server.
assert "const LuluWidgetDesign = require('./widget-design');" in main
assert "EMBEDDED_RELAY_CLIENT_TOKEN = '';" in main
assert 'lulu-finity-production-6b8f.up.railway.app' in main
assert 'LuluWidgetDesign' in renderer
assert 'bindStreamWidgetStyleEditors' in renderer
assert 'ensureStreamWidgetStyleEditors' in renderer

# Music stability.
assert 'lastPayloadAt:0' in main
assert 'recovery.lastPayloadAt = now' in main
assert 'mutationMaintenanceTimer' in main
assert "observer.observe(document.documentElement, { childList:true, subtree:true });" in main
assert "attributes:true, attributeFilter:['class','style','aria-label']" not in main
assert "now, 30000, 12000" in main
assert 'stallAfterMs = 30000' in music
assert 'silenceAfterMs = 12000' in music
assert 'distingue silencio del reproductor' in music_tests

# LIVE reconnection.
assert "this.emit(C.DISCONNECTED || 'disconnected', { reason, code:1006, upstream:true });" in main
assert 'transportHealthTimer' in main
assert 'railway-transport-stale' in main
assert "this.socket.on('ping'" in main
assert '75000' in main
assert 'void safeDisconnect(connection);' in main

# Commands.
assert 'LEADING_COMMAND_BANGS' in commands
for marker in ('❗', '❕', '‼', '﹗'):
    assert marker in commands
assert 'acepta signos de exclamación de TikTok' in command_tests

print('Lulu Finity Studio 1.2.1 validada: Studio preservado, música/LIVE/comandos estabilizados')
