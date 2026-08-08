from pathlib import Path
import json
import shutil
import sys


ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
HERE = Path(__file__).resolve().parent


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


def remove_between(text: str, start: str, end: str, label: str) -> str:
    start_index = text.find(start)
    end_index = text.find(end, start_index)
    if start_index < 0 or end_index < 0:
        raise SystemExit(f"{label}: no se encontraron los límites")
    return text[:start_index] + text[end_index:]


package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
if package.get("version") != "1.0.0":
    raise SystemExit(f"Lulu Finity 1.0.1 espera la fuente 1.0.0, no {package.get('version')}")
package["version"] = "1.0.1"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = json.loads(lock_path.read_text(encoding="utf-8"))
lock["version"] = "1.0.1"
if isinstance(lock.get("packages", {}).get(""), dict):
    lock["packages"][""]["version"] = "1.0.1"
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for source in sorted((HERE / "files").rglob("*")):
    if not source.is_file():
        continue
    relative = source.relative_to(HERE / "files")
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

local_manager_path = ROOT / "src/local-voice-manager.js"
local_manager = local_manager_path.read_text(encoding="utf-8")
local_manager = replace_once(
    local_manager,
    "const AdmZip = require('adm-zip');\n",
    "const AdmZip = require('adm-zip');\nconst { CloneRuntimeManager } = require('./clone-runtime-manager');\n",
    "administrador del motor de clonación",
)
local_manager = replace_once(
    local_manager,
    "const ALLOWED_EXTENSIONS = new Set(['', '.json', '.onnx', '.txt', '.bin', '.fst', '.far', '.dat', '.md']);",
    "const ALLOWED_EXTENSIONS = new Set(['', '.json', '.onnx', '.txt', '.bin', '.fst', '.far', '.dat', '.md', '.wav']);",
    "muestra WAV permitida",
)
old_manifest = """  if (manifest.format !== 'lulu-local-v1' || manifest.type !== 'vits') throw new Error('La voz no usa el formato Lulu Local V1 (VITS/Piper).');
  for (const key of ['model', 'tokens']) {
    const file = safeInside(root, engine[key]);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Falta ${key} en el paquete de voz.`);
  }
  const dataDir = safeInside(root, engine.dataDir || 'espeak-ng-data');
  if (!fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) throw new Error('Falta espeak-ng-data en el paquete de voz.');
  return {
    id,
    name: String(manifest.name || id).slice(0, 80),
    author: String(manifest.author || 'Voz local').slice(0, 80),
    language: String(manifest.language || 'es-MX').slice(0, 20),
    description: String(manifest.description || '').slice(0, 240),
    type: 'vits',
    format: 'lulu-local-v1',
    sid: Math.max(0, Number(manifest.sid) || 0),
    engine,
    root,
    bundled,
    removable: !bundled
  };
"""
new_manifest = """  const type = String(manifest.type || '');
  const format = String(manifest.format || '');
  if (type === 'vits' && format === 'lulu-local-v1') {
    for (const key of ['model', 'tokens']) {
      const file = safeInside(root, engine[key]);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Falta ${key} en el paquete de voz.`);
    }
    const dataDir = safeInside(root, engine.dataDir || 'espeak-ng-data');
    if (!fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) throw new Error('Falta espeak-ng-data en el paquete de voz.');
  } else if (type === 'openvoice-v2' && format === 'lulu-local-v2') {
    const reference = safeInside(root, engine.reference);
    if (!fs.existsSync(reference) || !fs.statSync(reference).isFile()) throw new Error('Falta la muestra autorizada de la voz clonada.');
    if (!engine.baseVoiceId || !engine.runtime) throw new Error('La voz clonada no define su motor local.');
  } else {
    throw new Error('La voz no usa un formato compatible con Lulu Local.');
  }
  return {
    id,
    name: String(manifest.name || id).slice(0, 80),
    author: String(manifest.author || 'Voz local').slice(0, 80),
    language: String(manifest.language || 'es-MX').slice(0, 20),
    description: String(manifest.description || '').slice(0, 240),
    type,
    format,
    sid: Math.max(0, Number(manifest.sid) || 0),
    engine,
    root,
    bundled,
    removable: !bundled
  };
"""
local_manager = replace_once(local_manager, old_manifest, new_manifest, "formato de voz clonada")
local_manager = replace_once(
    local_manager,
    "    this.workerPath = workerPath;\n    this.worker = null;",
    "    this.workerPath = workerPath;\n    this.cloneRuntime = new CloneRuntimeManager({ app });\n    this.worker = null;",
    "estado del motor opcional",
)
local_manager = replace_once(
    local_manager,
    "    return voices.map(({ root, engine, ...voice }) => voice);",
    """    return voices.map((voice) => {
      const runtime = voice.type === 'openvoice-v2'
        ? this.cloneRuntime.status(voice)
        : { installed: true, installable: false, installing: false, downloadBytes: 0 };
      const { root: _root, engine: _engine, ...publicVoice } = voice;
      return { ...publicVoice, ...runtime };
    });""",
    "estado público de voces locales",
)
old_synthesize_start = """  async synthesize(request = {}) {
    const text = String(request.text || '').trim().slice(0, 500);
    if (!text) throw new Error('No hay texto para leer.');
    const voice = await this.resolve(request.voiceId || 'lulu-es-mx');
    const requestId = randomUUID();
"""
new_synthesize_start = """  async install(id, onProgress) {
    const voice = await this.resolve(id);
    if (voice.type !== 'openvoice-v2') return { ok: true, installed: true, installable: false };
    await this.release();
    return this.cloneRuntime.install(voice, onProgress);
  }

  async synthesize(request = {}) {
    const text = String(request.text || '').trim().slice(0, 500);
    if (!text) throw new Error('No hay texto para leer.');
    const voice = await this.resolve(request.voiceId || 'lulu-es-mx');
    let baseVoice = null;
    let runtime = null;
    if (voice.type === 'openvoice-v2') {
      runtime = this.cloneRuntime.runtimeFor(voice);
      baseVoice = await this.resolve(voice.engine.baseVoiceId || 'lulu-es-mx');
      if (baseVoice.type !== 'vits') throw new Error('La voz base de la clonación no está disponible.');
    }
    const requestId = randomUUID();
"""
local_manager = replace_once(local_manager, old_synthesize_start, new_synthesize_start, "instalación y síntesis clonada")
local_manager = replace_once(
    local_manager,
    "      }, 90_000);",
    "      }, voice.type === 'openvoice-v2' ? 240_000 : 90_000);",
    "tiempo máximo de clonación",
)
local_manager = replace_once(
    local_manager,
    "        sid: request.sid,\n        voice\n",
    "        sid: request.sid,\n        voice,\n        baseVoice,\n        runtime\n",
    "datos del proceso de clonación",
)
local_manager_path.write_text(local_manager, encoding="utf-8")

