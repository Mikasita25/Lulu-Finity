from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
MAIN = ROOT / "src" / "main.js"
RENDERER = ROOT / "src" / "renderer.js"

for required in (MAIN, RENDERER):
    if not required.is_file():
        raise SystemExit(f"No se encontró {required}")


def read(path):
    return path.read_text(encoding="utf-8")


def write(path, text):
    path.write_text(text, encoding="utf-8", newline="\n")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"No se pudo aplicar {label}: se esperaba 1 coincidencia y hubo {count}")
    return text.replace(old, new, 1)


main = read(MAIN)
main = replace_once(
    main,
    "const { defaultSoundCatalog } = require('./default-sound-catalog');",
    "const { defaultSoundCatalog } = require('./default-sound-catalog');\nconst widgetCustomizationPolicy = require('./widget-customization-policy');",
    "policy de personalización"
)
main = replace_once(
    main,
    "  streamWidgetBackgrounds: { ...DEFAULT_STREAM_WIDGET_BACKGROUNDS },",
    "  streamWidgetBackgrounds: { ...DEFAULT_STREAM_WIDGET_BACKGROUNDS },\n  streamWidgetCustomizations: widgetCustomizationPolicy.defaults(),",
    "ajustes por defecto de personalización"
)
main = replace_once(
    main,
    "  next.balancedKeepActive = normalizeBalancedKeepActive(next.balancedKeepActive);\n  return next;",
    "  next.balancedKeepActive = normalizeBalancedKeepActive(next.balancedKeepActive);\n  next.streamWidgetCustomizations = widgetCustomizationPolicy.sanitizeAll(next.streamWidgetCustomizations);\n  return next;",
    "normalización de personalización"
)
main = replace_once(
    main,
    "          background: normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds)[widgetType]\n        };",
    "          background: normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds)[widgetType],\n          customization: widgetCustomizationPolicy.sanitizeWidget(widgetType, runtimeResourceSettings?.streamWidgetCustomizations?.[widgetType])\n        };",
    "personalización en snapshots"
)

custom_css = r'''
  .lf-customized .card{background:var(--lf-custom-bg)!important;border-color:var(--lf-custom-border)!important;border-radius:var(--lf-custom-radius)!important;color:var(--lf-custom-text)!important;box-shadow:0 18px 52px var(--lf-custom-shadow)!important;backdrop-filter:blur(var(--lf-custom-blur))!important;transform:scale(var(--lf-custom-scale));transform-origin:top left}.lf-customized .card:before{background:linear-gradient(90deg,var(--lf-custom-primary),var(--lf-custom-secondary),var(--lf-custom-primary))!important}.lf-customized .badge{color:var(--lf-custom-text)!important;background:color-mix(in srgb,var(--lf-custom-primary) 16%,transparent)!important;border-color:color-mix(in srgb,var(--lf-custom-primary) 34%,transparent)!important}.lf-customized .copy small,.lf-customized .empty,.lf-customized .wallet-name small,.lf-customized .balance small,.lf-customized .game-copy small,.lf-customized .game-meta,.lf-customized .alert-copy span,.lf-customized .goal-meta small,.lf-customized .gift-grid small,.lf-customized .gift-grid span,.lf-customized .gift-last{color:var(--lf-custom-muted)!important}.lf-customized .balance strong,.lf-customized .game-payout{color:var(--lf-custom-primary)!important}.lf-customized .goal-track{height:var(--lf-goal-height,14px)!important}.lf-customized .goal-track span{background:linear-gradient(90deg,var(--lf-custom-primary),var(--lf-custom-secondary))!important}.lf-customized .alert-icon,.lf-customized .disc{background:linear-gradient(135deg,var(--lf-custom-primary),var(--lf-custom-secondary))!important}.lf-customized .wallet.wallet-card{border-radius:var(--lf-custom-radius)!important}.lf-customized .wallet.wallet-pill{border-radius:999px!important}
  .playlist.layout-compact{width:min(720px,100%);min-height:112px;padding:12px 16px!important}.playlist.layout-compact .head{margin:0 0 7px}.playlist.layout-compact.hide-provider .head{display:none}.playlist.layout-compact .now{display:grid;grid-template-columns:86px minmax(0,1fr);gap:16px;align-items:center;padding:0!important;margin:0!important;border:0!important;background:transparent!important}.playlist.layout-compact .now.no-art{grid-template-columns:1fr}.playlist.layout-compact .lf-now-art{width:86px;height:86px;border-radius:18px;object-fit:cover;background:linear-gradient(135deg,var(--lf-custom-primary,#ff67ad),var(--lf-custom-secondary,#5fe8ff));box-shadow:0 8px 24px rgba(0,0,0,.22)}.playlist.layout-compact .lf-now-art-fallback{display:grid;place-items:center;font-size:28px;font-weight:900}.playlist.layout-compact .lf-now-copy{min-width:0}.playlist.layout-compact .lf-now-copy strong{display:block;font-size:25px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.playlist.layout-compact .lf-now-copy small{display:block;margin-top:7px;font-size:17px;color:var(--lf-custom-muted,rgba(255,255,255,.72));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lf-progress-track{height:var(--lf-progress-height,5px);margin-top:18px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--lf-custom-text,#fff) 22%,transparent)}.lf-progress-fill{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,var(--lf-custom-primary,#fff),var(--lf-custom-secondary,#d7ffff));transition:width .55s linear}.lf-progress-time{display:flex;justify-content:space-between;gap:10px;margin-top:5px;font-size:10px;color:var(--lf-custom-muted,rgba(255,255,255,.66))}.playlist.layout-compact .queue{margin-top:10px}.playlist.layout-glass .lf-now-art,.playlist.layout-queue .lf-now-art{width:52px;height:52px;border-radius:14px;object-fit:cover;background:linear-gradient(135deg,var(--lf-custom-primary,#ff67ad),var(--lf-custom-secondary,#5fe8ff))}.playlist.layout-glass .now,.playlist.layout-queue .now{grid-template-columns:52px minmax(0,1fr)}.playlist .lf-now-art-fallback{display:grid;place-items:center}.playlist.layout-glass .lf-progress-track,.playlist.layout-queue .lf-progress-track{margin-top:10px}
'''
main = replace_once(
    main,
    "  ${streamWidgetBackgroundCss(normalizedBackground)}</style></head><body>",
    custom_css + "  ${streamWidgetBackgroundCss(normalizedBackground)}</style></head><body>",
    "CSS personalizable de widgets"
)

