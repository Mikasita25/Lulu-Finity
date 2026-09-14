'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`No se pudo aplicar ${label}: se esperaba 1 coincidencia y hubo ${count}.`);
  return source.replace(oldText, newText);
}

function patchMainSource(input) {
  let source = String(input || '');

  source = replaceOnce(
    source,
    "const { isAudiusUrl, isAudiusStreamUrl, resolveAudiusRequest } = require('./audius-light-engine');",
    "const { isAudiusUrl, isAudiusStreamUrl, resolveAudiusRequest } = require('./audius-light-engine');\nconst { YOUTUBE_STALL_MS, YOUTUBE_MAX_RECOVERY_ATTEMPTS, AUDIUS_MAX_RESOLVE_RETRIES, recoveryDelay, canRetry } = require('./playback-recovery-policy');",
    'política de recuperación'
  );

  source = replaceOnce(
    source,
    "let youtubeRecentIds = [];\nlet liveConnection = null;",
    "let youtubeRecentIds = [];\nlet youtubeRecovery = { itemId:'', attempts:0, inFlight:false };\nlet audiusResolveRetry = { itemId:'', attempts:0, inFlight:false };\nlet liveConnection = null;",
    'estado de recuperación'
  );

  const recoveryHelpers = String.raw`
function resetYoutubeRecovery(item = null) {
  youtubeRecovery = { itemId:String(item?.id || ''), attempts:0, inFlight:false };
}

function resetAudiusResolveRetry(item = null) {
  audiusResolveRetry = { itemId:String(item?.id || ''), attempts:0, inFlight:false };
}

async function recoverYoutubePlayback(reason, nonce, currentTime = 0) {
  const item = playback.current;
  if (!item || item.provider !== 'youtube' || !item.videoId || nonce !== playerNonce) return false;
  if (youtubeRecovery.itemId !== item.id) resetYoutubeRecovery(item);
  if (youtubeRecovery.inFlight) return true;
  if (!canRetry(youtubeRecovery.attempts, YOUTUBE_MAX_RECOVERY_ATTEMPTS)) {
    notice(\`YouTube no pudo recuperar “\${item.resolvedTitle || item.query}”. Se continuará con la cola.\`);
    advanceQueue();
    return false;
  }
  youtubeRecovery.inFlight = true;
  youtubeRecovery.attempts += 1;
  const attempt = youtubeRecovery.attempts;
  playback.loading = true;
  playback.paused = false;
  broadcastState();
  try {
    await new Promise((resolve) => setTimeout(resolve, recoveryDelay(attempt)));
    if (nonce !== playerNonce || playback.current?.id !== item.id) return false;
    const win = createYoutubeWindow();
    const startAt = Math.max(0, Math.floor(Number(currentTime) || playback.currentTime || 0) - 1);
    await win.loadURL(\`\${youtubeEmbedUrl(item.videoId)}&start=\${startAt}\`, { extraHeaders:'Referer: https://github.com/Mikasita25/Lulu-Finity/\n' });
    if (nonce !== playerNonce || playback.current?.id !== item.id) return false;
    await setPlayerVolume(settings.volume).catch(() => {});
    notice(attempt === 1 ? 'Lulu recuperó la reproducción de YouTube.' : \`Lulu recuperó YouTube en el intento \${attempt}.\`);
    return true;
  } catch (error) {
    if (nonce !== playerNonce || playback.current?.id !== item.id) return false;
    if (!canRetry(youtubeRecovery.attempts, YOUTUBE_MAX_RECOVERY_ATTEMPTS)) {
      notice(\`YouTube siguió fallando: \${error?.message || error}\`);
      advanceQueue();
      return false;
    }
    setTimeout(() => void recoverYoutubePlayback(reason || error?.message || 'corte temporal', nonce, currentTime), recoveryDelay(youtubeRecovery.attempts + 1));
    return true;
  } finally {
    youtubeRecovery.inFlight = false;
  }
}

async function retryAudiusSameTrack(reason, nonce) {
  const item = playback.current;
  if (!item || item.provider !== 'audius' || nonce !== playerNonce) return false;
  if (audiusResolveRetry.itemId !== item.id) resetAudiusResolveRetry(item);
  if (audiusResolveRetry.inFlight || !canRetry(audiusResolveRetry.attempts, AUDIUS_MAX_RESOLVE_RETRIES)) return false;
  audiusResolveRetry.inFlight = true;
  audiusResolveRetry.attempts += 1;
  playback.loading = true;
  playback.paused = false;
  broadcastState();
  try {
    await new Promise((resolve) => setTimeout(resolve, recoveryDelay(audiusResolveRetry.attempts)));
    if (nonce !== playerNonce || playback.current?.id !== item.id) return false;
    const resolved = await resolveAudiusRequest(item.query, { requireConfident:false });
    if (nonce !== playerNonce || playback.current?.id !== item.id) return false;
    await openAudius(item, nonce, { resolved, requireConfident:false });
    notice('Lulu recuperó el stream de Audius sin cambiar de canción.');
    return true;
  } catch {
    return false;
  } finally {
    audiusResolveRetry.inFlight = false;
  }
}

`;

  source = replaceOnce(source, 'function advanceQueue({ natural = false } = {}) {', recoveryHelpers + 'function advanceQueue({ natural = false } = {}) {', 'helpers de recuperación');

  source = replaceOnce(
    source,
    "function advanceQueue({ natural = false } = {}) {\n  const previous = playback.current;",
    "function advanceQueue({ natural = false } = {}) {\n  const previous = playback.current;\n  resetYoutubeRecovery();\n  resetAudiusResolveRetry();",
    'reinicio de recuperación al avanzar'
  );

  source = replaceOnce(
    source,
    "async function startCurrentSong() {\n  const item = playback.current;\n  if (!item) return;\n  const nonce = ++playerNonce;",
    "async function startCurrentSong() {\n  const item = playback.current;\n  if (!item) return;\n  const nonce = ++playerNonce;\n  resetYoutubeRecovery(item);\n  resetAudiusResolveRetry(item);",
    'reinicio por canción nueva'
  );

  source = replaceOnce(
    source,
    "async function fallbackAudiusToYoutube(reason, nonce) {\n  const item = playback.current;\n  if (!item || item.provider !== 'audius' || nonce !== playerNonce) return;",
    "async function fallbackAudiusToYoutube(reason, nonce) {\n  const item = playback.current;\n  if (!item || item.provider !== 'audius' || nonce !== playerNonce) return;\n  if (await retryAudiusSameTrack(reason, nonce)) return;",
    'reintento de Audius'
  );

  source = replaceOnce(
    source,
    "  win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {\n    if (!isMainFrame || code === -3 || !playback.current || playback.current.provider !== 'youtube') return;\n    notice(`El reproductor ligero de YouTube no cargó: ${description || code}.`);\n    advanceQueue();\n  });",
    "  win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {\n    if (!isMainFrame || code === -3 || !playback.current || playback.current.provider !== 'youtube') return;\n    const nonce=playerNonce;\n    notice(`YouTube tuvo un corte temporal: ${description || code}. Lulu intentará recuperar la misma canción.`);\n    void recoverYoutubePlayback(description || String(code), nonce, playback.currentTime);\n  });",
    'recuperación de carga YouTube'
  );

  source = replaceOnce(
    source,
    "        playback.currentTime = Number(data.currentTime) || 0; playback.duration = Number(data.duration) || 0;\n        broadcastState();",
    "        playback.currentTime = Number(data.currentTime) || 0; playback.duration = Number(data.duration) || 0;\n        if (!playback.paused && playback.currentTime > 1 && youtubeRecovery.itemId === playback.current.id) youtubeRecovery.attempts = 0;\n        broadcastState();",
    'confirmación de progreso YouTube'
  );

  source = replaceOnce(
    source,
    "    const ended = message.match(/^__LULU_MUSIC_ENDED__:(\\d+)$/);\n    if (ended && Number(ended[1]) === playerNonce) advanceQueue({ natural:true });",
    "    const stalled = message.match(/^__LULU_MUSIC_STALLED__:(\\d+):([0-9.]+)$/);\n    if (stalled && Number(stalled[1]) === playerNonce) { void recoverYoutubePlayback('buffering prolongado', playerNonce, Number(stalled[2]) || playback.currentTime); return; }\n    const ended = message.match(/^__LULU_MUSIC_ENDED__:(\\d+)$/);\n    if (ended && Number(ended[1]) === playerNonce) advanceQueue({ natural:true });",
    'evento de atasco YouTube'
  );

  const oldWatcher = String.raw`async function installYoutubeWatcher(nonce, attempt) {
  if (nonce !== playerNonce || !youtubeWindow || youtubeWindow.isDestroyed()) return;
  try {
    const installed = await youtubeWindow.webContents.executeJavaScript(\`(() => {
      window.__luluMusicCleanup?.();
      const video=document.querySelector('video');
      if(!video)return false;
      const initialVolume=${JSON.stringify(settings.volume)};
      const normalizeVolume=(value)=>Math.max(0,Math.min(1,Number(value)));
      window.__luluMusicVolume=Number.isFinite(Number(window.__luluMusicVolume))
        ? normalizeVolume(window.__luluMusicVolume)
        : initialVolume;
      const applyVolume=()=>{
        const desired=normalizeVolume(window.__luluMusicVolume);
        if(Math.abs(video.volume-desired)>.001)video.volume=desired;
        if(video.muted)video.muted=false;
      };
      let ended=false;
      const report=()=>{
        const ad=Boolean(document.querySelector('.html5-video-player.ad-showing,.html5-video-player.ad-interrupting'));
        applyVolume();
        const payload={currentTime:video.currentTime,duration:video.duration,paused:video.paused};
        console.info('__LULU_MUSIC_PLAYER__:${nonce}:'+encodeURIComponent(JSON.stringify(payload)));
        if(!ad&&video.ended&&!ended){ended=true;console.info('__LULU_MUSIC_ENDED__:${nonce}')}
      };
      const timer=setInterval(report,650);video.play().catch(()=>{});report();
      window.__luluMusicCleanup=()=>{clearInterval(timer);delete window.__luluMusicCleanup};
      return true;
    })()\`, true);
    if (installed) return;
  } catch {}
  if (attempt < 24) setTimeout(() => void installYoutubeWatcher(nonce, attempt + 1), 300);
  else if (nonce === playerNonce) { notice('El reproductor ligero de YouTube no pudo iniciar esta canción.'); advanceQueue(); }
}`;

  const newWatcher = String.raw`async function installYoutubeWatcher(nonce, attempt) {
  if (nonce !== playerNonce || !youtubeWindow || youtubeWindow.isDestroyed()) return;
  try {
    const installed = await youtubeWindow.webContents.executeJavaScript(\`(() => {
      window.__luluMusicCleanup?.();
      const video=document.querySelector('video');
      if(!video)return false;
      const initialVolume=${JSON.stringify(settings.volume)};
      const normalizeVolume=(value)=>Math.max(0,Math.min(1,Number(value)));
      window.__luluMusicVolume=Number.isFinite(Number(window.__luluMusicVolume)) ? normalizeVolume(window.__luluMusicVolume) : initialVolume;
      window.__luluMusicUserPaused=false;
      const applyVolume=()=>{
        const desired=normalizeVolume(window.__luluMusicVolume);
        if(Math.abs(video.volume-desired)>.001)video.volume=desired;
        if(video.muted)video.muted=false;
      };
      let ended=false;
      let lastTime=Number(video.currentTime)||0;
      let lastAdvanceAt=Date.now();
      let pauseSince=0;
      let stallReported=false;
      const report=()=>{
        const now=Date.now();
        const ad=Boolean(document.querySelector('.html5-video-player.ad-showing,.html5-video-player.ad-interrupting'));
        const current=Number(video.currentTime)||0;
        applyVolume();
        if(current>lastTime+.08){lastTime=current;lastAdvanceAt=now;stallReported=false}
        if(!video.paused){pauseSince=0}
        else if(!window.__luluMusicUserPaused&&!video.ended&&!ad){
          if(!pauseSince)pauseSince=now;
          if(now-pauseSince>1200)video.play().catch(()=>{});
        }
        const stalledFor=now-lastAdvanceAt;
        const payload={currentTime:current,duration:video.duration,paused:video.paused,readyState:video.readyState,networkState:video.networkState,userPaused:Boolean(window.__luluMusicUserPaused),stalledFor};
        console.info('__LULU_MUSIC_PLAYER__:${nonce}:'+encodeURIComponent(JSON.stringify(payload)));
        if(!ad&&video.ended&&!ended){ended=true;console.info('__LULU_MUSIC_ENDED__:${nonce}');return}
        if(!ad&&!video.ended&&!window.__luluMusicUserPaused&&stalledFor>=${YOUTUBE_STALL_MS}&&!stallReported){stallReported=true;console.info('__LULU_MUSIC_STALLED__:${nonce}:'+current)}
      };
      const timer=setInterval(report,650);
      video.play().catch(()=>{});
      report();
      window.__luluMusicCleanup=()=>{clearInterval(timer);delete window.__luluMusicCleanup};
      return true;
    })()\`, true);
    if (installed) return;
  } catch {}
  if (attempt < 24) setTimeout(() => void installYoutubeWatcher(nonce, attempt + 1), 300);
  else if (nonce === playerNonce) { notice('El reproductor ligero de YouTube no pudo iniciar esta canción.'); void recoverYoutubePlayback('watchdog no disponible', nonce, playback.currentTime); }
}`;
  source = replaceOnce(source, oldWatcher, newWatcher, 'watchdog YouTube');

  source = replaceOnce(
    source,
    "  await win.webContents.executeJavaScript(`(() => {const video=document.querySelector('video');if(!video)return{ok:false};const action=${JSON.stringify(action)};if(action==='toggle')video.paused?video.play():video.pause();if(action==='restart'){video.currentTime=0;video.play()}return{ok:true}})()`, true);",
    "  await win.webContents.executeJavaScript(`(() => {const video=document.querySelector('video');if(!video)return{ok:false};const action=${JSON.stringify(action)};if(action==='toggle'){if(video.paused){window.__luluMusicUserPaused=false;video.play()}else{window.__luluMusicUserPaused=true;video.pause()}}if(action==='restart'){window.__luluMusicUserPaused=false;video.currentTime=0;video.play()}return{ok:true,userPaused:Boolean(window.__luluMusicUserPaused)}})()`, true);",
    'intención de pausa YouTube'
  );

  return source;
}

if (process.env.LULU_MUSIC_PATCH_TEST === '1') {
  module.exports = { patchMainSource };
} else {
  const filename = path.join(__dirname, 'main.js');
  const source = patchMainSource(fs.readFileSync(filename, 'utf8'));
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(source, filename);
  module.exports = compiled.exports;
}
