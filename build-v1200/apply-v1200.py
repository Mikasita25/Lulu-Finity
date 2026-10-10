from pathlib import Path
import json, shutil, sys
root=Path(sys.argv[1] if len(sys.argv)>1 else 'app').resolve()
here=Path(__file__).resolve().parent
package=json.loads((root/'package.json').read_text(encoding='utf-8-sig'))
if package['version'] not in ['1.1.8','1.2.0']:
    raise SystemExit('Se requiere la fuente oficial 1.1.8')
for source in sorted((here/'files').rglob('*')):
    if source.is_file():
        target=root/source.relative_to(here/'files'); target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
package['version']='1.2.0';package['description']='Lulu Finity: estudio de widgets, música, voces y control del LIVE'
(root/'package.json').write_text(json.dumps(package,indent=2)+'\n')
lock=json.loads((root/'package-lock.json').read_text(encoding='utf-8-sig'));lock['version']='1.2.0';lock.get('packages',{}).get('',{})['version']='1.2.0'
(root/'package-lock.json').write_text(json.dumps(lock,indent=2)+'\n')
print('Lulu Finity Studio 1.2.0 preparada')
