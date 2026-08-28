from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()

def read(path):
    return path.read_text(encoding="utf-8")

def write(path, text):
    path.write_text(text, encoding="utf-8", newline="\n")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"No se pudo aplicar {label}: se esperaba 1 coincidencia y hubo {count}")
    return text.replace(old, new, 1)

MAIN = ROOT / "src" / "main.js"
if not MAIN.is_file(): raise SystemExit(f"No se encontró {MAIN}")
main = read(MAIN)

widget_block = """  if (kind === 'widget') {
    const type = normalizeStreamWidgetType(id);
    const themes = normalizeStreamWidgetThemes(runtimeResourceSettings?.streamWidgetThemes);
    const backgrounds = normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds);
    const theme = themes[type];
    const background = backgrounds[type];
    return {
      token, source:key,
      html: includeHtml ? streamWidgetHtml(type, token, false, theme, background) : undefined,
      state: { ...(await streamWidgetSnapshot(type, false)), theme, background },
      mediaPath:''
    };
  }
  if (kind === 'ranking') {
    const slot = normalizeRankingSlot(id);
    return { token, source:key, html:includeHtml ? rankingHtml(slot, token, false) : undefined, state:await rankingSnapshot(slot, false), mediaPath:'' };
  }"""
widget_block_new = """  if (kind === 'widget') {
    const type = normalizeStreamWidgetType(id);
    const themes = normalizeStreamWidgetThemes(runtimeResourceSettings?.streamWidgetThemes);
    const backgrounds = normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds);
    const theme = themes[type];
    const background = backgrounds[type];
    const snapshot = await streamWidgetSnapshot(type, false);
    return {
      token, source:key,
      html: includeHtml ? streamWidgetHtml(type, token, false, theme, background) : undefined,
      state: { ...snapshot, theme, background },
      mediaPaths: customMediaPaths(snapshot?.customization),
      verifyMedia: includeHtml === true
    };
  }
  if (kind === 'ranking') {
    const slot = normalizeRankingSlot(id);
    const snapshot = await rankingSnapshot(slot, false);
    return { token, source:key, html:includeHtml ? rankingHtml(slot, token, false) : undefined, state:snapshot, mediaPaths:customMediaPaths(snapshot?.config), verifyMedia:includeHtml === true };
  }"""
main = replace_once(main, widget_block, widget_block_new, "media personalizada en relay estable")

main = replace_once(
    main,
    "  runtimeResourceSettings=next;\n  youtubeVolume=normalizedAudioVolume(next.youtubeVolume,youtubeVolume);",
    """  runtimeResourceSettings=next;
  for (const type of ['playlist','wallet','alert','goal','gift']) if (stableOverlaySourceActive('widget', type)) scheduleStableOverlaySync('widget', type);
  for (let slot = 1; slot <= 4; slot += 1) if (stableOverlaySourceActive('ranking', slot)) scheduleStableOverlaySync('ranking', slot);
  youtubeVolume=normalizedAudioVolume(next.youtubeVolume,youtubeVolume);""",
    "sincronización inmediata al personalizar"
)

main = replace_once(
    main,
    "const stableOverlaySources = new Map();\nconst stableOverlaySyncTimers = new Map();",
    """const stableOverlaySources = new Map();
const stableOverlayPinnedSources = new Set();
let stableOverlayRegistryLoaded = false;
const stableOverlaySyncTimers = new Map();""",
    "registro persistente de fuentes"
)

registry_functions = r'''
function stableOverlayRegistryPath() {
  return path.join(app.getPath('userData'), 'stable-overlay-sources.json');
}

function parseStableOverlayKey(key) {
  const raw = String(key || '');
  let match = raw.match(/^widget:(playlist|wallet|game|alert|goal|gift)$/);
  if (match) return { kind:'widget', id:match[1], key:raw };
  match = raw.match(/^ranking:([1-4])$/);
  if (match) return { kind:'ranking', id:Number(match[1]), key:raw };
  match = raw.match(/^overlay:([1-4])$/);
  if (match) return { kind:'overlay', id:Number(match[1]), key:raw };
  return null;
}

async function loadStableOverlayRegistry() {
  if (stableOverlayRegistryLoaded) return stableOverlayPinnedSources;
  stableOverlayRegistryLoaded = true;
  try {
    const parsed = JSON.parse(await fsp.readFile(stableOverlayRegistryPath(), 'utf8'));
    const list = Array.isArray(parsed?.sources) ? parsed.sources : [];
    for (const key of list) if (parseStableOverlayKey(key)) stableOverlayPinnedSources.add(String(key));
  } catch {}
  return stableOverlayPinnedSources;
}

async function persistStableOverlayRegistry() {
  await fsp.mkdir(path.dirname(stableOverlayRegistryPath()), { recursive:true });
  const file = stableOverlayRegistryPath(), temp = `${file}.tmp`;
  await fsp.writeFile(temp, JSON.stringify({ version:1, sources:[...stableOverlayPinnedSources].sort() }, null, 2) + '\n', 'utf8');
  await fsp.rename(temp, file).catch(async () => { await fsp.rm(file, { force:true }); await fsp.rename(temp, file); });
}

async function rememberStableOverlaySource(kind, id) {
  await loadStableOverlayRegistry();
  const key = stableOverlaySourceKey(kind, id);
  if (stableOverlayPinnedSources.has(key)) return;
  stableOverlayPinnedSources.add(key);
  await persistStableOverlayRegistry();
}

async function restoreStableOverlaySources() {
  await loadStableOverlayRegistry();
  const sources = [...stableOverlayPinnedSources].map(parseStableOverlayKey).filter(Boolean);
  if (!sources.length || isQuitting) return;
  for (const source of sources) stableOverlaySources.set(source.key, { kind:source.kind, id:source.id, lastSuccessAt:0 });
  startStableOverlayHeartbeat();
  refreshAppSuspensionBlocker();
  for (const source of sources) {
    try { await publishStableOverlaySource(source.kind, source.id, { includeHtml:true }); }
    catch (error) { console.warn('[overlay-relay] Restauración pendiente:', source.key, error?.message || error); }
  }
}

'''
main = replace_once(
    main,
    "function stableOverlaySourceKey(kind, id) {",
    registry_functions + "function stableOverlaySourceKey(kind, id) {",
    "funciones de persistencia HTTPS"
)
main = replace_once(
    main,
    "  stableOverlaySources.set(key, { kind:String(kind), id, lastSuccessAt:Date.now() });\n  startStableOverlayHeartbeat();",
    "  stableOverlaySources.set(key, { kind:String(kind), id, lastSuccessAt:Date.now() });\n  await rememberStableOverlaySource(kind, id).catch(() => {});\n  startStableOverlayHeartbeat();",
    "recordar fuente HTTPS"
)
main = replace_once(
    main,
    "async function startApplication() {\n  await ensureDataFiles();\n  await removeRetiredVoiceEngine();",
    """async function startApplication() {
  await ensureDataFiles();
  setTimeout(() => { restoreStableOverlaySources().catch((error) => console.warn('[overlay-relay] No se pudieron restaurar fuentes:', error?.message || error)); }, 1200).unref?.();
  await removeRetiredVoiceEngine();""",
    "restauración de HTTPS al iniciar"
)

write(MAIN, main)
print("Persistencia y recuperación HTTPS de assets integradas")
