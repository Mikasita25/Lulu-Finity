'use strict';

const { app, BrowserWindow, ipcMain, shell, session, powerSaveBlocker } = require('electron');
const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { MAX_RELAY_FRAME_BYTES, RelayProtocolError, parseRelayFrame } = require('./relay-protocol');
const { LIVE_RECONNECT_DELAYS_MS, shouldReconnectLive, liveReconnectDelay } = require('./live-reconnect-policy');
const { normalizeUsername, normalizeMusicCommand, parseMusicCommand, requesterAllowed, blockedRequest } = require('./music-command-policy');

const fsp = fs.promises;
const RELAY_URL = 'wss://lulu-finity-production.up.railway.app/v1/tiktok/live';
const RELAY_CLIENT_TOKEN = '__LULU_RELAY_CLIENT_TOKEN__';
const YOUTUBE_PARTITION = 'persist:lulu-music-youtube';
const SPOTIFY_PARTITION = 'persist:lulu-music-spotify';
const PROVIDERS = new Set(['youtube','spotify']);
const PERMISSIONS = new Set(['all','followers','subscribers','selected']);

const DEFAULT_SETTINGS = Object.freeze({
  creatorUsername:'', command:'!cancion', provider:'youtube', permission:'all', queueLimit:30,
  selectedUsers:[], blockedTerms:[], preventDuplicates:true, onePerUser:true,
  continueRecommended:false, volume:.8
});

let mainWindow = null;
let youtubeWindow = null;
let spotifyWindow = null;
let settings = { ...DEFAULT_SETTINGS };
let musicQueue = [];
let playback = { current:null, loading:false, paused:true, currentTime:0, duration:0 };
let playerNonce = 0;
let youtubeBlockerInstalled = false;
let youtubeAdvancedBlocker = null;
let youtubeAdvancedBlockerPromise = null;
let liveConnection = null;
let connectorModule = null;
let liveNonce = 0;
let liveReconnectTimer = null;
let liveReconnectAttempt = 0;
let liveReconnectUsername = '';
let liveReconnectEnabled = false;
let liveHasConnected = false;
let liveStatus = { status:'offline', username:'', message:'Lista para conectarse a un LIVE.' };
let shuttingDown = false;
let powerBlockerId = null;

function clamp(number, minimum, maximum, fallback) {
  const value = Number(number);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function stringList(value, normalizer = (item) => item) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((item) => normalizer(String(item || '').trim())).filter(Boolean))].slice(0, 100);
}

function sanitizeSettings(input = {}) {
  const merged = { ...settings, ...input };
  return {
    creatorUsername:normalizeUsername(merged.creatorUsername),
    command:normalizeMusicCommand(merged.command),
    provider:PROVIDERS.has(merged.provider) ? merged.provider : 'youtube',
    permission:PERMISSIONS.has(merged.permission) ? merged.permission : 'all',
    queueLimit:Math.round(clamp(merged.queueLimit, 1, 100, 30)),
    selectedUsers:stringList(merged.selectedUsers, normalizeUsername),
    blockedTerms:stringList(merged.blockedTerms, (item) => item.slice(0, 80)),
    preventDuplicates:merged.preventDuplicates !== false,
    onePerUser:merged.onePerUser !== false,
    continueRecommended:Boolean(merged.continueRecommended),
    volume:clamp(merged.volume, 0, 1, .8)
  };
}

function publicSettings() {
  return { ...settings };
}

function settingsPath() { return path.join(app.getPath('userData'), 'music-settings.json'); }

async function loadSettings() {
  try { settings = sanitizeSettings(JSON.parse(await fsp.readFile(settingsPath(), 'utf8'))); }
  catch { settings = sanitizeSettings(DEFAULT_SETTINGS); }
  await writeSettings();
}

