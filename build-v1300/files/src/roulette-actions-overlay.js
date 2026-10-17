let rouletteMediaKey = '', rouletteMediaStartTimer = 0, rouletteMediaEndTimer = 0, rouletteMediaNode = null;
function stopRouletteMedia() {
  clearTimeout(rouletteMediaStartTimer);
  clearTimeout(rouletteMediaEndTimer);
  rouletteMediaStartTimer = 0;
  rouletteMediaEndTimer = 0;
  rouletteMediaKey = '';
  if (rouletteMediaNode) {
    if (rouletteMediaNode.tagName === 'VIDEO') rouletteMediaNode.pause();
    rouletteMediaNode.remove();
    rouletteMediaNode = null;
  }
}
function scheduleRouletteMedia(data) {
  const media = data && data.rouletteMedia;
  const key = String(data && data.id || '');
  if (key && key === rouletteMediaKey) return;
  stopRouletteMedia();
  if (!media || !['gif','image','video'].includes(media.type)) return;
  let url;
  try { url = new URL(String(media.url || '')); } catch { return; }
  if (url.protocol !== 'https:' || !url.hostname) return;
  const startAt = Number(data.animationStartedAt) + Number(data.animationDurationMs || 14110);
  const endAt = Math.min(Number(data.expiresAt), startAt + Math.max(1,Math.min(30,Number(media.seconds)||5))*1000);
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= Date.now()) return;
  rouletteMediaKey = key;
  const show = () => {
    if (rouletteMediaKey !== key || Date.now() >= endAt) return;
    const el = document.createElement(media.type === 'video' ? 'video' : 'img');
    el.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;background:transparent;z-index:110;';
    if (media.type === 'video') {
      el.muted = true;
      el.autoplay = true;
      el.loop = true;
      el.playsInline = true;
      el.preload = 'auto';
    } else { el.alt = 'Acción del color ganador'; }
    el.src = url.href;
    document.body.append(el);
    rouletteMediaNode = el;
    if (media.type === 'video') { const result = el.play(); if (result && result.catch) result.catch(() => {}); }
    rouletteMediaEndTimer = setTimeout(stopRouletteMedia, Math.max(0,endAt - Date.now()));
  };
  if (startAt > Date.now()) rouletteMediaStartTimer = setTimeout(show, Math.max(0,startAt - Date.now()));
  else show();
}
