'use strict';

const electron = process.env.LULU_MUSIC_UNIT_TEST === '1' ? {} : require('electron');
const { app, BrowserWindow, ipcMain, shell, session, powerSaveBlocker } = electron;
const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { MAX_RELAY_FRAME_BYTES, RelayProtocolError, parseRelayFrame } = require('./relay-protocol');
const { LIVE_RECONNECT_DELAYS_MS, shouldReconnectLive, liveReconnectDelay } = require('./live-reconnect-policy');
const { normalizeUsername, normalizeMusicCommand, parseMusicCommand, requesterAllowed, blockedRequest } = require('./music-command-policy');
const { youtubeVideoId, youtubeEmbedUrl, isYoutubeEmbedUrl, resolveYoutubeRequest } = require('./youtube-light-engine');
const { isAudiusUrl, isAudiusStreamUrl, resolveAudiusRequest } = require('./audius-light-engine');

const fsp = fs.promises;
const RELAY_URL = 'wss://lulu-finity-production.up.railway.app/v1/tiktok/live';
const RELAY_CLIENT_TOKEN = '__LULU_RELAY_CLIENT_TOKEN__';
const YOUTUBE_PARTITION = 'persist:lulu-music-youtube';
const PROVIDERS = new Set(['auto','audius','youtube']);
const PERMISSIONS = new Set(['all','followers','subscribers','selected']);

const DEFAULT_SETTINGS = Object.freeze({
  creatorUsername:'', command:'!cancion', provider:'auto', permission:'all', queueLimit:30,
  selectedUsers:[], blockedTerms:[], preventDuplicates:true, onePerUser:true,
  continueRecommended:false, volume:.8
});

let mainWindow = null;
let youtubeWindow = null;
let settings = { ...DEFAULT_SETTINGS };
let musicQueue = [];
let playback = { current:null, loading:false, paused:true, currentTime:0, duration:0 };
let playerNonce = 0;
let youtubeRequestIdentityInstalled = false;
let youtubeRecentIds = [];
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
let rendererReady = false;
let rendererReadyWaiters = [];

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
    provider:PROVIDERS.has(merged.provider) ? merged.provider : 'auto',
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

function markRendererReady(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event?.sender?.id !== mainWindow.webContents.id) return false;
  rendererReady = true;
  const waiters = rendererReadyWaiters;
  rendererReadyWaiters = [];
  waiters.forEach((resolve) => resolve(true));
  return true;
}

function waitForRendererReady(timeoutMs = 8_000) {
  if (rendererReady) return Promise.resolve(true);
  return new Promise((resolve, reject) => {
    const ready = () => { clearTimeout(timer); resolve(true); };
    const timer = setTimeout(async () => {
      rendererReadyWaiters = rendererReadyWaiters.filter((waiter) => waiter !== ready);
      let phase = 'no disponible';
      try {
        phase = await mainWindow.webContents.executeJavaScript(`JSON.stringify({phase:window.__LULU_MUSIC_RENDERER_PHASE__||'',api:typeof window.luluMusic,policy:typeof window.LuluMusicPolicy})`, true);
      } catch {}
      reject(new Error(`El renderer musical no confirmó que estaba listo (${phase}).`));
    }, timeoutMs);
    rendererReadyWaiters.push(ready);
  });
}

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
    provider:settings.provider, requestedProvider:settings.provider, createdAt:Date.now()
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
  if (natural && !musicQueue.length && settings.continueRecommended && previous?.provider === 'youtube') {
    const recommendationQuery = [previous.artist, previous.resolvedTitle || previous.query].filter(Boolean).join(' ').trim();
    playback = { current:{
      id:randomUUID(), query:recommendationQuery || previous.query, requestedBy:'Lulu Music', username:'', provider:'youtube', requestedProvider:'youtube',
      createdAt:Date.now(), recommendation:true
    }, loading:true, paused:false, currentTime:0, duration:0 };
    broadcastState();
    void startCurrentSong();
    return;
  }
  stopAudiusPlayback();
  void pauseYoutubePlayback();
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
    const requestedProvider = item.requestedProvider || item.provider || 'auto';
    item.requestedProvider = requestedProvider;
    if (requestedProvider === 'audius') {
      item.provider = 'audius';
      await openAudius(item, nonce, { requireConfident:false });
    } else if (requestedProvider === 'youtube') {
      item.provider = 'youtube';
      await openYoutube(item, nonce);
    } else {
      await openAutomatic(item, nonce);
    }
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

function stopAudiusPlayback() {
  send('audius:command', { action:'stop', nonce:playerNonce });
}