main_path = ROOT / "src/main.js"
main = main_path.read_text(encoding="utf-8")
main = replace_once(
    main,
    "const { LocalVoiceManager } = require('./local-voice-manager');\n",
    "const { LocalVoiceManager } = require('./local-voice-manager');\nconst { FALLBACK_ONLINE_VOICES, prepareOnlineVoices } = require('./online-voice-catalog');\n",
    "importar catálogo de voces",
)
main = remove_between(main, "const FALLBACK_ONLINE_VOICES = [", "async function getEdgeTtsModule()", "catálogo anterior")
main = remove_between(main, "function normalizeOnlineVoice(voice) {", "async function listOnlineVoices()", "normalizador anterior")

old_list = """async function listOnlineVoices() {
  try {
    const module = await getEdgeTtsModule();
    const listVoices = module.listVoices || module.default?.listVoices;
    if (typeof listVoices !== 'function') throw new Error('El proveedor no expuso la lista de voces.');
    const voices = (await listVoices())
      .map(normalizeOnlineVoice)
      .filter((voice) => voice.shortName && voice.locale)
      .sort((a, b) => {
        const aSpanish = a.locale.toLowerCase().startsWith('es') ? 0 : 1;
        const bSpanish = b.locale.toLowerCase().startsWith('es') ? 0 : 1;
        return aSpanish - bSpanish || a.locale.localeCompare(b.locale) || a.localName.localeCompare(b.localName);
      });
    return { voices, fallback: false };
  } catch (error) {
    console.warn('No se pudo cargar la lista de voces online:', error?.message || error);
    return { voices: FALLBACK_ONLINE_VOICES, fallback: true, message: friendlyUpdateError(error) };
  }
}
"""
new_list = """let onlineVoiceCatalogCache = null;

function onlineVoiceCatalogCachePath() {
  return path.join(app.getPath('userData'), 'online-voice-catalog-v1.json');
}

async function readOnlineVoiceCatalogCache() {
  try {
    const data = JSON.parse(await fsp.readFile(onlineVoiceCatalogCachePath(), 'utf8'));
    const voices = prepareOnlineVoices(data?.voices);
    return voices.length ? voices : [];
  } catch {
    return [];
  }
}

async function writeOnlineVoiceCatalogCache(voices) {
  try {
    await fsp.writeFile(onlineVoiceCatalogCachePath(), JSON.stringify({ updatedAt: Date.now(), voices }), 'utf8');
  } catch (error) {
    console.warn('No se pudo guardar el catálogo de voces:', error?.message || error);
  }
}

async function listOnlineVoices(options = {}) {
  const refresh = Boolean(options?.refresh);
  if (!refresh && onlineVoiceCatalogCache?.length) {
    return { voices: onlineVoiceCatalogCache, fallback: false, cached: true };
  }
  try {
    const module = await getEdgeTtsModule();
    const listVoices = module.listVoices || module.default?.listVoices;
    if (typeof listVoices !== 'function') throw new Error('El proveedor no expuso la lista de voces.');
    const voices = prepareOnlineVoices(await listVoices());
    if (!voices.length) throw new Error('El proveedor devolvió un catálogo vacío.');
    onlineVoiceCatalogCache = voices;
    await writeOnlineVoiceCatalogCache(voices);
    return { voices, fallback: false, cached: false };
  } catch (error) {
    console.warn('No se pudo cargar la lista de voces online:', error?.message || error);
    const savedVoices = await readOnlineVoiceCatalogCache();
    if (savedVoices.length) {
      onlineVoiceCatalogCache = savedVoices;
      return { voices: savedVoices, fallback: true, cached: true, message: friendlyUpdateError(error) };
    }
    return { voices: FALLBACK_ONLINE_VOICES, fallback: true, cached: false, message: friendlyUpdateError(error) };
  }
}
"""
main = replace_once(main, old_list, new_list, "carga del catálogo completo")
main = replace_once(
    main,
    "ipcMain.handle('tts:list-online-voices', async () => listOnlineVoices());",
    "ipcMain.handle('tts:list-online-voices', async (_event, options) => listOnlineVoices(options));",
    "IPC del catálogo",
)
main = replace_once(
    main,
    "ipcMain.handle('tts:import-local-voice', () => getLocalVoiceManager().importVoice(mainWindow));\n",
    "ipcMain.handle('tts:import-local-voice', () => getLocalVoiceManager().importVoice(mainWindow));\nipcMain.handle('tts:install-local-voice', (event,id) => getLocalVoiceManager().install(id, (progress) => { if (!event.sender.isDestroyed()) event.sender.send('tts:local-install-progress', { id, ...progress }); }));\n",
    "IPC para descargar el motor oficial",
)
main_path.write_text(main, encoding="utf-8")

