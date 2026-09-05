(function (root, factory) {
  const design = factory();
  if (typeof module === 'object' && module.exports) module.exports = design;
  else root.LuluWidgetDesign = design;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const fonts = Object.freeze({ system:'"Segoe UI",Arial,sans-serif', rounded:'"Arial Rounded MT Bold","Trebuchet MS",sans-serif', modern:'Verdana,Arial,sans-serif', editorial:'Georgia,"Times New Roman",serif', mono:'Consolas,"Courier New",monospace' });
  function number(value, min, max, fallback) { const n = Number(value); return value == null || value === '' || !Number.isFinite(n) ? fallback : Math.max(min, Math.min(max, n)); }
  function image(value) {
    const raw = String(value || '');
    if (/^\/overlay-media\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|bmp)$/.test(raw)) return raw;
    try { const u = new URL(raw); if (u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash && /^\/v1\/overlays\/[a-f0-9]{32}\/assets\/[a-f0-9]{64}\.(png|jpe?g|webp|bmp)$/.test(u.pathname)) return u.href; } catch {}
    return '';
  }
  function normalize(source = {}) {
    return { fontFamily:Object.hasOwn(fonts, source.fontFamily) ? source.fontFamily : 'system', fontSize:number(source.fontSize,12,40,22), scale:number(source.scale,50,150,100), borderWidth:number(source.borderWidth,0,8,1), shadow:number(source.shadow,0,60,24), blur:number(source.blur,0,24,0), padding:number(source.padding,8,40,18), backgroundImage:image(source.backgroundImage), logoImage:image(source.logoImage), backgroundFit:source.backgroundFit === 'contain' ? 'contain' : 'cover' };
  }
  function css(source = {}) {
    if (!source.enabled) return '';
    const s = normalize(source);
    const background = s.backgroundImage ? `background-image:linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.2)),url("${s.backgroundImage}")!important;background-size:${s.backgroundFit}!important;background-position:center!important;background-repeat:no-repeat!important;` : '';
    const logo = s.logoImage ? `.card:after{content:"";display:block;width:44px;height:44px;margin-top:10px;background:url("${s.logoImage}") center/contain no-repeat}` : '';
    return `.card{font-family:${fonts[s.fontFamily]}!important;zoom:${s.scale/100};padding:${s.padding}px!important;border-width:${s.borderWidth}px!important;box-shadow:0 ${s.shadow/3}px ${s.shadow}px rgba(0,0,0,.38)!important;backdrop-filter:blur(${s.blur}px)!important;${background}}.card .head strong,.card .copy strong,.card .wallet-name strong,.card .game-copy strong,.card .alert-copy strong,.card .goal-meta strong,.card .gift-grid strong{font-size:${s.fontSize}px!important}.card small{font-size:${Math.max(10,Math.round(s.fontSize*.6))}px!important}${logo}`;
  }
  return Object.freeze({ fonts, normalize, css, image });
});
