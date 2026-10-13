from pathlib import Path
import json, sys

root=Path(sys.argv[1] if len(sys.argv)>1 else 'app')
assert json.loads((root/'package.json').read_text(encoding='utf-8'))['version']=='1.2.8'
assert json.loads((root/'package-lock.json').read_text(encoding='utf-8'))['packages']['']['version']=='1.2.8'
js=(root/'src/renderer.js').read_text(encoding='utf-8')
assert 'function startSystemSpeechNow(' in js
assert 'function withSpeechTimeout(' in js
assert "withSpeechTimeout(audio.play(), 12000)" in js
assert 'queueWaitSeconds' in js
assert "cola llena; se conservan los comentarios pendientes" in js
assert (root/'src/speech-start-recovery.test.js').exists()
assert 'v1.2.8' in (root/'src/index.html').read_text(encoding='utf-8')
print('Lulu Finity 1.2.8: parche de voz, cola y versiones validados')