preload_path = ROOT / "src/preload.js"
preload = preload_path.read_text(encoding="utf-8")
preload = replace_once(
    preload,
    "listOnlineVoices: () => ipcRenderer.invoke('tts:list-online-voices'),",
    "listOnlineVoices: (options = {}) => ipcRenderer.invoke('tts:list-online-voices', options),",
    "API del catálogo",
)
preload = replace_once(
    preload,
    "importLocalVoice: () => ipcRenderer.invoke('tts:import-local-voice'),\n",
    "importLocalVoice: () => ipcRenderer.invoke('tts:import-local-voice'),\n  installLocalVoice: (id) => ipcRenderer.invoke('tts:install-local-voice', id),\n",
    "API de instalación de voz oficial",
)
preload_path.write_text(preload, encoding="utf-8")

renderer_path = ROOT / "src/renderer.js"
renderer = renderer_path.read_text(encoding="utf-8")
old_gender = """function voiceGenderLabel(value) {
  const gender = String(value || '').toLowerCase();
  if (gender === 'female') return 'mujer';
  if (gender === 'male') return 'hombre';
  return '';
}
"""
new_gender = """function voiceGenderLabel(value) {
  const gender = String(value || '').toLowerCase();
  if (gender === 'female') return 'mujer';
  if (gender === 'male') return 'hombre';
  return '';
}

function voiceLocaleLabel(locale) {
  const normalized = String(locale || '').replace('_', '-');
  try {
    const [language, region] = normalized.split('-');
    const languageName = new Intl.DisplayNames(['es'], { type: 'language' }).of(language) || language;
    const regionName = region ? new Intl.DisplayNames(['es'], { type: 'region' }).of(region) : '';
    return regionName ? `${languageName} (${regionName})` : languageName;
  } catch {
    return normalized;
  }
}

function onlineVoiceSearchText(voice) {
  return `${voice.localName} ${voice.name} ${voice.shortName} ${voice.locale} ${voiceLocaleLabel(voice.locale)} ${voice.gender}`;
}
"""
renderer = replace_once(renderer, old_gender, new_gender, "etiquetas de idioma y país")

