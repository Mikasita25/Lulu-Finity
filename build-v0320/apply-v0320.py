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

# Distribución propietaria: el relay ya normaliza los mensajes y únicamente
# necesita nombres de eventos. Definirlos localmente evita enlazar la app de
# escritorio con tiktok-live-connector/AGPL sin cambiar el protocolo Railway.
m=main.read_text(encoding='utf-8')
local_events="""const connectorModule = Object.freeze({
  WebcastEvent: Object.freeze({
    CHAT: 'chat',
    GIFT: 'gift',
    LIKE: 'like',
    MEMBER: 'member',
    ROOM_USER: 'roomUser',
    SUB_NOTIFY: 'subscribe',
    EMOTE: 'emote',
    STREAM_END: 'streamEnd',
    FOLLOW: 'follow',
    SHARE: 'share'
  }),
  ControlEvent: Object.freeze({
    CONNECTED: 'connected',
    WEBSOCKET_CONNECTED: 'websocketConnected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
  })
});"""
m=rep(m,"let connectorModule = null;",local_events,'local relay events')
legacy_import="""  try {
    if (!connectorModule) connectorModule = await import('tiktok-live-connector');
  } catch (error) {
    const message = `No se pudo cargar el conector de TikTok: ${error?.message || error}`;
    send('live:status', { status: 'error', username, message });
    throw new Error(message);
  }

"""
m=rep(m,legacy_import,"",'remove AGPL connector import')
main.write_text(m,encoding='utf-8')

p=json.loads(pkg.read_text(encoding='utf-8'))
p['private']=True
p['license']='UNLICENSED'
p.setdefault('dependencies',{}).pop('tiktok-live-connector',None)
pkg.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

assert 'tiktok-live-connector' not in m
assert "CHAT: 'chat'" in m and "GIFT: 'gift'" in m and "ERROR: 'error'" in m
assert p.get('private') is True and p.get('license') == 'UNLICENSED'
assert 'tiktok-live-connector' not in p.get('dependencies',{})
print('patched 0.32.0 proprietary distribution')