async function writeSettings() {
  const target = settingsPath();
  const temporary = `${target}.tmp`;
  await fsp.mkdir(path.dirname(target), { recursive:true });
  await fsp.writeFile(temporary, JSON.stringify(settings, null, 2), 'utf8');
  await fsp.rename(temporary, target).catch(async () => {
    await fsp.rm(target, { force:true });
    await fsp.rename(temporary, target);
  });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function currentState() {
  return {
    version:app.getVersion(), settings:publicSettings(), queue:musicQueue.map((item) => ({ ...item })),
    playback:{ ...playback, current:playback.current ? { ...playback.current } : null }, live:{ ...liveStatus }
  };
}

function broadcastState() {
  send('music:state', currentState());
  refreshPowerBlocker();
}

function notice(message) { send('app:notice', { message:String(message || '') }); }

function setLiveStatus(status, message, extra = {}) {
  liveStatus = { status, username:liveReconnectUsername || settings.creatorUsername, message, ...extra };
  send('live:status', liveStatus);
  broadcastState();
}

function refreshPowerBlocker() {
  const needed = Boolean(liveConnection || liveReconnectTimer || playback.current);
  if (needed && powerBlockerId === null) {
    try { powerBlockerId = powerSaveBlocker.start('prevent-app-suspension'); } catch {}
  } else if (!needed && powerBlockerId !== null) {
    try { if (powerSaveBlocker.isStarted(powerBlockerId)) powerSaveBlocker.stop(powerBlockerId); } catch {}
    powerBlockerId = null;
  }
}

function requesterLabel(user) {
  return String(user?.nickname || user?.displayName || user?.uniqueId || '').trim().slice(0, 80);
}

function sameSong(left, right) {
  return String(left || '').trim().toLocaleLowerCase('es-MX') === String(right || '').trim().toLocaleLowerCase('es-MX');
}

async function enqueueSong(queryInput, user = null, manual = false) {
  const query = String(queryInput || '').trim().replace(/\s+/g, ' ').slice(0, 180);
  if (!query) throw new Error('Escribe una canción o un enlace.');
  if (!manual && !requesterAllowed(user, settings)) return { accepted:false, reason:'permission' };
  if (!manual && blockedRequest(query, settings.blockedTerms)) return { accepted:false, reason:'blocked' };
  if (musicQueue.length >= settings.queueLimit) return { accepted:false, reason:'full' };
  if (settings.preventDuplicates && [playback.current, ...musicQueue].some((item) => item && sameSong(item.query, query))) {
    return { accepted:false, reason:'duplicate' };
  }
  const username = normalizeUsername(user?.uniqueId || user?.username);
  if (!manual && settings.onePerUser && username && [playback.current, ...musicQueue].some((item) => item?.username === username)) {
    return { accepted:false, reason:'user-limit' };
  }
  const item = {
    id:randomUUID(), query, requestedBy:manual ? '' : requesterLabel(user), username:manual ? '' : username,
    provider:settings.provider, createdAt:Date.now()
  };
  send('music:request', item);
  if (!playback.current) {
    playback = { current:item, loading:true, paused:false, currentTime:0, duration:0 };
    broadcastState();
    void startCurrentSong();
  } else {
    musicQueue.push(item);
    broadcastState();
  }
  return { accepted:true, item, message:playback.current?.id === item.id ? 'Reproduciendo la canción.' : 'Canción agregada a la cola.' };
}

function processLiveChat(data = {}) {
  const parsed = parseMusicCommand(data.comment ?? data.content ?? '', settings.command);
  if (!parsed) return;
  const userData = data.user || data.sender || data;
  const badges = Array.isArray(userData.badgeList) ? userData.badgeList : Array.isArray(userData.badges) ? userData.badges : [];
  const badgeText = badges.map((badge) => JSON.stringify(badge || {})).join(' ').toLowerCase();
  const memberLevel = Number(userData.teamMemberLevel || userData.memberLevel || data.memberLevel || 0);
  const user = {
    uniqueId:String(userData.uniqueId || userData.displayId || userData.userId || data.uniqueId || ''),
    nickname:String(userData.nickname || userData.displayName || userData.uniqueId || 'Usuario'),
    isFollower:Boolean(userData.isFollower || userData.followInfo?.followStatus || data.isFollower || /follower|seguidor/.test(badgeText)),
    isSubscriber:Boolean(userData.isSubscriber || userData.isSubscribing || data.isSubscriber || memberLevel > 0 || /subscriber|subscription|suscriptor|member|miembro/.test(badgeText))
  };
  void enqueueSong(parsed.query, user, false).catch(() => {});
}

function advanceQueue({ natural = false } = {}) {
  const previous = playback.current;
  if (natural && !musicQueue.length && settings.continueRecommended && previous?.provider === 'youtube' && youtubeWindow && !youtubeWindow.isDestroyed()) {
    playback = { ...playback, loading:true, paused:false, currentTime:0, duration:0,
      current:{ ...previous, id:randomUUID(), query:'Recomendación de YouTube', requestedBy:'Lulu Music' } };
    broadcastState();
    void youtubeWindow.webContents.executeJavaScript(`(() => { const next=document.querySelector('a.ytp-next-button[href*="/watch"]'); if(next?.href){location.href=next.href;return true} return false })()`, true)
      .then((ok) => { if (!ok) advanceQueue(); }).catch(() => advanceQueue());
    return;
  }
  playerNonce += 1;
  const next = musicQueue.shift() || null;
  playback = { current:next, loading:Boolean(next), paused:!next, currentTime:0, duration:0 };
  broadcastState();
  if (next) void startCurrentSong();
}

async function startCurrentSong() {
  const item = playback.current;
  if (!item) return;
  const nonce = ++playerNonce;
  playback.loading = true;
  playback.paused = false;
  broadcastState();
  try {
    if (item.provider === 'spotify') await openSpotify(item.query, nonce);
    else await openYoutube(item.query, nonce);
  } catch (error) {
    if (nonce !== playerNonce || playback.current?.id !== item.id) return;
    notice(`No se pudo abrir “${item.query}”: ${error.message || error}`);
    advanceQueue();
  }
}

function removeSong(id) {
  const before = musicQueue.length;
  musicQueue = musicQueue.filter((item) => item.id !== String(id || ''));
  if (musicQueue.length !== before) broadcastState();
  return currentState();
}

function moveSong(id, direction) {
  const index = musicQueue.findIndex((item) => item.id === String(id || ''));
  if (index < 0) return currentState();
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= musicQueue.length) return currentState();
  [musicQueue[index], musicQueue[target]] = [musicQueue[target], musicQueue[index]];
  broadcastState();
  return currentState();
}