old_online_group = """  const onlineMatches = state.onlineVoices.filter((voice) => (languageMatches(voice.locale, filter) || `online:${voice.shortName}` === selected) && (!search || normalizeText(`${voice.localName} ${voice.name} ${voice.shortName} ${voice.locale} ${voice.gender}`).includes(search) || `online:${voice.shortName}` === selected));
  if (onlineMatches.length) {
    const group = document.createElement('optgroup');
    group.label = `Voces neuronales online (${onlineMatches.length})`;
    for (const voice of onlineMatches) {
      const option = document.createElement('option');
      option.value = `online:${voice.shortName}`;
      const gender = voiceGenderLabel(voice.gender);
      option.textContent = `${voice.localName || voice.name || voice.shortName} — ${voice.locale}${gender ? ` · ${gender}` : ''}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
"""
new_online_group = """  const onlineMatches = state.onlineVoices.filter((voice) => (languageMatches(voice.locale, filter) || `online:${voice.shortName}` === selected) && (!search || normalizeText(onlineVoiceSearchText(voice)).includes(search) || `online:${voice.shortName}` === selected));
  const onlineByLocale = new Map();
  for (const voice of onlineMatches) {
    if (!onlineByLocale.has(voice.locale)) onlineByLocale.set(voice.locale, []);
    onlineByLocale.get(voice.locale).push(voice);
  }
  for (const [locale, voices] of onlineByLocale) {
    const group = document.createElement('optgroup');
    group.label = `Gratis online · ${voiceLocaleLabel(locale)} (${voices.length})`;
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = `online:${voice.shortName}`;
      const gender = voiceGenderLabel(voice.gender);
      option.textContent = `${voice.localName || voice.name || voice.shortName}${gender ? ` · ${gender}` : ''}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
"""
renderer = replace_once(renderer, old_online_group, new_online_group, "grupos de voces por país")
renderer = replace_once(
    renderer,
    "const result = await api.listOnlineVoices();",
    "const result = await api.listOnlineVoices({ refresh: showToast });",
    "recarga forzada del catálogo",
)
renderer = replace_once(
    renderer,
    "status.innerHTML = '<span class=\"status-light connecting\"></span><span>Cargando voces neuronales online…</span>';",
    "status.innerHTML = '<span class=\"status-light connecting\"></span><span>Cargando catálogo gratuito completo…</span>';",
    "mensaje de carga del catálogo",
)
renderer = replace_once(
    renderer,
    "state.onlineVoicesFallback = Boolean(result?.fallback);",
    "state.onlineVoicesFallback = Boolean(result?.fallback);\n    const cachedCatalog = Boolean(result?.cached);",
    "estado de caché",
)
renderer = replace_once(
    renderer,
    "? `<span class=\"status-light connected\"></span><span>${state.onlineVoices.length} voces online disponibles${state.onlineVoicesFallback ? ' · lista básica de respaldo' : ''}. Requieren internet.</span>`",
    "? `<span class=\"status-light connected\"></span><span>${state.onlineVoices.length} voces gratuitas online disponibles${state.onlineVoicesFallback ? (cachedCatalog ? ' · catálogo guardado' : ' · lista de respaldo') : ''}. Se agrupan por idioma y país.</span>`",
    "mensaje del catálogo",
)
renderer = replace_once(
    renderer,
    "if(page==='voice'){void loadLocalVoices();if(state.settings?.voiceMode==='online')void loadOnlineVoices(false);}",
    "if(page==='voice'&&!state.loadedPages.has(page)){void loadLocalVoices();void loadOnlineVoices(false);}",
    "carga del catálogo al abrir TTS",
)
renderer = replace_once(
    renderer,
    "if (showToast) toast('Voces actualizadas', `${state.voices.length} locales y ${state.onlineVoices.length} online.`, 'success');",
    "if (showToast) toast('Voces actualizadas', `${state.voices.length} de Windows y ${state.onlineVoices.length} gratuitas online.`, 'success');",
    "resumen de voces actualizado",
)
renderer = replace_once(
    renderer,
    "const localMatches=state.localVoices.filter((voice)=>(languageMatches(voice.language,filter)||`local:${voice.id}`===selected)&&(!search||normalizeText(`${voice.name} ${voice.language} ${voice.author}`).includes(search)||`local:${voice.id}`===selected));",
    "const localMatches=state.localVoices.filter((voice)=>(voice.installed!==false||`local:${voice.id}`===selected)&&(languageMatches(voice.language,filter)||`local:${voice.id}`===selected)&&(!search||normalizeText(`${voice.name} ${voice.language} ${voice.author}`).includes(search)||`local:${voice.id}`===selected));",
    "ocultar voces locales todavía no instaladas",
)
renderer = replace_once(
    renderer,
    "  $('localVoiceStatus').textContent=state.localVoices.length?`${state.localVoices.length} voz${state.localVoices.length===1?'':'es'} instalada${state.localVoices.length===1?'':'s'}.`:'No se encontró una voz local completa. Importa un paquete .lfvoice.';",
    "  const installed=state.localVoices.filter((voice)=>voice.installed!==false).length;const optional=state.localVoices.length-installed;\n  $('localVoiceStatus').textContent=state.localVoices.length?`${installed} voz${installed===1?'':'es'} instalada${installed===1?'':'s'}${optional?` · ${optional} disponible para descargar`:''}.`:'No se encontró una voz local completa. Importa un paquete .lfvoice.';",
    "estado de voces instaladas y opcionales",
)
renderer = replace_once(
    renderer,
    "  list.innerHTML=state.localVoices.length?state.localVoices.map((voice)=>`<div class=\"local-voice-card ${voice.id===selected&&state.settings.voiceMode==='local'?'active':''}\"><div class=\"local-voice-copy\"><strong>${escapeHtml(voice.name)}</strong><small>${escapeHtml(voice.language)} · ${escapeHtml(voice.author||'Voz local')}${voice.bundled?' · incluida':' · importada'}</small></div><div class=\"local-voice-actions\"><button class=\"secondary select-local-voice\" data-id=\"${escapeHtml(voice.id)}\">Usar</button><button class=\"ghost test-local-voice\" data-id=\"${escapeHtml(voice.id)}\">Probar</button>${voice.removable?`<button class=\"danger-outline remove-local-voice\" data-id=\"${escapeHtml(voice.id)}\">Eliminar</button>`:''}</div></div>`).join(''):'<div class=\"local-voice-card\"><div class=\"local-voice-copy\"><strong>Biblioteca vacía</strong><small>Importa una voz .lfvoice para comenzar.</small></div></div>';",
    "  list.innerHTML=state.localVoices.length?state.localVoices.map((voice)=>`<div class=\"local-voice-card ${voice.id===selected&&state.settings.voiceMode==='local'?'active':''}\"><div class=\"local-voice-copy\"><strong>${escapeHtml(voice.name)}</strong><small>${escapeHtml(voice.language)} · ${escapeHtml(voice.author||'Voz local')}${voice.installable?(voice.installed?' · clonación instalada':' · descarga opcional'):(voice.bundled?' · incluida':' · importada')}</small>${voice.description?`<span>${escapeHtml(voice.description)}</span>`:''}</div><div class=\"local-voice-actions\">${voice.installable&&!voice.installed?`<button class=\"primary install-local-voice\" data-id=\"${escapeHtml(voice.id)}\">Descargar voz</button>`:`<button class=\"secondary select-local-voice\" data-id=\"${escapeHtml(voice.id)}\">Usar</button><button class=\"ghost test-local-voice\" data-id=\"${escapeHtml(voice.id)}\">Probar</button>`}${voice.removable?`<button class=\"danger-outline remove-local-voice\" data-id=\"${escapeHtml(voice.id)}\">Eliminar</button>`:''}</div></div>`).join(''):'<div class=\"local-voice-card\"><div class=\"local-voice-copy\"><strong>Biblioteca vacía</strong><small>Importa una voz .lfvoice para comenzar.</small></div></div>';",
    "tarjeta de la Voz Oficial",
)
renderer = replace_once(
    renderer,
    "  qsa('.test-local-voice').forEach((button)=>button.addEventListener('click',()=>speakText($('voiceTestInput')?.value.trim()||'Hola, esta es una prueba de Lulu Local.',false,null,{mode:'local',localVoiceId:button.dataset.id},{lockKey:`test-local:${button.dataset.id}`,label:'Prueba Lulu Local'})));\n",
    "  qsa('.test-local-voice').forEach((button)=>button.addEventListener('click',()=>speakText($('voiceTestInput')?.value.trim()||'Hola, esta es una prueba de Lulu Local.',false,null,{mode:'local',localVoiceId:button.dataset.id},{lockKey:`test-local:${button.dataset.id}`,label:'Prueba Lulu Local'})));\n  qsa('.install-local-voice').forEach((button)=>button.addEventListener('click',async()=>{button.disabled=true;button.textContent='Descargando…';$('localVoiceStatus').textContent='Descargando y verificando el motor local. Puede tardar varios minutos…';try{await api.installLocalVoice(button.dataset.id);await loadLocalVoices();state.settings.voiceMode='local';state.settings.localVoiceId=button.dataset.id;renderVoiceOptions();renderLocalVoices();scheduleSave();toast('Voz Oficial instalada','Ya funciona sin Internet.','success');}catch(error){button.disabled=false;button.textContent='Reintentar descarga';toast('No se pudo instalar la voz',error.message||String(error),'error');await loadLocalVoices();}}));\n",
    "botón para instalar la Voz Oficial",
)
renderer_path.write_text(renderer, encoding="utf-8")

