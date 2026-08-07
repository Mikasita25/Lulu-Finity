from pathlib import Path
import base64,gzip,sys
code=gzip.decompress(base64.b64decode(Path(__file__).with_name('part-00.txt').read_text(encoding='utf-8').strip())).decode('utf-8')
exec(compile(code,'apply-v028-embedded.py','exec'))