function isYoutubeUrl(value) {
  try { const host = new URL(String(value)).hostname.replace(/^www\./, '').toLowerCase(); return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be'; }
  catch { return false; }
}

function youtubeTarget(query) {
  const clean = String(query || '').trim();
  if (isYoutubeUrl(clean)) return clean;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`;
}

function youtubeKind(value) {
  try { const url = new URL(value); if (url.hostname.includes('youtu.be') || url.pathname === '/watch') return 'watch'; if (url.pathname === '/results') return 'search'; return 'other'; }
  catch { return 'other'; }
}

function youtubeAutoplay(value) {
  try {
    const url = new URL(value);
    if (url.hostname.replace(/^www\./, '') === 'youtu.be') return `https://www.youtube.com/watch?v=${encodeURIComponent(url.pathname.slice(1).split('/')[0])}&autoplay=1`;
    if (url.pathname === '/watch') url.searchParams.set('autoplay','1');
    return url.href;
  } catch { return value; }
}

function installYoutubeBlocking() {
  if (youtubeBlockerInstalled) return;
  youtubeBlockerInstalled = true;
  session.fromPartition(YOUTUBE_PARTITION).webRequest.onBeforeRequest({ urls:[
    '*://*.doubleclick.net/*','*://*.googlesyndication.com/*','*://*.googleadservices.com/*',
    '*://*.googletagservices.com/*','*://*.adservice.google.com/*','*://*.imasdk.googleapis.com/*','*://*.2mdn.net/*'
  ] }, (_details, callback) => callback({ cancel:true }));
}

async function ensureYoutubeBlocking() {
  installYoutubeBlocking();
  if (youtubeAdvancedBlocker) return youtubeAdvancedBlocker;
  if (!youtubeAdvancedBlockerPromise) youtubeAdvancedBlockerPromise = (async () => {
    try {
      const module = await import('@ghostery/adblocker-electron');
      const ElectronBlocker = module.ElectronBlocker || module.default?.ElectronBlocker;
      const cache = path.join(app.getPath('userData'),'adblock','youtube.bin');
      await fsp.mkdir(path.dirname(cache), { recursive:true });
      const blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
        path:cache, read:(file) => fsp.readFile(file), write:(file,data) => fsp.writeFile(file,data)
      });
      blocker.enableBlockingInSession(session.fromPartition(YOUTUBE_PARTITION));
      youtubeAdvancedBlocker = blocker;
      return blocker;
    } catch (error) {
      console.warn('Se mantiene el bloqueo integrado de YouTube:', error?.message || error);
      return null;
    }
  })();
  return youtubeAdvancedBlockerPromise;
}

function createYoutubeWindow() {
  if (youtubeWindow && !youtubeWindow.isDestroyed()) return youtubeWindow;
  installYoutubeBlocking();
  youtubeWindow = new BrowserWindow({
    width:1240,height:820,minWidth:850,minHeight:580,show:false,skipTaskbar:true,autoHideMenuBar:true,
    title:'YouTube — Lulu Music',backgroundColor:'#0f0f0f',
    webPreferences:{ contextIsolation:true,nodeIntegration:false,sandbox:true,autoplayPolicy:'no-user-gesture-required',partition:YOUTUBE_PARTITION }
  });
  youtubeWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isYoutubeUrl(url)) void youtubeWindow.loadURL(url); else if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action:'deny' };
  });
  youtubeWindow.webContents.on('did-finish-load', () => handleYoutubePage(youtubeWindow.webContents.getURL(), playerNonce));
  youtubeWindow.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => { if (isMainFrame) handleYoutubePage(url, playerNonce); });
  youtubeWindow.webContents.on('console-message', (_event, details, legacyMessage) => {
    const message = String(details && typeof details === 'object' ? details.message : (legacyMessage || details) || '');
    const match = message.match(/^__LULU_MUSIC_PLAYER__:(\d+):(.*)$/);
    if (match && Number(match[1]) === playerNonce) {
      try {
        const data = JSON.parse(decodeURIComponent(match[2]));
        if (!playback.current || playback.current.provider !== 'youtube') return;
        playback.current.resolvedTitle = data.title || playback.current.resolvedTitle || playback.current.query;
        playback.current.artist = data.artist || '';
        playback.loading = false; playback.paused = Boolean(data.paused);
        playback.currentTime = Number(data.currentTime) || 0; playback.duration = Number(data.duration) || 0;
        broadcastState();
      } catch {}
      return;
    }
    const ended = message.match(/^__LULU_MUSIC_ENDED__:(\d+)$/);
    if (ended && Number(ended[1]) === playerNonce) advanceQueue({ natural:true });
  });
  youtubeWindow.on('closed', () => { youtubeWindow = null; });
  return youtubeWindow;
}

async function openYoutube(query, nonce) {
  await ensureYoutubeBlocking();
  const win = createYoutubeWindow();
  const raw = youtubeTarget(query);
  await win.loadURL(youtubeKind(raw) === 'watch' ? youtubeAutoplay(raw) : raw);
  if (nonce !== playerNonce) return;
  await setPlayerVolume(settings.volume).catch(() => {});
}

function handleYoutubePage(url, nonce) {
  if (nonce !== playerNonce) return;
  if (youtubeKind(url) === 'search') void selectYoutubeResult(nonce, 0);
  if (youtubeKind(url) === 'watch') void installYoutubeWatcher(nonce, 0);
}