html_path = ROOT / "src/index.html"
html = html_path.read_text(encoding="utf-8")
html = html.replace("v1.0.0", "v1.0.1")
html = replace_once(
    html,
    '<option value="pt">Portugués</option><option value="ja">Japonés</option><option value="ko">Coreano</option><option value="fr">Francés</option>',
    '<option value="pt">Portugués</option><option value="fr">Francés</option>',
    "filtros CJK",
)
html = replace_once(
    html,
    '<div class="voice-provider-status" id="voiceProviderStatus"><span class="status-light connecting"></span><span>Cargando voces…</span></div>',
    '<div class="voice-provider-status" id="voiceProviderStatus"><span class="status-light connecting"></span><span>Cargando catálogo gratuito completo…</span></div>',
    "estado inicial de voces",
)
html = replace_once(
    html,
    '<div class="tts-section-pane" data-tts-pane="local"><div class="local-voice-layout"><article class="panel settings-card wide"><div class="panel-header"><div><h3>Biblioteca Lulu Local</h3><p class="hint">Funciona sin Internet. El motor se libera cuando deja de usarse.</p></div><button class="primary" id="localVoiceImportBtn">Importar .lfvoice</button></div><div class="local-voice-status" id="localVoiceStatus">Buscando voces instaladas…</div><div class="local-voice-list" id="localVoiceList"></div></article><article class="panel settings-card"><h3>Paquetes de voz</h3><p>Un archivo <strong>.lfvoice</strong> contiene un modelo VITS/Piper, sus tokens y datos de pronunciación.</p><p class="hint">Las voces importadas se validan y se guardan sólo en tu equipo.</p></article></div></div>',
    '<div class="tts-section-pane" data-tts-pane="local"><div class="local-voice-layout"><article class="panel settings-card wide"><div class="panel-header"><div><h3>Biblioteca Lulu Local</h3><p class="hint">Funciona sin Internet. El motor se libera cuando deja de usarse.</p></div><button class="primary" id="localVoiceImportBtn">Importar .lfvoice</button></div><div class="local-voice-status" id="localVoiceStatus">Buscando voces instaladas…</div><div class="local-voice-list" id="localVoiceList"></div></article><article class="panel settings-card"><h3>Paquetes de voz</h3><p>La <strong>Voz Oficial De Lulu Finity</strong> usa clonación local y descarga su motor sólo al instalarla.</p><p>Un archivo <strong>.lfvoice</strong> contiene un modelo VITS/Piper, sus tokens y datos de pronunciación.</p><p class="hint">Las voces importadas se validan y se guardan sólo en tu equipo.</p></article></div></div>',
    "explicación de la Voz Oficial",
)
html_path.write_text(html, encoding="utf-8")

