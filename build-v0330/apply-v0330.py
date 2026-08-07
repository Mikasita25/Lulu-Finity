from pathlib import Path
import base64, gzip

parts=sorted(Path(__file__).parent.glob('patch-*.txt'))
payload=''.join(part.read_text(encoding='utf-8').strip() for part in parts)
code=gzip.decompress(base64.b64decode(payload)).decode('utf-8')
exec(compile(code,'apply-v0330-embedded.py','exec'))
