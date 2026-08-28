from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
MAIN = ROOT / "src" / "main.js"

if not MAIN.is_file():
    raise SystemExit(f"No se encontró {MAIN}")

text = MAIN.read_text(encoding="utf-8")

css_anchor = ".game-meta{display:flex;justify-content:space-between;gap:12px;margin-top:11px;color:rgba(255,255,255,.73);font-size:13px}"
css_extra = css_anchor + ".reward-wheel-stage{position:relative;width:min(330px,82vw);aspect-ratio:1;margin:14px auto 6px;display:none}.reward-wheel-stage.active{display:block}.reward-wheel-pointer{position:absolute;z-index:6;left:50%;top:-4px;transform:translateX(-50%);width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-bottom:27px solid #fff;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))}.reward-wheel-disc{position:absolute;z-index:1;inset:12px;border-radius:50%;box-shadow:0 18px 52px rgba(0,0,0,.38),inset 0 0 0 7px rgba(255,255,255,.12);transition:transform 4s cubic-bezier(.12,.72,.08,1);will-change:transform}.reward-wheel-disc:after{content:'LF';position:absolute;z-index:4;left:50%;top:50%;transform:translate(-50%,-50%);width:68px;height:68px;border-radius:50%;display:grid;place-items:center;background:rgba(12,10,24,.95);border:5px solid rgba(255,255,255,.92);font-size:19px;font-weight:900;box-shadow:0 8px 25px rgba(0,0,0,.42)}.reward-wheel-labels{position:absolute;z-index:3;inset:12px;border-radius:50%;pointer-events:none;transition:transform 4s cubic-bezier(.12,.72,.08,1);will-change:transform}.reward-wheel-label{position:absolute;left:50%;top:50%;width:76px;text-align:center;font-size:10px;line-height:1.05;font-weight:900;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reward-wheel-label.compact{width:52px;font-size:8px}"
if css_anchor not in text:
    raise SystemExit("No se encontró el ancla CSS del widget de juegos")
text = text.replace(css_anchor, css_extra, 1)

html_anchor = '<div class="game-result" id="gameResult">Usa un comando de juego en el chat.</div><div class="game-meta">'
html_replacement = '<div class="reward-wheel-stage" id="rewardWheelStage"><div class="reward-wheel-pointer"></div><div class="reward-wheel-disc" id="rewardWheelDisc"></div><div class="reward-wheel-labels" id="rewardWheelLabels"></div></div><div class="game-result" id="gameResult">Usa un comando de juego en el chat.</div><div class="game-meta">'
if html_anchor not in text:
    raise SystemExit("No se encontró el bloque HTML del widget de juegos")
text = text.replace(html_anchor, html_replacement, 1)

pattern = re.compile(r"  function renderGame\(data\)\{.*?\}\n  function hideAll\(\)", re.S)
match = pattern.search(text)
if not match:
    raise SystemExit("No se encontró renderGame() del widget")

replacement = r'''  let rewardWheelRotation=0;
  function rewardWheelModel(data){const wheel=data?.wheel||{},segments=Array.isArray(wheel.segments)?wheel.segments.slice(0,40):[];if(data?.game!=='reward-wheel'||segments.length<2)return null;const total=segments.reduce((sum,item)=>sum+Math.max(1,Number(item?.weight)||1),0)||1;let cursor=0;const stops=[],ranges=[];segments.forEach((item,index)=>{const weight=Math.max(1,Number(item?.weight)||1),start=cursor/total*360;cursor+=weight;const end=cursor/total*360;const color=/^#[0-9a-f]{6}$/i.test(String(item?.color||''))?String(item.color):['#ff6fae','#8f7cff','#5fd8ff','#ffd166','#7ee2a8','#ff8b6a'][index%6];stops.push(color+' '+start.toFixed(3)+'deg '+end.toFixed(3)+'deg');ranges.push({start,end})});return{segments,ranges,gradient:'conic-gradient('+stops.join(',')+')',selectedIndex:Math.max(0,Math.min(segments.length-1,Number(wheel.selectedIndex)||0)),spinning:Boolean(wheel.spinning)}}
  function renderRewardWheel(data){const stage=document.getElementById('rewardWheelStage'),disc=document.getElementById('rewardWheelDisc'),labels=document.getElementById('rewardWheelLabels'),model=rewardWheelModel(data);if(!stage||!disc||!labels)return;if(!model){stage.classList.remove('active');labels.replaceChildren();return}stage.classList.add('active');disc.style.background=model.gradient;labels.replaceChildren(...model.segments.map((item,index)=>{const range=model.ranges[index]||{start:0,end:0},mid=(range.start+range.end)/2,node=document.createElement('span');node.className='reward-wheel-label'+(model.segments.length>20?' compact':'');node.textContent=text(item.label,'Premio');node.style.transform='translate(-50%,-50%) rotate('+mid+'deg) translateY(-112px) rotate('+-mid+'deg)';return node}));const range=model.ranges[model.selectedIndex]||{start:0,end:0},mid=(range.start+range.end)/2,target=((360-mid)%360+360)%360,current=((rewardWheelRotation%360)+360)%360;let delta=((target-current+360)%360);if(model.spinning)delta+=2160+Math.floor(Math.random()*2)*360;rewardWheelRotation+=delta;const transition=model.spinning?'transform 4s cubic-bezier(.12,.72,.08,1)':'transform .7s cubic-bezier(.2,.8,.2,1)';disc.style.transition=transition;labels.style.transition=transition;requestAnimationFrame(()=>{const transform='rotate('+rewardWheelRotation+'deg)';disc.style.transform=transform;labels.style.transform=transform})}
  function renderGame(data){gameCard.classList.remove('hidden');playlistCard.classList.add('hidden');walletCard.classList.add('hidden');renderRewardWheel(data);document.getElementById('gameTitle').textContent=text(data.title,'Juegos del LIVE');document.getElementById('gameBadge').textContent=data.status==='win'?'GANÓ':data.status==='loss'?'PERDIÓ':data.status==='push'?'EMPATE':data?.wheel?.spinning?'GIRANDO':'JUGANDO';document.getElementById('gamePlayer').textContent=text(data.displayName||data.user,'Esperando jugador');document.getElementById('gameUser').textContent=data.user?'@'+text(data.user):'Comandos activos';const symbol=text(data.currencySymbol,'🌙');document.getElementById('gamePayout').textContent=Number(data.payout||0)>0?symbol+' '+Number(data.payout||0).toLocaleString('es-MX'):symbol+' 0';const result=document.getElementById('gameResult');result.textContent=text(data.detail||data.text,data?.wheel?.spinning?'La ruleta está girando…':'Usa un comando de juego en el chat.');result.className='game-result '+text(data.status,'pending');document.getElementById('gameBet').textContent=Number(data.bet||0)>0?'Costo: '+symbol+' '+Number(data.bet).toLocaleString('es-MX'):'Costo: gratis';document.getElementById('gameStatus').textContent=data?.wheel?.spinning?'Girando':data.status==='win'?'Premio':data.status==='loss'?'Penalización':data.status==='push'?'Sin premio':'En juego'}
  function hideAll()'''
text = text[:match.start()] + replacement + text[match.end():]

MAIN.write_text(text, encoding="utf-8", newline="\n")
print("Ruleta de premios visual integrada en el widget de Juegos")

for patch_name in (
    "widget-customization-patch.py",
    "custom-assets-ui-patch.py",
    "custom-assets-visual-patch.py",
    "custom-assets-relay-patch.py",
):
    patch = Path(__file__).with_name(patch_name)
    subprocess.run([sys.executable, str(patch), str(ROOT)], check=True)
