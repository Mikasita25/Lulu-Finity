from pathlib import Path
import sys,json,gzip,re
from html.parser import HTMLParser
root=Path(sys.argv[1] if len(sys.argv)>1 else 'app')
assert json.loads((root/'package.json').read_text())['version']=='1.2.4'
class IDs(HTMLParser):
 def __init__(self):super().__init__();self.ids=[]
 def handle_starttag(self,tag,attrs):
  for name,value in attrs:
   if name=='id':self.ids.append(value)
html=IDs();html.feed((root/'src/index.html').read_text());assert len(html.ids)==len(set(html.ids))
animation=gzip.decompress((root/'src/roulette.html.gz').read_bytes()).decode()
assert 'const S=960,CX=465,CY=471,DURATION=14.109635' in animation
assert 'requestAnimationFrame(tick)' in animation and "event.source!==parent" in animation
assert '<aside' not in animation and 'draw(9.5)' not in animation
assert animation==gzip.decompress((root/'railway-relay/src/roulette.html.gz').read_bytes()).decode()
print('1.2.4: version, IDs, original animation, idle transparency and relay assets validated.')
