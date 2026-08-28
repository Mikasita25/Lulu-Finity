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

POLICY = ROOT / "src" / "widget-customization-policy.js"
PANEL = ROOT / "src" / "widget-customizer-panel.js"
PANEL_CSS = ROOT / "src" / "widget-customizer-panel.css"
for required in (POLICY,PANEL,PANEL_CSS):
    if not required.is_file(): raise SystemExit(f"No se encontró {required}")

policy = read(POLICY)
policy = replace_once(
    policy,
    "  const WALLET_SHAPES = new Set(['pill','card']);",
    """  const WALLET_SHAPES = new Set(['pill','card']);
  const ASSET_FITS = new Set(['cover','contain','fill']);
  const ASSET_POSITIONS = new Set(['center','top','bottom','left','right','top-left','top-right','bottom-left','bottom-right']);
  const LOGO_POSITIONS = new Set(['top-left','top','top-right','left','center','right','bottom-left','bottom','bottom-right']);
  const FONTS = new Set(['Segoe UI','Arial','Trebuchet MS','Georgia','Impact','Courier New','Comic Sans MS']);

  function assetName(value) {
    const name = String(value || '').trim();
    return /^image-[a-zA-Z0-9._-]{1,170}\\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(name) ? name : '';
  }""",
    "tipos de assets personalizados"
)
policy = replace_once(
    policy,
    "    shadow: 42,\n    scale: 100\n  });",
    """    shadow: 42,
    scale: 100,
    fontFamily: 'Segoe UI',
    backgroundAsset: '',
    backgroundAssetFit: 'cover',
    backgroundAssetPosition: 'center',
    backgroundAssetOpacity: 100,
    logoAsset: '',
    logoAssetPosition: 'top-right',
    logoAssetSize: 64,
    logoAssetOpacity: 100,
    frameAsset: '',
    frameAssetFit: 'fill',
    frameAssetOpacity: 100
  });""",
    "defaults de assets personalizados"
)
policy = replace_once(
    policy,
    "      shadow: Math.round(clamp(source.shadow, 0, 100, fallback.shadow)),\n      scale: Math.round(clamp(source.scale, 60, 150, fallback.scale))\n    };",
    """      shadow: Math.round(clamp(source.shadow, 0, 100, fallback.shadow)),
      scale: Math.round(clamp(source.scale, 60, 150, fallback.scale)),
      fontFamily: FONTS.has(String(source.fontFamily || '')) ? String(source.fontFamily) : fallback.fontFamily,
      backgroundAsset: assetName(source.backgroundAsset),
      backgroundAssetFit: ASSET_FITS.has(String(source.backgroundAssetFit || '')) ? String(source.backgroundAssetFit) : fallback.backgroundAssetFit,
      backgroundAssetPosition: ASSET_POSITIONS.has(String(source.backgroundAssetPosition || '')) ? String(source.backgroundAssetPosition) : fallback.backgroundAssetPosition,
      backgroundAssetOpacity: Math.round(clamp(source.backgroundAssetOpacity, 0, 100, fallback.backgroundAssetOpacity)),
      logoAsset: assetName(source.logoAsset),
      logoAssetPosition: LOGO_POSITIONS.has(String(source.logoAssetPosition || '')) ? String(source.logoAssetPosition) : fallback.logoAssetPosition,
      logoAssetSize: Math.round(clamp(source.logoAssetSize, 24, 180, fallback.logoAssetSize)),
      logoAssetOpacity: Math.round(clamp(source.logoAssetOpacity, 0, 100, fallback.logoAssetOpacity)),
      frameAsset: assetName(source.frameAsset),
      frameAssetFit: ASSET_FITS.has(String(source.frameAssetFit || '')) ? String(source.frameAssetFit) : fallback.frameAssetFit,
      frameAssetOpacity: Math.round(clamp(source.frameAssetOpacity, 0, 100, fallback.frameAssetOpacity))
    };""",
    "saneo de assets personalizados"
)
policy = replace_once(
    policy,
    "  return Object.freeze({ TYPES, defaults, sanitizeAll, sanitizeWidget, color });",
    "  return Object.freeze({ TYPES, defaults, sanitizeAll, sanitizeWidget, color, assetName });",
    "export de assetName"
)
write(POLICY, policy)

panel = read(PANEL)