styles_path = ROOT / "src/styles.css"
styles = styles_path.read_text(encoding="utf-8")
if ".local-voice-copy > span" not in styles:
    styles += "\n.local-voice-copy > span{display:block;margin-top:5px;max-width:680px;color:var(--muted);font-size:.78rem;line-height:1.45}\n"
styles_path.write_text(styles, encoding="utf-8")

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8") if changelog_path.exists() else "# Cambios\n\n"
entry = """## 1.0.1

- Corrige la regresión que ocultaba las voces Microsoft/online cuando Lulu Local estaba seleccionada.
- Carga automáticamente el catálogo gratuito completo al abrir TTS y permite actualizarlo manualmente.
- Organiza las voces online por idioma y país, con búsqueda por nombre, región y género.
- Guarda el último catálogo válido y amplía la lista de respaldo para funcionar ante fallos temporales.
- Omite voces CJK del catálogo, de acuerdo con el filtro de lectura inteligente de Lulu Finity.
- Conserva Lulu Local y todas las voces instaladas de Windows.
- Añade la **Voz Oficial De Lulu Finity**, creada con una muestra autorizada y un motor de clonación local que se descarga sólo cuando se instala.
- Mantiene el instalador ligero: el motor OpenVoice V2 se verifica por SHA-256 y se obtiene desde la Release oficial.

"""
if "## 1.0.1" not in changelog:
    if not changelog.startswith("# Cambios\n\n"):
        raise SystemExit("El changelog no tiene el encabezado esperado")
    changelog = "# Cambios\n\n" + entry + changelog[len("# Cambios\n\n"):]
changelog_path.write_text(changelog, encoding="utf-8")

readme_path = ROOT / "README.md"
if readme_path.exists():
    readme = readme_path.read_text(encoding="utf-8").replace("1.0.0", "1.0.1")
    readme_path.write_text(readme, encoding="utf-8")

notice_path = ROOT / "NOTICE.md"
notice = notice_path.read_text(encoding="utf-8") if notice_path.exists() else "# Avisos de terceros\n"
openvoice_notice = """

## OpenVoice V2

La descarga opcional de la Voz Oficial usa OpenVoice V2 de MyShell/MIT, distribuido bajo licencia MIT. El motor y su licencia completa se entregan en un archivo separado de la Release.
"""
if "## OpenVoice V2" not in notice:
    notice += openvoice_notice
notice_path.write_text(notice, encoding="utf-8")

print("Lulu Finity 1.0.1: catálogo gratuito completo y carga de voces corregidos")