start_marker = "  const text=(v,f='')=>String(v??f);function renderPlaylist(data){"
end_marker = "\n  function renderWallet(data)"
start = main.find(start_marker)
end = main.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("No se encontró renderPlaylist() para aplicar el nuevo Now Playing")

new_playlist = r'''  const text=(v,f='')=>String(v??f);
  const clamp01=(v)=>Math.max(0,Math.min(1,Number(v)||0));
  function rgba(hex,opacity){const raw=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(raw))return 'rgba(18,16,26,'+opacity+')';const n=parseInt(raw,16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+opacity+')'}
  function clock(seconds){const total=Math.max(0,Math.round(Number(seconds)||0)),m=Math.floor(total/60),s=String(total%60).padStart(2,'0');return m+':'+s}
  function applyWidgetCustomization(data){const c=data?.customization,enabled=Boolean(c&&c.enabled);document.body.classList.toggle('lf-customized',enabled);if(!enabled)return;const style=document.documentElement.style;style.setProperty('--lf-custom-primary',text(c.primaryColor,'#ff67ad'));style.setProperty('--lf-custom-secondary',text(c.secondaryColor,'#5fe8ff'));style.setProperty('--lf-custom-text',text(c.textColor,'#ffffff'));style.setProperty('--lf-custom-muted',text(c.mutedColor,'#cfc7d9'));style.setProperty('--lf-custom-bg',rgba(c.backgroundColor,Math.max(0,Math.min(100,Number(c.backgroundOpacity??88)))/100));style.setProperty('--lf-custom-border',rgba(c.textColor,Math.max(0,Math.min(100,Number(c.borderOpacity??14)))/100));style.setProperty('--lf-custom-shadow','rgba(0,0,0,'+(Math.max(0,Math.min(100,Number(c.shadow??42)))/180)+')');style.setProperty('--lf-custom-radius',Math.max(0,Math.min(48,Number(c.borderRadius??22)))+'px');style.setProperty('--lf-custom-blur',Math.max(0,Math.min(32,Number(c.blur??16)))+'px');style.setProperty('--lf-custom-scale',Math.max(.6,Math.min(1.5,Number(c.scale??100)/100)));style.setProperty('--lf-progress-height',Math.max(2,Math.min(12,Number(c.progressHeight??5)))+'px');style.setProperty('--lf-goal-height',Math.max(4,Math.min(30,Number(c.goalBarHeight??14)))+'px');walletCard?.classList.toggle('wallet-card',c.walletShape==='card');walletCard?.classList.toggle('wallet-pill',c.walletShape!=='card')}
  function renderPlaylist(data){playlistCard.classList.remove('hidden');walletCard.classList.add('hidden');gameCard.classList.add('hidden');const c=data?.customization||{},layout=['compact','glass','queue'].includes(c.layout)?c.layout:'queue';playlistCard.classList.remove('layout-compact','layout-glass','layout-queue','hide-provider');playlistCard.classList.add('layout-'+layout);if(c.showProvider===false)playlistCard.classList.add('hide-provider');document.getElementById('provider').textContent=text(data.provider,'Música');const now=document.getElementById('now'),queue=document.getElementById('queue');now.replaceChildren();queue.replaceChildren();if(data.current){const box=document.createElement('div');box.className='now'+(c.showArtwork===false?' no-art':'');if(c.showArtwork!==false){let art;if(data.current.artworkUrl){art=document.createElement('img');art.src=text(data.current.artworkUrl);art.alt='';art.referrerPolicy='no-referrer';art.addEventListener('error',()=>{const fallback=document.createElement('div');fallback.className='lf-now-art lf-now-art-fallback';fallback.textContent='♪';art.replaceWith(fallback)},{once:true})}else{art=document.createElement('div');art.className='lf-now-art lf-now-art-fallback';art.textContent='♪'}art.classList.add('lf-now-art');box.appendChild(art)}const copy=document.createElement('div');copy.className='lf-now-copy copy';const title=document.createElement('strong');title.textContent=text(data.current.title,'Canción actual');const by=document.createElement('small');const secondary=text(data.current.artist||data.current.requestedBy,'Reproduciendo ahora');by.textContent=secondary;const progress=document.createElement('div');progress.className='lf-progress-track';const fill=document.createElement('div');fill.className='lf-progress-fill';const duration=Math.max(0,Number(data.current.duration||0)),current=Math.max(0,Number(data.current.currentTime||0)),fraction=duration>0?clamp01(current/duration):clamp01(data.current.progress??(preview?0.42:0));fill.style.width=(fraction*100).toFixed(2)+'%';progress.appendChild(fill);copy.append(title,by,progress);if(duration>0){const time=document.createElement('div');time.className='lf-progress-time';const a=document.createElement('span');a.textContent=clock(current);const b=document.createElement('span');b.textContent=clock(duration);time.append(a,b);copy.appendChild(time)}box.appendChild(copy);now.appendChild(box)}else{const empty=document.createElement('div');empty.className='empty';empty.textContent='No hay una canción reproduciéndose.';now.appendChild(empty)}const items=Array.isArray(data.queue)?data.queue:[];const showQueue=c.showQueue===true||layout==='queue';queue.style.display=showQueue?'flex':'none';if(showQueue){if(!items.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='La cola está vacía.';queue.appendChild(empty)}items.slice(0,5).forEach((item,index)=>{const row=document.createElement('div');row.className='song';const number=document.createElement('span');number.textContent=String(index+1);const copy=document.createElement('div');copy.className='copy';const title=document.createElement('strong');title.textContent=text(item.title,'Canción');const by=document.createElement('small');by.textContent=item.requestedBy?'Pedida por '+item.requestedBy:'Solicitud manual';copy.append(title,by);row.append(number,copy);queue.appendChild(row)})}}
'''
main = main[:start] + new_playlist + main[end:]
main = replace_once(
    main,
    "  function render(data){if((data.theme&&data.theme!==activeTheme)",
    "  function render(data){applyWidgetCustomization(data);if((data.theme&&data.theme!==activeTheme)",
    "aplicar personalización al render"
)
write(MAIN, main)