asset_panel_helpers = r'''
  const CUSTOM_ASSET_MAX_BYTES = 12 * 1024 * 1024;
  const ASSET_POSITIONS = [['center','Centro'],['top','Arriba'],['bottom','Abajo'],['left','Izquierda'],['right','Derecha'],['top-left','Arriba izquierda'],['top-right','Arriba derecha'],['bottom-left','Abajo izquierda'],['bottom-right','Abajo derecha']];
  const LOGO_POSITIONS = [['top-left','Arriba izquierda'],['top','Arriba centro'],['top-right','Arriba derecha'],['left','Centro izquierda'],['center','Centro'],['right','Centro derecha'],['bottom-left','Abajo izquierda'],['bottom','Abajo centro'],['bottom-right','Abajo derecha']];
  const FONT_OPTIONS = [['Segoe UI','Segoe UI'],['Arial','Arial'],['Trebuchet MS','Trebuchet'],['Georgia','Georgia'],['Impact','Impact'],['Courier New','Courier New'],['Comic Sans MS','Comic Sans']];

  function storedAssetName(media) {
    const direct = String(media?.storedName || '').trim();
    const fromPath = String(media?.path || '').split(/[\/\\]/).filter(Boolean).pop() || '';
    const name = direct || fromPath;
    return /^image-[a-zA-Z0-9._-]{1,170}\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(name) ? name : '';
  }

  function assetFileRow(title, help, field, value) {
    const has = Boolean(value);
    return `<div class="lf-customizer-asset-row"><div><strong>${esc(title)}</strong><small>${esc(help)}</small><em>${has?esc(value):'Sin archivo'}</em></div><span><button type="button" class="ghost tiny" data-asset-action="upload" data-asset-field="${esc(field)}">${has?'Cambiar':'Subir'}</button>${has?`<button type="button" class="ghost tiny danger" data-asset-action="remove" data-asset-field="${esc(field)}">Quitar</button>`:''}</span></div>`;
  }

  function customAssetControls(config, ranking=false) {
    const attr = (key) => ranking ? `data-rank-key="${esc(key)}"` : `data-custom-key="${esc(key)}"`;
    const range = (label,key,value,min,max,suffix) => `<label class="lf-customizer-field full"><span>${esc(label)}</span><span class="lf-customizer-range"><input type="range" min="${min}" max="${max}" value="${Number(value)}" ${attr(key)}><output>${Number(value)}${esc(suffix)}</output></span></label>`;
    const select = (label,key,items,value) => `<label class="lf-customizer-field"><span>${esc(label)}</span><select ${attr(key)}>${optionList(items,value)}</select></label>`;
    const bgFit = String(config.backgroundAssetFit || 'cover');
    const bgPosition = String(config.backgroundAssetPosition || 'center');
    const logoPosition = String(config.logoAssetPosition || 'top-right');
    const frameFit = String(config.frameAssetFit || 'fill');
    return `<div class="lf-customizer-group lf-customizer-assets"><strong>Fotos y capas propias</strong><p class="lf-customizer-assets-help">Los archivos se guardan dentro de Lulu y se sincronizan con el mismo HTTPS. No se usa la ruta original de tu PC.</p>
      <div class="lf-customizer-asset-list">
        ${assetFileRow('Fondo propio','Foto, GIF o textura detrás del contenido.','backgroundAsset',config.backgroundAsset)}
        ${assetFileRow('Logo / decoración','Imagen pequeña encima del widget.','logoAsset',config.logoAsset)}
        ${assetFileRow('Marco transparente','PNG, WebP o GIF colocado encima de todo.','frameAsset',config.frameAsset)}
      </div>
      <div class="lf-customizer-grid">${select('Ajuste del fondo','backgroundAssetFit',[['cover','Llenar'],['contain','Completo'],['fill','Estirar']],bgFit)}${select('Posición del fondo','backgroundAssetPosition',ASSET_POSITIONS,bgPosition)}${range('Opacidad de la foto','backgroundAssetOpacity',config.backgroundAssetOpacity??100,0,100,'%')}${select('Posición del logo','logoAssetPosition',LOGO_POSITIONS,logoPosition)}${range('Tamaño del logo','logoAssetSize',config.logoAssetSize??64,24,180,'px')}${range('Opacidad del logo','logoAssetOpacity',config.logoAssetOpacity??100,0,100,'%')}${select('Ajuste del marco','frameAssetFit',[['fill','Estirar al widget'],['contain','Completo'],['cover','Llenar']],frameFit)}${range('Opacidad del marco','frameAssetOpacity',config.frameAssetOpacity??100,0,100,'%')}${ranking?'':select('Tipografía','fontFamily',FONT_OPTIONS,String(config.fontFamily||'Segoe UI'))}</div>
      <div class="lf-customizer-assets-note">Hasta 12 MB por imagen · PNG, JPG, WebP, GIF o BMP · los juegos no usan estas capas.</div>
    </div>`;
  }

  async function handleAssetAction(button) {
    const field = String(button?.dataset?.assetField || '');
    if (!['backgroundAsset','logoAsset','frameAsset'].includes(field)) return;
    const cfg = current === 'rankings' ? rankingConfig() : settings.streamWidgetCustomizations[current];
    if (!cfg) return;
    if (button.dataset.assetAction === 'remove') {
      cfg[field] = '';
      renderControls();
      await saveNow(true);
      return;
    }
    setStatus('Seleccionando…');
    try {
      const media = await api.pickMedia('image');
      if (!media || media.cancelled || media.canceled) { setStatus('Listo'); return; }
      if (Number(media.size || 0) > CUSTOM_ASSET_MAX_BYTES) throw new Error('La imagen supera 12 MB.');
      const name = storedAssetName(media);
      if (!name) throw new Error('Lulu no pudo guardar la imagen con un nombre seguro.');
      cfg[field] = name;
      if (current !== 'rankings') cfg.enabled = true;
      renderControls();
      await saveNow(true);
    } catch (error) {
      setStatus('Imagen no válida','error');
      console.warn('No se pudo agregar la imagen personalizada:', error);
    }
  }

'''
panel = replace_once(
    panel,
    "  function renderWidgetControls() {",
    asset_panel_helpers + "  function renderWidgetControls() {",
    "controles de assets"
)
panel = replace_once(
    panel,
    "      <div class=\"lf-customizer-info\">Los juegos quedan fuera de este editor.",
    "      ${customAssetControls(config,false)}\n      <div class=\"lf-customizer-info\">Los juegos quedan fuera de este editor.",
    "assets en widgets"
)
panel = replace_once(
    panel,
    "      <div class=\"lf-customizer-game-note\">Los rankings sí se pueden personalizar libremente",
    "      ${customAssetControls(cfg,true)}\n      <div class=\"lf-customizer-game-note\">Los rankings sí se pueden personalizar libremente",
    "assets en rankings"
)
panel = replace_once(
    panel,
    "    controls.addEventListener('click',(event)=>{\n      const rank = event.target.closest('[data-rank-slot]');",
    """    controls.addEventListener('click',(event)=>{
      const assetAction = event.target.closest('[data-asset-action]');
      if (assetAction) { void handleAssetAction(assetAction); return; }
      const rank = event.target.closest('[data-rank-slot]');""",
    "eventos de upload"
)
panel = panel.replace(
    "['backgroundOpacity','borderOpacity','shadow','scale'].includes(input.dataset.customKey)",
    "['backgroundOpacity','borderOpacity','shadow','scale','backgroundAssetOpacity','logoAssetOpacity','frameAssetOpacity'].includes(input.dataset.customKey)"
)
panel = panel.replace(
    "['borderRadius','blur','progressHeight','goalBarHeight'].includes(input.dataset.customKey)",
    "['borderRadius','blur','progressHeight','goalBarHeight','logoAssetSize'].includes(input.dataset.customKey)"
)
write(PANEL, panel)

