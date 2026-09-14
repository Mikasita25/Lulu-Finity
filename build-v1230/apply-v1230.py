from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8", newline="\n")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperó 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


def update_version(path: str) -> None:
    data = json.loads(read(path))
    if data.get("version") != "1.2.2":
        raise RuntimeError(f"{path}: se esperaba la base 1.2.2 y se encontró {data.get('version')}")
    data["version"] = "1.2.3"
    if path.endswith("package-lock.json"):
        packages = data.get("packages")
        if isinstance(packages, dict) and isinstance(packages.get(""), dict):
            packages[""]["version"] = "1.2.3"
    write(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


for file_name in ("package.json", "package-lock.json"):
    update_version(file_name)

main = read("src/main.js")
main = replace_once(
    main,
    "const DEFAULT_SOUND_SOURCE_URL = 'https://kenney.nl/assets/interface-sounds';",
    """const DEFAULT_SOUND_SOURCE_URL = 'https://kenney.nl/assets/interface-sounds';
const TIKTOK_GIFT_CATALOG_URL = 'https://beetgames.com/tiktok-gifts.json';
const TIKTOK_GIFT_CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const TIKTOK_GIFT_FALLBACK = Object.freeze([
  'Rose','TikTok','GG',\"You're Awesome\",'Ice Cream Cone','Shining Starlight','Creeper','Birthday Cake','Lucky Pig','Pop','Freestyle','Wink Wink','Oldies','Glow Stick','Love You So Much','Finger Heart','Ice Cream','Peach','Hand Heart','Overreact','Name Shoutout','Rosa','Shamrock','Friendship Necklace','Perfume','Doughnut','Family','Fireworks','Diamond','Party Laser','Wedding','Shooting Stars','Motorcycle','Pink Dream','Party Bus','Meteor Shower','Private Jet','Sports Car','Interstellar','TikTok Shuttle','Phoenix'
]);
let tiktokGiftCatalogCache = null;""",
    "constantes del catálogo TikTok",
)

catalog_functions = r'''
function normalizeTikTokGiftCatalogGift(gift) {
  if (!gift || typeof gift !== 'object') return null;
  const name = String(gift.name || '').trim();
  if (!name || name.length > 140) return null;
  const rawImage = String(gift.image_url || gift.imageUrl || '').trim();
  const imageUrl = rawImage.startsWith('/')
    ? `https://beetgames.com${rawImage}`
    : /^https:\/\//i.test(rawImage) ? rawImage : '';
  const regions = Array.isArray(gift.regions)
    ? [...new Set(gift.regions.map((value) => String(value || '').trim().toUpperCase()).filter((value) => /^[A-Z]{2}$/.test(value)))]
    : [];
  return {
    name,
    coins: Math.max(0, Number(gift.coins || 0)),
    imageUrl,
    regions,
    slug: String(gift.slug || '').trim().slice(0, 180)
  };
}

function fallbackTikTokGiftCatalog(error = '') {
  return {
    ok: true,
    source: 'fallback',
    stale: true,
    fetchedAt: Date.now(),
    sourceUpdatedAt: '',
    warning: String(error || 'No se pudo actualizar el catálogo; se muestra la lista básica incluida con Lulu.'),
    counts: { allCountryUnique: TIKTOK_GIFT_FALLBACK.length, common: TIKTOK_GIFT_FALLBACK.length },
    gifts: TIKTOK_GIFT_FALLBACK.map((name) => ({ name, coins:0, imageUrl:'', regions:[], slug:'' }))
  };
}

async function getTikTokGiftCatalog(options = {}) {
  const force = Boolean(options?.force);
  const now = Date.now();
  if (!force && tiktokGiftCatalogCache?.gifts?.length && now - Number(tiktokGiftCatalogCache.fetchedAt || 0) < TIKTOK_GIFT_CATALOG_TTL_MS) {
    return { ...tiktokGiftCatalogCache, cached:true };
  }

  const cachePath = path.join(app.getPath('userData'), 'tiktok-gift-catalog-cache.json');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    timeout.unref?.();
    let response;
    try {
      response = await fetch(TIKTOK_GIFT_CATALOG_URL, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'Accept':'application/json', 'User-Agent':`Lulu-Finity/${app.getVersion()}` }
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`Catálogo HTTP ${response.status}`);
    const raw = await response.json();
    const gifts = Array.isArray(raw?.gifts) ? raw.gifts.map(normalizeTikTokGiftCatalogGift).filter(Boolean) : [];
    if (gifts.length < 50) throw new Error('El catálogo recibido está incompleto.');
    const payload = {
      ok: true,
      source: 'beetgames',
      stale: false,
      fetchedAt: now,
      sourceUpdatedAt: String(raw?.updated_at || ''),
      counts: raw?.counts && typeof raw.counts === 'object' ? raw.counts : { allCountryUnique:gifts.length },
      gifts
    };
    tiktokGiftCatalogCache = payload;
    fsp.writeFile(cachePath, JSON.stringify(payload), 'utf8').catch(() => {});
    return payload;
  } catch (error) {
    try {
      const cached = JSON.parse(await fsp.readFile(cachePath, 'utf8'));
      if (Array.isArray(cached?.gifts) && cached.gifts.length >= 50) {
        tiktokGiftCatalogCache = { ...cached, ok:true, stale:true, cached:true, warning:`Catálogo guardado: ${error?.message || error}` };
        return tiktokGiftCatalogCache;
      }
    } catch {}
    return fallbackTikTokGiftCatalog(error?.message || error);
  }
}

'''
main = replace_once(
    main,
    "function packagedDefaultSoundsDirectory() {",
    catalog_functions + "function packagedDefaultSoundsDirectory() {",
    "funciones del catálogo TikTok",
)
main = replace_once(
    main,
    "ipcMain.handle('sounds:list-default', async () => defaultSoundCatalog(packagedDefaultSoundsDirectory()));",
    "ipcMain.handle('sounds:list-default', async () => defaultSoundCatalog(packagedDefaultSoundsDirectory()));\nipcMain.handle('tiktok-gifts:catalog', async (_event, options = {}) => getTikTokGiftCatalog(options));",
    "IPC del catálogo TikTok",
)
write("src/main.js", main)

preload = read("src/preload.js")
preload = replace_once(
    preload,
    "  getRelayUsage: () => ipcRenderer.invoke('relay:usage'),",
    "  getRelayUsage: () => ipcRenderer.invoke('relay:usage'),\n  getTikTokGiftCatalog: (options = {}) => ipcRenderer.invoke('tiktok-gifts:catalog', options),",
    "puente del catálogo TikTok",
)
write("src/preload.js", preload)

renderer = read("src/renderer.js")
renderer = replace_once(
    renderer,
    "  detectedFanStickers: [],",
    "  detectedFanStickers: [],\n  detectedTikTokGifts: [],\n  tiktokGiftCatalog: [],\n  tiktokGiftCatalogMeta: null,\n  giftCatalogQuery: '',\n  giftCatalogRegion: 'MX',",
    "estado del catálogo de regalos",
)

catalog_renderer = r'''
function selectTikTokGiftForRule(giftName) {
  const value = String(giftName || '').trim();
  if (!value) return;
  if ($('eventRuleTypeInput')) $('eventRuleTypeInput').value = 'gift';
  if ($('eventRuleMatchInput')) $('eventRuleMatchInput').value = value;
  toast('Regalo seleccionado', value, 'success');
}

function renderDetectedTikTokGifts() {
  const target = $('detectedTikTokGifts');
  if (!target) return;
  target.innerHTML = state.detectedTikTokGifts.length
    ? state.detectedTikTokGifts.map((gift) => `<div class="detected-gift-chip"><div class="detected-gift-icon">🎁</div><div><strong>${escapeHtml(gift.giftName)}</strong><small>${gift.giftId ? `ID ${escapeHtml(gift.giftId)} · ` : ''}${Number(gift.coins || 0) > 0 ? `${Number(gift.coins).toLocaleString('es-MX')} monedas` : 'detectado en tu LIVE'}</small></div><button type="button" class="ghost tiny use-tiktok-gift" data-gift-name="${escapeHtml(gift.giftName)}">Usar</button></div>`).join('')
    : '<span class="hint">Cuando llegue un regalo durante el LIVE, su nombre real e ID aparecerán aquí automáticamente.</span>';
}

function rememberTikTokGift(event) {
  if (event?.type !== 'gift') return;
  const giftId = String(event.giftId || '').trim();
  const giftName = String(event.giftName || (giftId ? `Regalo ${giftId}` : '')).trim();
  if (!giftName) return;
  const key = giftId || normalizeText(giftName);
  const known = state.tiktokGiftCatalog.find((gift) => normalizeText(gift.name) === normalizeText(giftName));
  const item = {
    giftId,
    giftName,
    coins: Math.max(0, Number(event.diamondEach || known?.coins || 0)),
    detectedAt: Date.now()
  };
  state.detectedTikTokGifts = [item, ...state.detectedTikTokGifts.filter((gift) => (String(gift.giftId || '') || normalizeText(gift.giftName)) !== key)].slice(0, 24);
  if (!known && !/^Regalo\s+\d+$/i.test(giftName)) {
    state.tiktokGiftCatalog.unshift({ name:giftName, coins:item.coins, imageUrl:'', regions:['LIVE'], slug:'', liveDetected:true });
  }
  renderDetectedTikTokGifts();
  renderTikTokGiftCatalog();
}

function visibleTikTokGiftCatalog() {
  const query = normalizeText(state.giftCatalogQuery || '').trim();
  const region = String(state.giftCatalogRegion || 'MX').toUpperCase();
  return state.tiktokGiftCatalog
    .filter((gift) => region === 'ALL' || gift.liveDetected || (Array.isArray(gift.regions) && gift.regions.includes(region)))
    .filter((gift) => !query || normalizeText(`${gift.name} ${gift.coins || ''}`).includes(query))
    .sort((a,b) => Number(Boolean(b.liveDetected)) - Number(Boolean(a.liveDetected)) || Number(a.coins || 0) - Number(b.coins || 0) || String(a.name).localeCompare(String(b.name), 'es'));
}

function renderTikTokGiftCatalog() {
  const target = $('tiktokGiftCatalogResults');
  const count = $('tiktokGiftCatalogCount');
  if (!target) return;
  const all = visibleTikTokGiftCatalog();
  const shown = all.slice(0, 72);
  if (count) count.textContent = all.length ? `${all.length.toLocaleString('es-MX')} encontrados${all.length > shown.length ? ` · mostrando ${shown.length}` : ''}` : 'Sin coincidencias';
  target.innerHTML = shown.length
    ? shown.map((gift) => `<div class="tiktok-gift-card">${gift.imageUrl ? `<img src="${escapeHtml(gift.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="tiktok-gift-placeholder">🎁</div>'}<div><strong>${escapeHtml(gift.name)}</strong><small>${Number(gift.coins || 0) > 0 ? `${Number(gift.coins).toLocaleString('es-MX')} monedas` : gift.liveDetected ? 'Detectado en tu LIVE' : 'Precio variable'}${Array.isArray(gift.regions) && gift.regions.includes('MX') ? ' · MX' : ''}</small></div><button type="button" class="ghost tiny use-tiktok-gift" data-gift-name="${escapeHtml(gift.name)}">Usar</button></div>`).join('')
    : '<div class="gift-catalog-empty">No encontré regalos con ese nombre en el filtro actual.</div>';
}

async function loadTikTokGiftCatalog(force = false) {
  const status = $('tiktokGiftCatalogStatus');
  const refresh = $('refreshTikTokGiftCatalogBtn');
  if (status) status.textContent = force ? 'Actualizando catálogo…' : 'Cargando catálogo de TikTok…';
  if (refresh) refresh.disabled = true;
  try {
    const result = await api.getTikTokGiftCatalog({ force });
    state.tiktokGiftCatalog = Array.isArray(result?.gifts) ? result.gifts : [];
    state.tiktokGiftCatalogMeta = result || null;
    const mxCount = state.tiktokGiftCatalog.filter((gift) => Array.isArray(gift.regions) && gift.regions.includes('MX')).length;
    if (status) {
      if (result?.source === 'fallback') status.textContent = `Sin catálogo en línea · lista básica de ${state.tiktokGiftCatalog.length} regalos`;
      else status.textContent = `${state.tiktokGiftCatalog.length.toLocaleString('es-MX')} regalos globales · ${mxCount.toLocaleString('es-MX')} disponibles en México${result?.stale ? ' · copia guardada' : ''}`;
    }
    renderTikTokGiftCatalog();
  } catch (error) {
    if (status) status.textContent = `No se pudo cargar el catálogo: ${error?.message || error}`;
  } finally {
    if (refresh) refresh.disabled = false;
  }
}

function bindTikTokGiftCatalog() {
  $('giftCatalogSearchInput')?.addEventListener('input', (event) => {
    state.giftCatalogQuery = event.target.value || '';
    renderTikTokGiftCatalog();
  });
  $('giftCatalogRegionInput')?.addEventListener('change', (event) => {
    state.giftCatalogRegion = event.target.value || 'MX';
    renderTikTokGiftCatalog();
  });
  $('refreshTikTokGiftCatalogBtn')?.addEventListener('click', () => loadTikTokGiftCatalog(true));
  for (const id of ['tiktokGiftCatalogResults','detectedTikTokGifts']) {
    $(id)?.addEventListener('click', (event) => {
      const button = event.target.closest('.use-tiktok-gift');
      if (button) selectTikTokGiftForRule(button.dataset.giftName || '');
    });
  }
}

'''
renderer = replace_once(
    renderer,
    "function rememberFanSticker(event) {",
    catalog_renderer + "function rememberFanSticker(event) {",
    "lógica del catálogo de regalos",
)
renderer = replace_once(
    renderer,
    "  runEventMediaRules(event);\n  rememberFanSticker(event);",
    "  runEventMediaRules(event);\n  rememberTikTokGift(event);\n  rememberFanSticker(event);",
    "registro de regalos detectados",
)
renderer = replace_once(
    renderer,
    "  ensureV010Ui();\n  setupNavigation();\n  const initial = await api.getState();",
    "  ensureV010Ui();\n  setupNavigation();\n  bindTikTokGiftCatalog();\n  const initial = await api.getState();",
    "enlace del catálogo en init",
)
renderer = replace_once(
    renderer,
    "  try { await loadDefaultSounds(); }",
    "  try { await loadDefaultSounds(); }\n  try { await loadTikTokGiftCatalog(); } catch {}",
    "carga del catálogo en init",
)
renderer = replace_once(
    renderer,
    "const RELEASE_NOTES = Object.freeze({\n  '1.2.2': Object.freeze([",
    "const RELEASE_NOTES = Object.freeze({\n  '1.2.3': Object.freeze([\n    Object.freeze({icon:'🎁',title:'Catálogo de regalos',text:'Busca regalos de TikTok sin esperar a que alguien los envíe durante el LIVE.'}),\n    Object.freeze({icon:'⌕',title:'México y Global',text:'Filtra el catálogo actual de México o consulta todos los nombres rastreados globalmente.'}),\n    Object.freeze({icon:'↻',title:'Aprende del LIVE',text:'Los regalos recibidos muestran el nombre e ID reales y se pueden usar con un clic.'})\n  ]),\n  '1.2.2': Object.freeze([",
    "notas de 1.2.3",
)
write("src/renderer.js", renderer)

index = read("src/index.html")
old_catalog_anchor = """<div class=\"detected-fan-stickers\" id=\"detectedFanStickers\">\n<span class=\"hint\">Los stickers detectados durante el LIVE aparecerán aquí con su ID.</span>\n</div>\n<div class=\"event-rules-list\" id=\"eventMediaRulesList\">"""
new_catalog_anchor = """<div class=\"tiktok-gift-catalog\">\n<div class=\"gift-catalog-head\"><div><strong>Catálogo de regalos TikTok</strong><small id=\"tiktokGiftCatalogStatus\">Cargando catálogo…</small></div><button class=\"ghost tiny\" id=\"refreshTikTokGiftCatalogBtn\" type=\"button\">Actualizar</button></div>\n<div class=\"gift-catalog-toolbar\"><input id=\"giftCatalogSearchInput\" type=\"search\" placeholder=\"Buscar Rose, Finger Heart, Universe…\" autocomplete=\"off\"/><select id=\"giftCatalogRegionInput\"><option value=\"MX\">México</option><option value=\"ALL\">Global</option></select></div>\n<div class=\"gift-catalog-meta\"><span id=\"tiktokGiftCatalogCount\">Preparando regalos…</span><small>Selecciona “Usar” y Lulu copiará el nombre exacto a la regla de Regalo.</small></div>\n<div class=\"tiktok-gift-catalog-results\" id=\"tiktokGiftCatalogResults\"><span class=\"hint\">Cargando…</span></div>\n</div>\n<div class=\"detected-gifts-wrap\"><div class=\"gift-catalog-section-title\"><strong>Detectados en tu LIVE</strong><small>Estos son los nombres e IDs que tu conexión recibió realmente.</small></div><div class=\"detected-tiktok-gifts\" id=\"detectedTikTokGifts\"><span class=\"hint\">Cuando llegue un regalo aparecerá aquí automáticamente.</span></div></div>\n<div class=\"detected-fan-stickers\" id=\"detectedFanStickers\">\n<span class=\"hint\">Los stickers detectados durante el LIVE aparecerán aquí con su ID.</span>\n</div>\n<div class=\"event-rules-list\" id=\"eventMediaRulesList\">"""
index = replace_once(index, old_catalog_anchor, new_catalog_anchor, "interfaz del catálogo de regalos")
index = index.replace("v1.2.2", "v1.2.3")
write("src/index.html", index)

styles = read("src/styles.css")
if ".tiktok-gift-catalog{" not in styles:
    styles += r'''

/* 1.2.3: catálogo de regalos TikTok */
.tiktok-gift-catalog,.detected-gifts-wrap{margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(18,12,29,.24)}
.gift-catalog-head,.gift-catalog-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.gift-catalog-head strong,.gift-catalog-head small,.gift-catalog-section-title strong,.gift-catalog-section-title small{display:block}.gift-catalog-head small,.gift-catalog-section-title small,.gift-catalog-meta small{margin-top:3px;color:var(--muted);font-size:10px}
.gift-catalog-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 150px;gap:9px;margin-top:11px}.gift-catalog-toolbar input,.gift-catalog-toolbar select{width:100%;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:rgba(14,9,23,.42);color:var(--text);outline:none}.gift-catalog-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:9px 1px;color:#f1cee0;font-size:10px}
.tiktok-gift-catalog-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;max-height:330px;overflow:auto;padding:2px 3px 3px}.tiktok-gift-card,.detected-gift-chip{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px 9px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.03)}.tiktok-gift-card img,.tiktok-gift-placeholder,.detected-gift-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;object-fit:cover;background:rgba(255,126,182,.09)}.tiktok-gift-card strong,.tiktok-gift-card small,.detected-gift-chip strong,.detected-gift-chip small{display:block;min-width:0}.tiktok-gift-card strong,.detected-gift-chip strong{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tiktok-gift-card small,.detected-gift-chip small{margin-top:3px;color:var(--muted);font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gift-catalog-empty{grid-column:1/-1;padding:18px;text-align:center;color:var(--muted)}
.detected-tiktok-gifts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.detected-gift-chip{min-width:245px;flex:1 1 270px;max-width:430px}.detected-fan-stickers{margin-top:14px}
@media(max-width:720px){.gift-catalog-toolbar{grid-template-columns:1fr}.gift-catalog-meta,.gift-catalog-head,.gift-catalog-section-title{align-items:flex-start;flex-direction:column}.tiktok-gift-catalog-results{grid-template-columns:1fr;max-height:300px}.detected-gift-chip{min-width:0;max-width:none}}
'''
write("src/styles.css", styles)

changelog = read("CHANGELOG.md")
if "## 1.2.3" not in changelog:
    changelog = """## 1.2.3

- Añade un catálogo buscable de regalos de TikTok para configurar sonidos sin esperar a recibir primero el regalo.
- El catálogo se actualiza desde una lista pública actual, guarda una copia local y ofrece filtros México / Global.
- Evita cargar miles de tarjetas a la vez: mantiene el catálogo completo en memoria y limita el render visible para conservar fluidez.
- Registra regalos reales recibidos durante el LIVE con `giftName` y `giftId`, y permite usarlos con un clic.
- Si el catálogo en línea no responde, usa la última copia guardada; en una instalación nueva sin caché, muestra una lista básica de respaldo.

""" + changelog
write("CHANGELOG.md", changelog)

print("Lulu Finity 1.2.3 preparada: catálogo de regalos TikTok + detección real")
