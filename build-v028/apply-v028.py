from pathlib import Path
import base64,gzip,sys
parts=sorted(Path(__file__).parent.glob('part-*.txt'))
code=gzip.decompress(base64.b64decode(''.join(p.read_text(encoding='utf-8').strip() for p in parts))).decode('utf-8')
exec(compile(code,'apply-v028-embedded.py','exec'))
