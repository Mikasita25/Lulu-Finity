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
package["description"] = "Lulu Finity 1.0: estudio para TikTok LIVE con voces TikTok, TTS local, música, comandos y overlays"
package.get("dependencies", {}).pop("edge-tts-universal", None)
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = json.loads(lock_path.read_text(encoding="utf-8"))
lock["version"] = "1.0.2"
lock_packages = lock.get("packages", {})
if isinstance(lock_packages.get(""), dict):
    lock_packages[""]["version"] = "1.0.2"
    lock_packages[""].get("dependencies", {}).pop("edge-tts-universal", None)
for key in (
    "node_modules/cross-fetch",
    "node_modules/edge-tts-universal",
    "node_modules/edge-tts-universal/node_modules/ws",
    "node_modules/isomorphic-ws",
    "node_modules/node-fetch",
    "node_modules/tr46",
    "node_modules/uuid",
    "node_modules/webidl-conversions",
    "node_modules/whatwg-url",
    "node_modules/xml-escape",
):
    lock_packages.pop(key, None)
for key in ("node_modules/agent-base", "node_modules/https-proxy-agent"):
    if isinstance(lock_packages.get(key), dict):
        lock_packages[key]["dev"] = True
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for relative in (
    "src/clone-runtime-manager.js",
    "src/clone-runtime-manager.test.js",
    "src/online-voice-catalog.js",
    "src/online-voice-catalog.test.js",
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
    "const { FALLBACK_ONLINE_VOICES, prepareOnlineVoices } = require('./online-voice-catalog');",
    "const { TIKTOK_VOICES, isTikTokVoiceId } = require('./tiktok-voice-catalog');\nconst { requestTikTokSpeech } = require('./tiktok-tts-client');",
    "catálogo importado en main",
)
main = replace_once(main, "let edgeTtsModulePromise = null;\n", "", "promesa de Edge TTS")
main = replace_once(main, "  voiceMode: 'local',", "  voiceMode: 'tiktok',", "voz predeterminada")
main = replace_once(main, "  onlineVoice: 'es-MX-DaliaNeural',", "  tiktokVoice: 'es_mx_002',", "código de voz predeterminado")

