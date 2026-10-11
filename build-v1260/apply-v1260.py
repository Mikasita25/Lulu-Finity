from pathlib import Path
import sys,json,gzip
root=Path(sys.argv[1]).resolve(); files=Path(__file__).parent/'files/src'
def edit(name,old,new):
 p=root/name;s=p.read_text(encoding='utf-8');assert old in s,(name,old[:90]);p.write_text(s.replace(old,new,1),encoding='utf-8')
for n in ['widget-activity.js','widget-activity.test.js','roulette-performance.test.js']: (root/'src'/n).write_bytes((files/n).read_bytes())
for n in ['package.json','package-lock.json']:
 p=root/n;d=json.loads(p.read_text(encoding='utf-8'));assert d['version']=='1.2.5';d['version']='1.2.6'
 if n=='package-lock.json':d['packages']['']['version']='1.2.6'
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
edit('src/index.html','v1.2.5','v1.2.6')
edit('src/main.js',"const STREAM_WIDGET_TYPES =", "const WidgetActivity = require('./widget-activity');\nconst rankingActivity = new Map();\nconst STREAM_WIDGET_TYPES =")
edit('src/main.js','const state = { ...payload, type: normalized, id: String(payload?.id || randomUUID()), updatedAt: Date.now() };',"const raw = { ...payload, type: normalized, id: String(payload?.id || randomUUID()), updatedAt: Date.now() };\n  const config = normalizeStreamWidgetStyles(runtimeResourceSettings?.streamWidgetStyles)[normalized];\n  const state = WidgetActivity.stamp(raw,streamWidgetStates.get(normalized),config);")
edit('src/main.js','if (!preview && current) return current;',"if (!preview && current) { const options=WidgetActivity.normalize(normalizeStreamWidgetStyles(runtimeResourceSettings?.streamWidgetStyles)[normalized]);return {...current,autoHide:options.autoHide,activityExpiresAt:current.animationDurationMs?current.expiresAt:current.activityAt+options.displaySeconds*1000}; }")
edit('src/main.js','uppercaseNames: source.uppercaseNames === true','uppercaseNames: source.uppercaseNames === true,\n    ...WidgetActivity.normalize(source)')
edit('src/main.js',"return { type: 'ranking', slot: normalizedSlot, config, entries };", "const raw={type:'ranking',slot:normalizedSlot,config,entries};\n  if(preview)return raw;\n  const next=WidgetActivity.stamp(raw,rankingActivity.get(normalizedSlot),config);rankingActivity.set(normalizedSlot,next);return next;")
edit('src/main.js',"const slot = normalizeRankingSlot(details?.slot); await broadcastRankingSlot(slot);", "const slot = normalizeRankingSlot(details?.slot); rankingActivity.delete(slot); await broadcastRankingSlot(slot);")
# shared style settings are independent of whether custom design is enabled
for filename in ['src/widget-design.js','railway-relay/src/widget-design.js']:
 edit(filename,"return { fontFamily:","return { autoHide:source.autoHide!==false,displaySeconds:number(source.displaySeconds,1,300,10),fontFamily:")
