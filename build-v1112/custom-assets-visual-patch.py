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

main = replace_once(
    main,
    "    path: destination,\n    url: pathToFileURL(destination).href,\n    size: stats.size",
    "    path: destination,\n    storedName: path.basename(destination),\n    url: pathToFileURL(destination).href,\n    size: stats.size",
    "storedName de media"
)

main = replace_once(
    main,
    "  if (!MEDIA_EXTENSIONS[type].has(extension)) throw new Error(`Formato de ${type === 'image' ? 'imagen' : 'audio'} no compatible.`);\n  const paths = getDataPaths();",
    """  if (!MEDIA_EXTENSIONS[type].has(extension)) throw new Error(`Formato de ${type === 'image' ? 'imagen' : 'audio'} no compatible.`);
  const sourceStats = await fsp.stat(source);
  if (type === 'image' && sourceStats.size > 12 * 1024 * 1024) throw new Error('La imagen supera 12 MB. Reduce su tamaño para mantener compatible el HTTPS.');
  const paths = getDataPaths();""",
    "límite HTTPS de imágenes"
)

safe_media_helpers = r'''
function safeCustomMediaName(value) {
  const name = String(value || '').trim();
  return /^image-[a-zA-Z0-9._-]{1,170}\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(name) ? name : '';
}

function customMediaPath(value) {
  const name = safeCustomMediaName(value);
  if (!name) return '';
  const root = path.resolve(getDataPaths().media);
  const candidate = path.resolve(root, name);
  if (!candidate.startsWith(`${root}${path.sep}`) || !fs.existsSync(candidate)) return '';
  return candidate;
}

function customMediaPaths(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const paths = ['backgroundAsset','logoAsset','frameAsset']
    .map((field) => customMediaPath(source[field]))
    .filter(Boolean);
  return [...new Set(paths)];
}

'''
main = replace_once(
    main,
    "function normalizeRankingConfig(value = {}, slot = 1) {",
    safe_media_helpers + "function normalizeRankingConfig(value = {}, slot = 1) {",
    "helpers de media personalizada"
)

main = replace_once(
    main,
    "    backgroundOpacity: Math.min(100, Math.max(0, Math.round(Number(source.backgroundOpacity ?? fallback.backgroundOpacity)))),\n    rgbText: source.rgbText === true,",
    """    backgroundOpacity: Math.min(100, Math.max(0, Math.round(Number(source.backgroundOpacity ?? fallback.backgroundOpacity)))),
    backgroundAsset: safeCustomMediaName(source.backgroundAsset),
    backgroundAssetFit: ['cover','contain','fill'].includes(String(source.backgroundAssetFit || '')) ? String(source.backgroundAssetFit) : 'cover',
    backgroundAssetPosition: ['center','top','bottom','left','right','top-left','top-right','bottom-left','bottom-right'].includes(String(source.backgroundAssetPosition || '')) ? String(source.backgroundAssetPosition) : 'center',
    backgroundAssetOpacity: Math.min(100, Math.max(0, Math.round(Number(source.backgroundAssetOpacity ?? 100)))),
    logoAsset: safeCustomMediaName(source.logoAsset),
    logoAssetPosition: ['top-left','top','top-right','left','center','right','bottom-left','bottom','bottom-right'].includes(String(source.logoAssetPosition || '')) ? String(source.logoAssetPosition) : 'top-right',
    logoAssetSize: Math.min(180, Math.max(24, Math.round(Number(source.logoAssetSize ?? 64)))),
    logoAssetOpacity: Math.min(100, Math.max(0, Math.round(Number(source.logoAssetOpacity ?? 100)))),
    frameAsset: safeCustomMediaName(source.frameAsset),
    frameAssetFit: ['cover','contain','fill'].includes(String(source.frameAssetFit || '')) ? String(source.frameAssetFit) : 'fill',
    frameAssetOpacity: Math.min(100, Math.max(0, Math.round(Number(source.frameAssetOpacity ?? 100)))),
    rgbText: source.rgbText === true,""",
    "assets en rankings"
)