tiktok_main = r'''const TIKTOK_TTS_COOKIE_NAMES = new Set(['sessionid', 'sessionid_ss', 'sid_tt', 'passport_csrf_token']);

function normalizeVoiceSettings(settings = {}) {
  const next = { ...settings };
  const retired = next.voiceMode === 'online' || next.localVoiceId === 'lulu-official';
  if (retired || !['tiktok', 'local', 'system'].includes(next.voiceMode)) next.voiceMode = 'tiktok';
  if (!isTikTokVoiceId(next.tiktokVoice)) next.tiktokVoice = 'es_mx_002';
  next.userVoiceRules = (Array.isArray(next.userVoiceRules) ? next.userVoiceRules : []).map((rule) => {
    const voice = String(rule?.voice || '');
    if (voice.startsWith('online:') || voice === 'local:lulu-official') return { ...rule, voice: `tiktok:${next.tiktokVoice}` };
    return rule;
  });
  delete next.onlineVoice;
  return next;
}

async function removeRetiredVoiceEngine() {
  const retiredRoot = path.join(app.getPath('userData'), 'lulu-local-engines', 'lulu-official');
  await fsp.rm(retiredRoot, { recursive: true, force: true }).catch(() => {});
  await fsp.rm(path.join(app.getPath('userData'), 'online-voice-catalog-v1.json'), { force: true }).catch(() => {});
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
main = replace_between(main, "async function getEdgeTtsModule()", "function cleanUsername", tiktok_main, "motor TikTok")
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
    "ipcMain.handle('tts:list-tiktok-voices', () => listTikTokVoices());\nipcMain.handle('tts:synthesize-tiktok', async (_event, request) => synthesizeTikTokVoice(request));",
    "IPC TikTok TTS",
)
main_path.write_text(main, encoding="utf-8")

preload_path = ROOT / "src/preload.js"
preload = preload_path.read_text(encoding="utf-8")
preload = replace_once(
    preload,
    "  listOnlineVoices: (options = {}) => ipcRenderer.invoke('tts:list-online-voices', options),\n  synthesizeOnlineVoice: (request) => ipcRenderer.invoke('tts:synthesize-online', request),",
    "  listTikTokVoices: () => ipcRenderer.invoke('tts:list-tiktok-voices'),\n  synthesizeTikTokVoice: (request) => ipcRenderer.invoke('tts:synthesize-tiktok', request),",
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
    '<div class="page-heading simple"><div><h1>TTS y voces</h1><p>Voces reales de TikTok, voz local, reglas y permisos en un solo lugar.</p></div></div>',
    "descripción TTS",
)
html = replace_once(
    html,
    '<div class="voice-provider-status" id="voiceProviderStatus"><span class="status-light connecting"></span><span>Cargando catálogo gratuito completo…</span></div>',
    '<div class="voice-provider-status" id="voiceProviderStatus"><span class="status-light connecting"></span><span>Cargando voces de TikTok…</span></div>',
    "estado del proveedor",
)
html = replace_once(
    html,
    '<div class="tts-section-pane" data-tts-pane="local"><div class="local-voice-layout"><article class="panel settings-card wide"><div class="panel-header"><div><h3>Biblioteca Lulu Local</h3><p class="hint">Funciona sin Internet. El motor se libera cuando deja de usarse.</p></div><button class="primary" id="localVoiceImportBtn">Importar .lfvoice</button></div><div class="local-voice-status" id="localVoiceStatus">Buscando voces instaladas…</div><div class="local-voice-list" id="localVoiceList"></div></article><article class="panel settings-card"><h3>Paquetes de voz</h3><p>La <strong>Voz Oficial De Lulu Finity</strong> usa clonación local y descarga su motor sólo al instalarla.</p><p>Un archivo <strong>.lfvoice</strong> contiene un modelo VITS/Piper, sus tokens y datos de pronunciación.</p><p class="hint">Las voces importadas se validan y se guardan sólo en tu equipo.</p></article></div></div>',
    '<div class="tts-section-pane" data-tts-pane="local"><div class="local-voice-layout"><article class="panel settings-card wide"><div class="panel-header"><div><h3>Biblioteca Lulu Local</h3><p class="hint">Voces Piper sencillas que funcionan sin Internet y sin descargar el motor retirado.</p></div><button class="primary" id="localVoiceImportBtn">Importar .lfvoice</button></div><div class="local-voice-status" id="localVoiceStatus">Buscando voces instaladas…</div><div class="local-voice-list" id="localVoiceList"></div></article><article class="panel settings-card"><h3>Paquetes de voz</h3><p>Un archivo <strong>.lfvoice</strong> contiene un modelo VITS/Piper, sus tokens y datos de pronunciación.</p><p class="hint">Las voces importadas se validan y se guardan sólo en tu equipo.</p></article></div></div>',
    "biblioteca sin OpenVoice",
)
html_path.write_text(html, encoding="utf-8")

renderer_path = ROOT / "src/renderer.js"
renderer = renderer_path.read_text(encoding="utf-8")
renderer = replace_once(
    renderer,
    "  onlineVoices: [],\n  onlineVoicesFallback: false,",
    "  tiktokVoices: [],",
    "estado de voces TikTok",
)

voice_selection = r'''function selectedVoiceValue() {
  if (state.settings.voiceMode === 'local') return `local:${state.settings.localVoiceId || 'lulu-es-mx'}`;
  if (state.settings.voiceMode === 'tiktok') return `tiktok:${state.settings.tiktokVoice || 'es_mx_002'}`;
  return `system:${state.settings.voiceURI || ''}`;
}

function parseVoiceValue(value) {
  const raw = String(value || '');
  if (raw.startsWith('local:')) return { mode:'local', localVoiceId:raw.slice(6), voiceURI:'', tiktokVoice:'' };
  if (raw.startsWith('tiktok:')) return { mode:'tiktok', tiktokVoice:raw.slice(7), voiceURI:'' };
  if (raw.startsWith('system:')) return { mode:'system', voiceURI:raw.slice(7), tiktokVoice:'' };
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
  const voice = state.voices.find((item) => item.voiceURI === parsed.voiceURI);
  return voice ? `${voice.name} — ${voice.lang}` : (parsed.voiceURI || 'Voz de Windows');
}