async function selectYoutubeResult(nonce, attempt) {
  if (nonce !== playerNonce || !youtubeWindow || youtubeWindow.isDestroyed()) return;
  try {
    const result = await youtubeWindow.webContents.executeJavaScript(`(() => {
      const ads='ytd-promoted-video-renderer,ytd-display-ad-renderer,ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,[is-ad],[data-is-ad="true"]';
      for(const row of document.querySelectorAll('ytd-search ytd-video-renderer,ytd-video-renderer')){
        if(row.closest(ads)||row.querySelector(ads))continue;
        const link=row.querySelector('a#thumbnail[href*="/watch"],a.ytd-thumbnail[href*="/watch"]');
        if(!link?.href)continue;
        return {url:link.href,title:(row.querySelector('#video-title')?.textContent||'').trim(),artist:(row.querySelector('ytd-channel-name a')?.textContent||'').trim()};
      }
      return null;
    })()`, true);
    if (nonce !== playerNonce) return;
    if (result?.url) {
      if (playback.current) { playback.current.resolvedTitle = result.title || playback.current.query; playback.current.artist = result.artist || ''; broadcastState(); }
      await youtubeWindow.loadURL(youtubeAutoplay(result.url));
      return;
    }
  } catch {}
  if (attempt < 24) setTimeout(() => void selectYoutubeResult(nonce, attempt + 1), 500);
  else if (nonce === playerNonce) { notice('YouTube no encontró un resultado normal; se omitió la solicitud.'); advanceQueue(); }
}

async function installYoutubeWatcher(nonce, attempt) {
  if (nonce !== playerNonce || !youtubeWindow || youtubeWindow.isDestroyed()) return;
  try {
    const installed = await youtubeWindow.webContents.executeJavaScript(`(() => {
      window.__luluMusicCleanup?.();
      const video=document.querySelector('video.html5-main-video')||document.querySelector('video');
      if(!video)return false;
      let ended=false;
      const report=()=>{
        const ad=Boolean(document.querySelector('.html5-video-player.ad-showing,.html5-video-player.ad-interrupting'));
        for(const button of document.querySelectorAll('.ytp-ad-skip-button,.ytp-skip-ad-button,.ytp-ad-skip-button-modern,button[class*="ytp-ad-skip"]'))if(!button.disabled)button.click();
        if(ad){video.muted=true;if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.max(video.currentTime,video.duration-.2)}
        else{video.muted=false;video.volume=${JSON.stringify(settings.volume)}}
        const toggle=document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');if(toggle)toggle.click();
        const payload={title:(document.querySelector('h1.ytd-watch-metadata yt-formatted-string,h1.title yt-formatted-string')?.textContent||document.title.replace(/ - YouTube$/,'')).trim(),artist:(document.querySelector('ytd-watch-metadata ytd-channel-name a,#owner-name a')?.textContent||'').trim(),currentTime:video.currentTime,duration:video.duration,paused:video.paused};
        console.info('__LULU_MUSIC_PLAYER__:${nonce}:'+encodeURIComponent(JSON.stringify(payload)));
        if(video.ended&&!ended){ended=true;console.info('__LULU_MUSIC_ENDED__:${nonce}')}
      };
      const timer=setInterval(report,650);video.play().catch(()=>{});report();
      window.__luluMusicCleanup=()=>{clearInterval(timer);delete window.__luluMusicCleanup};
      return true;
    })()`, true);
    if (installed) return;
  } catch {}
  if (attempt < 24) setTimeout(() => void installYoutubeWatcher(nonce, attempt + 1), 300);
  else if (nonce === playerNonce) { notice('YouTube no pudo iniciar el reproductor.'); advanceQueue(); }
}

function isSpotifyUrl(value) {
  try { return new URL(String(value)).hostname.replace(/^www\./,'').toLowerCase() === 'open.spotify.com'; }
  catch { return false; }
}

function spotifyTarget(query) {
  const clean = String(query || '').trim();
  return isSpotifyUrl(clean) ? clean : `https://open.spotify.com/search/${encodeURIComponent(clean)}`;
}

function spotifyKind(value) {
  try { const pathname = new URL(value).pathname; return pathname.startsWith('/search/') ? 'search' : pathname.startsWith('/track/') ? 'track' : 'other'; }
  catch { return 'other'; }
}

function createSpotifyWindow() {
  if (spotifyWindow && !spotifyWindow.isDestroyed()) return spotifyWindow;
  spotifyWindow = new BrowserWindow({
    width:1240,height:820,minWidth:850,minHeight:580,show:false,skipTaskbar:true,autoHideMenuBar:true,
    title:'Spotify — Lulu Music',backgroundColor:'#121212',
    webPreferences:{ contextIsolation:true,nodeIntegration:false,sandbox:true,autoplayPolicy:'no-user-gesture-required',partition:SPOTIFY_PARTITION }
  });
  spotifyWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSpotifyUrl(url)) void spotifyWindow.loadURL(url); else if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action:'deny' };
  });
  spotifyWindow.webContents.on('did-finish-load', () => handleSpotifyPage(spotifyWindow.webContents.getURL(), playerNonce));
  spotifyWindow.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => { if (isMainFrame) handleSpotifyPage(url, playerNonce); });
  spotifyWindow.webContents.on('console-message', (_event, details, legacyMessage) => {
    const message = String(details && typeof details === 'object' ? details.message : (legacyMessage || details) || '');
    const match = message.match(/^__LULU_SPOTIFY_PLAYER__:(\d+):(.*)$/);
    if (match && Number(match[1]) === playerNonce) {
      try {
        const data = JSON.parse(decodeURIComponent(match[2]));
        if (!playback.current || playback.current.provider !== 'spotify') return;
        playback.current.resolvedTitle = data.title || playback.current.resolvedTitle || playback.current.query;
        playback.current.artist = data.artist || ''; playback.loading = false; playback.paused = Boolean(data.paused);
        playback.currentTime = Number(data.currentTime) || 0; playback.duration = Number(data.duration) || 0;
        broadcastState();
      } catch {}
      return;
    }
    const ended = message.match(/^__LULU_SPOTIFY_ENDED__:(\d+)$/);
    if (ended && Number(ended[1]) === playerNonce) advanceQueue({ natural:true });
  });
  spotifyWindow.on('closed', () => { spotifyWindow = null; });
  return spotifyWindow;
}