old_media_route = """      if (url.pathname.startsWith('/overlay-media/')) {
        const fileName = path.basename(decodeURIComponent(url.pathname.slice('/overlay-media/'.length)));
        const mediaRoot = path.resolve(getDataPaths().media);
        const file = path.resolve(mediaRoot, fileName);
        if (!file.startsWith(`${mediaRoot}${path.sep}`) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
        const ext = path.extname(file).toLowerCase();
        const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.bmp':'image/bmp' };
        if (!types[ext]) { response.writeHead(415); response.end(); return; }
        response.writeHead(200, { 'Content-Type': types[ext], 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(file).pipe(response); return;
      }"""
new_media_route = """      const customMediaPrefix = ['/overlay-media/','/widget-media/','/ranking-media/'].find((prefix) => url.pathname.startsWith(prefix));
      if (customMediaPrefix) {
        const fileName = path.basename(decodeURIComponent(url.pathname.slice(customMediaPrefix.length)));
        const mediaRoot = path.resolve(getDataPaths().media);
        const file = path.resolve(mediaRoot, fileName);
        if (!file.startsWith(`${mediaRoot}${path.sep}`) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
        const ext = path.extname(file).toLowerCase();
        const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.bmp':'image/bmp' };
        if (!types[ext]) { response.writeHead(415); response.end(); return; }
        response.writeHead(200, { 'Content-Type': types[ext], 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options':'nosniff' });
        fs.createReadStream(file).pipe(response); return;
      }"""
main = replace_once(main, old_media_route, new_media_route, "rutas locales de assets")

asset_css_anchor = ".lf-customized .wallet.wallet-pill{border-radius:999px!important}\n"
asset_css = asset_css_anchor + r"""  .lf-customized .card{isolation:isolate}.lf-customized .card:before{z-index:7}.lf-customized .card>.lf-custom-media-bg,.lf-customized .card>.lf-custom-media-frame,.lf-customized .card>.lf-custom-media-logo{position:absolute;display:block;pointer-events:none;user-select:none}.lf-customized .card>.lf-custom-media-bg{inset:0;width:100%;height:100%;z-index:0}.lf-customized .card>.lf-custom-media-frame{inset:0;width:100%;height:100%;z-index:6}.lf-customized .card>.lf-custom-media-logo{z-index:5;max-width:45%;max-height:45%;object-fit:contain}.lf-customized .card>:not(.lf-custom-media-bg):not(.lf-custom-media-frame):not(.lf-custom-media-logo){position:relative;z-index:2}
"""
main = replace_once(main, asset_css_anchor, asset_css, "CSS de capas personalizadas")

