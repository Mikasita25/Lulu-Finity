from pathlib import Path
import json
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


def replace_count(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: se esperaban {expected} coincidencias y se encontraron {count}")
    return text.replace(old, new)


package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
if package.get("version") != "1.0.3":
    raise SystemExit(f"Lulu Finity 1.0.4 espera la fuente 1.0.3, no {package.get('version')}")
package["version"] = "1.0.4"
package["description"] = "Lulu Finity 1.0: una sola interfaz con categorías activadas bajo demanda"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = json.loads(lock_path.read_text(encoding="utf-8"))
lock["version"] = "1.0.4"
if isinstance(lock.get("packages", {}).get(""), dict):
    lock["packages"][""]["version"] = "1.0.4"
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

html_path = ROOT / "src/index.html"
html = html_path.read_text(encoding="utf-8")
html = replace_once(html, 'id="versionLabel">v1.0.3', 'id="versionLabel">v1.0.4', "versión de la barra")
html = replace_once(html, 'id="updateVersionBadge">v1.0.3', 'id="updateVersionBadge">v1.0.4', "versión de actualización")
html = replace_once(
    html,
    '</article>\n</div></div>\n\n<section class="page" id="page-commands">',
    '</article>\n</div></div>\n\n</section>\n\n<section class="page" id="page-commands">',
    "cierre de la categoría Cuenta",
)
html_path.write_text(html, encoding="utf-8")

renderer_path = ROOT / "src/renderer.js"
renderer = renderer_path.read_text(encoding="utf-8")
renderer = replace_once(
    renderer,
    """function goToPage(pageName) {
  const visibleNavPage = pageName === 'spotify' ? 'songs' : pageName;
  qsa('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === visibleNavPage));
  qsa('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${pageName}`));
  state.activePage=pageName;void api.setActivePage(pageName);activatePageModules(pageName);scheduleAudioActivityIndicators();
  scheduleRuntimeMonitor(pageName==='settings'&&document.querySelector('[data-category-pane="performance"]')?.classList.contains('active'));
  document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}""",
    """const PAGE_PREVIEW_FRAMES = Object.freeze({
  rankings: ['rankingPreviewFrame','playlistWidgetPreviewFrame','walletWidgetPreviewFrame'],
  automations: ['alertWidgetPreviewFrame','goalWidgetPreviewFrame','giftWidgetPreviewFrame'],
  games: ['gameWidgetPreviewFrame']
});

function topLevelPages() {
  return qsa('.main-content > .page');
}

function suspendPageView(pageName) {
  for (const id of PAGE_PREVIEW_FRAMES[pageName] || []) {
    const frame = $(id);
    if (!frame) continue;
    frame.removeAttribute('src');
    frame.setAttribute('title', frame.getAttribute('title') || 'Vista previa en pausa');
  }
  if (pageName === 'voice' && state.systemVoicesBound) {
    window.speechSynthesis.onvoiceschanged = null;
    state.systemVoicesBound = false;
  }
}

function applyPageVisibility(pageName) {
  const target = $(`page-${pageName}`);
  const pages = topLevelPages();
  if (!target || !pages.includes(target)) {
    console.error(`La categoría ${pageName} no pertenece a la ventana principal.`);
    return false;
  }
  for (const page of pages) {
    const visible = page === target;
    page.classList.toggle('active', visible);
    page.hidden = !visible;
    page.inert = !visible;
    page.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
  document.body.dataset.activePage = pageName;
  return true;
}

function goToPage(pageName, options = {}) {
  const normalizedPage = String(pageName || '').trim();
  if (!applyPageVisibility(normalizedPage)) {
    toast('No se pudo abrir la categoría', 'Lulu evitó mostrar una pantalla incompleta.', 'error');
    return false;
  }
  const previousPage = state.activePage;
  if (previousPage && previousPage !== normalizedPage) suspendPageView(previousPage);
  const visibleNavPage = normalizedPage === 'spotify' ? 'songs' : normalizedPage;
  qsa('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === visibleNavPage));
  state.activePage = normalizedPage;
  if (options.notifyMain !== false) void api.setActivePage(normalizedPage).catch((error) => console.error('No se pudo activar la categoría:', error));
  if (options.activateModules !== false) activatePageModules(normalizedPage);
  scheduleAudioActivityIndicators();
  scheduleRuntimeMonitor(normalizedPage === 'settings' && document.querySelector('[data-category-pane="performance"]')?.classList.contains('active'));
  if (options.scroll !== false) document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  return true;
}""",
    "navegación exclusiva por categoría",
)
renderer = replace_once(
    renderer,
    "function normalizedBalancedKeepActive(value=state.settings?.balancedKeepActive){const source=value&&typeof value==='object'?value:{};return Object.fromEntries(BALANCED_KEEP_ACTIVE_KEYS.map((key)=>[key,source[key]===true]));}\nfunction renderBalancedKeepActiveControls()",
    "function normalizedBalancedKeepActive(value=state.settings?.balancedKeepActive){const source=value&&typeof value==='object'?value:{};return Object.fromEntries(BALANCED_KEEP_ACTIVE_KEYS.map((key)=>[key,source[key]===true]));}\nfunction categoryRunsInBackground(key,page=key){if(state.activePage===page)return true;if(!state.loadedPages.has(page))return false;const profile=state.settings?.performanceProfile||'balanced';return profile==='instant'||(profile==='balanced'&&state.settings?.balancedKeepActive?.[key]===true);}\nfunction renderBalancedKeepActiveControls()",
    "política de categorías en segundo plano",
)
renderer = replace_once(
    renderer,
    "if (!event?.type || !state.settings || !state.loadedPages.has('automations')) return;",
    "if (!event?.type || !state.settings || !categoryRunsInBackground('automations')) return;",
    "automatizaciones bajo demanda",
)
old_activate = "function activatePageModules(page){const first=!state.loadedPages.has(page);state.loadedPages.add(page);if(page==='voice'&&first){loadSystemVoices();if(!state.systemVoicesBound){window.speechSynthesis.onvoiceschanged=loadSystemVoices;state.systemVoicesBound=true;}void loadLocalVoices();void loadOnlineVoices(false);}if(page==='rankings'&&first){void refreshOverlayInfo(state.overlay?.screen||1);state.ranking.slot=clamp(state.ranking?.slot||1,1,4);setRankingControlValues();void refreshRankingInfo(state.ranking.slot,true);}if(page==='automations'&&first){publishAutomationWidgets();for(const type of ['alert','goal','gift'])void refreshStreamWidgetInfo(type,true);}if(page==='economy'&&first){state.economyLoaded=true;void refreshEconomy();}if(page==='settings'&&first)void refreshRelayUsage();if(page==='account'&&first)void api.getTikTokChatStatus().then(renderTikTokChatStatus).catch(()=>{});}"
new_activate = "function activatePageModules(page){const first=!state.loadedPages.has(page);state.loadedPages.add(page);if(page==='voice'){if(first){loadSystemVoices();void loadLocalVoices();void loadOnlineVoices(false);}if(!state.systemVoicesBound){window.speechSynthesis.onvoiceschanged=loadSystemVoices;state.systemVoicesBound=true;}}if(page==='rankings'){if(first){state.ranking.slot=clamp(state.ranking?.slot||1,1,4);setRankingControlValues();}void refreshOverlayInfo(state.overlay?.screen||1);void refreshRankingInfo(state.ranking.slot,true);void refreshStreamWidgetInfo('playlist',true);void refreshStreamWidgetInfo('wallet',true);}if(page==='automations'){publishAutomationWidgets();for(const type of ['alert','goal','gift'])void refreshStreamWidgetInfo(type,true);}if(page==='games')void refreshStreamWidgetInfo('game',true);if(page==='economy'){state.economyLoaded=true;void refreshEconomy();}if(page==='settings'&&first)void refreshRelayUsage();if(page==='account')void api.getTikTokChatStatus().then(renderTikTokChatStatus).catch(()=>{});}"
renderer = replace_once(renderer, old_activate, new_activate, "activación visible de módulos")
renderer = replace_once(
    renderer,
    "  qsa('[data-category-tabs]').forEach((group) => group.querySelectorAll('[data-category-tab]').forEach((button) => button.addEventListener('click', () => selectCategoryTab(group.dataset.categoryTabs, button.dataset.categoryTab))));\n\n}",
    "  qsa('[data-category-tabs]').forEach((group) => group.querySelectorAll('[data-category-tab]').forEach((button) => button.addEventListener('click', () => selectCategoryTab(group.dataset.categoryTabs, button.dataset.categoryTab))));\n  applyPageVisibility(state.activePage);\n}",
    "estado inicial de páginas",
)
renderer = replace_once(
    renderer,
    "  void api.setActivePage('dashboard');\n  api.reportRendererReady();",
    "  goToPage('dashboard', { activateModules:false, scroll:false });\n  api.reportRendererReady();",
    "Panel inicial por la navegación real",
)
renderer = replace_once(
    renderer,
    "  api.onOverlayStatus((payload) => { if (!payload) return; state.overlay={...state.overlay,...payload}; if (Number(payload.screen)===Number($('overlayScreenInput')?.value||1)) refreshOverlayInfo(payload.screen); });",
    "  api.onOverlayStatus((payload) => { if (!payload) return; state.overlay={...state.overlay,...payload}; if (['rankings','commands'].includes(state.activePage) && Number(payload.screen)===Number($('overlayScreenInput')?.value||1)) refreshOverlayInfo(payload.screen); });",
    "overlay solo en la vista activa",
)
renderer = replace_once(
    renderer,
    "  api.onOverlayTunnelStatus((payload)=>{if(!payload)return;const ready=payload.status==='ready'&&payload.url;if($('overlayHttpsStatus')){$('overlayHttpsStatus').textContent=payload.message||'';$('overlayHttpsStatus').classList.toggle('ready',Boolean(ready));$('overlayHttpsStatus').classList.toggle('error',payload.status==='error');}if($('rankingHttpsStatus')){$('rankingHttpsStatus').textContent=payload.message||'';$('rankingHttpsStatus').classList.toggle('ready',Boolean(ready));$('rankingHttpsStatus').classList.toggle('error',payload.status==='error');}if(ready){refreshOverlayInfo();refreshRankingInfo(null,false);refreshStreamWidgetInfo('playlist',false);refreshStreamWidgetInfo('wallet',false);refreshStreamWidgetInfo('game',false);refreshStreamWidgetInfo('alert',false);refreshStreamWidgetInfo('goal',false);refreshStreamWidgetInfo('gift',false);}});",
    "  api.onOverlayTunnelStatus((payload)=>{if(!payload)return;const ready=payload.status==='ready'&&payload.url;if($('overlayHttpsStatus')){$('overlayHttpsStatus').textContent=payload.message||'';$('overlayHttpsStatus').classList.toggle('ready',Boolean(ready));$('overlayHttpsStatus').classList.toggle('error',payload.status==='error');}if($('rankingHttpsStatus')){$('rankingHttpsStatus').textContent=payload.message||'';$('rankingHttpsStatus').classList.toggle('ready',Boolean(ready));$('rankingHttpsStatus').classList.toggle('error',payload.status==='error');}if(ready&&state.activePage==='rankings'){refreshOverlayInfo();refreshRankingInfo(null,false);refreshStreamWidgetInfo('playlist',false);refreshStreamWidgetInfo('wallet',false);}if(ready&&state.activePage==='games')refreshStreamWidgetInfo('game',false);if(ready&&state.activePage==='automations')for(const type of ['alert','goal','gift'])refreshStreamWidgetInfo(type,false);});",
    "túnel sin despertar vistas ocultas",
)
renderer = replace_once(
    renderer,
    "  api.onRankingStatus((payload)=>{if(!payload)return;state.ranking={...state.ranking,...payload};if(Number(payload.slot)===Number($('rankingSlotInput')?.value||1))refreshRankingInfo(payload.slot,false);});",
    "  api.onRankingStatus((payload)=>{if(!payload)return;state.ranking={...state.ranking,...payload};if(state.activePage==='rankings'&&Number(payload.slot)===Number($('rankingSlotInput')?.value||1))refreshRankingInfo(payload.slot,false);});",
    "ranking solo visible",
)
renderer = replace_once(
    renderer,
    "  api.onStreamWidgetStatus((payload)=>{if(!payload?.widget)return;state.streamWidgets[payload.widget]={...state.streamWidgets[payload.widget],...payload};refreshStreamWidgetInfo(payload.widget,false);});",
    "  api.onStreamWidgetStatus((payload)=>{if(!payload?.widget)return;state.streamWidgets[payload.widget]={...state.streamWidgets[payload.widget],...payload};const pageByWidget={playlist:'rankings',wallet:'rankings',game:'games',alert:'automations',goal:'automations',gift:'automations'};if(state.activePage===pageByWidget[payload.widget])refreshStreamWidgetInfo(payload.widget,false);});",
    "widgets solo visibles",
)
renderer_path.write_text(renderer, encoding="utf-8")

main_path = ROOT / "src/main.js"
main = main_path.read_text(encoding="utf-8")
main = replace_once(
    main,
    """let activeRendererPage = 'dashboard';
const activeRuntimeModules = new Set(['core']);
let runtimeResourceSettings = null;
function activateRuntimeModule(name){ if(name) activeRuntimeModules.add(String(name)); }
function activateRuntimeModuleForPage(page){ const moduleByPage={voice:'tts',rankings:'rankings',automations:'automations',games:'games',economy:'economy',account:'account',songs:'music',spotify:'music',commands:'commands'}; activateRuntimeModule(moduleByPage[String(page||'')]); }""",
    """let activeRendererPage = 'dashboard';
const activeRuntimeModules = new Set(['core']);
let runtimeResourceSettings = null;
const RUNTIME_MODULE_BY_PAGE = Object.freeze({ voice:'tts', rankings:'rankings', automations:'automations', games:'games', economy:'economy', account:'account', songs:'music', spotify:'music', commands:'commands' });
const RUNTIME_KEEP_KEY_BY_MODULE = Object.freeze({ tts:'voice', rankings:'rankings', automations:'automations', games:'games', economy:'economy', account:'account', music:'music', commands:'commands', overlays:'overlays', live:'live' });
let visibleRuntimeModule = null;
function activateRuntimeModule(name){ if(name) activeRuntimeModules.add(String(name)); }
function runtimeModuleRetained(name) {
  const key = RUNTIME_KEEP_KEY_BY_MODULE[String(name || '')];
  const settings = runtimeResourceSettings || {};
  return Boolean(key && (settings.performanceProfile === 'instant' || (settings.performanceProfile === 'balanced' && settings.balancedKeepActive?.[key] === true)));
}
function runtimeModuleInUse(name) {
  const moduleName = String(name || '');
  if (moduleName === 'live') return Boolean(liveConnection);
  if (moduleName === 'music') return Boolean((youtubeWindow && !youtubeWindow.isDestroyed()) || (spotifyWindow && !spotifyWindow.isDestroyed()));
  if (moduleName === 'account') return Boolean(tiktokChatWindow && !tiktokChatWindow.isDestroyed() && tiktokChatWindow.isVisible());
  if (moduleName === 'rankings') return rankingClientCount() > 0;
  if (moduleName === 'overlays') return overlayClientCount() + streamWidgetClientCount() > 0;
  if (moduleName === 'games') return Boolean(liveGameManager?.blackjackHands?.size);
  if (moduleName === 'tts') return Boolean(localVoiceManager?.status?.().pending);
  return false;
}
function activeRuntimeModuleNames() {
  const modules = new Set(['core']);
  if (visibleRuntimeModule) modules.add(visibleRuntimeModule);
  for (const name of activeRuntimeModules) {
    if (name === 'core' || runtimeModuleRetained(name) || runtimeModuleInUse(name)) modules.add(name);
  }
  if (liveConnection) modules.add('live');
  if (automationEngine && runtimeModuleRetained('automations')) modules.add('automations');
  if (liveGameManager && (runtimeModuleRetained('games') || runtimeModuleInUse('games'))) modules.add('games');
  if (overlayServer && (runtimeModuleRetained('overlays') || overlayClientCount() + rankingClientCount() + streamWidgetClientCount() > 0)) modules.add('overlays');
  return [...modules];
}
function runtimeModuleActive(name) {
  return activeRuntimeModuleNames().includes(String(name || ''));
}
async function releasePageOnlyRuntime(previousModule) {
  if (!previousModule || runtimeModuleRetained(previousModule) || runtimeModuleInUse(previousModule)) return;
  activeRuntimeModules.delete(previousModule);
  if (previousModule === 'automations') {
    automationEngine = null;
    try { delete require.cache[require.resolve('./automation-engine')]; } catch {}
  }
  if (previousModule === 'games' && !liveGameManager?.blackjackHands?.size) {
    liveGameManager = null;
    try { delete require.cache[require.resolve('./live-games')]; } catch {}
  }
  if (previousModule === 'tts') await localVoiceManager?.release();
  if (previousModule === 'account' && tiktokChatWindow && !tiktokChatWindow.isDestroyed() && !tiktokChatWindow.isVisible()) {
    destroyWindowSafely(tiktokChatWindow);
    tiktokChatWindow = null;
  }
  if ((previousModule === 'rankings' || previousModule === 'overlays') && overlayClientCount() + rankingClientCount() + streamWidgetClientCount() === 0) {
    await stopOverlayServer();
    activeRuntimeModules.delete('rankings');
    activeRuntimeModules.delete('overlays');
  }
}
function activateRuntimeModuleForPage(page) {
  const previousModule = visibleRuntimeModule;
  visibleRuntimeModule = RUNTIME_MODULE_BY_PAGE[String(page || '')] || null;
  if (visibleRuntimeModule) activateRuntimeModule(visibleRuntimeModule);
  if (previousModule && previousModule !== visibleRuntimeModule) void releasePageOnlyRuntime(previousModule);
}""",
    "ciclo de vida exclusivo de la categoría visible",
)
main = replace_count(
    main,
    "if (!activeRuntimeModules.has('rankings') && rankingClientCount() === 0) return;",
    "if (!runtimeModuleActive('rankings') && rankingClientCount() === 0) return;",
    2,
    "ranking bajo demanda",
)
main = replace_once(main, "    show: false,\n    webPreferences: {\n      contextIsolation: true,\n      nodeIntegration: false,\n      sandbox: true,\n      partition: TIKTOK_CHAT_PARTITION", "    show: false,\n    skipTaskbar: true,\n    webPreferences: {\n      contextIsolation: true,\n      nodeIntegration: false,\n      sandbox: true,\n      partition: TIKTOK_CHAT_PARTITION", "TikTok agrupado en Lulu")
main = replace_once(main, "    height: 720,\n    show: false,\n    backgroundColor: '#0f0f0f',", "    height: 720,\n    show: false,\n    skipTaskbar: true,\n    backgroundColor: '#0f0f0f',", "buscador de YouTube agrupado")
main = replace_once(main, "    autoHideMenuBar: true,\n    show: false,\n    webPreferences: {\n      contextIsolation: true,\n      nodeIntegration: false,\n      sandbox: true,\n      autoplayPolicy: 'no-user-gesture-required',", "    autoHideMenuBar: true,\n    show: false,\n    skipTaskbar: true,\n    webPreferences: {\n      contextIsolation: true,\n      nodeIntegration: false,\n      sandbox: true,\n      autoplayPolicy: 'no-user-gesture-required',", "YouTube agrupado en Lulu")
main = replace_once(main, "    title: 'Spotify — Lulu Finity', backgroundColor: '#121212', autoHideMenuBar: true, show: false,\n    webPreferences:", "    title: 'Spotify — Lulu Finity', backgroundColor: '#121212', autoHideMenuBar: true, show: false,\n    skipTaskbar: true,\n    webPreferences:", "Spotify agrupado en Lulu")
main = replace_once(
    main,
    "ipcMain.handle('runtime:set-active-page', (_event,page) => { activeRendererPage=String(page||'dashboard').slice(0,40); activateRuntimeModuleForPage(activeRendererPage); return {ok:true,page:activeRendererPage}; });",
    "ipcMain.handle('runtime:set-active-page', (_event,page) => { activeRendererPage=String(page||'dashboard').slice(0,40); activateRuntimeModuleForPage(activeRendererPage); return {ok:true,page:activeRendererPage,module:visibleRuntimeModule}; });",
    "IPC de categoría visible",
)
main = replace_once(
    main,
    "gamesLoaded:Boolean(liveGameManager), automationsLoaded:Boolean(automationEngine), active:[...activeRuntimeModules]",
    "gamesLoaded:Boolean(liveGameManager), automationsLoaded:Boolean(automationEngine), active:activeRuntimeModuleNames(), visible:visibleRuntimeModule",
    "estado real de módulos",
)
main = replace_once(
    main,
    "if(keep('voice'))protectedCategories.push('voice');else await localVoiceManager?.release();",
    "if(keep('voice'))protectedCategories.push('voice');else{await localVoiceManager?.release();if(visibleRuntimeModule!=='tts')activeRuntimeModules.delete('tts');}",
    "liberación de voz inactiva",
)
main = replace_once(
    main,
    """ipcMain.on('app:renderer-ready', () => {
  const runnerRoot = String(process.env.RUNNER_TEMP || '').trim();
  const marker = String(process.env.LULU_STARTUP_SMOKE_MARKER || '').trim();
  if (process.env.CI !== 'true' || !runnerRoot || !marker) return;
  const allowedRoot = path.resolve(runnerRoot);
  const markerPath = path.resolve(marker);
  if (!markerPath.startsWith(`${allowedRoot}${path.sep}`)) return;
  try { fs.writeFileSync(markerPath, 'ready', { encoding:'utf8', flag:'wx' }); }
  catch (error) { console.error('No se pudo escribir la marca de arranque:', error); }
});""",
    """function ciSmokeMarker(name) {
  const runnerRoot = String(process.env.RUNNER_TEMP || '').trim();
  const marker = String(process.env[name] || '').trim();
  if (process.env.CI !== 'true' || !runnerRoot || !marker) return;
  const allowedRoot = path.resolve(runnerRoot);
  const markerPath = path.resolve(marker);
  if (!markerPath.startsWith(`${allowedRoot}${path.sep}`)) return;
  return markerPath;
}

ipcMain.on('app:renderer-ready', async (event) => {
  const startupMarker = ciSmokeMarker('LULU_STARTUP_SMOKE_MARKER');
  if (startupMarker) {
    try { fs.writeFileSync(startupMarker, 'ready', { encoding:'utf8', flag:'wx' }); }
    catch (error) { console.error('No se pudo escribir la marca de arranque:', error); }
  }
  const navigationMarker = ciSmokeMarker('LULU_NAVIGATION_SMOKE_MARKER');
  const contents = event?.sender || mainWindow?.webContents;
  if (!navigationMarker || !contents?.executeJavaScript) return;
  try {
    const result = await contents.executeJavaScript(`(async()=>{
      const pages=[...document.querySelectorAll('.main-content > .page')];
      const results=[];
      for(const page of pages){
        const name=String(page.id||'').replace(/^page-/,'');
        const changed=typeof goToPage==='function'&&goToPage(name,{activateModules:false,notifyMain:false,scroll:false});
        await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const visible=[...document.querySelectorAll('.main-content > .page.active:not([hidden])')];
        let ancestor=page.parentElement;let hiddenAncestor=false;
        while(ancestor&&ancestor!==document.body){if(ancestor.hidden||getComputedStyle(ancestor).display==='none'){hiddenAncestor=true;break;}ancestor=ancestor.parentElement;}
        results.push({name,changed:Boolean(changed),active:page.classList.contains('active'),hidden:page.hidden,inert:page.inert,ariaHidden:page.getAttribute('aria-hidden'),display:getComputedStyle(page).display,visibleCount:visible.length,hiddenAncestor});
      }
      goToPage('dashboard',{activateModules:false,notifyMain:false,scroll:false});
      return {ok:results.length>0&&results.every((item)=>item.changed&&item.active&&!item.hidden&&!item.inert&&item.ariaHidden==='false'&&item.display!=='none'&&item.visibleCount===1&&!item.hiddenAncestor),results};
    })()`, true);
    fs.writeFileSync(navigationMarker, JSON.stringify(result), { encoding:'utf8', flag:'wx' });
  } catch (error) {
    try { fs.writeFileSync(navigationMarker, JSON.stringify({ok:false,error:error?.message||String(error)}), { encoding:'utf8', flag:'wx' }); } catch {}
    console.error('Falló la prueba de navegación:', error);
  }
});""",
    "prueba real de todas las categorías",
)
main_path.write_text(main, encoding="utf-8")

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8")
entry = """# Cambios

## 1.0.4

- Corrige las categorías vacías causadas por la sección Cuenta sin cerrar en el HTML de 1.0.3.
- Mantiene todas las categorías dentro de una sola ventana y permite que exactamente una página esté visible y activa a la vez.
- Suspende las vistas previas de overlays, alertas y juegos al salir de su categoría, sin cerrar fuentes OBS/TikTok LIVE Studio que sigan conectadas.
- Evita que eventos del relay vuelvan a cargar vistas previas ocultas y que Automatizaciones despierte fuera de su categoría si no fue conservada en Rendimiento.
- Agrupa las ventanas auxiliares de TikTok, YouTube y Spotify dentro de Lulu sin mostrarlas como aplicaciones independientes en la barra de tareas.
- Añade una prueba real que recorre todas las categorías en el ejecutable de Windows y exige una sola pantalla visible en cada cambio.

"""
if changelog.startswith("# Cambios\n"):
    changelog = entry + changelog[len("# Cambios\n\n"):]
else:
    changelog = entry + changelog
changelog_path.write_text(changelog, encoding="utf-8")

readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
readme += """

## Navegación de una sola ventana

Lulu Finity usa una sola ventana principal para todas las categorías. Solo la página visible participa en la interfaz y las vistas previas con contenido web se suspenden al salir; los servicios que estén realmente en uso, como un LIVE, una canción, una partida o una fuente conectada, continúan funcionando.
"""
readme_path.write_text(readme, encoding="utf-8")