async function openSpotify(query, nonce) {
  const win = createSpotifyWindow();
  await win.loadURL(spotifyTarget(query));
  if (nonce !== playerNonce) return;
  await setPlayerVolume(settings.volume).catch(() => {});
}

function handleSpotifyPage(url, nonce) {
  if (nonce !== playerNonce) return;
  if (spotifyKind(url) === 'search') void selectSpotifyResult(nonce, 0);
  else void installSpotifyWatcher(nonce, 0);
}

async function selectSpotifyResult(nonce, attempt) {
  if (nonce !== playerNonce || !spotifyWindow || spotifyWindow.isDestroyed()) return;
  try {
    const result = await spotifyWindow.webContents.executeJavaScript(`(() => {
      for(const row of document.querySelectorAll('[data-testid="tracklist-row"],[role="row"]')){
        const link=row.querySelector('a[href*="/track/"]');if(!link?.href)continue;
        return {url:link.href,title:(link.textContent||'').trim(),artist:(row.querySelector('a[href*="/artist/"]')?.textContent||'').trim()};
      }
      const link=document.querySelector('a[href*="/track/"]');return link?.href?{url:link.href,title:(link.textContent||'').trim(),artist:''}:null;
    })()`, true);
    if (nonce !== playerNonce) return;
    if (result?.url) {
      if (playback.current) { playback.current.resolvedTitle=result.title||playback.current.query; playback.current.artist=result.artist||''; broadcastState(); }
      await spotifyWindow.loadURL(result.url); return;
    }
  } catch {}
  if (attempt < 24) setTimeout(() => void selectSpotifyResult(nonce, attempt + 1), 700);
  else if (nonce === playerNonce) { spotifyWindow.show(); notice('Inicia sesión en Spotify para reproducir solicitudes.'); }
}

async function installSpotifyWatcher(nonce, attempt) {
  if (nonce !== playerNonce || !spotifyWindow || spotifyWindow.isDestroyed()) return;
  try {
    const installed = await spotifyWindow.webContents.executeJavaScript(`(() => {
      window.__luluSpotifyCleanup?.();let ended=false;
      const seconds=(text)=>String(text||'').split(':').map(Number).reduce((total,value)=>total*60+value,0)||0;
      const report=()=>{
        const title=(document.querySelector('[data-testid="context-item-info-title"]')?.textContent||document.querySelector('[data-testid="now-playing-widget"] a[href*="/track/"]')?.textContent||'').trim();
        const artist=(document.querySelector('[data-testid="context-item-info-artist"]')?.textContent||document.querySelector('[data-testid="now-playing-widget"] a[href*="/artist/"]')?.textContent||'').trim();
        const currentTime=seconds(document.querySelector('[data-testid="playback-position"]')?.textContent);const duration=seconds(document.querySelector('[data-testid="playback-duration"]')?.textContent);
        const paused=!document.querySelector('button[data-testid="control-button-playpause"][aria-label*="Pause" i],button[data-testid="control-button-playpause"][aria-label*="Paus" i]');
        console.info('__LULU_SPOTIFY_PLAYER__:${nonce}:'+encodeURIComponent(JSON.stringify({title,artist,currentTime,duration,paused})));
        if(!paused&&duration>4&&currentTime>=duration-2&&!ended){ended=true;console.info('__LULU_SPOTIFY_ENDED__:${nonce}')}
      };
      document.querySelector('button[data-testid="play-button"],button[aria-label="Play"],button[aria-label="Reproducir"]')?.click();
      const timer=setInterval(report,750);report();window.__luluSpotifyCleanup=()=>{clearInterval(timer);delete window.__luluSpotifyCleanup};return true;
    })()`, true);
    if (installed) return;
  } catch {}
  if (attempt < 20) setTimeout(() => void installSpotifyWatcher(nonce, attempt + 1), 600);
}

function activePlayerWindow() { return playback.current?.provider === 'spotify' ? spotifyWindow : youtubeWindow; }

async function setPlayerVolume(value) {
  settings.volume = clamp(value, 0, 1, settings.volume);
  const win = activePlayerWindow();
  if (!win || win.isDestroyed()) return { ok:true, deferred:true };
  if (playback.current?.provider === 'spotify') {
    return win.webContents.executeJavaScript(`(() => {const slider=document.querySelector('[data-testid="volume-bar"] input[type="range"],input[aria-label*="volume" i],input[aria-label*="volumen" i]');if(!slider)return{ok:false};const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(slider,String(${JSON.stringify(settings.volume)}*Number(slider.max||1)));slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));return{ok:true}})()`, true);
  }
  return win.webContents.executeJavaScript(`(() => {const video=document.querySelector('video');if(!video)return{ok:false};video.volume=${JSON.stringify(settings.volume)};video.muted=false;return{ok:true}})()`, true);
}