async function pauseYoutubePlayback({ release = false } = {}) {
  const win = youtubeWindow;
  if (!win || win.isDestroyed()) return;
  await win.webContents.executeJavaScript(`(() => {document.querySelector('video')?.pause();return true})()`, true).catch(() => {});
  if (release && !win.isDestroyed()) {
    try { win.removeAllListeners('close'); win.destroy(); } catch {}
  }
}

async function openAutomatic(item, nonce) {
  if (youtubeVideoId(item.query)) {
    item.provider = 'youtube';
    item.autoFallbackAllowed = false;
    return openYoutube(item, nonce);
  }
  if (isAudiusUrl(item.query)) {
    item.provider = 'audius';
    item.autoFallbackAllowed = false;
    return openAudius(item, nonce, { requireConfident:false });
  }
  item.autoFallbackAllowed = true;
  try {
    const resolved = await resolveAudiusRequest(item.query, { requireConfident:true });
    if (nonce !== playerNonce || playback.current?.id !== item.id) return;
    item.provider = 'audius';
    return openAudius(item, nonce, { resolved });
  } catch {
    if (nonce !== playerNonce || playback.current?.id !== item.id) return;
    item.provider = 'youtube';
    item.autoFallbackTried = true;
    broadcastState();
    return openYoutube(item, nonce);
  }
}

async function openAudius(item, nonce, options = {}) {
  const resolved = options.resolved || await resolveAudiusRequest(item.query, {
    requireConfident:Boolean(options.requireConfident)
  });
  if (nonce !== playerNonce || playback.current?.id !== item.id) return;
  if (!isAudiusStreamUrl(resolved.streamUrl)) throw new Error('Audius devolvió una dirección de audio no válida.');
  item.provider = 'audius';
  item.trackId = resolved.trackId;
  item.resolvedTitle = resolved.title || item.query;
  item.artist = resolved.artist || '';
  item.sourceUrl = resolved.sourceUrl || '';
  item.verifiedArtist = Boolean(resolved.verified);
  item.audiusScore = Math.round(Number(resolved.score) || 0);
  playback.duration = Number(resolved.duration) || 0;
  await pauseYoutubePlayback({ release:true });
  await waitForRendererReady();
  if (nonce !== playerNonce || playback.current?.id !== item.id) return;
  broadcastState();
  send('audius:load', {
    nonce,
    streamUrl:resolved.streamUrl,
    volume:settings.volume,
    title:item.resolvedTitle,
    artist:item.artist
  });
}

async function fallbackAudiusToYoutube(reason, nonce) {
  const item = playback.current;
  if (!item || item.provider !== 'audius' || nonce !== playerNonce) return;
  if (item.requestedProvider !== 'auto' || item.autoFallbackAllowed === false || item.autoFallbackTried) {
    notice(`Audius no pudo reproducir “${item.query}”${reason ? `: ${reason}` : '.'}`);
    advanceQueue();
    return;
  }
  item.autoFallbackTried = true;
  item.provider = 'youtube';
  playback.loading = true;
  playback.paused = false;
  playback.currentTime = 0;
  playback.duration = 0;
  stopAudiusPlayback();
  broadcastState();
  try {
    await openYoutube(item, nonce);
  } catch (error) {
    if (nonce !== playerNonce || playback.current?.id !== item.id) return;
    notice(`No se pudo reproducir “${item.query}” en Audius ni YouTube: ${error?.message || error}`);
    advanceQueue();
  }
}

function handleAudiusState(event, input = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return;
  const nonce = Number(input.nonce);
  if (nonce !== playerNonce || !playback.current || playback.current.provider !== 'audius') return;
  const type = String(input.type || '');
  if (type === 'error') {
    void fallbackAudiusToYoutube(String(input.message || 'el audio directo falló'), nonce);
    return;
  }
  if (type === 'ended') {
    advanceQueue({ natural:true });
    return;
  }
  if (!['loaded','playing','paused','progress'].includes(type)) return;
  playback.loading = type === 'loaded' ? false : playback.loading;
  if (type === 'playing') { playback.loading = false; playback.paused = false; }
  if (type === 'paused') playback.paused = true;
  playback.currentTime = Math.max(0, Number(input.currentTime) || 0);
  playback.duration = Math.max(0, Number(input.duration) || playback.duration || 0);
  broadcastState();
}

function installYoutubeRequestIdentity() {
  if (youtubeRequestIdentityInstalled) return;
  youtubeRequestIdentityInstalled = true;
  session.fromPartition(YOUTUBE_PARTITION).webRequest.onBeforeSendHeaders({ urls:['https://www.youtube.com/embed/*'] }, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders, Referer:'https://github.com/Mikasita25/Lulu-Finity/' };
    callback({ requestHeaders });
  });
}

