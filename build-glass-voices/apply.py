#!/usr/bin/env python3
"""Apply the Glass/voice changes to the exact Lulu Finity 1.3.3 source."""
from pathlib import Path
import hashlib
import subprocess
import sys

EXPECTED = {
    'main.js': '43bd8e67c5afdf759710897bdb431a7e632f91e88234a225f2fb746699cec14c',
    'renderer.js': 'a368df70408c29e2973226f9dd3f3258339571393922b9303b15a917b97245a9',
    'online-voice-catalog.js': '7bcf81b28ba6a30c6f4c35880b15c7e623ffd9992a797847c110891394e65deb',
    'online-voice-catalog.test.js': '5b14772f439f5d04cc165409dbf226efe91bf0cc6c8a109570f15ce1b01b052e',
    'index.html': '459d3eacb72f2bef9ca0448eb11e607bbf4db86e5ce5d99bd8910bcb2241ff96',
}
root = Path(sys.argv[1] if len(sys.argv) > 1 else 'app').resolve()
patch = Path(__file__).resolve().with_name('changes.patch')
normalized = {}
for name, expected in EXPECTED.items():
    path = root / 'src' / name
    data = path.read_bytes().replace(b'\r\n', b'\n')
    if hashlib.sha256(data).hexdigest() != expected:
        raise SystemExit(f'{name}: fuente diferente de 1.3.3; no se aplicó el parche')
    normalized[path] = data
if (root / 'src' / 'glass.css').exists():
    raise SystemExit('glass.css ya existe; no se aplicó el parche')
for path, data in normalized.items():
    path.write_bytes(data)
subprocess.run(['git', 'apply', '--check', str(patch)], cwd=root, check=True)
subprocess.run(['git', 'apply', str(patch)], cwd=root, check=True)
print('Cambios de Glass y voces aplicados a Lulu Finity 1.3.3.')