async function playerControl(action, value) {
  if (action === 'next') {
    const currentWindow=activePlayerWindow();
    if(currentWindow&&!currentWindow.isDestroyed()){
      if(playback.current?.provider==='spotify')await currentWindow.webContents.executeJavaScript(`(() => {const pause=document.querySelector('button[data-testid="control-button-playpause"][aria-label*="Pause" i],button[data-testid="control-button-playpause"][aria-label*="Paus" i]');pause?.click();return true})()`,true).catch(()=>{});
      else await currentWindow.webContents.executeJavaScript(`(() => {document.querySelector('video')?.pause();return true})()`,true).catch(()=>{});
    }
    advanceQueue(); return currentState();
  }
  if (action === 'volume') { await setPlayerVolume(value); await writeSettings(); broadcastState(); return currentState(); }
  const win = activePlayerWindow();
  if (!win || win.isDestroyed()) throw new Error('No hay una canción activa.');
  if (playback.current?.provider === 'spotify') {
    await win.webContents.executeJavaScript(`(() => {const action=${JSON.stringify(action)};const button=document.querySelector('button[data-testid="control-button-playpause"]');if(action==='toggle')button?.click();if(action==='restart')document.querySelector('button[data-testid="control-button-skip-back"]')?.click();return{ok:Boolean(button)}})()`, true);
  } else {
    await win.webContents.executeJavaScript(`(() => {const video=document.querySelector('video');if(!video)return{ok:false};const action=${JSON.stringify(action)};if(action==='toggle')video.paused?video.play():video.pause();if(action==='restart'){video.currentTime=0;video.play()}return{ok:true}})()`, true);
  }
  return currentState();
}

function showPlayer() {
  const win = activePlayerWindow() || (settings.provider === 'spotify' ? createSpotifyWindow() : createYoutubeWindow());
  if (!win.webContents.getURL()) void win.loadURL(settings.provider === 'spotify' ? 'https://open.spotify.com/' : 'https://www.youtube.com/');
  win.show(); win.focus();
  return { ok:true };
}

function cleanRelayUrl(value) {
  const url = new URL(String(value || ''));
  if (!['wss:','ws:'].includes(url.protocol)) throw new Error('La URL del relay no es válida.');
  url.username=''; url.password=''; url.hash='';
  return url.toString();
}

class MusicRelayConnection extends EventEmitter {
  constructor(username, events) {
    super(); this.uniqueId=normalizeUsername(username); this.events=events; this.socket=null; this.roomId='relay'; this.isConnected=false; this.violations=0; this.rateStarted=0; this.rateCount=0;
  }
  emitMessage(message) {
    const type=String(message?.type||''); const data=message?.data&&typeof message.data==='object'?{...message.data}:{}; const E=this.events.WebcastEvent; const C=this.events.ControlEvent;
    if (/WebcastChatMessage$/i.test(type)) { data.comment=String(data.comment??data.content??data.text??''); this.emit(E.CHAT,data); return true; }
    if (/WebcastRoomUserSeqMessage$/i.test(type)) { data.viewerCount=Number(data.viewerCount??data.total??0); this.emit(E.ROOM_USER,data); return true; }
    if (/WebcastControlMessage$/i.test(type) && (Number(data.action||data.actionType)===3 || /end/i.test(String(data.status||data.displayType||'')))) { this.emit(E.STREAM_END,data); return true; }
    if (type==='room.status') { if(data.roomId)this.roomId=String(data.roomId); if(/ended|offline/.test(String(data.state)))this.emit(E.STREAM_END,data); if(data.state==='error')this.emit(C.ERROR,new Error(data.message||'Error del relay.')); return true; }
    if (type==='workerInfo') { this.roomId=String(data.roomId||this.roomId); return true; }
    if (type==='tiktok.connect' || (type==='lulu.relay.status'&&data.state==='connected')) { this.emit(C.CONNECTED,{roomId:this.roomId}); return true; }
    if (type==='lulu.relay.error') { this.emit(C.ERROR,new Error(data.message||'Error del relay.')); return true; }
    return false;
  }
  connect() {
    const url=new URL(cleanRelayUrl(RELAY_URL));url.searchParams.set('uniqueId',this.uniqueId);url.searchParams.set('clientVersion',app.getVersion());
    return new Promise((resolve,reject)=>{
      let settled=false;let opened=false;const ready=()=>{if(settled||!opened)return;settled=true;clearTimeout(timer);this.isConnected=true;resolve({roomId:this.roomId,isConnected:true})};
      const fail=(error)=>{if(settled)return;settled=true;clearTimeout(timer);reject(error instanceof Error?error:new Error(String(error)))};
      const timer=setTimeout(()=>fail(new Error('El relay no respondió en 24 segundos.')),24000);
      this.socket=new WebSocket(url,{headers:{Authorization:`Bearer ${RELAY_CLIENT_TOKEN}`,'User-Agent':`Lulu-Music/${app.getVersion()}`},handshakeTimeout:16000,maxPayload:MAX_RELAY_FRAME_BYTES,perMessageDeflate:false,followRedirects:false});
      this.socket.on('open',()=>{opened=true;this.emit(this.events.ControlEvent.WEBSOCKET_CONNECTED);setTimeout(ready,1800)});
      this.socket.on('message',(raw,isBinary)=>{try{if(isBinary)throw new RelayProtocolError('binary_frame','Paquete binario rechazado.');const messages=parseRelayFrame(raw);const now=Date.now();if(!this.rateStarted||now-this.rateStarted>=1000){this.rateStarted=now;this.rateCount=0}this.rateCount+=messages.length;if(this.rateCount>500)throw new RelayProtocolError('rate_limit','Demasiados eventos.');let valid=false;for(const message of messages)valid=this.emitMessage(message)||valid;if(valid)ready()}catch(error){this.violations+=1;if(this.violations>=3)this.socket?.close(1008,'Protocolo rechazado')}});
      this.socket.on('error',(error)=>{this.emit(this.events.ControlEvent.ERROR,error);fail(error)});
      this.socket.on('close',(code,reason)=>{this.isConnected=false;this.socket=null;const error=new Error(String(reason||`Conexión cerrada (${code}).`));error.code=code;fail(error);this.emit(this.events.ControlEvent.DISCONNECTED,{code,reason:error.message})});
    });
  }
  async disconnect() { const socket=this.socket;this.socket=null;this.isConnected=false;if(!socket)return;await new Promise((resolve)=>{const timer=setTimeout(()=>{try{socket.terminate()}catch{}resolve()},1200);socket.once('close',()=>{clearTimeout(timer);resolve()});try{socket.close(1000,'Lulu Music desconectada')}catch{clearTimeout(timer);resolve()}}); }
}

