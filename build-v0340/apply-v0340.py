from pathlib import Path
import base64, gzip, json, sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')
parts = Path(__file__).parent
package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
if package.get('version') != '0.33.0':
    raise SystemExit(f"Lulu 0.34.0 espera la fuente 0.33.0, no {package.get('version')}")

payload = ''.join(p.read_text(encoding='utf-8').strip() for p in sorted(parts.glob('payload-*.txt')))
files = json.loads(gzip.decompress(base64.b64decode(payload)).decode('utf-8'))
for relative, content in files.items():
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8', newline='\n')

checks = {
    'src/index.html': ('studioDashboard', 'studio-lavender', 'Studio Lavanda', 'Inicio'),
    'src/renderer.js': ('renderStudioDashboard', 'studioThemeInfo', 'miku-dark-user.png'),
    'src/styles.css': ('Lulu Studio', 'data-theme^="studio-"', 'studio-miku-halo'),
}
for relative, tokens in checks.items():
    text = (root / relative).read_text(encoding='utf-8')
    for token in tokens:
        if token not in text:
            raise SystemExit(f'Falta {token!r} en {relative}')

package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
if package.get('version') != '0.34.0':
    raise SystemExit('La versión final no es 0.34.0')
for name in ('miku-dark-user.png','miku-soft-user.png','miku-classic-user.jpg'):
    if not (root / 'src' / name).is_file():
        raise SystemExit(f'Falta ilustración {name}')
print('Lulu Finity 0.34.0: Lulu Studio aplicado')