'''
renderer = replace_between(renderer, "function voiceLabel(value)", "function voiceConfigFromRule(rule)", voice_label, "etiqueta de voz")

voice_render = r'''function tiktokVoiceSearchText(voice) {
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

  const localMatches=state.localVoices.filter((voice)=>(voice.installed!==false||`local:${voice.id}`===selected)&&(languageMatches(voice.language,filter)||`local:${voice.id}`===selected)&&(!search||normalizeText(`${voice.name} ${voice.language} ${voice.author}`).includes(search)||`local:${voice.id}`===selected));
  if(localMatches.length){const group=document.createElement('optgroup');group.label=`Lulu Local · sin Internet (${localMatches.length})`;for(const voice of localMatches){const option=document.createElement('option');option.value=`local:${voice.id}`;option.textContent=`${voice.name} — ${voice.language}`;group.appendChild(option);}select.appendChild(group);}

  const systemMatches = state.voices.filter((voice) => (languageMatches(voice.lang, filter) || `system:${voice.voiceURI}` === selected) && (!search || normalizeText(`${voice.name} ${voice.lang}`).includes(search) || `system:${voice.voiceURI}` === selected));
  if (systemMatches.length) {
    const group = document.createElement('optgroup');
    group.label = `Respaldo de Windows (${systemMatches.length})`;
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

  if ($('voiceVisibleCount')) $('voiceVisibleCount').textContent = `${tiktokMatches.length+localMatches.length+systemMatches.length} visibles de ${state.tiktokVoices.length+state.localVoices.length+state.voices.length} voces`;
  renderCustomVoiceOptions();
  renderUserVoiceRules();

  if ([...select.options].some((option) => option.value === selected)) {
    select.value = selected;
  } else {
    const preferredTikTok = tiktokMatches.find((voice) => voice.id === 'es_mx_002') || tiktokMatches[0];
    const preferredLocal=localMatches.find((voice)=>voice.language.toLowerCase().startsWith('es-mx'))||localMatches[0];
    const preferredSystem = systemMatches.find((voice) => /^es(-|_)/i.test(voice.lang)) || systemMatches[0];
    if (preferredTikTok) { select.value=`tiktok:${preferredTikTok.id}`; state.settings.voiceMode='tiktok'; state.settings.tiktokVoice=preferredTikTok.id; }
    else if(preferredLocal){select.value=`local:${preferredLocal.id}`;state.settings.voiceMode='local';state.settings.localVoiceId=preferredLocal.id;}
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

tiktok_load = r'''async function loadTikTokVoices(showToast = false) {
  if (state.voiceLoading) return;
  state.voiceLoading = true;
  const status = $('voiceProviderStatus');
  status.className = 'voice-provider-status loading';
  status.innerHTML = '<span class="status-light connecting"></span><span>Cargando voces de TikTok…</span>';
  try {
    const result = await api.listTikTokVoices();
    state.tiktokVoices = Array.isArray(result?.voices) ? result.voices : [];
    status.className = `voice-provider-status ${state.tiktokVoices.length ? 'ready' : 'error'}`;
    status.innerHTML = state.tiktokVoices.length
      ? `<span class="status-light connected"></span><span>${state.tiktokVoices.length} voces reales de TikTok. Usan la sesión enlazada en Cuenta y no se envían al relay.</span>`
      : '<span class="status-light error"></span><span>No se encontró el catálogo de TikTok. Las voces de Windows siguen como respaldo.</span>';
    renderVoiceOptions();
    if (showToast) toast('Voces TikTok cargadas', `${state.tiktokVoices.length} voces disponibles.`, 'success');
  } catch (error) {
    state.tiktokVoices = [];
    status.className = 'voice-provider-status error';
    status.innerHTML = '<span class="status-light error"></span><span>No se pudieron cargar las voces de TikTok. Usa una voz instalada en Windows.</span>';
    renderVoiceOptions();
    if (showToast) toast('No se cargaron voces TikTok', error.message || String(error), 'error');
  } finally {
    state.voiceLoading = false;
  }
}

async function refreshVoices(showToast = false) {
  await loadLocalVoices(false);
  loadSystemVoices();
  await loadTikTokVoices(showToast);
}

'''
renderer = replace_between(renderer, "async function loadOnlineVoices", "function scheduleSave()", tiktok_load, "carga de voces TikTok")
renderer = replace_once(renderer, "void loadOnlineVoices(false)", "void loadTikTokVoices(false)", "carga diferida TikTok")
renderer = replace_once(
    renderer,
    "if(parsed.mode==='local')state.settings.localVoiceId=parsed.localVoiceId;else if(parsed.mode==='online')state.settings.onlineVoice=parsed.onlineVoice;else state.settings.voiceURI=parsed.voiceURI;renderLocalVoices();",
    "if(parsed.mode==='local')state.settings.localVoiceId=parsed.localVoiceId;else if(parsed.mode==='tiktok')state.settings.tiktokVoice=parsed.tiktokVoice;else state.settings.voiceURI=parsed.voiceURI;renderLocalVoices();",
    "guardado de selección TikTok",
)
renderer = replace_once(
    renderer,
    "        const result = await api.synthesizeOnlineVoice({\n          text,\n          voice: voiceConfig?.onlineVoice || state.settings.onlineVoice,\n          rate: tuning.rate,\n          pitch: tuning.pitch\n        });",
    "        const result = await api.synthesizeTikTokVoice({\n          text,\n          voice: voiceConfig?.tiktokVoice || state.settings.tiktokVoice || 'es_mx_002'\n        });",
    "síntesis TikTok",
)
renderer = replace_once(
    renderer,
    "        audio.volume = tuning.volume;\n        state.onlineAudio = audio;",
    "        audio.volume = tuning.volume;\n        audio.playbackRate = Math.max(0.5, Math.min(2, Number(tuning.rate) || 1));\n        audio.preservesPitch = false;\n        state.onlineAudio = audio;",
    "velocidad del audio TikTok",
)
renderer = replace_once(
    renderer,
    "        toast('Voz online no disponible', 'Se usó una voz de Windows para este audio.', 'error');",
    "        toast('Voz de TikTok no disponible', error.message || 'Se usó una voz de Windows para este audio.', 'error');",
    "error TikTok",
)
renderer = replace_once(
    renderer,
    "  setupAudioActivityIndicators();",
    "  let migratedTikTokVoices=false;\n  if(state.settings.voiceMode==='online'||state.settings.localVoiceId==='lulu-official'){state.settings.voiceMode='tiktok';state.settings.tiktokVoice='es_mx_002';migratedTikTokVoices=true;}\n  if(!state.settings.tiktokVoice)state.settings.tiktokVoice='es_mx_002';\n  state.settings.userVoiceRules=(Array.isArray(state.settings.userVoiceRules)?state.settings.userVoiceRules:[]).map((rule)=>String(rule?.voice||'').startsWith('online:')||rule?.voice==='local:lulu-official'?{...rule,voice:`tiktok:${state.settings.tiktokVoice}`}:rule);\n  delete state.settings.onlineVoice;\n  setupAudioActivityIndicators();",
    "migración a voces TikTok",
)
renderer = replace_once(
    renderer,
    "if (migratedV100||migratedDefaultCommands || migratedVoiceCatalog || !state.settings.rankingsMigratedV016 || !state.settings.streamWidgetsMigratedV019)",
    "if (migratedV100||migratedTikTokVoices||migratedDefaultCommands || migratedVoiceCatalog || !state.settings.rankingsMigratedV016 || !state.settings.streamWidgetsMigratedV019)",
    "persistencia de migración TikTok",
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
@media(max-height:720px){.main-content{padding-top:16px;padding-bottom:24px}.sidebar{padding-top:12px;padding-bottom:10px}.logo-wrap{padding-bottom:9px}.feature-search{margin-bottom:8px}.nav-list{gap:8px}.sidebar-bottom{margin-top:5px}}
"""
styles_path.write_text(styles, encoding="utf-8")

notice_path = ROOT / "NOTICE.md"
if notice_path.exists():
    notice = notice_path.read_text(encoding="utf-8")
    notice = re.sub(r"\n## OpenVoice V2\n.*?(?=\n## |\Z)", "\n", notice, flags=re.S)
    notice = re.sub(
        r"\n## Voces neuronales online\n.*?(?=\n## |\Z)",
        "\n## Voces de TikTok\n\nLas voces TikTok usan una interfaz interna no documentada por TikTok y pueden cambiar sin aviso. Lulu Finity toma la sesión únicamente del perfil local enlazado en Cuenta, la envía solo a dominios fijos de TikTok para generar el audio y nunca la expone al renderer, al relay ni a archivos de registro.\n",
        notice,
        flags=re.S,
    )
    notice_path.write_text(notice.rstrip() + "\n", encoding="utf-8")

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8") if changelog_path.exists() else "# Cambios\n\n"
entry = """# Cambios

## 1.0.2

- Retira por completo la Voz Oficial y el motor descargable OpenVoice que no funcionaba correctamente.
- Elimina el catálogo online Edge/Microsoft que se presentó erróneamente como voces gratuitas nuevas.
- Añade más de 70 voces auténticas de TikTok, incluidas Warm, Jessie, Story Teller, Wacky, Ghost Face, C3PO, Stitch y Stormtrooper.
- Usa de forma local la sesión ya enlazada en Cuenta para solicitar el audio directamente a TikTok; la cookie nunca se muestra ni se envía al relay.
- Migra automáticamente las selecciones antiguas a Warm / Español MX y conserva Lulu Local Piper y Windows únicamente como respaldo.
- Permite desplazarse verticalmente por todas las funciones cuando la ventana no está maximizada.

"""
if "## 1.0.2" not in changelog:
    changelog = entry + (changelog[len("# Cambios\n\n"):] if changelog.startswith("# Cambios\n\n") else changelog)
changelog_path.write_text(changelog, encoding="utf-8")

print("Lulu Finity 1.0.2: voces TikTok reales, motor fallido retirado y scroll adaptable")
