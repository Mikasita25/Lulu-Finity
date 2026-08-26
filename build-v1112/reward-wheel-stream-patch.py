from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
MAIN = ROOT / "src" / "main.js"

if not MAIN.is_file():
    raise SystemExit(f"No se encontró {MAIN}")

text = MAIN.read_text(encoding="utf-8")

css_anchor = ".game-meta{display:flex;justify-content:space-between;gap:12px;margin-top:11px;color:rgba(255,255,255,.73);font-size:13px}"
css_extra = css_anchor + ".reward-wheel-stage{position:relative;width:min(330px,82vw);aspect-ratio:1;margin:14px auto 6px;display:none}.reward-wheel-stage.active{display:block}.reward-wheel-pointer{position:absolute;z-index:4;left:50%;top:-4px;transform:translateX(-50%);width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-bottom:27px solid #fff;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))}.reward-wheel-disc{position:absolute;inset:12px;border-radius:50%;box-shadow:0 18px 52px rgba(0,0,0,.38),inset 0 0 0 7px rgba(255,255,255,.12);transition:transform 4s cubic-bezier(.12,.72,.08,1);will-change:transform}.reward-wheel-disc:after{content:'LF';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:68px;height:68px;border-radius:50%;display:grid;place-items:center;background:rgba(12,10,24,.95);border:5px solid rgba(255,255,255,.92);font-size:19px;font-weight:900;box-shadow:0 8px 25px rgba(0,0,0,.42)}"
if css_anchor not in text:
    raise SystemExit("No se encontró el ancla CSS del widget de juegos")
text = text.replace(css_anchor, css_extra, 1)

html_anchor = '<div class="game-result" id="gameResult">Usa un comando de juego en el chat.</div><div class="game-meta">'
html_replacement = '<div class="reward-wheel-stage" id="rewardWheelStage"><div class="reward-wheel-pointer"></div><div class="reward-wheel-disc" id="rewardWheelDisc"></div></div><div class="game-result" id="gameResult">Usa un comando de juego en el chat.</div><div class="game-meta">'
if html_anchor not in text:
    raise SystemExit("No se encontró el bloque HTML del widget de juegos")
text = text.replace(html_anchor, html_replacement, 1)

pattern = re.compile(r"  function renderGame\(data\)\{.*?\}\n  function hideAll\(\)", re.S)
match = pattern.search(text)
if not match:
    raise SystemExit("No se encontró renderGame() del widget")

replacement = r'''  let rewardWheelRotation=0;
  function rewardWheelModel(data){const wheel=data?.wheel||{},segments=Array.isArray(wheel.segments)?wheel.segments.slice(0,40):[];if(data?.game!=='reward-wheel'||segments.length<2)return null;const total=segments.reduce((sum,item)=>sum+Math.max(1,Number(item?.weight)||1),0)||1;let cursor=0;const stops=[],ranges=[];segments.forEach((item,index)=>{const weight=Math.max(1,Number(item?.weight)||1),start=cursor/total*360;cursor+=weight;const end=cursor/total*360;const color=/^#[0-9a-f]{6}$/i.test(String(item?.color||''))?String(item.color):['#ff6fae','#8f7cff','#5fd8ff','#ffd166','#7ee2a8','#ff8b6a'][index%6];stops.push(color+' '+start.toFixed(3)+'deg '+end.toFixed(3)+'deg');ranges.push({start,end})});return{segments,ranges,gradient:'conic-gradient('+stops.join(',')+')',selectedIndex:Math.max(0,Math.min(segments.length-1,Number(wheel.selectedIndex)||0)),spinning:Boolean(wheel.spinning)}}
  function renderRewardWheel(data){const stage=document.getElementById('rewardWheelStage'),disc=document.getElementById('rewardWheelDisc'),model=rewardWheelModel(data);if(!stage||!disc)return;if(!model){stage.classList.remove('active');return}stage.classList.add('active');disc.style.background=model.gradient;const range=model.ranges[model.selectedIndex]||{start:0,end:0},mid=(range.start+range.end)/2,target=((360-mid)%360+360)%360,current=((rewardWheelRotation%360)+360)%360;let delta=((target-current+360)%360);if(model.spinning)delta+=2160+Math.floor(Math.random()*2)*360;rewardWheelRotation+=delta;disc.style.transition=model.spinning?'transform 4s cubic-bezier(.12,.72,.08,1)':'transform .7s cubic-bezier(.2,.8,.2,1)';requestAnimationFrame(()=>{disc.style.transform='rotate('+rewardWheelRotation+'deg)'})}
  function renderGame(data){gameCard.classList.remove('hidden');playlistCard.classList.add('hidden');walletCard.classList.add('hidden');renderRewardWheel(data);document.getElementById('gameTitle').textContent=text(data.title,'Juegos del LIVE');document.getElementById('gameBadge').textContent=data.status==='win'?'GANÓ':data.status==='loss'?'PERDIÓ':data.status==='push'?'EMPATE':data?.wheel?.spinning?'GIRANDO':'JUGANDO';document.getElementById('gamePlayer').textContent=text(data.displayName||data.user,'Esperando jugador');document.getElementById('gameUser').textContent=data.user?'@'+text(data.user):'Comandos activos';const symbol=text(data.currencySymbol,'🌙');document.getElementById('gamePayout').textContent=Number(data.payout||0)>0?symbol+' '+Number(data.payout||0).toLocaleString('es-MX'):symbol+' 0';const result=document.getElementById('gameResult');result.textContent=text(data.detail||data.text,data?.wheel?.spinning?'La ruleta está girando…':'Usa un comando de juego en el chat.');result.className='game-result '+text(data.status,'pending');document.getElementById('gameBet').textContent=Number(data.bet||0)>0?'Costo: '+symbol+' '+Number(data.bet).toLocaleString('es-MX'):'Costo: gratis';document.getElementById('gameStatus').textContent=data?.wheel?.spinning?'Girando':data.status==='win'?'Premio':data.status==='loss'?'Penalización':data.status==='push'?'Sin premio':'En juego'}
  function hideAll()'''
text = text[:match.start()] + replacement + text[match.end():]

MAIN.write_text(text, encoding="utf-8", newline="\n")
print("Ruleta de premios visual integrada en el widget de Juegos")
