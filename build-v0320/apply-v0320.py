from pathlib import Path
import json, sys

root=Path(sys.argv[1])
main=root/'src/main.js'; rend=root/'src/renderer.js'; html=root/'src/index.html'; css=root/'src/styles.css'; pre=root/'src/preload.js'; pkg=root/'package.json'; ch=root/'CHANGELOG.md'
m=main.read_text(encoding='utf-8'); r=rend.read_text(encoding='utf-8'); h=html.read_text(encoding='utf-8'); s=css.read_text(encoding='utf-8'); pr=pre.read_text(encoding='utf-8'); p=json.loads(pkg.read_text(encoding='utf-8')); c=ch.read_text(encoding='utf-8')

def rep(text,a,b,label):
    if a not in text: raise SystemExit(f'missing anchor {label}')
    return text.replace(a,b,1)

parts=Path(__file__).parent
for name in ('apply-part1.py','apply-part2.py','apply-part3.py','apply-part4.py'):
    exec((parts/name).read_text(encoding='utf-8'), globals())
