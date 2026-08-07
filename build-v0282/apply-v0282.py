from pathlib import Path
import json, re, sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else 'app'); rp=ROOT/'src/renderer.js'; hp=ROOT/'src/index.html'; mp=ROOT/'src/main.js'; pp=ROOT/'src/preload.js'; pkgp=ROOT/'package.json'; cp=ROOT/'CHANGELOG.md'
r=rp.read_text(encoding='utf-8'); h=hp.read_text(encoding='utf-8'); m=mp.read_text(encoding='utf-8'); p=pp.read_text(encoding='utf-8')
activity=r'''function setEqualizer(id, active) { $(id)?.classList.toggle('active', Boolean(active)); }
function renderAudioActivityIndicators() {
  if (!state.settings) return;
  const ttsPlaying=Boolean(state.speaking || (state.audioBusy && state.activeAudioJob?.kind === 'speech'));
  const provider=state.settings.musicProvider === 'spotify' ? 'spotify' : 'youtube';
  const currentMusic=provider === 'spotify' ? state.currentSpotify : state.currentSong;
  const player=provider === 'spotify' ? state.spotifyPlayer : state.player;
  const musicPlaying=Boolean(currentMusic && player && !player.paused), soundPlaying=Boolean(state.audioBusy && state.activeAudioJob?.kind === 'sound');
  setEqualizer('voiceActivityBars',ttsPlaying); if($('voiceActivityText')) $('voiceActivityText').textContent=ttsPlaying?'Reproduciendo':'Silencio';
  setEqualizer('musicActivityBars',musicPlaying); if($('musicActivityText')) $('musicActivityText').textContent=musicPlaying?'Reproduciendo':'Silencio';
  setEqualizer('commandActivityBars',soundPlaying); if($('commandActivityText')) $('commandActivityText').textContent=soundPlaying?'Reproduciendo':'Silencio';
}
function setupAudioActivityIndicators() { if(state.audioActivityTimer) clearInterval(state.audioActivityTimer); state.audioActivityTimer=setInterval(renderAudioActivityIndicators,250); renderAudioActivityIndicators(); }

'''
if 'function setupAudioActivityIndicators()' not in r:
    marker='function selectCategoryTab(scope, key, scroll = true) {'
    if marker not in r: raise RuntimeError('Falta punto para indicadores.')
    r=r.replace(marker,activity+marker,1)
# Controles eliminados en 0.28: proteger tanto listener como accesos dentro del callback.
r=r.replace("const addSpotify=()=>{const input=$('spotifyQueryInput');if(enqueueSpotify(input.value,'Manual'))input.value='';};","const addSpotify=()=>{const input=$('spotifyQueryInput');if(!input)return;if(enqueueSpotify(input.value,'Manual'))input.value='';};")
r=r.replace("$('spotifyVolumeInput')?.addEventListener('input',()=>{state.settings.spotifyVolume=clamp($('spotifyVolumeInput').value,0,1);syncOutputs();scheduleSave();api.setSpotifyVolume(state.settings.spotifyVolume).catch(()=>{});});","$('spotifyVolumeInput')?.addEventListener('input',()=>{const input=$('spotifyVolumeInput');if(!input)return;state.settings.spotifyVolume=clamp(input.value,0,1);syncOutputs();scheduleSave();api.setSpotifyVolume(state.settings.spotifyVolume).catch(()=>{});});")
r=r.replace("$('spotifyRecommendedInput')?.addEventListener('change',()=>{state.settings.spotifyContinueRecommended=$('spotifyRecommendedInput').checked;scheduleSave();});","$('spotifyRecommendedInput')?.addEventListener('change',()=>{const input=$('spotifyRecommendedInput');if(!input)return;state.settings.spotifyContinueRecommended=input.checked;scheduleSave();});")
old='<button class="ghost" id="openRepositoryBtn">Repositorio</button><button class="secondary" id="checkUpdatesBtn">Buscar actualización</button><button class="primary hidden" id="installUpdateBtn">Instalar y reiniciar</button>'
new='<button class="ghost" id="openRepositoryBtn">Repositorio</button><button class="ghost" id="rollbackVersionBtn">Regresar a 0.27</button><button class="secondary" id="checkUpdatesBtn">Buscar actualización</button><button class="primary hidden" id="installUpdateBtn">Instalar y reiniciar</button><p class="hint rollback-hint">¿Encontraste un bug molesto? Puedes regresar a la versión 0.27 hasta que la creadora lo solucione (:</p>'
if old not in h: raise RuntimeError('Falta bloque de actualización.')
h=h.replace(old,new,1).replace('v0.28.1','v0.28.2')
repo="ipcMain.handle('update:open-repository', async () => {"
if 'update:rollback-v027' not in m:
    handler="ipcMain.handle('update:rollback-v027', async () => {\n  const url='https://github.com/Mikasita25/Lulu-Finity/releases/download/v0.27.0/Lulu-Finity-Setup-0.27.0.exe';\n  await shell.openExternal(url); return {ok:true,version:'0.27.0',url};\n});\n"
    if repo not in m: raise RuntimeError('Falta IPC updates.')
    m=m.replace(repo,handler+repo,1)
if 'rollbackToV027' not in p:
    token="  installUpdate: () => ipcRenderer.invoke('update:install'),\n"; p=p.replace(token,token+"  rollbackToV027: () => ipcRenderer.invoke('update:rollback-v027'),\n",1)
if 'rollbackVersionBtn' not in r:
    token="  $('installUpdateBtn').addEventListener('click', () => api.installUpdate());\n"
    listener="  $('rollbackVersionBtn')?.addEventListener('click', async () => { if(!window.confirm('¿Regresar a Lulu Finity 0.27.0? Se abrirá el instalador oficial de esa versión.'))return; try{await api.rollbackToV027();toast('Regresar a 0.27','Se abrió la descarga oficial. Cierra Lulu e instala 0.27.0.','info');}catch(error){toast('No se pudo abrir 0.27',error.message||String(error),'error');} });\n"
    r=r.replace(token,token+listener,1)
pkg=json.loads(pkgp.read_text(encoding='utf-8')); pkg['version']='0.28.2'; pkgp.write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
# Validación de IDs: ignorar usos que están dentro de callbacks protegidos; exigir que los tres problemáticos ya tengan guardas.
for t in ("if(!input)return","function setupAudioActivityIndicators()","rollbackVersionBtn"):
    if t not in r+h: raise RuntimeError('Falta '+t)
rp.write_text(r,encoding='utf-8',newline='\n'); hp.write_text(h,encoding='utf-8',newline='\n'); mp.write_text(m,encoding='utf-8',newline='\n'); pp.write_text(p,encoding='utf-8',newline='\n')
if cp.exists():
    c=cp.read_text(encoding='utf-8')
    if '## 0.28.2' not in c: c='# Cambios\n\n## 0.28.2\n\n- Corrige el error al iniciar restante de 0.28.1.\n- Protege controles de Spotify eliminados de la interfaz 0.28.\n- Añade **Regresar a 0.27** con acceso al instalador oficial 0.27.0.\n\n'+c
    cp.write_text(c,encoding='utf-8',newline='\n')
print('Lulu Finity 0.28.2 preparada.')