function attachLiveEvents(connection, nonce, events) {
  const { WebcastEvent:E, ControlEvent:C } = events;
  connection.on(E.CHAT, (data) => { if(nonce===liveNonce&&connection===liveConnection)processLiveChat(data); });
  connection.on(E.ROOM_USER, (data) => { if(nonce===liveNonce&&connection===liveConnection)send('live:status',{...liveStatus,viewerCount:Number(data.viewerCount||0)}); });
  connection.on(E.STREAM_END, () => { if(nonce!==liveNonce||connection!==liveConnection)return;liveConnection=null;liveReconnectEnabled=false;void safeDisconnect(connection);setLiveStatus('ended','El LIVE terminó.'); });
  connection.on(C.ERROR, (error) => { if(nonce===liveNonce&&connection===liveConnection)notice(`Conexión LIVE: ${friendlyLiveError(error)}`); });
  connection.on(C.DISCONNECTED, (details={}) => {
    if(nonce!==liveNonce||connection!==liveConnection)return;liveConnection=null;
    if(liveReconnectEnabled&&liveHasConnected&&shouldReconnectLive({code:details.code,reason:details.reason,shuttingDown}))scheduleReconnect(nonce);
    else setLiveStatus('offline','La conexión al LIVE se cerró.');
  });
}

async function safeDisconnect(connection) { if(!connection)return;try{await Promise.race([connection.disconnect(),new Promise((resolve)=>setTimeout(resolve,3500))])}catch{} }

function friendlyLiveError(error) {
  const raw=String(error?.message||error||'Error desconocido');const lower=raw.toLowerCase();
  if(/offline|not live|live has ended|room.*offline/.test(lower))return 'TikTok no detecta un LIVE activo en esa cuenta.';
  if(/429|rate.?limit/.test(lower))return 'TikTok limitó temporalmente las conexiones. Espera un momento.';
  if(/401|unauthorized|token/.test(lower))return 'El servidor seguro rechazó la autorización de esta compilación.';
  return raw;
}

async function createLiveConnection(username, nonce) {
  if(!connectorModule)connectorModule=await import('tiktok-live-connector');
  const usingRelay=RELAY_CLIENT_TOKEN&&!RELAY_CLIENT_TOKEN.startsWith('__LULU_RELAY_');
  const connection=usingRelay
    ? new MusicRelayConnection(username,connectorModule)
    : new connectorModule.TikTokLiveConnection(username,{processInitialData:false,fetchRoomInfoOnConnect:true,enableWebsocketUpgrade:true});
  liveConnection=connection;attachLiveEvents(connection,nonce,connectorModule);refreshPowerBlocker();
  const result=await Promise.race([connection.connect(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('La conexión tardó más de 28 segundos.')),28000))]);
  if(nonce!==liveNonce||connection!==liveConnection){await safeDisconnect(connection);throw new Error('La conexión fue cancelada.');}
  return result;
}

async function connectLive(rawUsername, reconnecting = false) {
  const username=normalizeUsername(rawUsername);if(!username)throw new Error('Escribe el usuario que está en LIVE.');
  if(!reconnecting){liveNonce+=1;liveReconnectAttempt=0;liveReconnectUsername=username;liveReconnectEnabled=true;liveHasConnected=false;settings.creatorUsername=username;await writeSettings();}
  const nonce=liveNonce;const previous=liveConnection;liveConnection=null;await safeDisconnect(previous);
  setLiveStatus('connecting',reconnecting?'Recuperando la conexión al LIVE…':'Conectando al LIVE…');
  try{
    const result=await createLiveConnection(username,nonce);liveHasConnected=true;liveReconnectAttempt=0;
    setLiveStatus('connected',reconnecting?'Conexión recuperada automáticamente.':'Conectado correctamente al LIVE.',{roomId:String(result?.roomId||'live')});
    return liveStatus;
  }catch(error){if(nonce===liveNonce&&!reconnecting){liveConnection=null;liveReconnectEnabled=false;setLiveStatus('error',friendlyLiveError(error));}throw new Error(friendlyLiveError(error));}
}