# local and hosted widget pages share the expiry policy; polling cannot reactivate an expired snapshot
for filename in ['src/main.js','railway-relay/src/overlay-page.js']:
 p=root/filename;s=p.read_text(encoding='utf-8');s=s.replace("'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'public, max-age=3600'","'Content-Type':'text/html; charset=utf-8', 'Content-Encoding':'gzip', 'Cache-Control':'public, max-age=3600'");s=s.replace('Number(data.expiresAt||0)','Number(data.activityExpiresAt??data.expiresAt??0)')
 s=s.replace('&&expiresAt>Date.now()','&&(data.autoHide===false||expiresAt>Date.now())')
 s=s.replace('if(expiresAt>Date.now())hideTimer=', 'if(data.autoHide!==false&&expiresAt>Date.now())hideTimer=');s=s.replace('function armActivityExpiry(data){if(preview)return;', 'function armActivityExpiry(data){clearTimeout(hideTimer);if(preview)return;').replace('const armActivityExpiry=(data)=>{', 'const armActivityExpiry=(data)=>{clearTimeout(hideTimer);')
 if filename=='src/main.js':
  s=s.replace("else renderPlaylist(data)}", "else renderPlaylist(data);if(!preview&&data.autoHide===true&&!(data.game==='roulette'&&Number.isInteger(data.rouletteIndex))){const end=Number(data.activityExpiresAt??data.expiresAt??0);if(end<=Date.now()){hideAll();return}armActivityExpiry(data)}}")
  s=s.replace("board.className='style-'", "clearTimeout(rankingHideTimer);board.hidden=false;if(!preview&&data.autoHide!==false){const end=Number(data.activityExpiresAt||0);if(end<=Date.now()){board.hidden=true;return}rankingHideTimer=setTimeout(()=>{board.hidden=true},end-Date.now())}\n    board.className='style-'")
  s=s.replace('let renderedOnce=false;', 'let renderedOnce=false,rankingHideTimer=0;')
  s=s.replace('<section id="board">','<section id="board" hidden>')
  s=s.replace('*{box-sizing:border-box}html,body','[hidden]{display:none!important}*{box-sizing:border-box}html,body',1)
 else:
  s=s.replace('else renderPlaylist(data)}', "else renderPlaylist(data);if(boot.kind!=='screen'&&data.autoHide===true&&!(data.game==='roulette'&&Number.isInteger(data.rouletteIndex))){const end=Number(data.activityExpiresAt??data.expiresAt??0);if(end<=Date.now()){hideRoot();return}armActivityExpiry(data)}}")
 p.write_text(s,encoding='utf-8')
