from pathlib import Path
import json, sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'app')
h=(root/'src/index.html').read_text(encoding='utf-8')
r=(root/'src/renderer.js').read_text(encoding='utf-8')
s=(root/'src/styles.css').read_text(encoding='utf-8')
p=json.loads((root/'package.json').read_text(encoding='utf-8'))
assert p['version']=='0.34.0'
for theme in ('studio-lavender','studio-pink','studio-mint'):
    assert theme in h and theme in r and theme in s
for token in ('studioDashboard','studioActivityList','studioGoalRing','studioRankingList','studioConnectBtn'):
    assert token in h and token in r
for token in ('studio-miku-halo','brightness(1.18)','radial-gradient(ellipse at 91% 63%'):
    assert token in s
for name in ('miku-dark-user.png','miku-soft-user.png','miku-classic-user.jpg'):
    path=root/'src'/name
    assert path.is_file() and path.stat().st_size>100_000
print('studio theme checks ok')