asset_js = r'''  const lfAssetName=(value)=>{const name=String(value||'').trim();return /^image-[a-zA-Z0-9._-]{1,170}\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(name)?name:''};
  const lfAssetPosition=(value)=>({'center':'center center','top':'center top','bottom':'center bottom','left':'left center','right':'right center','top-left':'left top','top-right':'right top','bottom-left':'left bottom','bottom-right':'right bottom'}[String(value||'')]||'center center');
  function lfAssetUrl(name){const safe=lfAssetName(name);if(!safe)return'';const params=new URLSearchParams(location.search),token=params.get('token')||'';return '/widget-media/'+encodeURIComponent(safe)+'?type='+encodeURIComponent(widget)+'&token='+encodeURIComponent(token)}
  function lfAssetNode(card,kind,name){const cls='lf-custom-media-'+kind;let node=card?.querySelector('.'+cls);const safe=lfAssetName(name);if(!safe){node?.remove();return null}if(!node){node=document.createElement('img');node.className=cls;node.alt='';node.decoding='async';node.addEventListener('error',()=>{node.style.display='none'});node.addEventListener('load',()=>{node.style.display='block'});card.appendChild(node)}const src=lfAssetUrl(safe);if(node.dataset.asset!==safe){node.dataset.asset=safe;node.src=src}return node}
  function lfPlaceLogo(node,position){if(!node)return;node.style.left=node.style.right=node.style.top=node.style.bottom='auto';node.style.transform='none';const p=String(position||'top-right');if(p.includes('left'))node.style.left='10px';else if(p.includes('right'))node.style.right='10px';else{node.style.left='50%';node.style.transform='translateX(-50%)'}if(p.includes('top'))node.style.top='10px';else if(p.includes('bottom'))node.style.bottom='10px';else{node.style.top='50%';node.style.transform=(node.style.transform?node.style.transform+' ':'')+'translateY(-50%)'}}
  function applyCustomMedia(c){const card={playlist:playlistCard,wallet:walletCard,alert:alertCard,goal:goalCard,gift:giftCard}[widget];if(!card)return;const bg=lfAssetNode(card,'bg',c?.backgroundAsset);if(bg){bg.style.objectFit=['cover','contain','fill'].includes(c.backgroundAssetFit)?c.backgroundAssetFit:'cover';bg.style.objectPosition=lfAssetPosition(c.backgroundAssetPosition);bg.style.opacity=String(Math.max(0,Math.min(100,Number(c.backgroundAssetOpacity??100)))/100)}const logo=lfAssetNode(card,'logo',c?.logoAsset);if(logo){const size=Math.max(24,Math.min(180,Number(c.logoAssetSize??64)));logo.style.width=size+'px';logo.style.height=size+'px';logo.style.opacity=String(Math.max(0,Math.min(100,Number(c.logoAssetOpacity??100)))/100);lfPlaceLogo(logo,c.logoAssetPosition)}const frame=lfAssetNode(card,'frame',c?.frameAsset);if(frame){frame.style.objectFit=['cover','contain','fill'].includes(c.frameAssetFit)?c.frameAssetFit:'fill';frame.style.opacity=String(Math.max(0,Math.min(100,Number(c.frameAssetOpacity??100)))/100)}}
'''
main = replace_once(
    main,
    "  function applyWidgetCustomization(data){",
    asset_js + "  function applyWidgetCustomization(data){",
    "JS de capas de widgets"
)
main = replace_once(
    main,
    "walletCard?.classList.toggle('wallet-card',c.walletShape==='card');walletCard?.classList.toggle('wallet-pill',c.walletShape!=='card')}",
    "walletCard?.classList.toggle('wallet-card',c.walletShape==='card');walletCard?.classList.toggle('wallet-pill',c.walletShape!=='card');document.body.style.fontFamily=String(c.fontFamily||'Segoe UI')+',Arial,sans-serif';applyCustomMedia(c)}",
    "aplicación de capas de widgets"
)