function createYoutubeWindow() {
  if (youtubeWindow && !youtubeWindow.isDestroyed()) return youtubeWindow;
  installYoutubeRequestIdentity();
  const win = new BrowserWindow({
    width:854,height:480,minWidth:480,minHeight:270,show:false,skipTaskbar:true,autoHideMenuBar:true,
    title:'Reproductor ligero — Lulu Music',backgroundColor:'#000000',
    webPreferences:{
      contextIsolation:true,nodeIntegration:false,sandbox:true,autoplayPolicy:'no-user-gesture-required',
      backgroundThrottling:false,partition:YOUTUBE_PARTITION
    }
  });
  youtubeWindow = win;
  win.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (!isYoutubeEmbedUrl(url)) event.preventDefault(); });
  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed() && isYoutubeEmbedUrl(win.webContents.getURL())) void installYoutubeWatcher(playerNonce, 0);
  });
  win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3 || !playback.current || playback.current.provider !== 'youtube') return;
    notice(`El reproductor ligero de YouTube no cargó: ${description || code}.`);
    advanceQueue();
  });
  win.webContents.on('console-message', (_event, details, legacyMessage) => {
    const message = String(details && typeof details === 'object' ? details.message : (legacyMessage || details) || '');
    const match = message.match(/^__LULU_MUSIC_PLAYER__:(\d+):(.*)$/);
    if (match && Number(match[1]) === playerNonce) {
      try {
        const data = JSON.parse(decodeURIComponent(match[2]));
        if (!playback.current || playback.current.provider !== 'youtube') return;
        if (data.title) playback.current.resolvedTitle = data.title;
        if (data.artist) playback.current.artist = data.artist;
        playback.loading = false; playback.paused = Boolean(data.paused);
        playback.currentTime = Number(data.currentTime) || 0; playback.duration = Number(data.duration) || 0;
        broadcastState();
      } catch {}
      return;
    }
    const ended = message.match(/^__LULU_MUSIC_ENDED__:(\d+)$/);
    if (ended && Number(ended[1]) === playerNonce) advanceQueue({ natural:true });
  });
  win.on('close', (event) => { if (!shuttingDown) { event.preventDefault(); win.hide(); } });
  win.on('closed', () => { if (youtubeWindow === win) youtubeWindow = null; });
  return win;
}

async function openYoutube(item, nonce) {
  stopAudiusPlayback();
  const resolved = await resolveYoutubeRequest(item.query, {
    excludeVideoIds:item.recommendation ? youtubeRecentIds : []
  });
  if (nonce !== playerNonce || playback.current?.id !== item.id) return;
  item.videoId = resolved.videoId;
  item.resolvedTitle = resolved.title || item.resolvedTitle || item.query;
  item.artist = resolved.artist || item.artist || '';
  youtubeRecentIds = [...youtubeRecentIds.filter((id) => id !== resolved.videoId), resolved.videoId].slice(-20);
  broadcastState();
  const win = createYoutubeWindow();
  await win.loadURL(youtubeEmbedUrl(resolved.videoId), { extraHeaders:'Referer: https://github.com/Mikasita25/Lulu-Finity/\n' });
  if (nonce !== playerNonce) return;
  await setPlayerVolume(settings.volume).catch(() => {});
}

async function installYoutubeWatcher(nonce, attempt) {
  if (nonce !== playerNonce || !youtubeWindow || youtubeWindow.isDestroyed()) return;
  try {
    const installed = await youtubeWindow.webContents.executeJavaScript(`(() => {
      window.__luluMusicCleanup?.();
      const video=document.querySelector('video');
      if(!video)return false;
      let ended=false;
      const report=()=>{
        const ad=Boolean(document.querySelector('.html5-video-player.ad-showing,.html5-video-player.ad-interrupting'));
        video.volume=${JSON.stringify(settings.volume)};video.muted=false;
        const payload={currentTime:video.currentTime,duration:video.duration,paused:video.paused};
        console.info('__LULU_MUSIC_PLAYER__:${nonce}:'+encodeURIComponent(JSON.stringify(payload)));
        if(!ad&&video.ended&&!ended){ended=true;console.info('__LULU_MUSIC_ENDED__:${nonce}')}
      };
      const timer=setInterval(report,650);video.play().catch(()=>{});report();
      window.__luluMusicCleanup=()=>{clearInterval(timer);delete window.__luluMusicCleanup};
      return true;
    })()`, true);
    if (installed) return;
  } catch {}
  if (attempt < 24) setTimeout(() => void installYoutubeWatcher(nonce, attempt + 1), 300);
  else if (nonce === playerNonce) { notice('El reproductor ligero de YouTube no pudo iniciar esta canción.'); advanceQueue(); }
}

