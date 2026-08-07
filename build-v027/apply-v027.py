from pathlib import Path
import base64, gzip
parts = [Path(__file__).with_name('part-00.txt').read_text().strip(), Path(__file__).with_name('part-01.txt').read_text().strip()]
code = gzip.decompress(base64.b64decode(''.join(parts))).decode('utf-8')
exec(compile(code, 'apply-v027-embedded.py', 'exec'))
