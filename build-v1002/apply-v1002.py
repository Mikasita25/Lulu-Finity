from pathlib import Path
import json
import re
import shutil
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
FILES = Path(__file__).resolve().parent / "files"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"{label}: no se encontró el inicio")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f"{label}: no se encontró el final")
    return text[:start_index] + replacement + text[end_index:]


def install_file(relative: str) -> None:
    source = FILES / relative
    destination = ROOT / relative
    if not source.is_file():
        raise SystemExit(f"Falta archivo del parche: {relative}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
if package.get("version") != "1.0.1":
    raise SystemExit(f"Lulu Finity 1.0.2 espera la fuente 1.0.1, no {package.get('version')}")
package["version"] = "1.0.2"
package["description"] = "Lulu Finity 1.0: estudio para TikTok LIVE con voces TikTok, Microsoft, TTS local, música, comandos y overlays"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = json.loads(lock_path.read_text(encoding="utf-8"))
lock["version"] = "1.0.2"
lock_packages = lock.get("packages", {})
if isinstance(lock_packages.get(""), dict):
    lock_packages[""]["version"] = "1.0.2"
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for relative in (
    "src/clone-runtime-manager.js",
    "src/clone-runtime-manager.test.js",
):
    (ROOT / relative).unlink(missing_ok=True)
shutil.rmtree(ROOT / "resources/voices/lulu-official", ignore_errors=True)
for relative in (
    "src/local-voice-manager.js",
    "src/local-tts-worker.js",
    "src/tiktok-voice-catalog.js",
    "src/tiktok-voice-catalog.test.js",
    "src/tiktok-tts-client.js",
    "src/tiktok-tts-client.test.js",
):
    install_file(relative)

main_path = ROOT / "src/main.js"
main = main_path.read_text(encoding="utf-8")
main = replace_once(
    main,
    "let tiktokChatLastMessage = '';",
    "let tiktokChatLastMessage = '';\nlet tiktokSessionSecurityInstalled = false;",
    "estado de seguridad TikTok",
)
main = replace_once(
    main,
    "const { FALLBACK_ONLINE_VOICES, prepareOnlineVoices } = require('./online-voice-catalog');",
    "const { FALLBACK_ONLINE_VOICES, prepareOnlineVoices } = require('./online-voice-catalog');\nconst { TIKTOK_VOICES, isTikTokVoiceId } = require('./tiktok-voice-catalog');\nconst { requestTikTokSpeech } = require('./tiktok-tts-client');",
    "catálogo importado en main",
)
main = replace_once(main, "  onlineVoice: 'es-MX-DaliaNeural',", "  onlineVoice: 'es-MX-DaliaNeural',\n  tiktokVoice: 'es_mx_002',", "código de voz TikTok")

tiktok_main = r'''const TIKTOK_TTS_COOKIE_NAMES = new Set(['sessionid', 'sessionid_ss', 'sid_tt', 'passport_csrf_token']);

function normalizeVoiceSettings(settings = {}) {
  const next = { ...settings };
  const retired = next.localVoiceId === 'lulu-official';
  if (retired) next.voiceMode = 'online';
  if (!['tiktok', 'online', 'local', 'system'].includes(next.voiceMode)) next.voiceMode = 'local';
  if (!isTikTokVoiceId(next.tiktokVoice)) next.tiktokVoice = 'es_mx_002';
  if (!/^[A-Za-z0-9-]+Neural$/.test(String(next.onlineVoice || ''))) next.onlineVoice = 'es-MX-DaliaNeural';
  next.userVoiceRules = (Array.isArray(next.userVoiceRules) ? next.userVoiceRules : []).map((rule) => {
    const voice = String(rule?.voice || '');
    if (voice === 'local:lulu-official') return { ...rule, voice: `online:${next.onlineVoice}` };
    return rule;
  });
  return next;
}

async function removeRetiredVoiceEngine() {
  const retiredRoot = path.join(app.getPath('userData'), 'lulu-local-engines', 'lulu-official');
  await fsp.rm(retiredRoot, { recursive: true, force: true }).catch(() => {});
}

async function getTikTokTtsCookieHeader() {
  const chatSession = session.fromPartition(TIKTOK_CHAT_PARTITION);
  const cookies = await chatSession.cookies.get({ url: 'https://www.tiktok.com/' });
  const allowed = cookies.filter((cookie) => TIKTOK_TTS_COOKIE_NAMES.has(cookie.name) && cookie.value);
  const sessionCookie = allowed.find((cookie) => cookie.name === 'sessionid')
    || allowed.find((cookie) => cookie.name === 'sessionid_ss')
    || allowed.find((cookie) => cookie.name === 'sid_tt');
  if (!sessionCookie) throw new Error('Enlaza tu cuenta en Cuenta → TikTok antes de usar las voces de TikTok.');
  const values = new Map(allowed.map((cookie) => [cookie.name, String(cookie.value).replace(/[;\r\n]/g, '')]));
  if (!values.has('sessionid')) values.set('sessionid', String(sessionCookie.value).replace(/[;\r\n]/g, ''));
  return [...values].map(([name, value]) => `${name}=${value}`).join('; ');
}

function listTikTokVoices() {
  return { voices: TIKTOK_VOICES, provider: 'tiktok', requiresAccount: true };
}

async function synthesizeTikTokVoice(request = {}) {
  const cookie = await getTikTokTtsCookieHeader();
  return requestTikTokSpeech({ text: request?.text, voice: request?.voice, cookie });
}

'''
main = replace_once(main, "function cleanUsername(value) {", tiktok_main + "function cleanUsername(value) {", "motor TikTok")
main = replace_once(
    main,
    "app.whenReady().then(async () => {\n  await ensureDataFiles();",
    "app.whenReady().then(async () => {\n  await ensureDataFiles();\n  await removeRetiredVoiceEngine();",
    "limpieza del motor retirado",
)
main = replace_once(
    main,
    "  const settings = { ...DEFAULT_SETTINGS, ...(await readJson(p.settings, DEFAULT_SETTINGS)) };\n  setYoutubeNetworkAdBlockEnabled",
    "  const settings = normalizeVoiceSettings({ ...DEFAULT_SETTINGS, ...(await readJson(p.settings, DEFAULT_SETTINGS)) });\n  setYoutubeNetworkAdBlockEnabled",
    "migración de voz al cargar estado",
)
main = replace_once(
    main,
    "  const next = { ...DEFAULT_SETTINGS, ...previous, ...(incoming || {}) };",
    "  const next = normalizeVoiceSettings({ ...DEFAULT_SETTINGS, ...previous, ...(incoming || {}) });",
    "migración de voz al guardar",
)
main = replace_once(
    main,
    "ipcMain.handle('tts:install-local-voice', (event,id) => getLocalVoiceManager().install(id, (progress) => { if (!event.sender.isDestroyed()) event.sender.send('tts:local-install-progress', { id, ...progress }); }));\n",
    "",
    "IPC del motor retirado",
)
main = replace_once(
    main,
    "ipcMain.handle('tts:list-online-voices', async (_event, options) => listOnlineVoices(options));\nipcMain.handle('tts:synthesize-online', async (_event, request) => synthesizeOnlineVoice(request));",
    "ipcMain.handle('tts:list-online-voices', async (_event, options) => listOnlineVoices(options));\nipcMain.handle('tts:synthesize-online', async (_event, request) => synthesizeOnlineVoice(request));\nipcMain.handle('tts:list-tiktok-voices', () => listTikTokVoices());\nipcMain.handle('tts:synthesize-tiktok', async (_event, request) => synthesizeTikTokVoice(request));",
    "IPC TikTok TTS",
)

tiktok_security = r'''function isTikTokChatUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && /(^|\.)tiktok\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function tikTokOriginSummary(value = '') {
  try {
    const url = new URL(String(value || ''));
    const official = url.protocol === 'https:' && /(^|\.)tiktok\.com$/i.test(url.hostname);
    return { officialDomain: official, displayOrigin: official ? `https://${url.hostname}` : '' };
  } catch {
    return { officialDomain: false, displayOrigin: '' };
  }
}

async function getTikTokSessionSummary() {
  const chatSession = session.fromPartition(TIKTOK_CHAT_PARTITION);
  const cookies = await chatSession.cookies.get({ url: 'https://www.tiktok.com/' }).catch(() => []);
  return {
    sessionStored: cookies.some((cookie) => ['sessionid','sessionid_ss','sid_tt'].includes(cookie.name) && cookie.value),
    storageScope: 'local',
    permissionsBlocked: true
  };
}

function hardenTikTokSession(chatSession) {
  if (tiktokSessionSecurityInstalled) return;
  tiktokSessionSecurityInstalled = true;
  chatSession.setPermissionCheckHandler(() => false);
  chatSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  chatSession.on('will-download', (event) => event.preventDefault());
}
'''
main = replace_between(main, "function isTikTokChatUrl(value) {", "function emitTikTokChatStatus", tiktok_security, "protección de sesión TikTok")
main = replace_once(
    main,
    "  const payload = {\n    open,\n    visible: Boolean(open && tiktokChatWindow.isVisible()),\n    url: open ? tiktokChatWindow.webContents.getURL() : '',\n    ...extra\n  };",
    "  const currentUrl = open ? tiktokChatWindow.webContents.getURL() : '';\n  const payload = {\n    open,\n    visible: Boolean(open && tiktokChatWindow.isVisible()),\n    url: currentUrl,\n    ...tikTokOriginSummary(currentUrl),\n    storageScope: 'local',\n    permissionsBlocked: true,\n    ...extra\n  };",
    "estado visible de seguridad TikTok",
)
main = replace_once(
    main,
    "async function inspectTikTokChatWindow() {\n  if (!tiktokChatWindow || tiktokChatWindow.isDestroyed()) return { open: false, ready: false, loggedIn: false, message: 'Abre TikTok e inicia sesión con la cuenta creadora.' };",
    "async function inspectTikTokChatWindow() {\n  const sessionSummary = await getTikTokSessionSummary();\n  if (!tiktokChatWindow || tiktokChatWindow.isDestroyed()) return { open: false, ready: false, loggedIn:sessionSummary.sessionStored, message:sessionSummary.sessionStored ? 'La sesión está guardada de forma local. Abre TikTok para comprobarla.' : 'Abre el sitio oficial de TikTok e inicia sesión.', ...sessionSummary };",
    "resumen local de sesión TikTok",
)
main = replace_once(main, "      const text = document.body?.innerText || '';\n", "", "evitar copiar contenido de página TikTok")
main = replace_once(
    main,
    "        message: input && livePage ? 'Sesión lista para enviar mensajes.' : (loginVisible ? 'Inicia sesión con la cuenta creadora del LIVE.' : (livePage ? 'Abre el chat del LIVE y espera a que termine de cargar.' : 'Abre el LIVE del creador para preparar el chat.')),\n        pageText: text.slice(0, 160)",
    "        message: input && livePage ? 'Sesión lista para enviar mensajes.' : (loginVisible ? 'Inicia sesión dentro del sitio oficial de TikTok.' : (livePage ? 'Abre el chat del LIVE y espera a que termine de cargar.' : 'Abre el LIVE del creador para preparar el chat.'))",
    "estado privado de TikTok",
)
main = replace_once(
    main,
    "    return { open: true, ...result, url: tiktokChatWindow.webContents.getURL() };",
    "    const currentUrl = tiktokChatWindow.webContents.getURL();\n    return { open:true, ...result, ...sessionSummary, ...tikTokOriginSummary(currentUrl), url:currentUrl };",
    "dominio oficial inspeccionado",
)
main = replace_once(
    main,
    "    return { open: true, ready: false, loggedIn: false, message: error?.message || 'No se pudo revisar la sesión de TikTok.', url: tiktokChatWindow.webContents.getURL() };",
    "    const currentUrl = tiktokChatWindow.webContents.getURL();\n    return { open:true, ready:false, loggedIn:sessionSummary.sessionStored, message:error?.message || 'No se pudo revisar la sesión de TikTok.', ...sessionSummary, ...tikTokOriginSummary(currentUrl), url:currentUrl };",
    "error seguro de inspección TikTok",
)
main = replace_once(
    main,
    "function createTikTokChatWindow(username = '') {\n  if (tiktokChatWindow && !tiktokChatWindow.isDestroyed()) return tiktokChatWindow;",
    "function createTikTokChatWindow(username = '') {\n  if (tiktokChatWindow && !tiktokChatWindow.isDestroyed()) return tiktokChatWindow;\n  const chatSession = session.fromPartition(TIKTOK_CHAT_PARTITION);\n  hardenTikTokSession(chatSession);",
    "activar seguridad de sesión TikTok",
)
main = replace_once(
    main,
    "    title: 'TikTok LIVE Chat — Lulu Finity',",
    "    title: 'Sitio oficial de TikTok — Lulu Finity',",
    "título de confianza TikTok",
)
main = replace_once(
    main,
    "  tiktokChatWindow.webContents.on('did-finish-load', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));",
    "  tiktokChatWindow.webContents.on('page-title-updated', (event) => { event.preventDefault(); const origin=tikTokOriginSummary(tiktokChatWindow.webContents.getURL()); tiktokChatWindow.setTitle(origin.officialDomain ? `Sitio oficial · ${origin.displayOrigin} — Lulu Finity` : 'Navegación bloqueada — Lulu Finity'); });\n  tiktokChatWindow.webContents.on('will-navigate', (event, url) => { if (isTikTokChatUrl(url)) return; event.preventDefault(); if (/^https:\\/\\//i.test(url)) shell.openExternal(url); emitTikTokChatStatus({ ready:false, message:'Lulu bloqueó una navegación fuera de TikTok. Se abrió en tu navegador.', officialDomain:false }); });\n  tiktokChatWindow.webContents.on('did-finish-load', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));",
    "navegación visible y limitada de TikTok",
)
main = replace_once(
    main,
    "  tiktokChatWindow.webContents.on('did-navigate-in-page', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));",
    "  tiktokChatWindow.webContents.on('did-navigate', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));\n  tiktokChatWindow.webContents.on('did-navigate-in-page', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));",
    "actualización de dominio TikTok",
)
main = replace_once(
    main,
    "ipcMain.handle('tiktok-chat:status', async () => {\n  if (!tiktokChatWindow || tiktokChatWindow.isDestroyed()) return emitTikTokChatStatus({ ready:false, loggedIn:false, message:'Abre TikTok e inicia sesión con la cuenta creadora.' });\n  return emitTikTokChatStatus(await inspectTikTokChatWindow());\n});",
    "ipcMain.handle('tiktok-chat:status', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));",
    "estado de sesión aun con ventana cerrada",
)

# Activación bajo demanda: abrir Lulu o usar únicamente Música no debe cargar
# motores de TTS, juegos, automatizaciones, rankings ni ambos proveedores web.
main = replace_once(
    main,
    "const { LiveGameManager } = require('./live-games');\nconst { LocalVoiceManager } = require('./local-voice-manager');\nconst { FALLBACK_ONLINE_VOICES, prepareOnlineVoices } = require('./online-voice-catalog');\nconst { TIKTOK_VOICES, isTikTokVoiceId } = require('./tiktok-voice-catalog');\nconst { requestTikTokSpeech } = require('./tiktok-tts-client');\nconst automationEngine = require('./automation-engine');",
    "const { FALLBACK_ONLINE_VOICES, prepareOnlineVoices } = require('./online-voice-catalog');\nconst { TIKTOK_VOICES, isTikTokVoiceId } = require('./tiktok-voice-catalog');\nconst { requestTikTokSpeech } = require('./tiktok-tts-client');\nlet LiveGameManagerClass = null;\nlet LocalVoiceManagerClass = null;\nlet automationEngine = null;\nfunction getLiveGameManagerClass(){ if(!LiveGameManagerClass) ({ LiveGameManager:LiveGameManagerClass } = require('./live-games')); return LiveGameManagerClass; }\nfunction getLocalVoiceManagerClass(){ if(!LocalVoiceManagerClass) ({ LocalVoiceManager:LocalVoiceManagerClass } = require('./local-voice-manager')); return LocalVoiceManagerClass; }\nfunction getAutomationEngine(){ if(!automationEngine) automationEngine=require('./automation-engine'); return automationEngine; }",
    "imports pesados bajo demanda",
)
main = replace_once(
    main,
    "let youtubeMuted = false;\nlet youtubeAdGuardMuted = false;",
    "let youtubeMuted = false;\nlet youtubeVolume = 0.8;\nlet youtubeAdGuardMuted = false;",
    "volumen diferido YouTube",
)
main = replace_once(
    main,
    "let spotifyMuted = false;\nlet spotifyAutomationNonce = 0;",
    "let spotifyMuted = false;\nlet spotifyVolume = 0.8;\nlet spotifyAutomationNonce = 0;",
    "volumen diferido Spotify",
)
main = replace_once(
    main,
    "let youtubeAutomationTimer = null;\nlet youtubeAdBlockInstalled = false;",
    "let youtubeAutomationTimer = null;\nlet youtubeResolverIdleTimer = null;\nlet youtubeAdBlockInstalled = false;",
    "reposo del buscador YouTube",
)
main = replace_once(
    main,
    "let activeRendererPage = 'dashboard';\n\nfunction getLocalVoiceManager() {\n  if (!localVoiceManager) localVoiceManager = new LocalVoiceManager({ app, dialog, utilityProcess, workerPath:path.join(__dirname, 'local-tts-worker.js') });",
    "let activeRendererPage = 'dashboard';\nconst activeRuntimeModules = new Set(['core']);\nfunction activateRuntimeModule(name){ if(name) activeRuntimeModules.add(String(name)); }\nfunction activateRuntimeModuleForPage(page){ const moduleByPage={voice:'tts',rankings:'rankings',automations:'automations',games:'games',economy:'economy',account:'account',songs:'music',spotify:'music',commands:'commands'}; activateRuntimeModule(moduleByPage[String(page||'')]); }\n\nfunction getLocalVoiceManager() {\n  if (!localVoiceManager) { const LocalVoiceManager=getLocalVoiceManagerClass(); localVoiceManager = new LocalVoiceManager({ app, dialog, utilityProcess, workerPath:path.join(__dirname, 'local-tts-worker.js') }); }",
    "estado de módulos y gestor TTS diferido",
)
main = replace_once(
    main,
    "  if (!fs.existsSync(p.economy)) await writeJson(p.economy, { version: 1, balances: {}, ledger: [], processed: {} });\n  if (!fs.existsSync(p.rankings)) await writeJson(p.rankings, { version: 1, users: {}, processed: {}, updatedAt: Date.now() });",
    "  // Economía y rankings se crean la primera vez que esas funciones se usan.",
    "archivos de módulos bajo demanda",
)
main = replace_once(
    main,
    "  liveGameManager = new LiveGameManager({",
    "  const LiveGameManager=getLiveGameManagerClass();\n  liveGameManager = new LiveGameManager({",
    "juegos bajo demanda",
)
main = replace_once(
    main,
    "async function recordRankingMetric(type, source = {}, amount = 1, eventId = '') {\n  if (!RANKING_TYPES.has(type) || type === 'economy') return;",
    "async function recordRankingMetric(type, source = {}, amount = 1, eventId = '') {\n  if (!activeRuntimeModules.has('rankings') && rankingClientCount() === 0) return;\n  if (!RANKING_TYPES.has(type) || type === 'economy') return;",
    "rankings dormidos",
)
main = replace_once(
    main,
    "function scheduleRankingBroadcast() {\n  clearTimeout(rankingBroadcastTimer);",
    "function scheduleRankingBroadcast() {\n  if (!activeRuntimeModules.has('rankings') && rankingClientCount() === 0) return;\n  clearTimeout(rankingBroadcastTimer);",
    "broadcast de rankings bajo demanda",
)
main = replace_once(main, "async function streamWidgetInfo(type = 'playlist', forceTunnel = false) {\n  await startOverlayServer();", "async function streamWidgetInfo(type = 'playlist', forceTunnel = false) {\n  activateRuntimeModule('overlays');\n  await startOverlayServer();", "widgets activan overlays")
main = replace_once(main, "async function rankingInfo(slot = 1, forceTunnel = false) {\n  await startOverlayServer();", "async function rankingInfo(slot = 1, forceTunnel = false) {\n  activateRuntimeModule('rankings');\n  await startOverlayServer();", "ranking activa su módulo")
main = replace_once(main, "async function overlayInfo(screen = 1, forceTunnel = false) {\n  await startOverlayServer();", "async function overlayInfo(screen = 1, forceTunnel = false) {\n  activateRuntimeModule('overlays');\n  await startOverlayServer();", "overlay activa su módulo")
main = replace_once(
    main,
    "  void ensureYoutubeNetworkAdBlocker();\n}",
    "  if (youtubeWindow && !youtubeWindow.isDestroyed()) void ensureYoutubeNetworkAdBlocker();\n}",
    "antibloqueo YouTube diferido",
)
main = replace_once(
    main,
    "  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);\n  if (!youtubeAdBlockEnabled) {",
    "  if (!youtubeAdBlockEnabled) {",
    "sesión YouTube diferida",
)
main = replace_once(
    main,
    "    if (youtubeFilterEngine && youtubeFilterEngineEnabled) {\n      try { youtubeFilterEngine.disableBlockingInSession(youtubeSession); } catch {}",
    "    if (youtubeFilterEngine && youtubeFilterEngineEnabled) {\n      const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);\n      try { youtubeFilterEngine.disableBlockingInSession(youtubeSession); } catch {}",
    "sesión YouTube solo al apagar filtro activo",
)
main = replace_once(
    main,
    "async function resolveYoutubeRequest(rawQuery, suffix = '') {",
    "function scheduleYoutubeResolverRelease(){\n  clearTimeout(youtubeResolverIdleTimer);\n  youtubeResolverIdleTimer=setTimeout(()=>{ if(youtubeResolverWindow&&!youtubeResolverWindow.isDestroyed()) youtubeResolverWindow.destroy(); youtubeResolverWindow=null; youtubeResolverIdleTimer=null; },15000);\n  youtubeResolverIdleTimer.unref?.();\n}\n\nasync function resolveYoutubeRequest(rawQuery, suffix = '') {",
    "liberación del buscador YouTube",
)
main = replace_once(
    main,
    "  const task = youtubeResolveChain.then(run, run);\n  youtubeResolveChain = task.catch(() => {});\n  return task;",
    "  const task = youtubeResolveChain.then(run, run);\n  const settled = task.finally(scheduleYoutubeResolverRelease);\n  youtubeResolveChain = settled.catch(() => {});\n  return settled;",
    "buscador YouTube temporal",
)
main = replace_once(
    main,
    "async function controlYoutubePlayer(action, value) {",
    "function normalizedAudioVolume(value,fallback=.8){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(1,number)):fallback;}\nasync function setYoutubeVolume(value){youtubeVolume=normalizedAudioVolume(value,youtubeVolume);if(!youtubeWindow||youtubeWindow.isDestroyed())return{ok:true,deferred:true,volume:youtubeVolume};return controlYoutubePlayer('volume',youtubeVolume);}\nasync function setSpotifyVolume(value){spotifyVolume=normalizedAudioVolume(value,spotifyVolume);if(!spotifyWindow||spotifyWindow.isDestroyed())return{ok:true,deferred:true,volume:spotifyVolume};return controlSpotifyPlayer('volume',spotifyVolume);}\n\nasync function controlYoutubePlayer(action, value) {",
    "volúmenes sin crear ventanas",
)
main = replace_once(
    main,
    "  if (!(youtubeUrlKind(target) === 'watch' && youtubeAdBlockEnabled)) win.webContents.setAudioMuted(youtubeMuted);\n  const payload",
    "  if (!(youtubeUrlKind(target) === 'watch' && youtubeAdBlockEnabled)) win.webContents.setAudioMuted(youtubeMuted);\n  await setYoutubeVolume(youtubeVolume).catch(()=>{});\n  const payload",
    "volumen al abrir YouTube",
)
main = replace_once(
    main,
    "  win.webContents.setAudioMuted(spotifyMuted);\n  const payload = { open: true, visible: win.isVisible(), muted: spotifyMuted, target, query: String(rawQuery || '').trim() };",
    "  win.webContents.setAudioMuted(spotifyMuted);\n  await setSpotifyVolume(spotifyVolume).catch(()=>{});\n  const payload = { open: true, visible: win.isVisible(), muted: spotifyMuted, target, query: String(rawQuery || '').trim() };",
    "volumen al abrir Spotify",
)
main = replace_once(
    main,
    "function destroyAuxiliaryWindows() {",
    "function releaseInactiveMusicProvider(provider='youtube'){\n  if(provider==='spotify'){ clearYoutubeAutomation(); clearTimeout(youtubeResolverIdleTimer); youtubeResolverIdleTimer=null; destroyWindowSafely(youtubeResolverWindow); destroyWindowSafely(youtubeWindow); youtubeResolverWindow=null; youtubeWindow=null; }\n  else { clearSpotifyAutomation(); destroyWindowSafely(spotifyWindow); spotifyWindow=null; }\n}\n\nfunction destroyAuxiliaryWindows() {",
    "un solo proveedor musical",
)
main = replace_once(
    main,
    "  setYoutubeNetworkAdBlockEnabled(settings.youtubeAdBlockEnabled !== false);\n  return {\n    settings,\n    economy: await economySnapshot(),",
    "  youtubeVolume=normalizedAudioVolume(settings.youtubeVolume,.8);\n  spotifyVolume=normalizedAudioVolume(settings.spotifyVolume,.8);\n  setYoutubeNetworkAdBlockEnabled(settings.youtubeAdBlockEnabled !== false);\n  releaseInactiveMusicProvider(settings.musicProvider);\n  return {\n    settings,\n    economy: null,",
    "estado inicial ligero",
)
main = replace_once(
    main,
    "  await writeJson(p.settings, next);\n  scheduleRankingBroadcast();\n  return next;",
    "  await writeJson(p.settings, next);\n  youtubeVolume=normalizedAudioVolume(next.youtubeVolume,youtubeVolume);\n  spotifyVolume=normalizedAudioVolume(next.spotifyVolume,spotifyVolume);\n  releaseInactiveMusicProvider(next.musicProvider);\n  scheduleRankingBroadcast();\n  return next;",
    "guardar y liberar proveedor inactivo",
)
main = replace_once(
    main,
    "ipcMain.handle('runtime:set-active-page', (_event,page) => { activeRendererPage=String(page||'dashboard').slice(0,40); return {ok:true,page:activeRendererPage}; });",
    "ipcMain.handle('runtime:set-active-page', (_event,page) => { activeRendererPage=String(page||'dashboard').slice(0,40); activateRuntimeModuleForPage(activeRendererPage); return {ok:true,page:activeRendererPage}; });",
    "activación de módulo por página",
)
main = replace_once(
    main,
    "    live:Boolean(liveConnection), localTts:getLocalVoiceManager().status(),\n    youtube:Boolean(youtubeWindow&&!youtubeWindow.isDestroyed()), spotify:Boolean(spotifyWindow&&!spotifyWindow.isDestroyed()),\n    overlayServer:Boolean(overlayServer), overlayClients:overlayClientCount()+rankingClientCount()+streamWidgetClientCount()",
    "    live:Boolean(liveConnection), localTts:localVoiceManager?{loaded:true,...localVoiceManager.status()}:{loaded:false,running:false,pid:null,pending:0,lastUsedAt:0},\n    youtube:Boolean(youtubeWindow&&!youtubeWindow.isDestroyed()), spotify:Boolean(spotifyWindow&&!spotifyWindow.isDestroyed()),\n    overlayServer:Boolean(overlayServer), overlayClients:overlayClientCount()+rankingClientCount()+streamWidgetClientCount(),\n    gamesLoaded:Boolean(liveGameManager), automationsLoaded:Boolean(automationEngine), active:[...activeRuntimeModules]",
    "estado sin despertar módulos",
)
main = replace_once(
    main,
    "  youtubeResolverWindow=null;\n  return {ok:true};",
    "  youtubeResolverWindow=null;\n  const settings={...DEFAULT_SETTINGS,...(await readJson(getDataPaths().settings,DEFAULT_SETTINGS))};\n  releaseInactiveMusicProvider(settings.musicProvider);\n  return {ok:true};",
    "liberar proveedor musical inactivo",
)
main = replace_once(main, "ipcMain.handle('automations:evaluate', async (_event, details = {}) => automationEngine.evaluateAutomations(details.rules, details.event, details.context));", "ipcMain.handle('automations:evaluate', async (_event, details = {}) => getAutomationEngine().evaluateAutomations(details.rules, details.event, details.context));", "evaluador automático diferido")
main = replace_once(main, "ipcMain.handle('goals:apply-event', async (_event, details = {}) => automationEngine.applyGoalEvent(details.goals, details.event));", "ipcMain.handle('goals:apply-event', async (_event, details = {}) => getAutomationEngine().applyGoalEvent(details.goals, details.event));", "metas diferidas")
main = replace_once(main, "ipcMain.handle('goals:reset', async (_event, details = {}) => automationEngine.resetGoal(details.goals, details.goalId));", "ipcMain.handle('goals:reset', async (_event, details = {}) => getAutomationEngine().resetGoal(details.goals, details.goalId));", "reinicio de metas diferido")
main = replace_once(main, "ipcMain.handle('gifts:update-stats', async (_event, details = {}) => automationEngine.updateGiftStats(details.state, details.event));", "ipcMain.handle('gifts:update-stats', async (_event, details = {}) => getAutomationEngine().updateGiftStats(details.state, details.event));", "estadísticas de regalos diferidas")
main = replace_once(main, "ipcMain.handle('youtube:set-volume', async (_event, volume) => controlYoutubePlayer('volume', volume));", "ipcMain.handle('youtube:set-volume', async (_event, volume) => setYoutubeVolume(volume));", "IPC volumen YouTube diferido")
main = replace_once(main, "ipcMain.handle('spotify:set-volume', async (_event, volume) => controlSpotifyPlayer('volume', volume));", "ipcMain.handle('spotify:set-volume', async (_event, volume) => setSpotifyVolume(volume));", "IPC volumen Spotify diferido")
main_path.write_text(main, encoding="utf-8")

preload_path = ROOT / "src/preload.js"
preload = preload_path.read_text(encoding="utf-8")
preload = replace_once(
    preload,
    "  listOnlineVoices: (options = {}) => ipcRenderer.invoke('tts:list-online-voices', options),\n  synthesizeOnlineVoice: (request) => ipcRenderer.invoke('tts:synthesize-online', request),",
    "  listOnlineVoices: (options = {}) => ipcRenderer.invoke('tts:list-online-voices', options),\n  synthesizeOnlineVoice: (request) => ipcRenderer.invoke('tts:synthesize-online', request),\n  listTikTokVoices: () => ipcRenderer.invoke('tts:list-tiktok-voices'),\n  synthesizeTikTokVoice: (request) => ipcRenderer.invoke('tts:synthesize-tiktok', request),",
    "API TTS del preload",
)
preload = replace_once(preload, "  installLocalVoice: (id) => ipcRenderer.invoke('tts:install-local-voice', id),\n", "", "instalador de voz del preload")
preload_path.write_text(preload, encoding="utf-8")

html_path = ROOT / "src/index.html"
html = html_path.read_text(encoding="utf-8")
html = replace_once(html, 'id="versionLabel">v1.0.1', 'id="versionLabel">v1.0.2', "versión de la barra")
html = replace_once(html, 'id="updateVersionBadge">v1.0.1', 'id="updateVersionBadge">v1.0.2', "versión de actualizaciones")
html = replace_once(
    html,
    '<div class="page-heading simple"><div><h1>TTS y voces</h1><p>Voz local, reglas de lectura y permisos en un solo lugar.</p></div></div>',
    '<div class="page-heading simple"><div><h1>TTS y voces</h1><p>Voces de TikTok, Microsoft, Windows y Lulu Local en un solo lugar.</p></div></div>',
    "descripción TTS",
)
html = replace_once(
    html,
    '<div class="voice-provider-status" id="voiceProviderStatus"><span class="status-light connecting"></span><span>Cargando catálogo gratuito completo…</span></div>',
    '<div class="voice-provider-status" id="voiceProviderStatus"><span class="status-light connecting"></span><span>Cargando voces de Microsoft y TikTok…</span></div>',
    "estado del proveedor",
)
html = replace_once(
    html,
    '<div class="tts-section-pane" data-tts-pane="local"><div class="local-voice-layout"><article class="panel settings-card wide"><div class="panel-header"><div><h3>Biblioteca Lulu Local</h3><p class="hint">Funciona sin Internet. El motor se libera cuando deja de usarse.</p></div><button class="primary" id="localVoiceImportBtn">Importar .lfvoice</button></div><div class="local-voice-status" id="localVoiceStatus">Buscando voces instaladas…</div><div class="local-voice-list" id="localVoiceList"></div></article><article class="panel settings-card"><h3>Paquetes de voz</h3><p>La <strong>Voz Oficial De Lulu Finity</strong> usa clonación local y descarga su motor sólo al instalarla.</p><p>Un archivo <strong>.lfvoice</strong> contiene un modelo VITS/Piper, sus tokens y datos de pronunciación.</p><p class="hint">Las voces importadas se validan y se guardan sólo en tu equipo.</p></article></div></div>',
    '<div class="tts-section-pane" data-tts-pane="local"><div class="local-voice-layout"><article class="panel settings-card wide"><div class="panel-header"><div><h3>Biblioteca Lulu Local</h3><p class="hint">Voces Piper sencillas que funcionan sin Internet y sin descargar el motor retirado.</p></div><button class="primary" id="localVoiceImportBtn">Importar .lfvoice</button></div><div class="local-voice-status" id="localVoiceStatus">Buscando voces instaladas…</div><div class="local-voice-list" id="localVoiceList"></div></article><article class="panel settings-card"><h3>Paquetes de voz</h3><p>Un archivo <strong>.lfvoice</strong> contiene un modelo VITS/Piper, sus tokens y datos de pronunciación.</p><p class="hint">Las voces importadas se validan y se guardan sólo en tu equipo.</p></article></div></div>',
    "biblioteca sin OpenVoice",
)

account_html = r'''<section class="page" id="page-account">
<div class="page-heading simple"><div><h1>Cuenta</h1><p>Conecta TikTok desde su sitio oficial y conserva el control de tu sesión.</p></div></div>
<div class="section-tabs category-section-tabs" data-category-tabs="account" role="tablist"><button class="section-tab active" data-category-tab="tiktok" type="button">Conectar TikTok</button><button class="section-tab" data-category-tab="privacy" type="button">Seguridad y privacidad</button></div>
<div class="category-section-pane active" data-category-pane="tiktok" data-category-pane-group="account"><div class="settings-grid">
<article class="panel settings-card wide tiktok-account-card secure-account-card">
<div class="panel-header"><div><h3>Conexión protegida con TikTok</h3><p class="hint">El inicio de sesión se abre en una ventana aislada que solo permite el sitio oficial.</p></div><span class="chat-session-pill" id="tiktokChatStatusBadge">SIN SESIÓN</span></div>
<div class="official-domain-banner"><span class="domain-lock">🔒</span><div><strong id="tiktokSecurityOrigin">https://www.tiktok.com</strong><small>Comprueba este dominio antes de escribir tus datos.</small></div><span class="verified-pill">DOMINIO OFICIAL</span></div>
<div class="tiktok-trust-grid">
<div class="trust-item"><span>1</span><div><strong>Tu contraseña solo va a TikTok</strong><small>La escribes directamente en su página. Lulu Finity no la guarda ni la manda a Railway.</small></div></div>
<div class="trust-item"><span>2</span><div><strong>Sesión solo en esta PC</strong><small id="tiktokSecuritySession">Se almacena en el perfil local de Lulu Finity y puedes borrarla cuando quieras.</small></div></div>
<div class="trust-item"><span>3</span><div><strong>Permisos bloqueados</strong><small>Lulu no permite cámara, micrófono, ubicación, notificaciones ni descargas en esa ventana.</small></div></div>
</div>
<div class="setting-row"><div><h3>Estado de la conexión</h3><p id="tiktokChatStatusText">Abre el sitio oficial de TikTok e inicia sesión.</p></div></div>
<div class="tiktok-chat-actions"><button class="secondary" id="openTikTokChatBtn">Abrir sitio oficial de TikTok</button><button class="ghost" id="checkTikTokChatBtn">Comprobar sesión</button><button class="danger-outline" id="resetTikTokChatBtn">Desvincular y borrar sesión</button></div>
<p class="account-independence-note">Puedes seguir usando Lulu Local, las voces de Microsoft y las voces instaladas de Windows sin vincular TikTok. La cuenta solo es necesaria para voces TikTok y funciones que publican en el chat.</p>
</article>
</div></div>
<div class="category-section-pane" data-category-pane="privacy" data-category-pane-group="account"><div class="settings-grid">
<article class="panel settings-card wide account-privacy-card">
<div class="privacy-intro"><span class="privacy-shield">🔐</span><div><h3>Privacidad al vincular TikTok</h3><p>Tu cuenta se abre dentro del sitio oficial de TikTok. Vincularla no significa entregar tu cuenta a Lulu Finity ni al servidor de Lulú.</p></div></div>
<section class="privacy-server-explainer">
<span class="privacy-section-label">CONEXIÓN CON EL SERVIDOR DE LULÚ FINITY</span>
<h4>La única finalidad del servidor de Lulú es la API WebSocket del LIVE</h4>
<p>Cuando conectas un LIVE, la aplicación abre una conexión cifrada <strong>WSS (WebSocket seguro)</strong> con el relay de Lulú Finity. Esa conexión existe únicamente para operar las APIs de WebSocket que reciben en tiempo real comentarios, regalos, likes, seguidores, compartidos y otros eventos públicos del LIVE.</p>
<p>El relay también protege las claves técnicas del proveedor para que nunca tengan que incluirse dentro de la aplicación. La consulta del contador de uso pertenece al mismo servicio WebSocket. <strong>El inicio de sesión y la sesión de tu cuenta de TikTok no pasan por este servidor.</strong></p>
<div class="websocket-flow" aria-label="Ruta de la conexión WebSocket"><span>Tu PC</span><i>WSS cifrado</i><span>Relay de Lulú</span><i>Eventos LIVE</i><span>API del LIVE</span></div>
</section>
<div class="privacy-detail-grid">
<section class="privacy-detail-card safe"><span class="privacy-section-label">LO QUE SÍ USA EL WEBSOCKET</span><h4>Solo lo necesario para escuchar el LIVE</h4><ul><li>El nombre de usuario público del LIVE que quieres conectar.</li><li>Los eventos públicos que la API devuelve mientras el LIVE está activo.</li><li>Datos técnicos temporales de conexión, como dirección IP y hora, necesarios para seguridad, límites y funcionamiento de cualquier servicio de Internet.</li><li>Un contador general de conexiones para controlar la cuota del servicio.</li></ul><p>El relay reenvía los eventos a tu aplicación en tiempo real; su código no crea una base de datos con tus comentarios, regalos o espectadores.</p></section>
<section class="privacy-detail-card blocked"><span class="privacy-section-label">LO QUE NUNCA SE ENVÍA AL SERVIDOR DE LULÚ</span><h4>Tu cuenta permanece fuera del relay</h4><ul><li>Tu contraseña, correo electrónico o número de teléfono.</li><li>Cookies de TikTok, <code>sessionid</code>, tokens o credenciales de acceso.</li><li>El contenido de tu computadora, archivos, micrófono, cámara o ubicación.</li><li>Tus ajustes de voces, reglas, comandos o configuración local.</li><li>Los textos enviados al chat o a una voz TikTok: esos van directamente a TikTok.</li></ul><p>Railway no recibe tu sesión. Lulu Finity tampoco imprime contraseñas, cookies ni tokens de TikTok en sus archivos de registro.</p></section>
</div>
<section class="privacy-direct-connections"><span class="privacy-section-label">A DÓNDE SE CONECTA CADA FUNCIÓN</span><h4>Conexiones separadas y fáciles de entender</h4><div class="privacy-connection-list"><div><strong>TikTok oficial</strong><span>Inicio de sesión, envío de mensajes y voces TikTok. La comunicación es directa con dominios oficiales de TikTok.</span></div><div><strong>Servidor de Lulú Finity</strong><span>Únicamente el relay y estado técnico de la API WebSocket del LIVE; nunca autentica tu cuenta.</span></div><div><strong>Microsoft</strong><span>Solo recibe el texto que eliges convertir en audio cuando usas una voz Microsoft online. No recibe tu sesión de TikTok.</span></div><div><strong>Tu computadora</strong><span>Guarda la sesión aislada, ajustes, comandos y voces locales. Estos datos permanecen en el perfil de Windows de Lulu Finity.</span></div></div></section>
<section class="privacy-local-session"><span class="privacy-section-label">SESIÓN LOCAL Y PERMISOS</span><h4>La vinculación queda bajo tu control</h4><p>La ventana de inicio de sesión está aislada del resto de la aplicación, muestra el dominio oficial y bloquea cámara, micrófono, ubicación, notificaciones y descargas. La sesión se guarda únicamente en el perfil local de Lulu Finity para que no tengas que iniciar sesión cada vez.</p><p>Cerrar la ventana conserva la sesión local. El botón de abajo elimina cookies, caché y almacenamiento local de TikTok de esta computadora. Después de borrarla, las voces Microsoft, Windows y Lulu Local continúan funcionando sin una cuenta.</p></section>
<div class="privacy-delete-box"><div><strong>Tú conservas el control</strong><span>Cerrar la ventana no borra la sesión. Usa “Desvincular y borrar sesión” para eliminar cookies, caché y almacenamiento local de TikTok de esta PC.</span></div><button class="danger-outline" id="privacyResetTikTokBtn">Desvincular y borrar sesión</button></div>
<p class="hint">Lulu Finity no está afiliada con TikTok. Las voces TikTok usan una interfaz no oficial que puede cambiar; las voces Microsoft permanecen disponibles sin esta cuenta.</p>
</article>
</div></div>

'''
html = replace_between(html, '<section class="page" id="page-account">', '<section class="page" id="page-commands">', account_html, "cuenta TikTok transparente")
html_path.write_text(html, encoding="utf-8")

renderer_path = ROOT / "src/renderer.js"
renderer = renderer_path.read_text(encoding="utf-8")
renderer = replace_once(
    renderer,
    "const modules=[['LIVE',runtime.modules?.live],['Lulu Local',runtime.modules?.localTts?.running],['YouTube',runtime.modules?.youtube],['Spotify',runtime.modules?.spotify],['Overlays',runtime.modules?.overlayServer]];",
    "const active=new Set(runtime.modules?.active||[]);const modules=[['LIVE',runtime.modules?.live],['Lulu Local',runtime.modules?.localTts?.running],['YouTube',runtime.modules?.youtube],['Spotify',runtime.modules?.spotify],['Overlays',runtime.modules?.overlayServer],['Rankings',active.has('rankings')],['Automatizaciones',runtime.modules?.automationsLoaded],['Juegos',runtime.modules?.gamesLoaded],['Economía',active.has('economy')]];",
    "módulos visibles sin despertarlos",
)
renderer = replace_once(
    renderer,
    "  onlineVoices: [],\n  onlineVoicesFallback: false,",
    "  onlineVoices: [],\n  onlineVoicesFallback: false,\n  tiktokVoices: [],",
    "estado de voces TikTok",
)

account_status = r'''function renderTikTokChatStatus(status = state.tiktokChatStatus || {}) {
  state.tiktokChatStatus = status;
  const badge = $('tiktokChatStatusBadge');
  const text = $('tiktokChatStatusText');
  const origin = $('tiktokSecurityOrigin');
  const sessionText = $('tiktokSecuritySession');
  if (badge) {
    badge.textContent = status.ready ? 'LISTO' : status.loggedIn || status.sessionStored ? 'SESIÓN LOCAL' : status.requiresLogin ? 'INICIA SESIÓN' : status.open ? 'ABIERTO' : 'SIN SESIÓN';
    badge.classList.toggle('ready', Boolean(status.ready || status.loggedIn || status.sessionStored));
    badge.classList.toggle('warning', Boolean(!status.ready && status.open && !status.loggedIn));
  }
  if (text) text.textContent = status.message || (status.ready ? 'TikTok está listo para enviar mensajes.' : 'Abre el sitio oficial de TikTok e inicia sesión.');
  if (origin) {
    origin.textContent = status.displayOrigin || 'https://www.tiktok.com';
    origin.classList.toggle('untrusted', status.open && status.officialDomain === false);
  }
  if (sessionText) sessionText.textContent = status.sessionStored || status.loggedIn
    ? 'Hay una sesión guardada únicamente en el perfil local de esta computadora.'
    : 'No hay una sesión guardada. Tú decides cuándo vincularla.';
}

'''
renderer = replace_between(renderer, "function renderTikTokChatStatus(status = state.tiktokChatStatus || {})", "function autoChatSongTitle", account_status, "estado transparente de cuenta TikTok")

voice_selection = r'''function selectedVoiceValue() {
  if (state.settings.voiceMode === 'local') return `local:${state.settings.localVoiceId || 'lulu-es-mx'}`;
  if (state.settings.voiceMode === 'tiktok') return `tiktok:${state.settings.tiktokVoice || 'es_mx_002'}`;
  if (state.settings.voiceMode === 'online') return `online:${state.settings.onlineVoice || 'es-MX-DaliaNeural'}`;
  return `system:${state.settings.voiceURI || ''}`;
}

function parseVoiceValue(value) {
  const raw = String(value || '');
  if (raw.startsWith('local:')) return { mode:'local', localVoiceId:raw.slice(6), voiceURI:'', tiktokVoice:'', onlineVoice:'' };
  if (raw.startsWith('tiktok:')) return { mode:'tiktok', tiktokVoice:raw.slice(7), voiceURI:'', onlineVoice:'' };
  if (raw.startsWith('online:')) return { mode:'online', onlineVoice:raw.slice(7), voiceURI:'', tiktokVoice:'' };
  if (raw.startsWith('system:')) return { mode:'system', voiceURI:raw.slice(7), tiktokVoice:'', onlineVoice:'' };
  return null;
}

'''
renderer = replace_between(renderer, "function selectedVoiceValue()", "function normalizedUserVoiceRules()", voice_selection, "selección de voz")

voice_label = r'''function voiceLabel(value) {
  const parsed = parseVoiceValue(value);
  if (!parsed) return 'Voz predeterminada';
  if (parsed.mode === 'local') { const voice=state.localVoices.find((item)=>item.id===parsed.localVoiceId); return voice?`${voice.name} — ${voice.language} · local`:parsed.localVoiceId; }
  if (parsed.mode === 'tiktok') {
    const voice = state.tiktokVoices.find((item) => item.id === parsed.tiktokVoice);
    return voice ? `${voice.name} — TikTok · ${voice.locale}` : parsed.tiktokVoice;
  }
  if (parsed.mode === 'online') {
    const voice = state.onlineVoices.find((item) => item.shortName === parsed.onlineVoice);
    return voice ? `${voice.localName || voice.name || voice.shortName} — Microsoft · ${voice.locale}` : parsed.onlineVoice;
  }
  const voice = state.voices.find((item) => item.voiceURI === parsed.voiceURI);
  return voice ? `${voice.name} — ${voice.lang}` : (parsed.voiceURI || 'Voz de Windows');
}

'''
renderer = replace_between(renderer, "function voiceLabel(value)", "function voiceConfigFromRule(rule)", voice_label, "etiqueta de voz")

voice_render = r'''function onlineVoiceSearchText(voice) {
  return `${voice.localName} ${voice.name} ${voice.shortName} ${voice.locale} ${voiceLocaleLabel(voice.locale)} ${voice.gender} Microsoft`;
}

function tiktokVoiceSearchText(voice) {
  return `${voice.name} ${voice.id} ${voice.locale} ${voice.category} TikTok`;
}

function renderVoiceOptions() {
  const select = $('voiceSelect');
  if (!select || !state.settings) return;
  const filter = state.settings.voiceLanguageFilter || 'all';
  const search = normalizeText(state.voiceSearch || '');
  const selected = selectedVoiceValue();
  select.innerHTML = '';

  const tiktokMatches = state.tiktokVoices.filter((voice) => (languageMatches(voice.locale, filter) || `tiktok:${voice.id}` === selected) && (!search || normalizeText(tiktokVoiceSearchText(voice)).includes(search) || `tiktok:${voice.id}` === selected));
  const byCategory = new Map();
  for (const voice of tiktokMatches) {
    if (!byCategory.has(voice.category)) byCategory.set(voice.category, []);
    byCategory.get(voice.category).push(voice);
  }
  for (const [category, voices] of byCategory) {
    const group = document.createElement('optgroup');
    group.label = `TikTok · ${category} (${voices.length})`;
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = `tiktok:${voice.id}`;
      option.textContent = `${voice.name} — ${voice.locale}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }

  const onlineMatches = state.onlineVoices.filter((voice) => (languageMatches(voice.locale, filter) || `online:${voice.shortName}` === selected) && (!search || normalizeText(onlineVoiceSearchText(voice)).includes(search) || `online:${voice.shortName}` === selected));
  const onlineByLocale = new Map();
  for (const voice of onlineMatches) {
    if (!onlineByLocale.has(voice.locale)) onlineByLocale.set(voice.locale, []);
    onlineByLocale.get(voice.locale).push(voice);
  }
  for (const [locale, voices] of onlineByLocale) {
    const group = document.createElement('optgroup');
    group.label = `Microsoft online · ${voiceLocaleLabel(locale)} (${voices.length})`;
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = `online:${voice.shortName}`;
      const gender = voiceGenderLabel(voice.gender);
      option.textContent = `${voice.localName || voice.name || voice.shortName}${gender ? ` · ${gender}` : ''}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }

  const localMatches=state.localVoices.filter((voice)=>(voice.installed!==false||`local:${voice.id}`===selected)&&(languageMatches(voice.language,filter)||`local:${voice.id}`===selected)&&(!search||normalizeText(`${voice.name} ${voice.language} ${voice.author}`).includes(search)||`local:${voice.id}`===selected));
  if(localMatches.length){const group=document.createElement('optgroup');group.label=`Lulu Local · sin Internet (${localMatches.length})`;for(const voice of localMatches){const option=document.createElement('option');option.value=`local:${voice.id}`;option.textContent=`${voice.name} — ${voice.language}`;group.appendChild(option);}select.appendChild(group);}

  const systemMatches = state.voices.filter((voice) => (languageMatches(voice.lang, filter) || `system:${voice.voiceURI}` === selected) && (!search || normalizeText(`${voice.name} ${voice.lang}`).includes(search) || `system:${voice.voiceURI}` === selected));
  if (systemMatches.length) {
    const group = document.createElement('optgroup');
    group.label = `Voces instaladas de Windows (${systemMatches.length})`;
    for (const voice of systemMatches) {
      const option = document.createElement('option');
      option.value = `system:${voice.voiceURI}`;
      option.textContent = `${voice.name} — ${voice.lang}${voice.default ? ' · predeterminada' : ''}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }

  if (!select.options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No hay voces para este idioma';
    select.appendChild(option);
  }

  if ($('voiceVisibleCount')) $('voiceVisibleCount').textContent = `${tiktokMatches.length+onlineMatches.length+localMatches.length+systemMatches.length} visibles de ${state.tiktokVoices.length+state.onlineVoices.length+state.localVoices.length+state.voices.length} voces`;
  renderCustomVoiceOptions();
  renderUserVoiceRules();

  if ([...select.options].some((option) => option.value === selected)) {
    select.value = selected;
  } else {
    const preferredTikTok = tiktokMatches.find((voice) => voice.id === 'es_mx_002') || tiktokMatches[0];
    const preferredOnline = onlineMatches.find((voice) => voice.locale.toLowerCase().startsWith('es-mx')) || onlineMatches[0];
    const preferredLocal=localMatches.find((voice)=>voice.language.toLowerCase().startsWith('es-mx'))||localMatches[0];
    const preferredSystem = systemMatches.find((voice) => /^es(-|_)/i.test(voice.lang)) || systemMatches[0];
    if(preferredLocal){select.value=`local:${preferredLocal.id}`;state.settings.voiceMode='local';state.settings.localVoiceId=preferredLocal.id;}
    else if (preferredOnline) { select.value=`online:${preferredOnline.shortName}`; state.settings.voiceMode='online'; state.settings.onlineVoice=preferredOnline.shortName; }
    else if (preferredTikTok) { select.value=`tiktok:${preferredTikTok.id}`; state.settings.voiceMode='tiktok'; state.settings.tiktokVoice=preferredTikTok.id; }
    else if (preferredSystem) { select.value=`system:${preferredSystem.voiceURI}`;state.settings.voiceMode='system';state.settings.voiceURI=preferredSystem.voiceURI; }
  }
}

'''
renderer = replace_between(renderer, "function onlineVoiceSearchText(voice)", "function loadSystemVoices()", voice_render, "catálogo visual TikTok")

local_render = r'''function renderLocalVoices(){
  const list=$('localVoiceList');if(!list)return;const selected=state.settings?.localVoiceId||'lulu-es-mx';
  $('localVoiceStatus').textContent=state.localVoices.length?`${state.localVoices.length} voz${state.localVoices.length===1?'':'es'} local${state.localVoices.length===1?'':'es'} disponible${state.localVoices.length===1?'':'s'}.`:'No se encontró una voz local completa. Importa un paquete .lfvoice.';
  list.innerHTML=state.localVoices.length?state.localVoices.map((voice)=>`<div class="local-voice-card ${voice.id===selected&&state.settings.voiceMode==='local'?'active':''}"><div class="local-voice-copy"><strong>${escapeHtml(voice.name)}</strong><small>${escapeHtml(voice.language)} · ${escapeHtml(voice.author||'Voz local')}${voice.bundled?' · incluida':' · importada'}</small>${voice.description?`<span>${escapeHtml(voice.description)}</span>`:''}</div><div class="local-voice-actions"><button class="secondary select-local-voice" data-id="${escapeHtml(voice.id)}">Usar</button><button class="ghost test-local-voice" data-id="${escapeHtml(voice.id)}">Probar</button>${voice.removable?`<button class="danger-outline remove-local-voice" data-id="${escapeHtml(voice.id)}">Eliminar</button>`:''}</div></div>`).join(''):'<div class="local-voice-card"><div class="local-voice-copy"><strong>Biblioteca vacía</strong><small>Importa una voz .lfvoice para comenzar.</small></div></div>';
  qsa('.select-local-voice').forEach((button)=>button.addEventListener('click',()=>{state.settings.voiceMode='local';state.settings.localVoiceId=button.dataset.id;renderVoiceOptions();renderLocalVoices();scheduleSave();}));
  qsa('.test-local-voice').forEach((button)=>button.addEventListener('click',()=>speakText($('voiceTestInput')?.value.trim()||'Hola, esta es una prueba de Lulu Local.',false,null,{mode:'local',localVoiceId:button.dataset.id},{lockKey:`test-local:${button.dataset.id}`,label:'Prueba Lulu Local'})));
  qsa('.remove-local-voice').forEach((button)=>button.addEventListener('click',async()=>{if(!confirm('¿Eliminar esta voz importada del equipo?'))return;try{await api.removeLocalVoice(button.dataset.id);await loadLocalVoices();toast('Voz eliminada','','success');}catch(error){toast('No se pudo eliminar',error.message||String(error),'error');}}));
}
'''
renderer = replace_between(renderer, "function renderLocalVoices(){", "async function loadLocalVoices", local_render, "biblioteca local sin clonación")

tiktok_load = r'''async function loadOnlineVoices(showToast = false) {
  if (state.voiceLoading) return;
  state.voiceLoading = true;
  const status = $('voiceProviderStatus');
  status.className = 'voice-provider-status loading';
  status.innerHTML = '<span class="status-light connecting"></span><span>Cargando voces de Microsoft y TikTok…</span>';
  try {
    const [onlineResult, tiktokResult] = await Promise.allSettled([
      api.listOnlineVoices({ refresh: showToast }),
      api.listTikTokVoices()
    ]);
    const online = onlineResult.status === 'fulfilled' ? onlineResult.value : null;
    const tiktok = tiktokResult.status === 'fulfilled' ? tiktokResult.value : null;
    state.onlineVoices = Array.isArray(online?.voices) ? online.voices : [];
    state.onlineVoicesFallback = Boolean(online?.fallback);
    state.tiktokVoices = Array.isArray(tiktok?.voices) ? tiktok.voices : [];
    const total = state.onlineVoices.length + state.tiktokVoices.length;
    status.className = `voice-provider-status ${total ? 'ready' : 'error'}`;
    status.innerHTML = total
      ? `<span class="status-light connected"></span><span>${state.onlineVoices.length} voces Microsoft online y ${state.tiktokVoices.length} voces TikTok. TikTok solo usa la sesión local cuando eliges una de sus voces.</span>`
      : '<span class="status-light error"></span><span>No se pudieron cargar los catálogos online. Lulu Local y las voces de Windows siguen disponibles.</span>';
    renderVoiceOptions();
    if (showToast) toast('Voces actualizadas', `${state.onlineVoices.length} Microsoft y ${state.tiktokVoices.length} TikTok.`, total ? 'success' : 'error');
  } catch (error) {
    state.onlineVoices = [];
    state.tiktokVoices = [];
    status.className = 'voice-provider-status error';
    status.innerHTML = '<span class="status-light error"></span><span>No se pudieron cargar los catálogos online. Usa Lulu Local o una voz de Windows.</span>';
    renderVoiceOptions();
    if (showToast) toast('No se cargaron voces online', error.message || String(error), 'error');
  } finally {
    state.voiceLoading = false;
  }
}

async function refreshVoices(showToast = false) {
  await loadLocalVoices(false);
  loadSystemVoices();
  await loadOnlineVoices(showToast);
}

'''
renderer = replace_between(renderer, "async function loadOnlineVoices", "function scheduleSave()", tiktok_load, "carga de voces TikTok")
renderer = replace_once(
    renderer,
    "if(parsed.mode==='local')state.settings.localVoiceId=parsed.localVoiceId;else if(parsed.mode==='online')state.settings.onlineVoice=parsed.onlineVoice;else state.settings.voiceURI=parsed.voiceURI;renderLocalVoices();",
    "if(parsed.mode==='local')state.settings.localVoiceId=parsed.localVoiceId;else if(parsed.mode==='tiktok')state.settings.tiktokVoice=parsed.tiktokVoice;else if(parsed.mode==='online')state.settings.onlineVoice=parsed.onlineVoice;else state.settings.voiceURI=parsed.voiceURI;renderLocalVoices();",
    "guardado de selección TikTok",
)
renderer = replace_once(
    renderer,
    "        const result = await api.synthesizeOnlineVoice({\n          text,\n          voice: voiceConfig?.onlineVoice || state.settings.onlineVoice,\n          rate: tuning.rate,\n          pitch: tuning.pitch\n        });",
    "        const result = voiceMode === 'tiktok'\n          ? await api.synthesizeTikTokVoice({ text, voice: voiceConfig?.tiktokVoice || state.settings.tiktokVoice || 'es_mx_002' })\n          : await api.synthesizeOnlineVoice({ text, voice: voiceConfig?.onlineVoice || state.settings.onlineVoice, rate: tuning.rate, pitch: tuning.pitch });",
    "síntesis Microsoft y TikTok",
)
renderer = replace_once(
    renderer,
    "        audio.volume = tuning.volume;\n        state.onlineAudio = audio;",
    "        audio.volume = tuning.volume;\n        if (voiceMode === 'tiktok') { audio.playbackRate = Math.max(0.5, Math.min(2, Number(tuning.rate) || 1)); audio.preservesPitch = false; }\n        state.onlineAudio = audio;",
    "velocidad del audio TikTok",
)
renderer = replace_once(
    renderer,
    "        toast('Voz online no disponible', 'Se usó una voz de Windows para este audio.', 'error');",
    "        toast(voiceMode === 'tiktok' ? 'Voz de TikTok no disponible' : 'Voz Microsoft no disponible', error.message || 'Se usó una voz de Windows para este audio.', 'error');",
    "error Microsoft y TikTok",
)
renderer = replace_once(
    renderer,
    "  setupAudioActivityIndicators();",
    "  let migratedTikTokVoices=false;\n  if(state.settings.localVoiceId==='lulu-official'){state.settings.voiceMode='online';state.settings.onlineVoice=state.settings.onlineVoice||'es-MX-DaliaNeural';migratedTikTokVoices=true;}\n  if(!state.settings.tiktokVoice)state.settings.tiktokVoice='es_mx_002';\n  if(!state.settings.onlineVoice)state.settings.onlineVoice='es-MX-DaliaNeural';\n  state.settings.userVoiceRules=(Array.isArray(state.settings.userVoiceRules)?state.settings.userVoiceRules:[]).map((rule)=>rule?.voice==='local:lulu-official'?{...rule,voice:`online:${state.settings.onlineVoice}`}:rule);\n  setupAudioActivityIndicators();",
    "migración a voces TikTok",
)
renderer = replace_once(
    renderer,
    "if (migratedV100||migratedDefaultCommands || migratedVoiceCatalog || !state.settings.rankingsMigratedV016 || !state.settings.streamWidgetsMigratedV019)",
    "if (migratedV100||migratedTikTokVoices||migratedDefaultCommands || migratedVoiceCatalog || !state.settings.rankingsMigratedV016 || !state.settings.streamWidgetsMigratedV019)",
    "persistencia de migración TikTok",
)

renderer = replace_once(
    renderer,
    "  $('resetTikTokChatBtn')?.addEventListener('click', async () => {\n    if (!window.confirm('¿Eliminar la sesión local de TikTok guardada en Lulu Finity?')) return;\n    renderTikTokChatStatus(await api.resetTikTokChatSession());\n  });",
    "  const resetTikTokSessionFromUi = async () => {\n    if (!window.confirm('¿Desvincular TikTok y borrar de esta PC todas las cookies, caché y datos locales de esa sesión?')) return;\n    renderTikTokChatStatus(await api.resetTikTokChatSession());\n    toast('Sesión de TikTok eliminada', 'Lulu Finity ya no conserva datos de esa sesión en esta PC.', 'success');\n  };\n  $('resetTikTokChatBtn')?.addEventListener('click', resetTikTokSessionFromUi);\n  $('privacyResetTikTokBtn')?.addEventListener('click', resetTikTokSessionFromUi);",
    "borrado explícito de sesión TikTok",
)

renderer = replace_once(
    renderer,
    "  activePage: 'dashboard', loadedPages: new Set(['dashboard']), runtimeTimer: null, audioActivityTimer: null",
    "  activePage:'dashboard', loadedPages:new Set(['dashboard']), runtimeTimer:null, audioActivityTimer:null, systemVoicesBound:false, economyLoaded:false",
    "estado de carga diferida",
)
renderer = replace_once(
    renderer,
    "async function handleAutomationEvent(event) {\n  if (!event?.type || !state.settings) return;",
    "async function handleAutomationEvent(event) {\n  if (!event?.type || !state.settings || !state.loadedPages.has('automations')) return;",
    "automatizaciones dormidas hasta abrir su módulo",
)
renderer = replace_once(
    renderer,
    "function scheduleAudioActivityIndicators(){clearInterval(state.audioActivityTimer);state.audioActivityTimer=null;if(document.hidden||!['dashboard','voice','songs','spotify','commands'].includes(state.activePage))return;renderAudioActivityIndicators();state.audioActivityTimer=setInterval(renderAudioActivityIndicators,350);}",
    "function hasActiveAudioActivity(){const provider=state.settings?.musicProvider==='spotify'?'spotify':'youtube';const current=provider==='spotify'?state.currentSpotify:state.currentSong;const player=provider==='spotify'?state.spotifyPlayer:state.player;return Boolean(state.speaking||state.audioBusy||(current&&player&&!player.paused));}\nfunction scheduleAudioActivityIndicators(){clearInterval(state.audioActivityTimer);state.audioActivityTimer=null;if(document.hidden||!['dashboard','voice','songs','spotify','commands'].includes(state.activePage))return;renderAudioActivityIndicators();if(!hasActiveAudioActivity())return;state.audioActivityTimer=setInterval(renderAudioActivityIndicators,750);}",
    "indicadores sin sondeo en reposo",
)
renderer = replace_once(
    renderer,
    "function activatePageModules(page){if(page==='voice'&&!state.loadedPages.has(page)){void loadLocalVoices();void loadOnlineVoices(false);}if(page==='rankings'&&!state.loadedPages.has(page)){void refreshOverlayInfo(state.overlay?.screen||1);state.ranking.slot=clamp(state.ranking?.slot||1,1,4);setRankingControlValues();void refreshRankingInfo(state.ranking.slot,true);}if(page==='automations'&&!state.loadedPages.has(page)){for(const type of ['alert','goal','gift'])void refreshStreamWidgetInfo(type,true);}if(page==='settings'&&!state.loadedPages.has(page))void refreshRelayUsage();if(page==='account'&&!state.loadedPages.has(page))void api.getTikTokChatStatus().then(renderTikTokChatStatus).catch(()=>{});state.loadedPages.add(page);}",
    "function activatePageModules(page){const first=!state.loadedPages.has(page);state.loadedPages.add(page);if(page==='voice'&&first){loadSystemVoices();if(!state.systemVoicesBound){window.speechSynthesis.onvoiceschanged=loadSystemVoices;state.systemVoicesBound=true;}void loadLocalVoices();void loadOnlineVoices(false);}if(page==='rankings'&&first){void refreshOverlayInfo(state.overlay?.screen||1);state.ranking.slot=clamp(state.ranking?.slot||1,1,4);setRankingControlValues();void refreshRankingInfo(state.ranking.slot,true);}if(page==='automations'&&first){publishAutomationWidgets();for(const type of ['alert','goal','gift'])void refreshStreamWidgetInfo(type,true);}if(page==='economy'&&first){state.economyLoaded=true;void refreshEconomy();}if(page==='settings'&&first)void refreshRelayUsage();if(page==='account'&&first)void api.getTikTokChatStatus().then(renderTikTokChatStatus).catch(()=>{});}",
    "carga de módulos por primera apertura",
)
renderer = replace_once(
    renderer,
    "  loadSystemVoices();\n  await loadLocalVoices(false);\n  window.speechSynthesis.onvoiceschanged = loadSystemVoices;",
    "  // Los catálogos TTS y las voces de Windows se cargan al abrir Voz.",
    "TTS fuera del arranque",
)
renderer = replace_once(
    renderer,
    "  renderAutomationStudio();\n  publishAutomationWidgets();\n  renderDashboardMusic();",
    "  renderAutomationStudio();\n  renderDashboardMusic();",
    "automatizaciones fuera del arranque",
)
renderer = replace_once(
    renderer,
    "  api.setYouTubeVolume(state.settings.youtubeVolume ?? 0.8).catch(() => {});\n  api.setSpotifyVolume(state.settings.spotifyVolume ?? 0.8).catch(() => {});\n  void api.setActivePage('dashboard');",
    "  // Ningún proveedor musical se crea hasta reproducir o mostrarlo.\n  void api.setActivePage('dashboard');",
    "proveedores musicales fuera del arranque",
)
renderer = replace_once(
    renderer,
    "  $('songQueueStat').textContent = `${activeMusicProvider() === 'spotify' ? state.spotifyQueue.length : state.songQueue.length} en cola`;\n  renderStudioDashboard();\n}",
    "  $('songQueueStat').textContent = `${activeMusicProvider() === 'spotify' ? state.spotifyQueue.length : state.songQueue.length} en cola`;\n  renderStudioDashboard();\n  scheduleAudioActivityIndicators();\n}",
    "indicadores guiados por cambios",
)
renderer_path.write_text(renderer, encoding="utf-8")

styles_path = ROOT / "src/styles.css"
styles = styles_path.read_text(encoding="utf-8")
marker = "/* Lulu Finity 1.0.2 — ventanas ajustables y desplazamiento vertical */"
if marker in styles:
    raise SystemExit("El arreglo de desplazamiento ya estaba aplicado")
styles += """

/* Lulu Finity 1.0.2 — ventanas ajustables y desplazamiento vertical */
html,body{min-width:0;min-height:0}
.app-shell{height:100vh;height:100dvh;min-width:0;min-height:0;grid-template-rows:40px minmax(0,1fr);overflow:hidden}
.sidebar{min-width:0;min-height:0}
.nav-list{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}
.main-content{grid-column:2;grid-row:2;min-width:0;min-height:0;height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;scrollbar-gutter:stable}
.modal-backdrop{overflow-y:auto;padding:20px;overscroll-behavior:contain}
.modal-card{max-height:calc(100vh - 40px);max-height:calc(100dvh - 40px);overflow-y:auto;margin:auto;overscroll-behavior:contain}
.feature-search-results{max-height:min(340px,calc(100dvh - 140px))}
.secure-account-card{overflow:hidden}.official-domain-banner{display:flex;align-items:center;gap:12px;margin:14px 0;padding:14px 16px;border:1px solid rgba(81,231,146,.3);border-radius:12px;background:linear-gradient(100deg,rgba(42,122,83,.2),rgba(255,255,255,.025))}.domain-lock{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(81,231,146,.14)}.official-domain-banner div{min-width:0;flex:1}.official-domain-banner strong,.official-domain-banner small{display:block}.official-domain-banner strong{color:#9df2bd;word-break:break-all}.official-domain-banner strong.untrusted{color:#ff9bb0}.official-domain-banner small{margin-top:4px;color:var(--muted);font-size:10px}.verified-pill{padding:5px 8px;border-radius:999px;background:rgba(81,231,146,.13);color:#8aefb2;font-size:9px;font-weight:800;letter-spacing:.5px}.tiktok-trust-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}.trust-item{display:flex;gap:10px;padding:13px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.trust-item>span{width:24px;height:24px;flex:none;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#ff82b8,#a97cff);font-size:11px;font-weight:800}.trust-item strong,.trust-item small{display:block}.trust-item strong{font-size:12px}.trust-item small{margin-top:5px;color:var(--muted);font-size:10px;line-height:1.45}.account-independence-note{margin:14px 0 0;padding:11px 13px;border-left:3px solid var(--purple);border-radius:0 9px 9px 0;background:rgba(169,124,255,.08);color:#ddd0e5;font-size:11px;line-height:1.55}.account-privacy-card{gap:0}.privacy-intro{display:flex;align-items:center;gap:13px;margin-bottom:15px}.privacy-intro h3,.privacy-intro p{margin:0}.privacy-intro p{margin-top:5px;color:var(--muted);font-size:11px;line-height:1.55}.privacy-shield{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:13px;background:linear-gradient(135deg,rgba(255,130,184,.18),rgba(169,124,255,.18));font-size:19px}.privacy-section-label{display:block;margin-bottom:7px;color:#d8b4ff;font-size:9px;font-weight:900;letter-spacing:.9px}.privacy-server-explainer,.privacy-direct-connections,.privacy-local-session{margin-top:12px;padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}.privacy-server-explainer{border-color:rgba(81,231,146,.23);background:linear-gradient(120deg,rgba(42,122,83,.13),rgba(255,255,255,.025))}.account-privacy-card h4{margin:0;color:#fff;font-size:14px}.account-privacy-card section>p{margin:8px 0 0;color:var(--muted);font-size:11px;line-height:1.65}.account-privacy-card section>p strong{color:#e8dff0}.websocket-flow{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:14px;padding:11px;border-radius:10px;background:rgba(7,10,17,.28);font-size:10px}.websocket-flow span{padding:7px 9px;border:1px solid rgba(81,231,146,.2);border-radius:8px;color:#a5f4c1;font-weight:800}.websocket-flow i{color:var(--muted);font-style:normal}.privacy-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.privacy-detail-card{padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}.privacy-detail-card.safe{border-color:rgba(81,231,146,.17)}.privacy-detail-card.blocked{border-color:rgba(255,109,140,.17)}.privacy-detail-card ul{margin:10px 0 0;padding-left:18px;color:var(--muted);font-size:10px;line-height:1.65}.privacy-detail-card li+li{margin-top:5px}.privacy-detail-card p{margin:10px 0 0;color:#cfc4d5;font-size:10px;line-height:1.6}.privacy-detail-card code{padding:1px 4px;border-radius:4px;background:rgba(255,255,255,.07);color:#ffc4dc}.privacy-connection-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:11px}.privacy-connection-list>div{padding:12px;border:1px solid rgba(255,255,255,.06);border-radius:10px;background:rgba(0,0,0,.1)}.privacy-connection-list strong,.privacy-connection-list span{display:block}.privacy-connection-list strong{font-size:11px;color:#ffb3d3}.privacy-connection-list span{margin-top:5px;color:var(--muted);font-size:10px;line-height:1.5}.privacy-delete-box{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px;padding:14px;border:1px solid rgba(255,109,140,.2);border-radius:11px;background:rgba(255,82,116,.045)}.privacy-delete-box strong,.privacy-delete-box span{display:block}.privacy-delete-box span{margin-top:5px;color:var(--muted);font-size:10px;line-height:1.45}.privacy-delete-box button{flex:none}
@media(max-width:980px){.tiktok-trust-grid,.privacy-detail-grid,.privacy-connection-list{grid-template-columns:1fr}.official-domain-banner{align-items:flex-start;flex-wrap:wrap}.verified-pill{margin-left:46px}.privacy-delete-box{align-items:stretch;flex-direction:column}.websocket-flow{align-items:stretch;flex-direction:column;text-align:center}}
@media(max-height:720px){.main-content{padding-top:16px;padding-bottom:24px}.sidebar{padding-top:12px;padding-bottom:10px}.logo-wrap{padding-bottom:9px}.feature-search{margin-bottom:8px}.nav-list{gap:8px}.sidebar-bottom{margin-top:5px}}
"""
styles_path.write_text(styles, encoding="utf-8")

notice_path = ROOT / "NOTICE.md"
if notice_path.exists():
    notice = notice_path.read_text(encoding="utf-8")
    notice = re.sub(r"\n## OpenVoice V2\n.*?(?=\n## |\Z)", "\n", notice, flags=re.S)
    if "## Voces de TikTok" not in notice:
        notice += "\n## Voces de TikTok\n\nLas voces TikTok usan una interfaz interna no documentada por TikTok y pueden cambiar sin aviso. Lulu Finity toma la sesión únicamente del perfil local enlazado en Cuenta, la envía solo a dominios fijos de TikTok para generar el audio y nunca la expone al renderer, al relay ni a archivos de registro. La contraseña se introduce directamente en el sitio oficial y no se guarda en los ajustes de Lulu.\n"
    notice_path.write_text(notice.rstrip() + "\n", encoding="utf-8")

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8") if changelog_path.exists() else "# Cambios\n\n"
entry = """# Cambios

## 1.0.2

- Retira por completo la Voz Oficial y el motor descargable OpenVoice que no funcionaba correctamente.
- Conserva las voces online de Microsoft/Edge, las voces instaladas de Windows y Lulu Local.
- Añade más de 70 voces auténticas de TikTok, incluidas Warm, Jessie, Story Teller, Wacky, Ghost Face, C3PO, Stitch y Stormtrooper.
- Rediseña Cuenta con dominio oficial visible, una explicación extensa del relay WebSocket, datos transmitidos, sesión local, permisos bloqueados y borrado completo con un botón.
- Usa de forma local la sesión enlazada en Cuenta para solicitar audio directamente a TikTok; la cookie nunca se muestra ni se envía al relay.
- Las voces Microsoft, Windows y Lulu Local funcionan sin vincular una cuenta de TikTok.
- Permite desplazarse verticalmente por todas las funciones cuando la ventana no está maximizada.
- Añade carga bajo demanda: al iniciar no abre YouTube/Spotify, TTS, rankings, overlays, juegos, economía ni automatizaciones; en Música solo permanece el proveedor elegido.
- Libera el buscador temporal de YouTube después de resolver una canción y cierra el proveedor musical inactivo al cambiar de servicio.

"""
if "## 1.0.2" not in changelog:
    changelog = entry + (changelog[len("# Cambios\n\n"):] if changelog.startswith("# Cambios\n\n") else changelog)
changelog_path.write_text(changelog, encoding="utf-8")

print("Lulu Finity 1.0.2: módulos bajo demanda, Microsoft/TikTok y scroll adaptable")