function scheduleReconnect(nonce) {
  if(liveReconnectTimer||!liveReconnectEnabled||shuttingDown||nonce!==liveNonce)return;
  liveReconnectAttempt+=1;if(liveReconnectAttempt>LIVE_RECONNECT_DELAYS_MS.length){liveReconnectEnabled=false;setLiveStatus('error','No se pudo recuperar el LIVE. Pulsa Conectar para intentarlo otra vez.');return;}
  const delay=liveReconnectDelay(liveReconnectAttempt);setLiveStatus('connecting',`Reconectando automáticamente en ${Math.ceil(delay/1000)} s…`);
  liveReconnectTimer=setTimeout(async()=>{liveReconnectTimer=null;if(!liveReconnectEnabled||nonce!==liveNonce)return;try{await connectLive(liveReconnectUsername,true)}catch{if(liveReconnectEnabled&&nonce===liveNonce)scheduleReconnect(nonce)}},delay);
  liveReconnectTimer.unref?.();refreshPowerBlocker();
}

async function disconnectLive() {
  liveReconnectEnabled=false;liveHasConnected=false;liveReconnectAttempt=0;liveNonce+=1;if(liveReconnectTimer)clearTimeout(liveReconnectTimer);liveReconnectTimer=null;
  const connection=liveConnection;liveConnection=null;await safeDisconnect(connection);setLiveStatus('offline','Desconectado del LIVE.');return liveStatus;
}

function registerIpc() {
  ipcMain.handle('app:get-state',()=>currentState());
  ipcMain.handle('settings:save',async(_event,input)=>{settings=sanitizeSettings(input);if(musicQueue.length>settings.queueLimit)musicQueue=musicQueue.slice(0,settings.queueLimit);await writeSettings();await setPlayerVolume(settings.volume).catch(()=>{});broadcastState();return currentState()});
  ipcMain.handle('live:connect',(_event,input)=>connectLive(input?.username));
  ipcMain.handle('live:disconnect',()=>disconnectLive());
  ipcMain.handle('music:add',async(_event,input)=>{const result=await enqueueSong(input?.query,null,true);if(!result.accepted)throw new Error(result.reason==='duplicate'?'Esa canción ya está solicitada.':result.reason==='full'?'La cola está llena.':'No se pudo agregar la canción.');return result});
  ipcMain.handle('music:remove',(_event,input)=>removeSong(input?.id));
  ipcMain.handle('music:move',(_event,input)=>moveSong(input?.id,input?.direction));
  ipcMain.handle('music:clear',()=>{musicQueue=[];broadcastState();return currentState()});
  ipcMain.handle('player:control',(_event,input)=>playerControl(String(input?.action||''),input?.value));
  ipcMain.handle('player:show',()=>showPlayer());
}

function createMainWindow() {
  mainWindow=new BrowserWindow({
    width:1380,height:900,minWidth:920,minHeight:720,show:false,autoHideMenuBar:true,backgroundColor:'#090812',title:'Lulu Music',
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,spellcheck:false}
  });
  mainWindow.webContents.setWindowOpenHandler(({url})=>{/^https?:\/\//i.test(url)&&void shell.openExternal(url);return{action:'deny'}});
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==mainWindow.webContents.getURL())event.preventDefault()});
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  if(process.env.LULU_MUSIC_SMOKE_TEST==='1')mainWindow.webContents.once('did-finish-load',async()=>{
    try{
      const result=await mainWindow.webContents.executeJavaScript(`(() => ({title:document.title,panels:document.querySelectorAll('.panel').length,hasQueue:Boolean(document.getElementById('queueList')),hasPlayer:Boolean(document.getElementById('nowContent')),hasSettings:Boolean(document.getElementById('musicCommand')),hasSidebar:Boolean(document.querySelector('nav,.sidebar')),hasIframe:Boolean(document.querySelector('iframe'))}))()`,true);
      console.log(`LULU_MUSIC_SMOKE_OK:${JSON.stringify(result)}`);
      const marker=String(process.env.LULU_MUSIC_SMOKE_MARKER||'');
      if(marker)await fsp.writeFile(marker,JSON.stringify(result),'utf8');
    }catch(error){console.error('LULU_MUSIC_SMOKE_FAIL:',error?.message||error);process.exitCode=1}
    setTimeout(()=>app.quit(),300);
  });
  mainWindow.on('closed',()=>{mainWindow=null});
  void mainWindow.loadFile(path.join(__dirname,'index.html'));
}

async function shutdown() {
  if(shuttingDown)return;shuttingDown=true;liveReconnectEnabled=false;if(liveReconnectTimer)clearTimeout(liveReconnectTimer);liveReconnectTimer=null;
  const connection=liveConnection;liveConnection=null;await safeDisconnect(connection);
  for(const win of [youtubeWindow,spotifyWindow])if(win&&!win.isDestroyed())try{win.destroy()}catch{}
}

if(process.env.LULU_MUSIC_UNIT_TEST!=='1'){
  const singleInstance=app.requestSingleInstanceLock();
  if(!singleInstance)app.quit();
  else{
    app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus()}});
    app.whenReady().then(async()=>{
      session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
      await loadSettings();registerIpc();createMainWindow();
    }).catch((error)=>{console.error(error);app.quit()});
    app.on('before-quit',(event)=>{if(shuttingDown)return;event.preventDefault();void shutdown().finally(()=>app.exit(0))});
    app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
    app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createMainWindow()});
  }
}

module.exports={sanitizeSettings};
