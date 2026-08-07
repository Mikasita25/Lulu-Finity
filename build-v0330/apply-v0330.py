from pathlib import Path
import base64, gzip, re

parts=sorted(Path(__file__).parent.glob('patch-*.txt'))
payload=''.join(part.read_text(encoding='utf-8').strip() for part in parts)
code=gzip.decompress(base64.b64decode(payload)).decode('utf-8')

# 0.32 procesa los eventos del LIVE con una forma ligeramente distinta a la
# que usó la primera versión del parche. Enganchar la automatización al inicio
# de processLiveEvent evita depender del último renglón de esa función.
pattern=r'live_event_anchor=.*?r=rep\(r,live_event_anchor,.*?[\"\']live automation event[\"\']\)'
replacement='''live_event_anchor="function processLiveEvent(event) {\\n"
r=rep(r,live_event_anchor,"function processLiveEvent(event) {\\n  handleAutomationEvent(event).catch(()=>{});\\n",'live automation event')'''
code, replaced = re.subn(pattern, lambda _match: replacement, code, count=1, flags=re.S)
if replaced != 1:
    raise SystemExit('No se pudo preparar el enlace de Automatizaciones con Eventos.')

exec(compile(code,'apply-v0330-embedded.py','exec'))
