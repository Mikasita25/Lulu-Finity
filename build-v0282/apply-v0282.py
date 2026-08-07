from pathlib import Path
import json, re, sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else 'app')
rp=ROOT/'src/renderer.js'; hp=ROOT/'src/index.html'; mp=ROOT/'src/main.js'; pp=ROOT/'src/preload.js'; pkgp=ROOT/'package.json'; cp=ROOT/'CHANGELOG.md'
r=rp.read_text(encoding='utf-8'); h=hp.read_text(encoding='utf-8'); m=mp.read_text(encoding='utf-8'); p=pp.read_text(encoding='utf-8')

# 0.28.1 todavía llamaba esta función durante init(), pero 0.28 había eliminado su definición.
activity=r'''function setEqualizer(id, active) {
  $(id)?.classList.toggle('active', Boolean(active));
}
function renderAudioActivityIndicators() {
  if (!state.settings) return;
  const ttsPlaying=Boolean(state.speaking || (state.audioBusy && state.activeAudioJob?.kind === 'speech'));
  const provider=state.settings.musicProvider === 'spotify' ? 'spotify' : 'youtube';
  const currentMusic=provider === 'spotify' ? state.currentSpotify : state.currentSong;
  const player=provider === 'spotify' ? state.spotifyPlayer : state.player;
  const musicPlaying=Boolean(currentMusic && player && !player.paused);
  const soundPlaying=Boolean(state.audioBusy && state.activeAudioJob?.kind === 'sound');
  setEqualizer('voiceActivityBars',ttsPlaying); if($('voiceActivityText')) $('voiceActivityText').textContent=ttsPlaying?'Reproduciendo':'Silencio';
  setEqualizer('musicActivityBars',musicPlaying); if($('musicActivityText')) $('musicActivityText').textContent=musicPlaying?'Reproduciendo':'Silencio';
  setEqualizer('commandActivityBars',soundPlaying); if($('commandActivityText')) $('commandActivityText').textContent=soundPlaying?'Reproduciendo':'Silencio';
}
function setupAudioActivityIndicators() {
  if(state.audioActivityTimer) clearInterval(state.audioActivityTimer);
  state.audioActivityTimer=setInterval(renderAudioActivityIndicators,250);
  renderAudioActivityIndicators();
}

'''
if 'function setupAudioActivityIndicators()' not in r:
    marker='function selectCategoryTab(scope, key, scroll = true) {'
    if marker not in r: raise RuntimeError('Falta punto para restaurar indicadores.')
    r=r.replace(marker,activity+marker,1)

# 0.28 también eliminó controles Spotify del HTML; 0.28.1 restauró listeners antiguos sin protección.
for ident in ('spotifyQueryInput','spotifyVolumeInput','spotifyRecommendedInput'):
    r=r.replace(f"$('{ident}').addEventListener",f"$('{ident}')?.addEventListener")

# Botón de emergencia para volver a la versión estable solicitada: 0.27.0.
old='<button class="ghost" id="openRepositoryBtn">Repositorio</button><button class="secondary" id="checkUpdatesBtn">Buscar actualización</button><button class="primary hidden" id="installUpdateBtn">Instalar y reiniciar</button>'
new='<button class="ghost" id="openRepositoryBtn">Repositorio</button><button class="ghost" id="rollbackVersionBtn">Regresar a 0.27</button><button class="secondary" id="checkUpdatesBtn">Buscar actualización</button><button class="primary hidden" id="installUpdateBtn">Instalar y reiniciar</button><p class="hint rollback-hint">¿Encontraste un bug molesto? Puedes regresar a la versión 0.27 hasta que la creadora lo solucione (:</p>'
if old not in h: raise RuntimeError('Falta bloque de actualización.')
h=h.replace(old,new,1).replace('v0.28.1','v0.28.2')

repo="ipcMain.handle('update:open-repository', async () => {"
if 'update:rollback-v027' not in m:
    handler="ipcMain.handle('update:rollback-v027', async () => {\n  const url = 'https://github.com/Mikasita25/Lulu-Finity/releases/download/v0.27.0/Lulu-Finity-Setup-0.27.0.exe';\n  await shell.openExternal(url);\n  return { ok:true, version:'0.27.0', url };\n});\n"
    if repo not in m: raise RuntimeError('Falta IPC de updates.')
    m=m.replace(repo,handler+repo,1)
if 'rollbackToV027' not in p:
    token="  installUpdate: () => ipcRenderer.invoke('update:install'),\n"
    p=p.replace(token,token+"  rollbackToV027: () => ipcRenderer.invoke('update:rollback-v027'),\n",1)
if 'rollbackVersionBtn' not in r:
    token="  $('installUpdateBtn').addEventListener('click', () => api.installUpdate());\n"
    listener="  $('rollbackVersionBtn')?.addEventListener('click', async () => {\n    if (!window.confirm('¿Regresar a Lulu Finity 0.27.0? Se abrirá el instalador oficial de esa versión.')) return;\n    try { await api.rollbackToV027(); toast('Regresar a 0.27','Se abrió la descarga oficial. Cierra Lulu e instala 0.27.0.','info'); }\n    catch(error){ toast('No se pudo abrir 0.27',error.message||String(error),'error'); }\n  });\n"
    r=r.replace(token,token+listener,1)

pkg=json.loads(pkgp.read_text(encoding='utf-8')); pkg['version']='0.28.2'; pkgp.write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
rp.write_text(r,encoding='utf-8',newline='\n'); hp.write_text(h,encoding='utf-8',newline='\n'); mp.write_text(m,encoding='utf-8',newline='\n'); pp.write_text(p,encoding='utf-8',newline='\n')

# No publicar si setupEvents toca IDs que ya no existen sin optional chaining.
body=r[r.index('function setupEvents()'):r.index('\nasync function init()')]
ids=set(re.findall(r'id=["\']([^"\']+)',h))
missing=sorted({x.group(1) for x in re.finditer(r"\$\('([^']+)'\)(?!\?)",body)}-ids)
if missing: raise RuntimeError('IDs inexistentes sin protección: '+', '.join(missing))
for token in ('function setupAudioActivityIndicators()','async function connectFromUi()','function setupEvents()','rollbackVersionBtn','rollbackToV027','update:rollback-v027'):
    if token not in r+p+m+h: raise RuntimeError('Falta '+token)

if cp.exists():
    c=cp.read_text(encoding='utf-8')
    if '## 0.28.2' not in c:
        c='# Cambios\n\n## 0.28.2\n\n- Corrige el error al iniciar restante: faltaba `setupAudioActivityIndicators()` y había listeners de Spotify apuntando a controles eliminados.\n- Añade **Regresar a 0.27** en Actualizaciones, con acceso al instalador oficial 0.27.0.\n- Añade validaciones para impedir publicar si `setupEvents()` vuelve a usar controles inexistentes.\n\n'+c
    cp.write_text(c,encoding='utf-8',newline='\n')
print('Lulu Finity 0.28.2: arranque y regreso a 0.27 preparados.')