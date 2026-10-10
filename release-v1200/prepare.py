import base64
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

root = Path('tested-build')
out = Path('release-assets')
out.mkdir(exist_ok=True)
installer = root / 'app/dist/Lulu-Finity-Setup-1.2.0.exe'
expected = 'eb84a15058c846e8b0205d8d2b2aefa41705723f6a1ce1cac3aa9c4dd4cd1676'
assert hashlib.file_digest(installer.open('rb'), 'sha256').hexdigest() == expected
navigation = json.loads((root / 'navigation-validation.json').read_text())
assert navigation['ok'] and len(navigation['results']) == 13
assert navigation['widgetEditors']['count'] == 6
source = root / 'Lulu-Finity-Source-1.2.0.zip'
with zipfile.ZipFile(source) as z:
    assert json.loads(z.read('package.json'))['version'] == '1.2.0'
    main = z.read('src/main.js').decode('utf-8')
    assert "const EMBEDDED_RELAY_CLIENT_TOKEN = '';" in main
    assert "const EMBEDDED_RELAY_URL = 'wss://lulu-finity-production-6b8f.up.railway.app/v1/tiktok/live';" in main
for path in (installer, root / 'app/dist/Lulu-Finity-1.2.0-x64.zip', source):
    shutil.copy2(path, out / path.name)
digest = base64.b64encode(hashlib.file_digest(installer.open('rb'), 'sha512').digest()).decode()
latest = {
    'version': '1.2.0',
    'files': [{'url': installer.name, 'sha512': digest, 'size': installer.stat().st_size}],
    'path': installer.name,
    'sha512': digest,
    'releaseDate': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'),
}
# JSON is valid YAML and preserves the exact updater field values.
(out / 'latest.yml').write_text(json.dumps(latest, indent=2) + '\n')
(out / 'SHA256SUMS.txt').write_text(''.join(
    hashlib.file_digest(p.open('rb'), 'sha256').hexdigest() + '  ' + p.name + '\n'
    for p in sorted(out.iterdir()) if p.is_file() and p.name != 'SHA256SUMS.txt'
))
print('Original tested installer verified; update metadata prepared.')
