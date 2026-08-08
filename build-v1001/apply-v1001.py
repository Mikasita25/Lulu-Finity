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
main_path.write_text(main, encoding="utf-8", newline="\n")

preload_path = ROOT / "src/preload.js"
preload = preload_path.read_text(encoding="utf-8")
preload = replace_once(
    preload,
    "listOnlineVoices: () => ipcRenderer.invoke('tts:list-online-voices'),",
    "listOnlineVoices: (options = {}) => ipcRenderer.invoke('tts:list-online-voices', options),",
    "API del catálogo",
)
preload_path.write_text(preload, encoding="utf-8", newline="\n")

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
renderer_path.write_text(renderer, encoding="utf-8", newline="\n")

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
html_path.write_text(html, encoding="utf-8", newline="\n")

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8") if changelog_path.exists() else "# Cambios\n\n"
entry = """## 1.0.1

- Corrige la regresión que ocultaba las voces Microsoft/online cuando Lulu Local estaba seleccionada.
- Carga automáticamente el catálogo gratuito completo al abrir TTS y permite actualizarlo manualmente.
- Organiza las voces online por idioma y país, con búsqueda por nombre, región y género.
- Guarda el último catálogo válido y amplía la lista de respaldo para funcionar ante fallos temporales.
- Omite voces CJK del catálogo, de acuerdo con el filtro de lectura inteligente de Lulu Finity.
- Conserva Lulu Local y todas las voces instaladas de Windows.

"""
if "## 1.0.1" not in changelog:
    if not changelog.startswith("# Cambios\n\n"):
        raise SystemExit("El changelog no tiene el encabezado esperado")
    changelog = "# Cambios\n\n" + entry + changelog[len("# Cambios\n\n"):]
changelog_path.write_text(changelog, encoding="utf-8", newline="\n")

readme_path = ROOT / "README.md"
if readme_path.exists():
    readme = readme_path.read_text(encoding="utf-8").replace("1.0.0", "1.0.1")
    readme_path.write_text(readme, encoding="utf-8", newline="\n")

print("Lulu Finity 1.0.1: catálogo gratuito completo y carga de voces corregidos")