main = replace_once(
    main,
    "#board{--text:#fff;--accent:#ff2d8f;--accent2:#25f4ee;--bg:16,16,24;--opacity:.82;width:min(560px,100%);border-radius:22px;overflow:hidden;position:relative;",
    "#board{--text:#fff;--accent:#ff2d8f;--accent2:#25f4ee;--bg:16,16,24;--opacity:.82;width:min(560px,100%);border-radius:22px;overflow:hidden;position:relative;isolation:isolate;",
    "aislamiento del ranking"
)
main = replace_once(
    main,
    "#board:before{content:'';position:absolute;inset:0 0 auto;height:4px;",
    "#board:before{content:'';position:absolute;z-index:7;inset:0 0 auto;height:4px;",
    "z-index del ranking"
)
main = replace_once(
    main,
    ".hide-value.hide-avatar.hide-rank .row{grid-template-columns:1fr}@keyframes enter",
    ".hide-value.hide-avatar.hide-rank .row{grid-template-columns:1fr}#board>.lf-rank-bg,#board>.lf-rank-frame,#board>.lf-rank-logo{position:absolute;display:block;pointer-events:none;user-select:none}#board>.lf-rank-bg{inset:0;width:100%;height:100%;z-index:0}#board>.lf-rank-frame{inset:0;width:100%;height:100%;z-index:6}#board>.lf-rank-logo{z-index:5;max-width:45%;max-height:45%;object-fit:contain}#board>*:not(.lf-rank-bg):not(.lf-rank-frame):not(.lf-rank-logo){position:relative;z-index:2}@keyframes enter",
    "CSS de assets de ranking"
)
rank_asset_js = r'''  const rankAssetName=(value)=>{const name=String(value||'').trim();return /^image-[a-zA-Z0-9._-]{1,170}\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(name)?name:''};
  const rankAssetPosition=(value)=>({'center':'center center','top':'center top','bottom':'center bottom','left':'left center','right':'right center','top-left':'left top','top-right':'right top','bottom-left':'left bottom','bottom-right':'right bottom'}[String(value||'')]||'center center');
  function rankAssetUrl(name){const safe=rankAssetName(name);if(!safe)return'';const params=new URLSearchParams(location.search),token=params.get('token')||'',slot=params.get('slot')||'1';return '/ranking-media/'+encodeURIComponent(safe)+'?slot='+encodeURIComponent(slot)+'&token='+encodeURIComponent(token)}
  function rankAssetNode(kind,name){const cls='lf-rank-'+kind;let node=board.querySelector('.'+cls),safe=rankAssetName(name);if(!safe){node?.remove();return null}if(!node){node=document.createElement('img');node.className=cls;node.alt='';node.decoding='async';node.addEventListener('error',()=>{node.style.display='none'});node.addEventListener('load',()=>{node.style.display='block'});board.appendChild(node)}if(node.dataset.asset!==safe){node.dataset.asset=safe;node.src=rankAssetUrl(safe)}return node}
  function rankPlaceLogo(node,position){if(!node)return;node.style.left=node.style.right=node.style.top=node.style.bottom='auto';node.style.transform='none';const p=String(position||'top-right');if(p.includes('left'))node.style.left='10px';else if(p.includes('right'))node.style.right='10px';else{node.style.left='50%';node.style.transform='translateX(-50%)'}if(p.includes('top'))node.style.top='10px';else if(p.includes('bottom'))node.style.bottom='10px';else{node.style.top='50%';node.style.transform=(node.style.transform?node.style.transform+' ':'')+'translateY(-50%)'}}
  function applyRankingAssets(c){const bg=rankAssetNode('bg',c.backgroundAsset);if(bg){bg.style.objectFit=['cover','contain','fill'].includes(c.backgroundAssetFit)?c.backgroundAssetFit:'cover';bg.style.objectPosition=rankAssetPosition(c.backgroundAssetPosition);bg.style.opacity=String(Math.max(0,Math.min(100,Number(c.backgroundAssetOpacity??100)))/100)}const logo=rankAssetNode('logo',c.logoAsset);if(logo){const size=Math.max(24,Math.min(180,Number(c.logoAssetSize??64)));logo.style.width=size+'px';logo.style.height=size+'px';logo.style.opacity=String(Math.max(0,Math.min(100,Number(c.logoAssetOpacity??100)))/100);rankPlaceLogo(logo,c.logoAssetPosition)}const frame=rankAssetNode('frame',c.frameAsset);if(frame){frame.style.objectFit=['cover','contain','fill'].includes(c.frameAssetFit)?c.frameAssetFit:'fill';frame.style.opacity=String(Math.max(0,Math.min(100,Number(c.frameAssetOpacity??100)))/100)}}
'''
main = replace_once(
    main,
    "  function render(data){\n    const c=data.config||{};",
    rank_asset_js + "  function render(data){\n    const c=data.config||{};",
    "JS de assets de ranking"
)
main = replace_once(
    main,
    "    board.style.fontFamily=fontMap[c.font]||fontMap['Segoe UI'];\n    title.textContent=c.title||'RANKING';",
    "    board.style.fontFamily=fontMap[c.font]||fontMap['Segoe UI'];\n    applyRankingAssets(c);\n    title.textContent=c.title||'RANKING';",
    "aplicación de assets de ranking"
)

write(MAIN, main)
print("Capas visuales personalizadas integradas")
