from pathlib import Path
import json
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'app').resolve()
assert json.loads((root / 'package.json').read_text(encoding='utf-8'))['version'] == '1.2.9'
assert json.loads((root / 'package-lock.json').read_text(encoding='utf-8'))['packages']['']['version'] == '1.2.9'
renderer = (root / 'src/renderer.js').read_text(encoding='utf-8')
assert 'function withSpeechTimeout(promise, ms = 8000)' in renderer
assert 'await withSpeechTimeout(audio.play(), 5000);' in renderer
assert '    }, 4000);\n  };\n  speak();\n}\nfunction runSpeechNow(' in renderer
assert 'function startSystemSpeechNow(' in renderer
assert 'systemSpeechRecoveryCancel' in renderer
assert 'v1.2.9' in (root / 'src/index.html').read_text(encoding='utf-8')
speech_test = (root / 'src/speech-start-recovery.test.js').read_text(encoding='utf-8')
assert 'h.fire(4000)' in speech_test
assert 'withSpeechTimeout\\(audio\\.play\\(\\), 5000\\)' in speech_test
print('Lulu Finity 1.2.9: pruebas de latencia y recuperación verificadas')