css = read(PANEL_CSS)
if "/* Lulu custom image assets */" not in css:
    css += r'''

/* Lulu custom image assets */
.lf-customizer-assets-help{margin:6px 0 12px;color:rgba(255,255,255,.58);font-size:12px;line-height:1.45}.lf-customizer-asset-list{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}.lf-customizer-asset-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.035)}.lf-customizer-asset-row>div{min-width:0}.lf-customizer-asset-row strong,.lf-customizer-asset-row small,.lf-customizer-asset-row em{display:block}.lf-customizer-asset-row small{margin-top:2px;color:rgba(255,255,255,.52);font-size:11px}.lf-customizer-asset-row em{margin-top:5px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(137,226,255,.82);font-size:10px;font-style:normal}.lf-customizer-asset-row>span{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.lf-customizer-asset-row .danger{opacity:.74}.lf-customizer-assets-note{margin-top:10px;padding:8px 10px;border-radius:10px;background:rgba(95,232,255,.06);color:rgba(255,255,255,.52);font-size:10px;line-height:1.4}
'''
write(PANEL_CSS, css)

for file, needles in {POLICY:["backgroundAsset","logoAsset","frameAsset","assetName"],PANEL:["Fotos y capas propias","api.pickMedia('image')","backgroundAssetOpacity"]}.items():
    text=read(file)
    for needle in needles:
        if needle not in text: raise SystemExit(f"Falta {needle!r} en {file}")
print("Editor de fotos y estilos personalizados integrado")