# settings + recall button on every widget
edit('src/renderer.js', '${widgetStudioFields(type)}', '<div class="widget-style-range-grid"><label><span>Ocultar hasta la siguiente activación</span><input type="checkbox" data-widget-style-field="autoHide"></label><label><span>Segundos visible</span><input type="number" min="1" max="300" data-widget-style-field="displaySeconds"></label><button type="button" class="ghost tiny" data-widget-recall>Mostrar ahora</button></div>${widgetStudioFields(type)}')
edit('src/renderer.js', 'input.value = String(style[input.dataset.widgetStyleField]);', "if(input.type==='checkbox')input.checked=style[input.dataset.widgetStyleField]!==false;else input.value = String(style[input.dataset.widgetStyleField]);")
edit('src/renderer.js', "const numeric = input.type === 'range';", "const numeric = input.type === 'range'||input.type === 'number';")
edit('src/renderer.js', '[field]:numeric ? Number(input.value) : input.value', "[field]:input.type==='checkbox'?input.checked:(numeric ? Number(input.value) : input.value)")
edit('src/renderer.js', "if (event.target.closest('[data-widget-style-reset]'))", "if(event.target.closest('[data-widget-recall]')){const type=editor.dataset.widgetStyleEditor;void api.getStreamWidgetInfo(type).then(info=>{const data={...info.snapshot,visible:true,recall:String(Date.now())};if(data.game==='roulette'){data.id='preview-'+Date.now();data.animationStartedAt=Date.now()+1200;data.expiresAt=data.animationStartedAt+14110+Number(data.resultSeconds||3)*1000;}return api.updateStreamWidget(type,data);}).catch(error=>toast('No se pudo mostrar',error.message,'error'));}\n      if (event.target.closest('[data-widget-style-reset]'))")
# rankings use their existing refresh button to recall
edit('src/index.html','<input id="rankingTitleInput"', '<label><input id="rankingAutoHideInput" type="checkbox"/> Ocultar hasta la siguiente activación</label><label>Segundos visible <input id="rankingDisplaySecondsInput" type="number" min="1" max="300" value="10"/></label><input id="rankingTitleInput"')
edit('src/renderer.js',"$('rankingTypeInput').value=c.type;", "$('rankingAutoHideInput').checked=c.autoHide!==false;$('rankingDisplaySecondsInput').value=String(c.displaySeconds||10);$('rankingTypeInput').value=c.type;")
edit('src/renderer.js',"{...previous,type:$('rankingTypeInput').value", "{...previous,autoHide:$('rankingAutoHideInput').checked,displaySeconds:clamp($('rankingDisplaySecondsInput').value,1,300),type:$('rankingTypeInput').value")
edit('src/renderer.js',"['rankingTitleInput','rankingBackgroundOpacityInput']", "['rankingTitleInput','rankingBackgroundOpacityInput','rankingAutoHideInput','rankingDisplaySecondsInput']")
# serve compressed immutable roulette bytes, not sync decompression on the LIVE event thread
edit('src/main.js', "response.end(require('zlib').gunzipSync(fs.readFileSync(path.join(__dirname,'roulette.html.gz'))));", "rouletteAssetCache ||= fs.readFileSync(path.join(__dirname,'roulette.html.gz'));response.end(rouletteAssetCache);")
edit('src/main.js','const rankingActivity = new Map();','let rouletteAssetCache;\nconst rankingActivity = new Map();')
# optimize original engine without changing a single texture or movement sample
p=root/'src/roulette.html.gz';html=gzip.decompress(p.read_bytes()).decode()
old="const ready=Promise.all(Object.entries(ASSETS).map(async([key,src])=>{const image=new Image();image.src=src;await image.decode();layers[key]=image;}));"
new="""const pendingLayers=new Map();
async function loadLayer(key){if(layers[key])return;if(pendingLayers.has(key))return pendingLayers.get(key);const promise=(async()=>{const image=new Image();image.src=ASSETS[key];await image.decode();layers[key]=typeof createImageBitmap==='function'?await createImageBitmap(image).catch(()=>image):image;})();pendingLayers.set(key,promise);try{await promise;}finally{pendingLayers.delete(key)}}
const ready=(async()=>{for(const key of Object.keys(ASSETS).filter(key=>!key.startsWith('winner_'))){await loadLayer(key);await new Promise(resolve=>setTimeout(resolve,0));}})();
async function prepareWinner(color){await ready;for(let j=0;j<3;j++)await loadLayer('winner_'+color+'_'+j);for(const key of Object.keys(layers)){if(key.startsWith('winner_')&&!key.startsWith('winner_'+color+'_')){layers[key].close?.();delete layers[key]}}}"
""".rstrip('"\n')
assert old in html;html=html.replace(old,new)
html=html.replace('try{await ready;}catch{return;}','try{await prepareWinner(data.rouletteIndex);}catch{return;}')
html=html.replace('let audioStarted=false;','let audioStarted=false,lastFrame=-1;')
html=html.replace('if(t<DURATION){if(!audioStarted',"if(t<DURATION){const frame=Math.floor(t*60);if(frame===lastFrame){requestAnimationFrame(tick);return}lastFrame=frame;if(!audioStarted")
html=html.replace('else{context.clearRect(0,0,S,S);audio.pause();label.hidden=false;', 'else{if(!label.hidden){requestAnimationFrame(tick);return}context.clearRect(0,0,S,S);audio.pause();label.hidden=false;')
p.write_bytes(gzip.compress(html.encode(),mtime=0));(root/'railway-relay/src/roulette.html.gz').write_bytes(p.read_bytes())
print('1.2.6: widget activity and roulette optimization applied')

# Cache bust old roulette sources so the optimization is picked up immediately.
for name in ['src/main.js','railway-relay/src/overlay-page.js','src/roulette-overlay-bridge.js']:
 p=root/name;s=p.read_text(encoding='utf-8').replace('/roulette.html?', '/roulette.html?v=126&').replace("'/roulette.html'", "'/roulette.html?v=126'").replace("url.pathname === '/roulette.html?v=126'","url.pathname === '/roulette.html'");p.write_text(s,encoding='utf-8')

edit('src/renderer.js','visible:Boolean(state.giftStats?.lastGift)&&giftExpiresAt>Date.now()','visible:Boolean(state.giftStats?.lastGift)')

edit('src/renderer.js','uppercaseNames:item.uppercaseNames===true','uppercaseNames:item.uppercaseNames===true,autoHide:item.autoHide!==false,displaySeconds:clamp(item.displaySeconds||10,1,300)')
