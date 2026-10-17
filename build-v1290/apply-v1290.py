from pathlib import Path
import json
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'app').resolve()

def replace_once(pathname, old, new):
    path = root / pathname
    source = path.read_text(encoding='utf-8')
    matches = source.count(old)
    if matches != 1:
        raise RuntimeError(f'{pathname}: se esperaba un solo anclaje ({matches}): {old[:80]}')
    path.write_text(source.replace(old, new, 1), encoding='utf-8')

for name in ('package.json', 'package-lock.json'):
    path = root / name
    info = json.loads(path.read_text(encoding='utf-8'))
    if info.get('version') != '1.2.8':
        raise RuntimeError(f'{name}: se requiere fuente 1.2.8')
    info['version'] = '1.2.9'
    if name.endswith('package-lock.json'):
        if info['packages'][''].get('version') != '1.2.8':
            raise RuntimeError('package-lock.json no corresponde a 1.2.8')
        info['packages']['']['version'] = '1.2.9'
    path.write_text(json.dumps(info, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

# Reintentar voces que no comienzan; el comentario no debe esperar a otro evento del chat.
replace_once('src/renderer.js',
    '    }, 9000);\n  };\n  speak();\n}\nfunction runSpeechNow(',
    '    }, 4000);\n  };\n  speak();\n}\nfunction runSpeechNow(')

# Fallar rápido cuando un proveedor online no responde, conservando el fallback a Windows.
replace_once('src/renderer.js',
    'function withSpeechTimeout(promise, ms = 25000) {',
    'function withSpeechTimeout(promise, ms = 8000) {')
replace_once('src/renderer.js',
    'await withSpeechTimeout(audio.play(), 12000);',
    'await withSpeechTimeout(audio.play(), 5000);')

replace_once('src/index.html', 'v1.2.8', 'v1.2.9')

# Adaptar las pruebas existentes a los plazos nuevos.
test_path = root / 'src/speech-start-recovery.test.js'
test_content = test_path.read_text(encoding='utf-8')
if test_content.count('h.fire(9000)') != 2:
    raise RuntimeError('No se encontraron los dos casos de recuperación de voz')
test_content = test_content.replace('h.fire(9000)', 'h.fire(4000)')
if test_content.count('withSpeechTimeout\\(audio\\.play\\(\\), 12000\\)') != 1:
    raise RuntimeError('No se encontró la prueba de audio de 12 segundos')
test_content = test_content.replace('withSpeechTimeout\\(audio\\.play\\(\\), 12000\\)', 'withSpeechTimeout\\(audio\\.play\\(\\), 5000\\)')
test_path.write_text(test_content, encoding='utf-8')

print('Lulu Finity 1.2.9: arranque de voz más rápido y límites de espera reducidos')