renderer = read(RENDERER)
helper = r'''
function playlistArtworkUrl(current, player, spotify) {
  const direct = String(current?.artworkUrl || current?.thumbnailUrl || current?.thumbnail || player?.artworkUrl || '').trim();
  if (direct) return direct.slice(0,1000);
  if (spotify) return '';
  const source = String(player?.url || current?.url || current?.selectedUrl || '').trim();
  if (!source) return '';
  let videoId = '';
  try {
    const parsed = new URL(source);
    const host = parsed.hostname.toLowerCase().replace(/^www\./,'');
    if (host === 'youtu.be') videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host.endsWith('.youtube.com')) videoId = parsed.searchParams.get('v') || '';
  } catch {}
  if (!videoId) {
    const match = source.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
    videoId = match?.[1] || '';
  }
  return /^[A-Za-z0-9_-]{6,20}$/.test(videoId) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
}

'''
renderer = replace_once(renderer, "function playlistWidgetPayload() {", helper + "function playlistWidgetPayload() {", "portada de música")
old_current = """    current:current ? {\n      title:String(player?.title || current?.title || current?.selectedTitle || current?.query || 'Canción actual').slice(0,180),\n      requestedBy:String(current?.requestedBy || (spotify ? player?.artist : current?.isRecommendation ? 'Recomendación' : '') || '').slice(0,100)\n    } : null,"""
new_current = """    current:current ? {\n      title:String(player?.title || current?.title || current?.selectedTitle || current?.query || 'Canción actual').slice(0,180),\n      artist:String((spotify ? player?.artist : current?.artist || current?.channelTitle) || '').slice(0,120),\n      requestedBy:String(current?.requestedBy || (spotify ? player?.artist : current?.isRecommendation ? 'Recomendación' : '') || '').slice(0,100),\n      artworkUrl:playlistArtworkUrl(current,player,spotify),\n      currentTime:Math.max(0,Number(player?.currentTime||0)),\n      duration:Math.max(0,Number(player?.duration||0)),\n      progress:Number(player?.duration||0)>0?Math.max(0,Math.min(1,Number(player?.currentTime||0)/Number(player.duration))):0\n    } : null,"""
renderer = replace_once(renderer, old_current, new_current, "progreso y metadata de música")
write(RENDERER, renderer)

print("Personalización central y Now Playing aplicados")