function activePlayerWindow() { return playback.current?.provider === 'youtube' ? youtubeWindow : null; }

async function setPlayerVolume(value) {
  settings.volume = clamp(value, 0, 1, settings.volume);
  if (playback.current?.provider === 'audius') {
    send('audius:command', { action:'volume', value:settings.volume, nonce:playerNonce });
    return { ok:true };
  }
  const win = activePlayerWindow();
  if (!win || win.isDestroyed()) return { ok:true, deferred:true };
  return win.webContents.executeJavaScript(`(() => {const video=document.querySelector('video');if(!video)return{ok:false};video.volume=${JSON.stringify(settings.volume)};video.muted=false;return{ok:true}})()`, true);
}

async function playerControl(action, value) {
  if (action === 'next') {
    if (playback.current?.provider === 'audius') stopAudiusPlayback();
    const currentWindow=activePlayerWindow();
    if(currentWindow&&!currentWindow.isDestroyed()){
      await currentWindow.webContents.executeJavaScript(`(() => {document.querySelector('video')?.pause();return true})()`,true).catch(()=>{});
    }
    advanceQueue(); return currentState();
  }
  if (action === 'volume') { await setPlayerVolume(value); await writeSettings(); broadcastState(); return currentState(); }
  if (playback.current?.provider === 'audius') {
    if (!playback.current) throw new Error('No hay una canción activa.');
    send('audius:command', { action, nonce:playerNonce });
    return currentState();
  }
  const win = activePlayerWindow();
  if (!win || win.isDestroyed()) throw new Error('No hay una canción activa.');
  await win.webContents.executeJavaScript(`(() => {const video=document.querySelector('video');if(!video)return{ok:false};const action=${JSON.stringify(action)};if(action==='toggle')video.paused?video.play():video.pause();if(action==='restart'){video.currentTime=0;video.play()}return{ok:true}})()`, true);
  return currentState();
}

function showPlayer() {
  if (playback.current?.provider === 'audius') {
    const source = String(playback.current.sourceUrl || '');
    if (isAudiusUrl(source)) { void shell.openExternal(source); return { ok:true, external:true }; }
    notice('Audius reproduce audio directo dentro de Lulu Music; no necesita otra ventana.');
    return { ok:true, embedded:true };
  }
  const win = activePlayerWindow();
  if (!playback.current || !win || win.isDestroyed() || !win.webContents.getURL()) {
    notice(playback.loading ? 'La canción todavía se está buscando.' : 'Agrega una canción para abrir el reproductor.');
    return { ok:false };
  }
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
  ipcMain.handle('app:renderer-ready',(event)=>markRendererReady(event));
  ipcMain.on('audius:state',handleAudiusState);
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

async function audiusSmokeDiagnostics() {
  const previousVolume = settings.volume;
  const resolved = await resolveAudiusRequest('ODESZA Say My Name', { requireConfident:true });
  const item = {
    id:randomUUID(), query:'ODESZA Say My Name', requestedBy:'Prueba', username:'',
    provider:'audius', requestedProvider:'audius', createdAt:Date.now()
  };
  const nonce = ++playerNonce;
  settings.volume = 0;
  playback = { current:item, loading:true, paused:false, currentTime:0, duration:0 };
  try {
    await openAudius(item, nonce, { resolved });
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && playback.current?.id === item.id && playback.loading) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const rendererAudio = await mainWindow.webContents.executeJavaScript(`(() => {const audio=document.getElementById('audiusPlayer');const clean=(value)=>{try{const url=new URL(value);return url.origin+url.pathname}catch{return''}};return{exists:Boolean(audio),readyState:Number(audio?.readyState||0),networkState:Number(audio?.networkState||0),errorCode:Number(audio?.error?.code||0),errorMessage:String(audio?.error?.message||''),paused:Boolean(audio?.paused),source:clean(audio?.currentSrc||audio?.src),hasSource:Boolean(audio?.currentSrc||audio?.src)}})()`, true);
    if (playback.current?.id !== item.id || playback.current?.provider !== 'audius' || playback.loading) {
      throw new Error(`El audio directo de Audius no confirmó su carga: ${JSON.stringify(rendererAudio)}`);
    }
    if (!rendererAudio.exists || rendererAudio.readyState < 1 || !rendererAudio.hasSource) throw new Error('El elemento de audio de Audius no quedó activo.');
    const workingSetKb = app.getAppMetrics().reduce((total, metric) => total + (Number(metric.memory?.workingSetSize) || 0), 0);
    return {
      audiusDirectAudio:true,
      audiusUsedMainRenderer:true,
      audiusWindowCount:BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed()).length,
      audiusTrackId:resolved.trackId,
      audiusReadyState:rendererAudio.readyState,
      audiusWorkingSetMb:Math.round(workingSetKb / 1024)
    };
  } finally {
    stopAudiusPlayback();
    playerNonce += 1;
    playback = { current:null, loading:false, paused:true, currentTime:0, duration:0 };
    settings.volume = previousVolume;
  }
}

async function youtubeSmokeDiagnostics() {
  const firstUrl = `${youtubeEmbedUrl('M7lc1UVf-VE')}&start=0`;
  const secondUrl = `${youtubeEmbedUrl('M7lc1UVf-VE')}&start=1`;
  const win = createYoutubeWindow();
  const firstWindowId = win.id;
  const firstWebContentsId = win.webContents.id;
  await win.loadURL(firstUrl, { extraHeaders:'Referer: https://github.com/Mikasita25/Lulu-Finity/\n' });
  await win.loadURL(secondUrl, { extraHeaders:'Referer: https://github.com/Mikasita25/Lulu-Finity/\n' });
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const workingSetKb = app.getAppMetrics().reduce((total, metric) => total + (Number(metric.memory?.workingSetSize) || 0), 0);
  return {
    lightweightPlayer:true,
    playerWindowReused:firstWindowId === win.id,
    playerWebContentsReused:firstWebContentsId === win.webContents.id,
    playerWindowId:win.id,
    playerWebContentsId:win.webContents.id,
    appWindowCount:BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed()).length,
    playerUrl:win.webContents.getURL(),
    workingSetMb:Math.round(workingSetKb / 1024)
  };
}

function createMainWindow() {
  rendererReady=false;
  mainWindow=new BrowserWindow({
    width:1380,height:900,minWidth:920,minHeight:720,show:false,autoHideMenuBar:true,backgroundColor:'#090812',title:'Lulu Music',
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required',spellcheck:false}
  });
  mainWindow.webContents.setWindowOpenHandler(({url})=>{/^https?:\/\//i.test(url)&&void shell.openExternal(url);return{action:'deny'}});
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==mainWindow.webContents.getURL())event.preventDefault()});
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  if(process.env.LULU_MUSIC_SMOKE_TEST==='1')mainWindow.webContents.once('did-finish-load',async()=>{
    const marker=String(process.env.LULU_MUSIC_SMOKE_MARKER||'');
    try{
      await waitForRendererReady();
      const result=await mainWindow.webContents.executeJavaScript(`(() => ({title:document.title,panels:document.querySelectorAll('.panel').length,hasQueue:Boolean(document.getElementById('queueList')),hasPlayer:Boolean(document.getElementById('nowContent')),hasSettings:Boolean(document.getElementById('musicCommand')),hasSidebar:Boolean(document.querySelector('nav,.sidebar')),hasIframe:Boolean(document.querySelector('iframe'))}))()`,true);
      if(process.env.LULU_MUSIC_PLAYER_SMOKE_TEST==='1'){
        Object.assign(result,await audiusSmokeDiagnostics());
        Object.assign(result,await youtubeSmokeDiagnostics());
      }
      console.log(`LULU_MUSIC_SMOKE_OK:${JSON.stringify(result)}`);
      if(marker)await fsp.writeFile(marker,JSON.stringify(result),'utf8');
    }catch(error){
      const failure={error:String(error?.message||error),stack:String(error?.stack||'')};
      console.error('LULU_MUSIC_SMOKE_FAIL:',failure.error);
      if(marker)await fsp.writeFile(marker,JSON.stringify(failure),'utf8').catch(()=>{});
      process.exitCode=1;
    }
    setTimeout(()=>app.quit(),300);
  });
  mainWindow.on('closed',()=>{mainWindow=null;if(!shuttingDown)app.quit()});
  void mainWindow.loadFile(path.join(__dirname,'index.html'));
}

async function shutdown() {
  if(shuttingDown)return;shuttingDown=true;liveReconnectEnabled=false;if(liveReconnectTimer)clearTimeout(liveReconnectTimer);liveReconnectTimer=null;
  const connection=liveConnection;liveConnection=null;await safeDisconnect(connection);
  stopAudiusPlayback();
  if(youtubeWindow&&!youtubeWindow.isDestroyed())try{youtubeWindow.destroy()}catch{}
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
