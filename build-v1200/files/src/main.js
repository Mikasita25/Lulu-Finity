'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, clipboard, session, utilityProcess, powerSaveBlocker, powerMonitor } = require('electron');
const path = require('path');
const LuluWidgetDesign = require('./widget-design');
const { pathToFileURL } = require('url');
const { randomUUID, createHash } = require('crypto');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const fsp = fs.promises;
const { autoUpdater } = require('electron-updater');
const { EventEmitter } = require('events');
const WebSocket = require('ws');
const { MAX_RELAY_FRAME_BYTES, RelayProtocolError, parseRelayFrame, sanitizeRelayUsage } = require('./relay-protocol');
const { LIVE_RECONNECT_DELAYS_MS, shouldReconnectLive, liveReconnectDelay } = require('./live-reconnect-policy');
const { musicRecoveryDelay, shouldRecoverPlayback, isManualPlayerPause, shouldResumeUnexpectedPause } = require('./music-recovery-policy');
const { firstInstalledVersionFor } = require('./release-notice-policy');
const { defaultSoundCatalog } = require('./default-sound-catalog');
const DEFAULT_SOUND_SOURCE_URL = 'https://kenney.nl/assets/interface-sounds';
let onlineVoiceCatalog = null;
let tiktokVoiceCatalog = null;
let tiktokTtsClient = null;
let LiveGameManagerClass = null;
let LocalVoiceManagerClass = null;
let automationEngine = null;
function getOnlineVoiceCatalog(){ if(!onlineVoiceCatalog) onlineVoiceCatalog=require('./online-voice-catalog'); return onlineVoiceCatalog; }
function getTikTokVoiceCatalog(){ if(!tiktokVoiceCatalog) tiktokVoiceCatalog=require('./tiktok-voice-catalog'); return tiktokVoiceCatalog; }
function getTikTokTtsClient(){ if(!tiktokTtsClient) tiktokTtsClient=require('./tiktok-tts-client'); return tiktokTtsClient; }
function getLiveGameManagerClass(){ if(!LiveGameManagerClass) ({ LiveGameManager:LiveGameManagerClass } = require('./live-games')); return LiveGameManagerClass; }
function getLocalVoiceManagerClass(){ if(!LocalVoiceManagerClass) ({ LocalVoiceManager:LocalVoiceManagerClass } = require('./local-voice-manager')); return LocalVoiceManagerClass; }
function getAutomationEngine(){ if(!automationEngine) automationEngine=require('./automation-engine'); return automationEngine; }

let mainWindow = null;
let youtubeWindow = null;
let youtubeResolverWindow = null;
let tiktokChatWindow = null;
let tiktokChatSendChain = Promise.resolve();
let tiktokChatLastSentAt = 0;
let tiktokChatLastMessage = '';
let tiktokSessionSecurityInstalled = false;
let youtubeResolveChain = Promise.resolve();
let spotifyWindow = null;
let liveConnection = null;
let connectorModule = null;
let youtubeMuted = false;
let youtubeVolume = 0.8;
let youtubeAdGuardMuted = false;
let youtubeAutomationNonce = 0;
let youtubeAutomationTimer = null;
let youtubeResolverIdleTimer = null;
let youtubeAdBlockInstalled = false;
let youtubeAdBlockEnabled = true;
let youtubeFilterEngine = null;
let youtubeFilterEnginePromise = null;
let youtubeFilterEngineEnabled = false;
let spotifyMuted = false;
let spotifyVolume = 0.8;
let spotifyAutomationNonce = 0;
let spotifyAutomationTimer = null;
let musicRecoveryWatchdogTimer = null;
const musicRecoveryState = {
  youtube: { expectedPlaying:false, userPaused:false, replacing:false, adActive:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, recoveryAttempt:0, recoveryTimer:null },
  spotify: { expectedPlaying:false, userPaused:false, replacing:false, lastUrl:'', lastTime:0, lastDuration:0, lastProgressAt:0, recoveryAttempt:0, recoveryTimer:null }
};
let liveConnectNonce = 0;
let liveReconnectTimer = null;
let liveReconnectStableTimer = null;
let liveReconnectAttempt = 0;
let liveReconnectUsername = '';
let liveReconnectEnabled = false;
let liveReconnectHasConnected = false;
let liveReconnectInFlight = false;
let edgeTtsModulePromise = null;
let updaterInitialized = false;
let updatePromptOpen = false;
let updateDownloaded = false;
let installUpdateWhenDownloaded = false;
let updateCheckInFlight = false;
let lastUpdateCheckWasManual = false;
let isQuitting = false;
let shutdownPromise = null;
const knownFollowers = new Set();
const fanStickerDedup = new Map();
let economyOperationChain = Promise.resolve();
let overlayServer = null;
let overlayPort = 0;
const overlayClients = new Map();
const rankingClients = new Map();
const overlayPollClients = new Map();
const rankingPollClients = new Map();
const streamWidgetPollClients = new Map();
const overlayStates = new Map();
const streamWidgetStates = new Map();
let overlayTunnelProcess = null;
let overlayTunnelPromise = null;
let overlayPublicBaseUrl = '';
let overlayTunnelLastAttempt = 0;
let overlayTunnelStopRequested = false;
let overlayTunnelStatus = { status: 'idle', message: 'Enlace HTTPS pendiente.', url: '' };
let stableOverlaySyncTimer = null;
let stableOverlayRecoveryTimer = null;
let stableOverlaySyncInFlight = false;
let stableOverlaySettingsChain = Promise.resolve();
const pendingStableOverlaySources = new Set();
let appSuspensionBlockerId = null;
let rankingOperationChain = Promise.resolve();
let rankingDataCache = null;
let rankingWriteTimer = null;
let rankingBroadcastTimer = null;
let liveGameManager = null;
let localVoiceManager = null;
let activeRendererPage = 'dashboard';
const activeRuntimeModules = new Set(['core']);
let runtimeResourceSettings = null;
const RUNTIME_MODULE_BY_PAGE = Object.freeze({ voice:'tts', rankings:'rankings', automations:'automations', games:'games', economy:'economy', account:'account', songs:'music', spotify:'music', commands:'commands' });
const RUNTIME_KEEP_KEY_BY_MODULE = Object.freeze({ tts:'voice', rankings:'rankings', automations:'automations', games:'games', economy:'economy', account:'account', music:'music', commands:'commands', overlays:'overlays', live:'live' });
let visibleRuntimeModule = null;
function activateRuntimeModule(name){ if(name) activeRuntimeModules.add(String(name)); }
function runtimeModuleRetained(name) {
  const key = RUNTIME_KEEP_KEY_BY_MODULE[String(name || '')];
  const settings = runtimeResourceSettings || {};
  return Boolean(key && (settings.performanceProfile === 'instant' || (settings.performanceProfile === 'balanced' && settings.balancedKeepActive?.[key] === true)));
}
function runtimeModuleInUse(name) {
  const moduleName = String(name || '');
  const stableSources = normalizeActiveHttpsSources(runtimeResourceSettings?.activeHttpsSources);
  if (moduleName === 'live') return Boolean(liveConnection || liveReconnectEnabled || liveReconnectTimer || liveReconnectInFlight);
  if (moduleName === 'music') return Boolean((youtubeWindow && !youtubeWindow.isDestroyed()) || (spotifyWindow && !spotifyWindow.isDestroyed()));
  if (moduleName === 'account') return Boolean(tiktokChatWindow && !tiktokChatWindow.isDestroyed() && tiktokChatWindow.isVisible());
  if (moduleName === 'rankings') return rankingClientCount() > 0 || stableSources.some((key) => key.startsWith('ranking:')) || Boolean(overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed);
  if (moduleName === 'overlays') return overlayClientCount() + streamWidgetClientCount() > 0 || stableSources.some((key) => key.startsWith('widget:') || key.startsWith('screen:')) || Boolean(overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed);
  if (moduleName === 'games') return Boolean(liveGameManager?.blackjackHands?.size);
  if (moduleName === 'tts') return Boolean(localVoiceManager?.status?.().pending);
  return false;
}
function activeRuntimeModuleNames() {
  const modules = new Set(['core']);
  if (visibleRuntimeModule) modules.add(visibleRuntimeModule);
  for (const name of activeRuntimeModules) {
    if (name === 'core' || runtimeModuleRetained(name) || runtimeModuleInUse(name)) modules.add(name);
  }
  if (liveConnection) modules.add('live');
  const stableSources = normalizeActiveHttpsSources(runtimeResourceSettings?.activeHttpsSources);
  if (stableSources.some((key) => key.startsWith('ranking:'))) modules.add('rankings');
  if (stableSources.some((key) => key.startsWith('widget:') || key.startsWith('screen:'))) modules.add('overlays');
  if (automationEngine && runtimeModuleRetained('automations')) modules.add('automations');
  if (liveGameManager && (runtimeModuleRetained('games') || runtimeModuleInUse('games'))) modules.add('games');
  if (overlayServer && (runtimeModuleRetained('overlays') || overlayClientCount() + rankingClientCount() + streamWidgetClientCount() > 0)) modules.add('overlays');
  return [...modules];
}
function runtimeModuleActive(name) {
  return activeRuntimeModuleNames().includes(String(name || ''));
}
function activateRuntimeModuleForPage(page) {
  visibleRuntimeModule = RUNTIME_MODULE_BY_PAGE[String(page || '')] || null;
  if (visibleRuntimeModule) activateRuntimeModule(visibleRuntimeModule);
}

function runtimeNeedsAppAwake() {
  if (isQuitting) return false;
  return Boolean(liveConnection || liveReconnectEnabled || liveReconnectTimer || liveReconnectInFlight || musicRecoveryState.youtube.expectedPlaying || musicRecoveryState.spotify.expectedPlaying || (overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed));
}

function refreshAppSuspensionBlocker() {
  const shouldBlock = runtimeNeedsAppAwake();
  if (shouldBlock && appSuspensionBlockerId === null) {
    try { appSuspensionBlockerId = powerSaveBlocker.start('prevent-app-suspension'); } catch {}
  } else if (!shouldBlock && appSuspensionBlockerId !== null) {
    try { if (powerSaveBlocker.isStarted(appSuspensionBlockerId)) powerSaveBlocker.stop(appSuspensionBlockerId); } catch {}
    appSuspensionBlockerId = null;
  }
}

function getLocalVoiceManager() {
  if (!localVoiceManager) { const LocalVoiceManager=getLocalVoiceManagerClass(); localVoiceManager = new LocalVoiceManager({ app, dialog, utilityProcess, workerPath:path.join(__dirname, 'local-tts-worker.js') }); }
  return localVoiceManager;
}

const UPDATE_REPOSITORY_URL = 'https://github.com/Mikasita25/Lulu-Finity';
const UPDATE_RELEASES_URL = `${UPDATE_REPOSITORY_URL}/releases/latest`;
const DEFAULT_RELAY_PATH = '/v1/tiktok/live';
const EMBEDDED_RELAY_URL = 'wss://lulu-finity-production-6b8f.up.railway.app/v1/tiktok/live';
// The deployed /v1/tiktok/live endpoint is public; upstream keys stay on Railway.
const EMBEDDED_RELAY_CLIENT_TOKEN = '';
const RELAY_USAGE_URL = 'https://lulu-finity-production-6b8f.up.railway.app/usage';
const STABLE_OVERLAY_BASE_URL = 'https://lulu-finity-production-6b8f.up.railway.app';
const YOUTUBE_PARTITION = 'persist:lulu-youtube';
const SPOTIFY_PARTITION = 'persist:lulu-spotify';
const TIKTOK_CHAT_PARTITION = 'persist:lulu-tiktok-chat';


const CLOUDFLARED_RELEASE_API = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest';
const CLOUDFLARED_ASSET_NAME = 'cloudflared-windows-amd64.exe';
const validatedCloudflaredPaths = new Set();

function setOverlayTunnelStatus(status, message = '', url = overlayPublicBaseUrl) {
  overlayTunnelStatus = { status, message, url: String(url || '') };
  send('overlay:tunnel-status', overlayTunnelStatus);
  refreshAppSuspensionBlocker();
  return overlayTunnelStatus;
}

function normalizeTunnelBaseUrl(value) {
  const match = String(value || '').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return match ? match[0].replace(/\/+$/, '') : '';
}

async function validateCloudflaredExecutable(executablePath) {
  if (!executablePath || !fs.existsSync(executablePath)) return false;
  try {
    const stats = fs.statSync(executablePath);
    if (!stats.isFile() || stats.size < 1000000 || stats.size > 200000000) return false;
  } catch { return false; }
  if (validatedCloudflaredPaths.has(executablePath)) return true;
  const usable = await new Promise((resolve) => {
    let output = '';
    let settled = false;
    let timeout = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(Boolean(result));
    };
    let child;
    try {
      child = spawn(executablePath, ['--version'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { finish(false); return; }
    child.stdout?.on('data', (chunk) => { output += String(chunk || ''); });
    child.stderr?.on('data', (chunk) => { output += String(chunk || ''); });
    child.once('error', () => finish(false));
    child.once('exit', (code) => finish(code === 0 && /cloudflared/i.test(output)));
    timeout = setTimeout(() => { try { child.kill(); } catch {} finish(false); }, 7000);
  });
  if (usable) validatedCloudflaredPaths.add(executablePath);
  return usable;
}

async function ensureCloudflaredBinary() {
  if (process.platform !== 'win32') throw new Error('El enlace HTTPS automático está disponible en Windows.');
  const packagedPath = app.isPackaged && process.resourcesPath ? path.join(process.resourcesPath, 'lulu-tools', 'cloudflared.exe') : '';
  if (await validateCloudflaredExecutable(packagedPath)) return packagedPath;
  const toolsDirectory = path.join(app.getPath('userData'), 'tools');
  const executablePath = path.join(toolsDirectory, 'cloudflared.exe');
  if (await validateCloudflaredExecutable(executablePath)) return executablePath;
  await fsp.mkdir(toolsDirectory, { recursive: true });
  setOverlayTunnelStatus('downloading', 'Descargando el componente HTTPS seguro por primera vez…', '');
  let asset = null;
  try {
    const releaseResponse = await fetch(CLOUDFLARED_RELEASE_API, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': `Lulu-Finity/${app.getVersion()}` },
      redirect: 'follow'
    });
    if (releaseResponse.ok) {
      const release = await releaseResponse.json();
      asset = Array.isArray(release?.assets) ? release.assets.find((item) => item?.name === CLOUDFLARED_ASSET_NAME) : null;
    }
  } catch {}
  const downloadUrl = asset?.browser_download_url || `https://github.com/cloudflare/cloudflared/releases/latest/download/${CLOUDFLARED_ASSET_NAME}`;
  const binaryResponse = await fetch(downloadUrl, {
    headers: { 'Accept': 'application/octet-stream', 'User-Agent': `Lulu-Finity/${app.getVersion()}` },
    redirect: 'follow'
  });
  if (!binaryResponse.ok) throw new Error(`No se pudo descargar HTTPS (${binaryResponse.status}).`);
  const bytes = Buffer.from(await binaryResponse.arrayBuffer());
  if (bytes.length < 1000000 || bytes.length > 200000000) throw new Error('El componente HTTPS descargado tiene un tamaño inesperado.');
  const actualDigest = createHash('sha256').update(bytes).digest('hex');
  const expectedDigest = String(asset?.digest || '').replace(/^sha256:/i, '').trim().toLowerCase();
  if (expectedDigest && actualDigest !== expectedDigest) throw new Error('La verificación de seguridad del componente HTTPS no coincidió.');
  const temporaryPath = `${executablePath}.download`;
  await fsp.writeFile(temporaryPath, bytes);
  await fsp.rename(temporaryPath, executablePath).catch(async () => {
    await fsp.rm(executablePath, { force: true });
    await fsp.rename(temporaryPath, executablePath);
  });
  if (!await validateCloudflaredExecutable(executablePath)) throw new Error('El componente HTTPS descargado no pudo ejecutarse de forma segura.');
  return executablePath;
}

async function stopOverlayHttpsTunnel() {
  overlayTunnelStopRequested = true;
  overlayPublicBaseUrl = '';
  const child = overlayTunnelProcess;
  overlayTunnelProcess = null;
  if (child && !child.killed) {
    try { child.kill(); } catch {}
  }
  setOverlayTunnelStatus('stopped', 'Enlace HTTPS detenido.', '');
}

function currentOverlayTunnelInfo() {
  const active = Boolean(overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed);
  return {
    ok: active,
    ...overlayTunnelStatus,
    url: active ? overlayPublicBaseUrl : ''
  };
}

async function ensureOverlayHttpsTunnel(force = false) {
  if (overlayPublicBaseUrl && overlayTunnelProcess && !overlayTunnelProcess.killed) {
    return { ok: true, ...overlayTunnelStatus, url: overlayPublicBaseUrl };
  }
  if (overlayTunnelPromise) return overlayTunnelPromise;
  const now = Date.now();
  if (!force && overlayTunnelStatus.status === 'error' && now - overlayTunnelLastAttempt < 30000) {
    return { ok: false, ...overlayTunnelStatus, url: '' };
  }
  overlayTunnelLastAttempt = now;
  overlayTunnelPromise = (async () => {
    try {
      if (!overlayPort) throw new Error('El servidor local todavía no está listo.');
      const executablePath = await ensureCloudflaredBinary();
      overlayTunnelStopRequested = false;
      setOverlayTunnelStatus('connecting', 'Creando enlace HTTPS para TikTok LIVE Studio…', '');
      const result = await new Promise((resolve) => {
        let settled = false;
        let output = '';
        const child = spawn(executablePath, ['tunnel', '--url', `http://127.0.0.1:${overlayPort}`, '--no-autoupdate', '--loglevel', 'info'], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        overlayTunnelProcess = child;
        const finish = (payload) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(payload);
        };
        const consume = (chunk) => {
          output = `${output}${String(chunk || '')}`.slice(-16000);
          const publicUrl = normalizeTunnelBaseUrl(output);
          if (!publicUrl) return;
          overlayPublicBaseUrl = publicUrl;
          setOverlayTunnelStatus('ready', 'HTTPS listo. Mantén Lulu Finity abierta durante el LIVE.', publicUrl);
          finish({ ok: true, ...overlayTunnelStatus, url: publicUrl });
        };
        child.stdout?.on('data', consume);
        child.stderr?.on('data', consume);
        child.once('error', (error) => {
          overlayTunnelProcess = null;
          overlayPublicBaseUrl = '';
          setOverlayTunnelStatus('error', error?.message || 'No se pudo iniciar el enlace HTTPS.', '');
          finish({ ok: false, ...overlayTunnelStatus, url: '' });
        });
        child.once('exit', (code) => {
          overlayTunnelProcess = null;
          overlayPublicBaseUrl = '';
          if (!overlayTunnelStopRequested) setOverlayTunnelStatus('error', `El enlace HTTPS se cerró${Number.isInteger(code) ? ` (código ${code})` : ''}. Pulsa copiar para reintentarlo.`, '');
          finish({ ok: false, ...overlayTunnelStatus, url: '' });
        });
        const timeout = setTimeout(() => {
          try { child.kill(); } catch {}
          overlayTunnelProcess = null;
          overlayPublicBaseUrl = '';
          setOverlayTunnelStatus('error', 'El enlace HTTPS tardó demasiado. Revisa Internet o el firewall y vuelve a copiar.', '');
          finish({ ok: false, ...overlayTunnelStatus, url: '' });
        }, 45000);
      });
      return result;
    } catch (error) {
      overlayPublicBaseUrl = '';
      setOverlayTunnelStatus('error', error?.message || String(error), '');
      return { ok: false, ...overlayTunnelStatus, url: '' };
    }
  })().finally(() => { overlayTunnelPromise = null; });
  return overlayTunnelPromise;
}

function localOverlayBaseUrl() {
  return `http://127.0.0.1:${overlayPort}`;
}

const STABLE_SOURCE_NAMES = Object.freeze({
  widget: new Set(['playlist', 'wallet', 'game', 'alert', 'goal', 'gift']),
  ranking: new Set(['1', '2', '3', '4']),
  screen: new Set(['1', '2', '3', '4'])
});

function normalizeStableSource(kind, name) {
  const normalizedKind = String(kind || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim().toLowerCase();
  return STABLE_SOURCE_NAMES[normalizedKind]?.has(normalizedName) ? { kind: normalizedKind, name: normalizedName } : null;
}

function stableSourceKey(kind, name) {
  const source = normalizeStableSource(kind, name);
  return source ? `${source.kind}:${source.name}` : '';
}

function stableOverlayPublicId(secret) {
  const normalized = String(secret || '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? createHash('sha256').update(normalized).digest('hex').slice(0, 32) : '';
}

function stableOverlayPublicUrl(publicId, kind, name) {
  const source = normalizeStableSource(kind, name);
  if (!/^[a-f0-9]{32}$/.test(String(publicId || '')) || !source) return '';
  return `${STABLE_OVERLAY_BASE_URL}/overlays/${publicId}/${source.kind}/${source.name}`;
}

function normalizeActiveHttpsSources(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((entry) => {
    const [kind, name] = String(entry || '').split(':');
    return stableSourceKey(kind, name);
  }).filter(Boolean))].slice(0, 14);
}

function queueStableOverlaySettings(operation) {
  const run = stableOverlaySettingsChain.then(operation, operation);
  stableOverlaySettingsChain = run.catch(() => {});
  return run;
}

async function stableOverlayIdentity() {
  return queueStableOverlaySettings(async () => {
    const settingsPath = getDataPaths().settings;
    const settings = { ...DEFAULT_SETTINGS, ...(await readJson(settingsPath, DEFAULT_SETTINGS)) };
    let changed = false;
    if (!/^[a-f0-9]{64}$/i.test(String(settings.overlayRelaySecret || ''))) {
      settings.overlayRelaySecret = createHash('sha256').update(`${randomUUID()}:${randomUUID()}:${Date.now()}`).digest('hex');
      changed = true;
    }
    const active = normalizeActiveHttpsSources(settings.activeHttpsSources);
    if (JSON.stringify(active) !== JSON.stringify(settings.activeHttpsSources || [])) {
      settings.activeHttpsSources = active;
      changed = true;
    }
    if (changed) await writeJson(settingsPath, settings);
    if (runtimeResourceSettings) {
      runtimeResourceSettings.overlayRelaySecret = settings.overlayRelaySecret;
      runtimeResourceSettings.activeHttpsSources = active;
    }
    return { secret: settings.overlayRelaySecret, publicId: stableOverlayPublicId(settings.overlayRelaySecret), active };
  });
}

async function setStableOverlaySourceActive(kind, name) {
  const key = stableSourceKey(kind, name);
  if (!key) throw new Error('Fuente HTTPS no válida.');
  return queueStableOverlaySettings(async () => {
    const settingsPath = getDataPaths().settings;
    const settings = { ...DEFAULT_SETTINGS, ...(await readJson(settingsPath, DEFAULT_SETTINGS)) };
    if (!/^[a-f0-9]{64}$/i.test(String(settings.overlayRelaySecret || ''))) {
      settings.overlayRelaySecret = createHash('sha256').update(`${randomUUID()}:${randomUUID()}:${Date.now()}`).digest('hex');
    }
    settings.activeHttpsSources = normalizeActiveHttpsSources([...(settings.activeHttpsSources || []), key]);
    await writeJson(settingsPath, settings);
    if (runtimeResourceSettings) {
      runtimeResourceSettings.overlayRelaySecret = settings.overlayRelaySecret;
      runtimeResourceSettings.activeHttpsSources = settings.activeHttpsSources;
    }
    return { secret: settings.overlayRelaySecret, publicId: stableOverlayPublicId(settings.overlayRelaySecret), active: settings.activeHttpsSources };
  });
}

async function stableOverlayFetch(pathname, secret, options = {}) {
  const response = await fetch(`${STABLE_OVERLAY_BASE_URL}${pathname}`, {
    ...options,
    headers: { Authorization: `Bearer ${secret}`, ...(options.headers || {}) },
    redirect: 'error',
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) {
    let message = '';
    try { message = String((await response.json())?.error || ''); } catch {}
    throw new Error(message || `Railway respondió ${response.status}.`);
  }
  return response;
}

async function uploadStableOverlayAsset(publicId, secret, localUrl) {
  const rawName = String(localUrl || '').match(/^\/overlay-media\/([^?]+)/)?.[1];
  if (!rawName) return '';
  let fileName = '';
  try { fileName = path.basename(decodeURIComponent(rawName)); } catch { return ''; }
  const extension = path.extname(fileName).toLowerCase();
  const mimeByExtension = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.bmp':'image/bmp' };
  const mime = mimeByExtension[extension];
  if (!mime) return '';
  const mediaRoot = path.resolve(getDataPaths().media);
  const file = path.resolve(mediaRoot, fileName);
  if (!file.startsWith(`${mediaRoot}${path.sep}`) || !fs.existsSync(file)) return '';
  const stats = await fsp.stat(file);
  if (!stats.isFile() || stats.size <= 0 || stats.size > 12 * 1024 * 1024) throw new Error('La imagen de pantalla supera el límite HTTPS de 12 MB.');
  const bytes = await fsp.readFile(file);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const assetName = `${digest}${extension}`;
  await stableOverlayFetch(`/v1/overlays/${publicId}/assets/${assetName}`, secret, { method:'PUT', headers:{ 'Content-Type':mime, 'Content-Length':String(bytes.length) }, body:bytes });
  return `${STABLE_OVERLAY_BASE_URL}/v1/overlays/${publicId}/assets/${assetName}`;
}

async function stableOverlaySourcePayload(kind, name, identity) {
  if (kind === 'widget') {
    const snapshot = await streamWidgetSnapshot(name, false);
    const themes = normalizeStreamWidgetThemes(runtimeResourceSettings?.streamWidgetThemes);
    const backgrounds = normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds);
    const styles = normalizeStreamWidgetStyles(runtimeResourceSettings?.streamWidgetStyles);
    const style = { ...styles[name] };
    for (const field of ['backgroundImage', 'logoImage']) {
      if (style[field]?.startsWith('/overlay-media/')) style[field] = await uploadStableOverlayAsset(identity.publicId, identity.secret, style[field]);
    }
    return { ...snapshot, theme: themes[name], background: backgrounds[name], style };
  }
  if (kind === 'ranking') return rankingSnapshot(Number(name), false);
  const state = { ...overlayStateSnapshot(Number(name)) };
  if (state.type === 'show' && state.url) {
    const remoteUrl = await uploadStableOverlayAsset(identity.publicId, identity.secret, state.url);
    state.url = remoteUrl || '';
    if (!state.url) state.type = 'clear';
  }
  return state;
}

async function syncStableOverlaySource(kind, name, identity = null) {
  const source = normalizeStableSource(kind, name);
  if (!source) throw new Error('Fuente HTTPS no válida.');
  const currentIdentity = identity || await stableOverlayIdentity();
  const payload = await stableOverlaySourcePayload(source.kind, source.name, currentIdentity);
  await stableOverlayFetch(`/v1/overlays/${currentIdentity.publicId}/sources/${source.kind}/${source.name}`, currentIdentity.secret, {
    method: 'PUT', headers: { 'Content-Type':'application/json; charset=utf-8' }, body: JSON.stringify(payload)
  });
  return { ok:true, url:stableOverlayPublicUrl(currentIdentity.publicId, source.kind, source.name), publicId:currentIdentity.publicId };
}

async function ensureStableOverlaySource(kind, name) {
  const source = normalizeStableSource(kind, name);
  if (!source) return { ok:false, message:'Fuente HTTPS no válida.' };
  try {
    const identity = await stableOverlayIdentity();
    const result = await syncStableOverlaySource(source.kind, source.name, identity);
    await setStableOverlaySourceActive(source.kind, source.name);
    setOverlayTunnelStatus('ready', 'HTTPS fijo listo. La URL se conserva al reiniciar Lulu y Railway.', STABLE_OVERLAY_BASE_URL);
    scheduleStableOverlayRecovery();
    return result;
  } catch (error) {
    const message = error?.message || String(error);
    console.warn('No se pudo sincronizar la fuente HTTPS fija:', message);
    setOverlayTunnelStatus('error', `HTTPS fijo: ${message}`, '');
    scheduleStableOverlayRecovery();
    return { ok:false, message };
  }
}

function queueStableOverlaySync(kind, name) {
  const key = stableSourceKey(kind, name);
  if (!key || isQuitting) return;
  pendingStableOverlaySources.add(key);
  clearTimeout(stableOverlaySyncTimer);
  stableOverlaySyncTimer = setTimeout(() => {
    stableOverlaySyncTimer = null;
    flushStableOverlaySync().catch((error) => console.warn('HTTPS se reintentará:', error?.message || error));
  }, 350);
}

async function flushStableOverlaySync(forceAll = false) {
  if (stableOverlaySyncInFlight || isQuitting) return;
  stableOverlaySyncInFlight = true;
  try {
    const identity = await stableOverlayIdentity();
    const requested = forceAll ? identity.active : [...pendingStableOverlaySources];
    pendingStableOverlaySources.clear();
    for (const key of requested) {
      if (!identity.active.includes(key)) continue;
      const [kind, name] = key.split(':');
      try { await syncStableOverlaySource(kind, name, identity); }
      catch (error) { pendingStableOverlaySources.add(key); console.warn(`HTTPS ${key}:`, error?.message || error); }
    }
  } finally {
    stableOverlaySyncInFlight = false;
  }
}

function scheduleStableOverlayRecovery() {
  if (stableOverlayRecoveryTimer || isQuitting) return;
  stableOverlayRecoveryTimer = setInterval(() => { void flushStableOverlaySync(true); }, 45000);
  stableOverlayRecoveryTimer.unref?.();
}

async function stableOverlaySourceStatus(kind, name, force = false) {
  const source = normalizeStableSource(kind, name);
  if (!source) return { ok:false, url:'', message:'Fuente HTTPS no válida.' };
  const identity = await stableOverlayIdentity();
  const active = identity.active.includes(stableSourceKey(source.kind, source.name));
  if (force || !active) return ensureStableOverlaySource(source.kind, source.name);
  return { ok:active, url:active ? stableOverlayPublicUrl(identity.publicId, source.kind, source.name) : '', message:active ? 'HTTPS fijo listo.' : 'Pulsa copiar HTTPS para activar esta fuente.' };
}

function reportedOverlayTunnel(stable, fallback) {
  if (stable.ok) return { ok:true, status:'ready', message:'HTTPS fijo listo. Esta URL no cambia al reiniciar.', url:stable.url, stable:true };
  if (fallback?.ok && fallback.url) return fallback;
  return { ...(fallback || {}), ok:false, status:'error', url:'', message:stable.message ? `HTTPS fijo: ${stable.message}` : (fallback?.message || 'No se pudo crear el enlace HTTPS.') };
}

function touchPollingClient(store, key, clientId, ignore = false) {
  if (ignore) return false;
  const id = String(clientId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  if (!id) return false;
  if (!store.has(key)) store.set(key, new Map());
  const clients = store.get(key);
  const isNew = !clients.has(id);
  clients.set(id, Date.now());
  return isNew;
}

function pollingClientCount(store, key = null) {
  const now = Date.now();
  const countMap = (clients) => {
    if (!clients) return 0;
    for (const [id, touchedAt] of clients) if (now - touchedAt > 12000) clients.delete(id);
    return clients.size;
  };
  if (key !== null) return countMap(store.get(key));
  let total = 0;
  for (const clients of store.values()) total += countMap(clients);
  return total;
}

function setOverlayState(screen, payload) {
  const normalized = normalizeOverlayScreen(screen);
  const state = { ...payload, id: String(payload?.id || randomUUID()), updatedAt: Date.now() };
  overlayStates.set(normalized, state);
  queueStableOverlaySync('screen', String(normalized));
  return state;
}

function overlayStateSnapshot(screen) {
  const normalized = normalizeOverlayScreen(screen);
  const current = overlayStates.get(normalized);
  if (!current) return { type: 'clear', id: `idle-${normalized}`, updatedAt: 0 };
  if (current.type === 'show' && Number(current.expiresAt || 0) <= Date.now()) {
    return setOverlayState(normalized, { type: 'clear', id: `expired-${current.id}` });
  }
  return current;
}


const DEFAULT_RANKING_OVERLAYS = [1, 2, 3, 4].map((slot) => ({
  id: `ranking-${slot}`,
  type: slot === 1 ? 'coins' : slot === 2 ? 'likes' : slot === 3 ? 'economy' : 'comments',
  title: slot === 1 ? 'TOP GIFTERS' : slot === 2 ? 'TOP TAP TAPS' : slot === 3 ? 'TOP MONEDAS' : 'TOP COMENTARIOS',
  limit: 5,
  style: 'tiktok',
  font: 'Segoe UI',
  textColor: '#ffffff',
  accentColor: '#ff2d8f',
  secondaryColor: '#25f4ee',
  backgroundColor: '#101018',
  backgroundOpacity: 82,
  rgbText: false,
  showAvatar: true,
  showValue: true,
  showRank: true,
  uppercaseNames: false
}));

const STREAM_WIDGET_THEME_IDS = new Set([
  'lulu', 'aurora', 'cyber', 'arcade', 'hologram', 'sakura', 'miku',
  'lavender', 'sunset', 'gold', 'mint', 'ocean', 'vampire', 'mono'
]);

const DEFAULT_STREAM_WIDGET_THEMES = Object.freeze({
  playlist: 'aurora',
  wallet: 'gold',
  game: 'arcade',
  alert: 'lulu',
  goal: 'hologram',
  gift: 'sakura'
});

const STREAM_WIDGET_BACKGROUND_IDS = new Set([
  'plain', 'stars', 'aurora', 'grid', 'glass', 'bubbles',
  'vinyl', 'pixel', 'waves', 'confetti', 'spotlight', 'midnight'
]);

const DEFAULT_STREAM_WIDGET_BACKGROUNDS = Object.freeze({
  playlist: 'vinyl',
  wallet: 'spotlight',
  game: 'pixel',
  alert: 'bubbles',
  goal: 'aurora',
  gift: 'confetti'
});

const DEFAULT_STREAM_WIDGET_STYLES = Object.freeze({
  playlist: Object.freeze({ enabled:false, primaryColor:'#71ffd6', secondaryColor:'#9782ff', textColor:'#fff9fd', backgroundColor:'#14101f', backgroundOpacity:94, borderRadius:22, goalBarHeight:14 }),
  wallet: Object.freeze({ enabled:false, primaryColor:'#ffd56a', secondaryColor:'#d99832', textColor:'#fff9fd', backgroundColor:'#21180e', backgroundOpacity:94, borderRadius:28, goalBarHeight:14 }),
  game: Object.freeze({ enabled:false, primaryColor:'#75ff4d', secondaryColor:'#ff3dd1', textColor:'#fff9fd', backgroundColor:'#100c26', backgroundOpacity:96, borderRadius:24, goalBarHeight:14 }),
  alert: Object.freeze({ enabled:false, primaryColor:'#ff67ad', secondaryColor:'#5fe8ff', textColor:'#fff9fd', backgroundColor:'#1d1028', backgroundOpacity:94, borderRadius:22, goalBarHeight:14 }),
  goal: Object.freeze({ enabled:false, primaryColor:'#80fff4', secondaryColor:'#ff80eb', textColor:'#fff9fd', backgroundColor:'#10243e', backgroundOpacity:92, borderRadius:22, goalBarHeight:14 }),
  gift: Object.freeze({ enabled:false, primaryColor:'#ff9fc9', secondaryColor:'#c79bff', textColor:'#fff9fd', backgroundColor:'#2b1730', backgroundOpacity:94, borderRadius:22, goalBarHeight:14 })
});

function safeWidgetColor(value, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function boundedWidgetNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizeStreamWidgetStyle(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: source.enabled === true,
    primaryColor: safeWidgetColor(source.primaryColor, fallback.primaryColor),
    secondaryColor: safeWidgetColor(source.secondaryColor, fallback.secondaryColor),
    textColor: safeWidgetColor(source.textColor, fallback.textColor),
    backgroundColor: safeWidgetColor(source.backgroundColor, fallback.backgroundColor),
    backgroundOpacity: boundedWidgetNumber(source.backgroundOpacity, 0, 100, fallback.backgroundOpacity),
    borderRadius: boundedWidgetNumber(source.borderRadius, 0, 48, fallback.borderRadius),
    goalBarHeight: boundedWidgetNumber(source.goalBarHeight, 4, 40, fallback.goalBarHeight),
    ...LuluWidgetDesign.normalize(source)
  };
}

function normalizeStreamWidgetStyles(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_STREAM_WIDGET_STYLES).map(([type, fallback]) => [
    type,
    normalizeStreamWidgetStyle(source[type], fallback)
  ]));
}

function hexToRgb(value) {
  const match = safeWidgetColor(value, '#000000').match(/^#(..)(..)(..)$/);
  return match ? match.slice(1).map((part) => Number.parseInt(part, 16)) : [0, 0, 0];
}

function streamWidgetCustomCss(style) {
  const normalized = normalizeStreamWidgetStyle(style, DEFAULT_STREAM_WIDGET_STYLES.goal);
  if (!normalized.enabled) return '';
  const [red, green, blue] = hexToRgb(normalized.backgroundColor);
  const alpha = Math.round(normalized.backgroundOpacity) / 100;
  return `body{--wa:${normalized.primaryColor}!important;--wb:${normalized.secondaryColor}!important;--wt:${normalized.textColor}!important}.card{color:var(--wt)!important;background:rgba(${red},${green},${blue},${alpha})!important;border-radius:${normalized.borderRadius}px!important}.card:before,.goal-track span{background:linear-gradient(90deg,var(--wa),var(--wb))!important}.head strong,.copy strong,.wallet-name strong,.game-copy strong,.alert-copy strong,.goal-meta strong,.gift-grid strong{color:var(--wt)!important}.goal-track{height:${normalized.goalBarHeight}px!important}`;
}

const STREAM_WIDGET_BACKGROUND_CSS = Object.freeze({
  plain: '.card{background:linear-gradient(135deg,rgba(20,16,31,.96),rgba(49,31,61,.94))!important}',
  stars: '.card{background:radial-gradient(circle at 12% 22%,rgba(255,255,255,.92) 0 1px,transparent 2px),radial-gradient(circle at 76% 18%,color-mix(in srgb,var(--wa) 85%,white) 0 1.5px,transparent 2.5px),radial-gradient(circle at 58% 76%,rgba(255,255,255,.75) 0 1px,transparent 2px),radial-gradient(circle at 28% 68%,color-mix(in srgb,var(--wb) 82%,white) 0 1.5px,transparent 2.5px),linear-gradient(145deg,rgba(7,9,30,.98),rgba(34,19,62,.96))!important;background-size:84px 76px,118px 92px,72px 104px,130px 116px,auto!important}',
  aurora: '.card{background:radial-gradient(ellipse at 12% 20%,color-mix(in srgb,var(--wa) 42%,transparent),transparent 46%),radial-gradient(ellipse at 88% 72%,color-mix(in srgb,var(--wb) 45%,transparent),transparent 50%),linear-gradient(120deg,rgba(8,20,38,.98),rgba(36,21,59,.96))!important}',
  grid: '.card{background:linear-gradient(color-mix(in srgb,var(--wa) 13%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--wb) 13%,transparent) 1px,transparent 1px),linear-gradient(145deg,rgba(8,14,29,.98),rgba(31,18,51,.96))!important;background-size:24px 24px,24px 24px,auto!important}',
  glass: '.card{background:radial-gradient(circle at 12% 8%,rgba(255,255,255,.24),transparent 28%),radial-gradient(circle at 92% 92%,color-mix(in srgb,var(--wb) 28%,transparent),transparent 38%),linear-gradient(135deg,color-mix(in srgb,var(--wa) 14%,rgba(20,22,40,.88)),rgba(34,31,58,.84))!important;border-color:rgba(255,255,255,.25)!important;backdrop-filter:blur(24px) saturate(135%)!important}',
  bubbles: '.card{background:radial-gradient(circle at 12% 72%,color-mix(in srgb,var(--wa) 23%,transparent) 0 18px,transparent 19px),radial-gradient(circle at 78% 22%,color-mix(in srgb,var(--wb) 24%,transparent) 0 28px,transparent 29px),radial-gradient(circle at 92% 84%,rgba(255,255,255,.11) 0 13px,transparent 14px),radial-gradient(circle at 45% 42%,rgba(255,255,255,.08) 0 8px,transparent 9px),linear-gradient(140deg,rgba(29,16,48,.97),rgba(13,35,48,.95))!important}',
  vinyl: '.card{background:radial-gradient(circle at 18% 50%,var(--wa) 0 4px,rgba(8,8,13,.96) 5px 12px,rgba(255,255,255,.12) 13px 14px,rgba(8,8,13,.96) 15px 22px,rgba(255,255,255,.09) 23px 24px,rgba(8,8,13,.96) 25px 38px,transparent 39px),linear-gradient(135deg,rgba(12,12,20,.98),color-mix(in srgb,var(--wb) 16%,rgba(37,21,51,.96)))!important}',
  pixel: '.card{background:conic-gradient(from 90deg at 1px 1px,color-mix(in srgb,var(--wa) 17%,transparent) 25%,transparent 0) 0 0/18px 18px,conic-gradient(from 270deg at 9px 9px,color-mix(in srgb,var(--wb) 12%,transparent) 25%,transparent 0) 0 0/18px 18px,linear-gradient(180deg,rgba(11,10,33,.99),rgba(39,14,57,.97))!important;image-rendering:pixelated}',
  waves: '.card{background:repeating-radial-gradient(ellipse at 0 100%,transparent 0 18px,color-mix(in srgb,var(--wa) 15%,transparent) 19px 21px,transparent 22px 37px,color-mix(in srgb,var(--wb) 12%,transparent) 38px 40px),linear-gradient(135deg,rgba(8,29,48,.98),rgba(35,18,57,.96))!important}',
  confetti: '.card{background:linear-gradient(115deg,transparent 75%,color-mix(in srgb,var(--wa) 45%,transparent) 76% 80%,transparent 81%) 0 0/42px 38px,linear-gradient(25deg,transparent 72%,color-mix(in srgb,var(--wb) 42%,transparent) 73% 78%,transparent 79%) 8px 7px/52px 46px,radial-gradient(circle at 24% 35%,rgba(255,230,112,.52) 0 3px,transparent 4px) 0 0/64px 55px,linear-gradient(135deg,rgba(42,17,48,.98),rgba(17,29,50,.96))!important}',
  spotlight: '.card{background:radial-gradient(ellipse at 18% -12%,color-mix(in srgb,var(--wa) 46%,transparent),transparent 48%),radial-gradient(ellipse at 88% -10%,color-mix(in srgb,var(--wb) 40%,transparent),transparent 46%),linear-gradient(180deg,rgba(27,22,42,.97),rgba(10,11,21,.99))!important}',
  midnight: '.card{background:radial-gradient(circle at 16% 18%,rgba(255,255,255,.8) 0 1px,transparent 1.8px),radial-gradient(circle at 72% 30%,rgba(255,255,255,.62) 0 1px,transparent 1.8px),radial-gradient(circle at 48% 78%,color-mix(in srgb,var(--wb) 66%,white) 0 1.3px,transparent 2.2px),linear-gradient(160deg,rgba(3,7,20,.99),rgba(20,12,44,.98))!important;background-size:96px 82px,124px 108px,148px 126px,auto!important}'
});

const STREAM_WIDGET_THEME_TOKENS = Object.freeze({
  lulu: { a:'#ff67ad', b:'#5fe8ff', money:'#ffe287', bg:'linear-gradient(135deg,rgba(24,14,36,.96),rgba(67,29,72,.92))' },
  aurora: { a:'#71ffd6', b:'#9782ff', money:'#bcffea', bg:'linear-gradient(135deg,rgba(8,31,43,.96),rgba(61,37,99,.92))' },
  cyber: { a:'#00f6ff', b:'#ff2bd6', money:'#f6ff00', bg:'linear-gradient(145deg,rgba(5,9,27,.98),rgba(24,9,46,.96))', font:'"Trebuchet MS",sans-serif' },
  arcade: { a:'#75ff4d', b:'#ff3dd1', money:'#ffe84a', bg:'linear-gradient(180deg,rgba(12,9,34,.98),rgba(30,12,55,.98))', font:'"Courier New",monospace' },
  hologram: { a:'#80fff4', b:'#ff80eb', money:'#c8fff7', bg:'linear-gradient(135deg,rgba(16,36,62,.88),rgba(77,29,88,.84))' },
  sakura: { a:'#ff9fc9', b:'#c79bff', money:'#fff0a8', bg:'linear-gradient(135deg,rgba(72,31,58,.95),rgba(48,32,78,.94))' },
  miku: { a:'#39f1d2', b:'#ff68a9', money:'#adfff0', bg:'linear-gradient(135deg,rgba(8,43,47,.97),rgba(20,48,70,.94))' },
  lavender: { a:'#c7a0ff', b:'#ff91cf', money:'#efd5ff', bg:'linear-gradient(135deg,rgba(44,29,74,.96),rgba(78,39,84,.92))' },
  sunset: { a:'#ff7657', b:'#ff3f9f', money:'#ffd55b', bg:'linear-gradient(135deg,rgba(74,24,41,.97),rgba(68,34,78,.94))' },
  gold: { a:'#ffd56a', b:'#d99832', money:'#fff2a9', bg:'linear-gradient(135deg,rgba(39,29,14,.97),rgba(73,48,19,.94))' },
  mint: { a:'#7dffc5', b:'#42d8ba', money:'#d7ffae', bg:'linear-gradient(135deg,rgba(10,47,43,.96),rgba(20,64,60,.93))' },
  ocean: { a:'#48c8ff', b:'#4267ff', money:'#8ff8ff', bg:'linear-gradient(135deg,rgba(8,27,58,.97),rgba(15,49,91,.94))' },
  vampire: { a:'#ff365f', b:'#9e38ff', money:'#ffb3c0', bg:'linear-gradient(135deg,rgba(35,7,19,.98),rgba(58,12,49,.96))' },
  mono: { a:'#ffffff', b:'#9da7b8', money:'#ffffff', bg:'linear-gradient(135deg,rgba(15,17,22,.98),rgba(38,42,50,.96))', font:'Arial,sans-serif' }
});

function normalizeStreamWidgetTheme(value, fallback = 'lulu') {
  const normalized = String(value || '').trim().toLowerCase();
  return STREAM_WIDGET_THEME_IDS.has(normalized) ? normalized : fallback;
}

function normalizeStreamWidgetThemes(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_STREAM_WIDGET_THEMES).map(([type, fallback]) => [
    type,
    normalizeStreamWidgetTheme(source[type], fallback)
  ]));
}

function streamWidgetThemeCss(theme) {
  const normalized = normalizeStreamWidgetTheme(theme);
  const tokens = STREAM_WIDGET_THEME_TOKENS[normalized] || STREAM_WIDGET_THEME_TOKENS.lulu;
  const special = normalized === 'arcade'
    ? '.card{border-radius:6px!important;box-shadow:6px 6px 0 color-mix(in srgb,var(--wb) 35%,transparent),-4px -4px 0 color-mix(in srgb,var(--wa) 28%,transparent)!important}.card:before{height:5px!important}'
    : normalized === 'hologram'
      ? '.card{box-shadow:0 0 34px color-mix(in srgb,var(--wa) 24%,transparent),inset 0 0 28px color-mix(in srgb,var(--wb) 8%,transparent)!important}'
      : normalized === 'sakura'
        ? '.card:after{background:radial-gradient(circle at 30% 30%,var(--wa) 0 5px,transparent 6px),radial-gradient(circle at 70% 60%,var(--wb) 0 4px,transparent 5px)!important;background-size:42px 42px!important;opacity:.32!important}'
        : normalized === 'mono'
          ? '.card:before{animation:none!important;background:var(--wa)!important}'
          : '';
  return `body{--wa:${tokens.a};--wb:${tokens.b};--wt:#fff9fd;--wm:rgba(255,249,253,.68);--wl:rgba(255,255,255,.14);--wp:rgba(255,255,255,.075);--wmoney:${tokens.money};font-family:${tokens.font || '"Segoe UI",Arial,sans-serif'}!important;color:var(--wt)!important}.card{--pink:var(--wa)!important;--cyan:var(--wb)!important;color:var(--wt)!important;background:${tokens.bg}!important;border-color:var(--wl)!important;box-shadow:0 18px 55px color-mix(in srgb,var(--wa) 13%,rgba(0,0,0,.48))!important}.card:before{background:linear-gradient(90deg,var(--wa),var(--wb),var(--wa))!important;background-size:200% 100%!important}.card:after{content:"";position:absolute;right:-58px;bottom:-84px;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--wb) 25%,transparent),transparent 68%);pointer-events:none}.card>*{position:relative;z-index:1}.badge{color:var(--wt)!important;background:color-mix(in srgb,var(--wa) 17%,transparent)!important;border-color:color-mix(in srgb,var(--wa) 38%,transparent)!important}.now{background:linear-gradient(90deg,color-mix(in srgb,var(--wa) 20%,transparent),color-mix(in srgb,var(--wb) 10%,transparent))!important;border-color:var(--wl)!important}.disc,.avatar,.alert-icon{background:linear-gradient(135deg,var(--wa),var(--wb))!important;box-shadow:0 0 24px color-mix(in srgb,var(--wa) 28%,transparent)!important}.song,.game-result,.gift-grid>div{background:var(--wp)!important;border-color:var(--wl)!important}.song>span{color:var(--wa)!important}.copy small,.empty,.wallet-name small,.balance small,.game-copy small,.game-meta,.alert-copy span,.goal-meta small,.gift-grid small,.gift-grid span,.gift-last{color:var(--wm)!important}.balance strong,.game-payout{color:var(--wmoney)!important}.goal-track{background:var(--wp)!important}.goal-track span{background:linear-gradient(90deg,var(--wa),var(--wb),var(--wa))!important}${special}`;
}

function normalizeStreamWidgetBackground(value, fallback = 'plain') {
  const normalized = String(value || '').trim().toLowerCase();
  return STREAM_WIDGET_BACKGROUND_IDS.has(normalized) ? normalized : fallback;
}

function normalizeStreamWidgetBackgrounds(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.entries(DEFAULT_STREAM_WIDGET_BACKGROUNDS).map(([type, fallback]) => [
    type,
    normalizeStreamWidgetBackground(source[type], fallback)
  ]));
}

function streamWidgetBackgroundCss(background) {
  const normalized = normalizeStreamWidgetBackground(background);
  return STREAM_WIDGET_BACKGROUND_CSS[normalized] || STREAM_WIDGET_BACKGROUND_CSS.plain;
}

const DEFAULT_SETTINGS = {
  username: '',
  tiktokConnectionMode: 'railway-relay',
  ttsEnabled: true,
  includeUsername: true,
  voiceURI: '',
  voiceMode: 'local',
  localVoiceId: 'lulu-es-mx',
  localVoiceIdleMinutes: 2,
  ttsFallbackMode: 'system',
  onlineVoice: 'es-MX-DaliaNeural',
  tiktokVoice: 'es_mx_002',
  voiceLanguageFilter: 'all',
  rate: 1,
  pitch: 1,
  ttsVolume: 0.9,
  maxCharacters: 180,
  userCooldownSeconds: 2,
  queueLimit: 30,
  maxCommentDelaySeconds: 8,
  blockLinks: true,
  readCommands: false,
  ignoreDirectedMentions: true,
  smartTextEnabled: true,
  blockCjkText: true,
  blockMixedScripts: true,
  stripUsernameEmoji: true,
  pronunciationDictionary: [{ from:'xd', to:'equis de' }],
  performanceProfile: 'balanced',
  balancedKeepActive: { live:false, account:false, voice:false, music:false, overlays:false, rankings:false, automations:false, commands:false, games:false, economy:false },
  luluLocalMigratedV100: false,
  blockedWords: [],
  ignoredUsers: [],
  songPrefix: '!cancion',
  songQueueLimit: 10,
  youtubeMuteDuringTts: false,
  youtubeSearchSuffix: 'audio oficial',
  youtubeVolume: 0.8,
  youtubeAdBlockEnabled: true,
  tiktokAutoChatEnabled: false,
  tiktokAutoChatCooldownSeconds: 8,
  tiktokAutoChatSongQueuedEnabled: false,
  tiktokAutoChatSongQueuedText: '🎵 {usuario} agregó {cancion}. Está en la posición {posicion}.',
  tiktokAutoChatSongStartedEnabled: true,
  tiktokAutoChatSongStartedText: '▶ Ahora suena {cancion}, pedida por {usuario}.',
  tiktokAutoChatSongEndedEnabled: false,
  tiktokAutoChatSongEndedText: '✅ Terminó {cancion}.',
  tiktokAutoChatSongSkippedEnabled: false,
  tiktokAutoChatSongSkippedText: '⏭ Se saltó {cancion}.',
  tiktokAutoChatLiveConnectedEnabled: false,
  tiktokAutoChatLiveConnectedText: '🌸 Lulu Finity ya está conectada y lista para recibir canciones con {comando}.',
  tiktokAutoChatTestText: '🌸 Mensaje de prueba enviado desde Lulu Finity.',
  spotifyVolume: 0.8,
  spotifyContinueRecommended: true,
  musicProvider: 'youtube',
  continueRecommended: true,
  maxSongDurationMinutes: 10,
  preventDuplicateSongs: true,
  blockedSongs: [],
  blockedChannels: [],
  themeMode: 'pink',
  glowIntensity: 70,
  panelOpacity: 78,
  cornerRadius: 15,
  hiddenDashboardPanels: [],
  eventTtsEnabled: false,
  eventGiftEnabled: true,
  eventFollowEnabled: true,
  eventLikeEnabled: true,
  eventShareEnabled: true,
  eventMemberEnabled: false,
  eventSubscribeEnabled: true,
  musicPermissionMode: 'all',
  minimumMemberLevel: 1,
  allowedMusicUsers: [],
  ttsPermissionMode: 'all',
  minimumTtsMemberLevel: 1,
  allowedTtsUsers: [],
  userVoiceRules: [],
  eventMediaRules: [],
  defaultCommandsDisabledV012: false,
  economyEnabled: false,
  currencyName: 'Lunitas',
  currencySymbol: '🌙',
  economyStartingBalance: 0,
  economyRewards: {
    comment: { enabled: false, amount: 1, every: 1 },
    follow: { enabled: false, amount: 10, every: 1 },
    like: { enabled: false, amount: 1, every: 10 },
    share: { enabled: false, amount: 5, every: 1 },
    subscribe: { enabled: false, amount: 50, every: 1 },
    member: { enabled: false, amount: 2, every: 1 },
    gift: { enabled: true, amount: 1, every: 1 },
    fanSticker: { enabled: false, amount: 2, every: 1 }
  },
  liveGamesEnabled: true,
  liveGamesMinBet: 10,
  liveGamesMaxBet: 1000,
  liveGamesDefaultBet: 50,
  liveGamesCooldownSeconds: 8,
  liveGamesSpeakResults: false,
  liveGamesChatResults: false,
  liveGameCommands: [
    { id:'blackjack', trigger:'!blackjack', enabled:true },
    { id:'scratch', trigger:'!rasca', enabled:true },
    { id:'roulette', trigger:'!ruleta', enabled:true },
    { id:'dice', trigger:'!dados', enabled:true },
    { id:'rps', trigger:'!ppt', enabled:true },
    { id:'slots', trigger:'!slots', enabled:true }
  ],
  liveGamesMigratedV032: false,
  automationRules: [],
  liveGoals: [
    { id:'goal-likes', title:'Meta de likes', type:'likes', target:1000, progress:0, enabled:true },
    { id:'goal-diamonds', title:'Meta de monedas', type:'diamonds', target:100, progress:0, enabled:false },
    { id:'goal-follows', title:'Meta de seguidores', type:'follows', target:10, progress:0, enabled:false }
  ],
  selectedGoalId: 'goal-likes',
  economyMigratedV014: false,
  overlayToken: '',
  overlayRelaySecret: '',
  activeHttpsSources: [],
  firstInstalledVersion: '',
  lastSeenVersion: '',
  overlayScreenCount: 4,
  rankingOverlays: DEFAULT_RANKING_OVERLAYS,
  rankingsMigratedV016: false,
  streamWidgetsMigratedV019: false,
  streamWidgetThemes: { ...DEFAULT_STREAM_WIDGET_THEMES },
  streamWidgetBackgrounds: { ...DEFAULT_STREAM_WIDGET_BACKGROUNDS },
  streamWidgetStyles: normalizeStreamWidgetStyles(),
  giftRewardsMigratedV019: false,
  commandCostsEnforcedV117: false,
  musicControlCommandsMigratedV117: false,
  customCommands: [
    { id: 'song', trigger: '!cancion', action: 'song', response: '', permission: 'music', enabled: false, cost: 0 },
    { id: 'skip', trigger: '!skip', action: 'skip', response: '', permission: 'all', enabled: false, cost: 0 },
    { id: 'music-resume', trigger: '!true', action: 'resume', response: '', permission: 'all', enabled: true, cost: 0 },
    { id: 'music-pause', trigger: '!stop', action: 'pause', response: '', permission: 'all', enabled: false, cost: 0 },
    { id: 'voice', trigger: '!voz', action: 'tts', response: '', permission: 'all', enabled: false, cost: 0 },
    { id: 'hello', trigger: '!saludo', action: 'response', response: 'Hola {usuario}', permission: 'all', enabled: false, cost: 0 },
    { id: 'balance', trigger: '!saldo', action: 'balance', response: '', permission: 'all', enabled: false, cost: 0 },
    { id: 'revoke', trigger: '!revoke', action: 'revoke', response: '', permission: 'all', enabled: false, cost: 0 }
  ],
  checkUpdatesOnStartup: true
};

function getDataPaths() {
  const base = app.getPath('userData');
  return {
    base,
    settings: path.join(base, 'settings.json'),
    economy: path.join(base, 'economy.json'),
    rankings: path.join(base, 'rankings.json'),
    media: path.join(base, 'media')
  };
}

async function migrateLegacySettings(targetSettings) {
  if (fs.existsSync(targetSettings)) return;
  const appData = app.getPath('appData');
  const candidates = [
    path.join(appData, 'TikTok Voice Studio', 'settings.json'),
    path.join(appData, 'tiktok-voice-studio', 'settings.json'),
    path.join(appData, 'TikTok Voice Studio', 'connection.log'),
    path.join(appData, 'tiktok-voice-studio', 'connection.log')
  ];
  const source = candidates.find((candidate) => candidate.endsWith('settings.json') && fs.existsSync(candidate));
  if (!source) return;
  try {
    await fsp.copyFile(source, targetSettings);
    console.info(`Configuración anterior migrada desde ${source}`);
  } catch (error) {
    console.warn('No se pudo migrar la configuración anterior:', error?.message || error);
  }
}

async function ensureDataFiles() {
  const p = getDataPaths();
  await fsp.mkdir(p.base, { recursive: true });
  await fsp.mkdir(p.media, { recursive: true });
  await migrateLegacySettings(p.settings);
  const settingsExistedBeforeInitialization = fs.existsSync(p.settings);
  if (!settingsExistedBeforeInitialization) await writeJson(p.settings, DEFAULT_SETTINGS);
  const storedSettings = { ...DEFAULT_SETTINGS, ...(await readJson(p.settings, DEFAULT_SETTINGS)) };
  let settingsChanged = false;
  for (const obsoleteKey of ['eulerApiKey', 'relayUrl', 'relayClientToken']) {
    if (Object.prototype.hasOwnProperty.call(storedSettings, obsoleteKey)) {
      delete storedSettings[obsoleteKey];
      settingsChanged = true;
    }
  }
  if (!String(storedSettings.overlayToken || '').trim()) {
    storedSettings.overlayToken = randomUUID().replace(/-/g, '');
    settingsChanged = true;
  }
  if (!/^[a-f0-9]{64}$/i.test(String(storedSettings.overlayRelaySecret || ''))) {
    storedSettings.overlayRelaySecret = createHash('sha256').update(`${randomUUID()}:${randomUUID()}:${Date.now()}`).digest('hex');
    settingsChanged = true;
  }
  if (!Array.isArray(storedSettings.activeHttpsSources)) {
    storedSettings.activeHttpsSources = [];
    settingsChanged = true;
  }
  if (!String(storedSettings.firstInstalledVersion || '').trim()) {
    storedSettings.firstInstalledVersion = firstInstalledVersionFor({
      settingsExisted: settingsExistedBeforeInitialization,
      currentVersion: app.getVersion(),
      lastSeenVersion: storedSettings.lastSeenVersion
    });
    settingsChanged = true;
  }
  if (settingsChanged) await writeJson(p.settings, storedSettings);
  // Economía y rankings se crean la primera vez que esas funciones se usan.
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch (error) {
    console.error(`No se pudo leer ${file}:`, error);
    return fallback;
  }
}

async function writeJson(file, value) {
  const temp = `${file}.tmp`;
  await fsp.writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  await fsp.rename(temp, file);
}

function normalizeEconomyUser(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase().slice(0, 80);
}

function normalizeEconomyData(value) {
  const data = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    balances: data.balances && typeof data.balances === 'object' ? data.balances : {},
    ledger: Array.isArray(data.ledger) ? data.ledger.slice(-500) : [],
    processed: data.processed && typeof data.processed === 'object' ? data.processed : {}
  };
}

function queueEconomyOperation(operation) {
  const run = economyOperationChain.then(operation, operation);
  economyOperationChain = run.catch(() => {});
  return run;
}

async function economySnapshot() {
  const p = getDataPaths();
  const data = normalizeEconomyData(await readJson(p.economy, null));
  const balances = Object.entries(data.balances).map(([user, account]) => ({
    user,
    displayName: String(account?.displayName || user),
    profilePictureUrl: String(account?.profilePictureUrl || ''),
    balance: Math.round(Number(account?.balance || 0)),
    updatedAt: Number(account?.updatedAt || 0)
  })).sort((a, b) => b.balance - a.balance || a.user.localeCompare(b.user));
  return { balances, ledger: data.ledger.slice(-80).reverse() };
}

async function mutateEconomy(input = {}) {
  return queueEconomyOperation(async () => {
    const p = getDataPaths();
    const data = normalizeEconomyData(await readJson(p.economy, null));
    const settings = { ...DEFAULT_SETTINGS, ...(await readJson(p.settings, DEFAULT_SETTINGS)) };
    const user = normalizeEconomyUser(input.user);
    if (!user) throw new Error('Escribe un usuario válido.');
    const transactionId = String(input.transactionId || '').trim().slice(0, 180);
    if (transactionId && data.processed[transactionId]) return data.processed[transactionId];
    const starting = Math.round(Number(settings.economyStartingBalance || 0));
    const account = data.balances[user] || { displayName: String(input.displayName || input.user || user), balance: starting, updatedAt: Date.now() };
    account.displayName = String(input.displayName || account.displayName || user).slice(0, 100);
    account.profilePictureUrl = String(input.profilePictureUrl || account.profilePictureUrl || '').slice(0, 1000);
    account.balance = Math.round(Number(account.balance || 0));
    const mode = String(input.mode || 'add');
    const amount = Math.max(0, Math.round(Math.abs(Number(input.amount || 0))));
    let delta = 0;
    let ok = true;
    let insufficient = false;
    if (mode === 'charge') {
      if (account.balance < amount) { ok = false; insufficient = true; }
      else { delta = -amount; account.balance += delta; }
    } else if (mode === 'set') {
      const target = Math.max(0, Math.round(Number(input.amount || 0)));
      delta = target - account.balance;
      account.balance = target;
    } else {
      delta = Math.round(Number(input.amount || 0));
      account.balance = Math.max(0, account.balance + delta);
    }
    account.updatedAt = Date.now();
    data.balances[user] = account;
    const result = { ok, insufficient, user, balance: account.balance, amount, delta };
    if (ok && delta !== 0) {
      data.ledger.push({
        id: transactionId || randomUUID(),
        user,
        displayName: account.displayName,
        delta,
        balance: account.balance,
        reason: String(input.reason || 'Ajuste').slice(0, 160),
        timestamp: Date.now()
      });
      data.ledger = data.ledger.slice(-500);
    }
    if (transactionId) {
      data.processed[transactionId] = result;
      const keys = Object.keys(data.processed);
      if (keys.length > 2500) keys.slice(0, keys.length - 2000).forEach((key) => delete data.processed[key]);
    }
    await writeJson(p.economy, data);
    scheduleRankingBroadcast();
    return result;
  });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}


const STREAM_WIDGET_TYPES = new Set(['playlist', 'wallet', 'game', 'alert', 'goal', 'gift']);

function normalizeStreamWidgetType(value) {
  return STREAM_WIDGET_TYPES.has(String(value || '')) ? String(value) : 'playlist';
}

function setStreamWidgetState(type, payload = {}) {
  const normalized = normalizeStreamWidgetType(type);
  const state = { ...payload, type: normalized, id: String(payload?.id || randomUUID()), updatedAt: Date.now() };
  streamWidgetStates.set(normalized, state);
  send('widget:update', { widget: normalized, snapshot: state });
  queueStableOverlaySync('widget', normalized);
  return state;
}

async function streamWidgetSnapshot(type, preview = false) {
  const normalized = normalizeStreamWidgetType(type);
  const current = streamWidgetStates.get(normalized);
  // La vista de diseño siempre usa una muestra estable y no requiere actividad del LIVE.
  if (!preview && current) return current;
  if (normalized === 'wallet') {
    if (preview) {
      const settings = runtimeResourceSettings || DEFAULT_SETTINGS;
      return { type:'wallet', id:'wallet-preview', updatedAt:1, user:'lulu_fan', displayName:'Lulu Fan', profilePictureUrl:'', balance:2450, currencyName:String(settings.currencyName || 'Lunitas'), currencySymbol:String(settings.currencySymbol || '🌙') };
    }
    const settings = { ...DEFAULT_SETTINGS, ...(await readJson(getDataPaths().settings, DEFAULT_SETTINGS)) };
    const currencyName = String(settings.currencyName || 'Lunitas');
    const currencySymbol = String(settings.currencySymbol || '🌙');
    return { type:'wallet', id:'wallet-empty', updatedAt:0, visible:false, expiresAt:0, user:'', displayName:'', profilePictureUrl:'', balance:0, currencyName, currencySymbol };
  }
  if (normalized === 'alert') {
    if (preview) return { type:'alert', id:'alert-preview', updatedAt:1, title:'Gracias por el apoyo', text:'Lulu Fan envió un regalo', icon:'✦', durationSeconds:6, expiresAt:0 };
    return { type:'alert', id:'alert-empty', updatedAt:0, visible:false, title:'', text:'', icon:'✦', durationSeconds:6, expiresAt:0 };
  }
  if (normalized === 'goal') {
    if (preview) return { type:'goal', id:'goal-preview', updatedAt:1, title:'Meta de likes', goalType:'likes', progress:725, target:1000, percent:72.5, text:'725 / 1,000' };
    return { type:'goal', id:'goal-empty', updatedAt:0, visible:false, title:'', goalType:'likes', progress:0, target:100, percent:0, text:'0 / 100' };
  }
  if (normalized === 'gift') {
    if (preview) return { type:'gift', id:'gift-preview', updatedAt:1, totalGifts:46, totalDiamonds:1840, topGift:{displayName:'Lulu Fan',giftName:'TikTok Universe',diamonds:1000,repeatCount:1}, topStreak:{displayName:'Miku Fan',giftName:'Rose',diamonds:24,repeatCount:24}, lastGift:{displayName:'Miku Fan',giftName:'Rose',diamonds:24,repeatCount:24} };
    return { type:'gift', id:'gift-empty', updatedAt:0, visible:false, expiresAt:0, totalGifts:0, totalDiamonds:0, topGift:null, topStreak:null, lastGift:null };
  }
  if (normalized === 'game') {
    if (preview) return { type:'game', id:'game-preview', updatedAt:1, title:'Blackjack', displayName:'Lulu Fan', user:'lulu_fan', status:'win', bet:100, payout:200, profit:100, detail:'A♠ K♥ = 21 · Dealer 19', text:'Lulu Fan ganó 100 Lunitas en Blackjack.', currencyName:'Lunitas', currencySymbol:'🌙', playerCards:['A♠','K♥'], dealerCards:['10♦','9♣'] };
    return { type:'game', id:'game-empty', updatedAt:0, visible:false, expiresAt:0, title:'', displayName:'', user:'', status:'idle', bet:0, payout:0, profit:0, detail:'', text:'', currencyName:'Lunitas', currencySymbol:'🌙' };
  }
  if (preview) return {
    type:'playlist', id:'playlist-preview', updatedAt:1, provider:'YouTube', visible:true,
    current:{ title:'Canción actual de ejemplo', requestedBy:'Lulu Fan' },
    queue:[
      { title:'Siguiente canción', requestedBy:'AlyaTeam' },
      { title:'Otra solicitud del chat', requestedBy:'Estrellita' },
      { title:'Última canción visible', requestedBy:'Mikasita' }
    ]
  };
  return { type:'playlist', id:'playlist-empty', updatedAt:0, provider:'YouTube', visible:false, current:null, queue:[] };
}

function streamWidgetUrl(type, token, baseUrl = localOverlayBaseUrl(), theme = 'lulu', background = 'plain') {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/widget?type=${encodeURIComponent(normalizeStreamWidgetType(type))}&theme=${encodeURIComponent(normalizeStreamWidgetTheme(theme))}&background=${encodeURIComponent(normalizeStreamWidgetBackground(background))}&token=${encodeURIComponent(token)}`;
}

function streamWidgetHtml(type, token, preview = false, theme = 'lulu', background = 'plain', style = {}) {
  const normalized = normalizeStreamWidgetType(type);
  const normalizedTheme = normalizeStreamWidgetTheme(theme, DEFAULT_STREAM_WIDGET_THEMES[normalized] || 'lulu');
  const normalizedBackground = normalizeStreamWidgetBackground(background, DEFAULT_STREAM_WIDGET_BACKGROUNDS[normalized] || 'plain');
  const safeType = JSON.stringify(normalized);
  const safeToken = JSON.stringify(String(token || ''));
  const safeTheme = JSON.stringify(normalizedTheme);
  const safeBackground = JSON.stringify(normalizedBackground);
  const normalizedStyle = normalizeStreamWidgetStyle(style, DEFAULT_STREAM_WIDGET_STYLES[normalized]);
  const safeStyle = JSON.stringify(normalizedStyle);
  const previewFlag = preview ? '1' : '0';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${streamWidgetThemeCss(normalizedTheme)}
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:Segoe UI,Arial,sans-serif;color:#fff}body{display:flex;align-items:flex-start;justify-content:flex-start;padding:14px}.hidden{display:none!important}.card{--pink:#ff4f9b;--cyan:#25f4ee;position:relative;background:linear-gradient(135deg,rgba(24,14,36,.94),rgba(67,29,72,.9));border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 50px rgba(0,0,0,.4);backdrop-filter:blur(16px);overflow:hidden}.card:before{content:'';position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,var(--cyan),var(--pink))}.playlist{width:min(560px,100%);border-radius:22px;padding:18px}.head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}.head strong{font-size:22px;letter-spacing:.02em}.badge{font-size:11px;font-weight:800;padding:6px 9px;border-radius:999px;background:rgba(255,79,155,.17);border:1px solid rgba(255,79,155,.35)}.now{display:grid;grid-template-columns:46px minmax(0,1fr);gap:12px;align-items:center;padding:12px;border-radius:16px;background:linear-gradient(90deg,rgba(255,79,155,.2),rgba(37,244,238,.09));border:1px solid rgba(255,255,255,.11);margin-bottom:10px}.disc{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--pink),#8a5cff);font-size:20px;box-shadow:0 0 18px rgba(255,79,155,.28)}.copy strong,.copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.copy strong{font-size:17px}.copy small{margin-top:4px;color:rgba(255,255,255,.66)}.queue{display:flex;flex-direction:column;gap:7px}.song{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;align-items:center;padding:9px 11px;border-radius:13px;background:rgba(255,255,255,.065);border:1px solid rgba(255,255,255,.07)}.song>span{font-weight:900;color:#ff9fc5;text-align:center}.empty{padding:18px;text-align:center;color:rgba(255,255,255,.65)}.wallet{width:min(470px,100%);min-height:112px;border-radius:999px;display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:13px;padding:12px 22px 12px 12px}.avatar{width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--pink);background:linear-gradient(135deg,var(--pink),var(--cyan));display:grid;place-items:center;font-size:26px;font-weight:900;box-shadow:0 0 20px rgba(255,79,155,.28)}.wallet-name{min-width:0}.wallet-name strong,.wallet-name small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wallet-name strong{font-size:20px}.wallet-name small{color:rgba(255,255,255,.62);margin-top:3px}.balance{text-align:right;white-space:nowrap}.balance strong{display:block;font-size:25px;color:#ffe07d;text-shadow:0 0 12px rgba(255,224,125,.25)}.balance small{font-size:11px;color:rgba(255,255,255,.65)}.game{width:min(620px,100%);border-radius:24px;padding:18px}.game-player{display:flex;align-items:center;justify-content:space-between;gap:14px}.game-copy strong,.game-copy small{display:block}.game-copy strong{font-size:22px}.game-copy small{margin-top:4px;color:rgba(255,255,255,.65)}.game-result{margin-top:13px;padding:15px;border-radius:17px;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.1);font-size:22px;font-weight:850;letter-spacing:.02em}.game-result.win{box-shadow:inset 0 0 0 1px rgba(81,255,166,.22)}.game-result.loss{box-shadow:inset 0 0 0 1px rgba(255,89,122,.24)}.game-meta{display:flex;justify-content:space-between;gap:12px;margin-top:11px;color:rgba(255,255,255,.73);font-size:13px}.game-payout{font-weight:900;color:#ffe07d}.lulu-alert{width:min(660px,100%);padding:18px 20px;display:flex;align-items:center;gap:15px}.alert-icon{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(135deg,rgba(255,112,180,.34),rgba(144,92,255,.30));font-size:30px;box-shadow:0 0 32px rgba(255,104,190,.18)}.alert-copy strong,.alert-copy span{display:block}.alert-copy strong{font-size:23px}.alert-copy span{margin-top:5px;color:rgba(255,255,255,.78);font-size:16px}.lulu-goal{width:min(660px,100%);padding:18px}.goal-track{height:14px;margin-top:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.goal-track span{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#ff70b5,#a667ff,#65dcff)}.goal-meta{display:flex;align-items:center;justify-content:space-between;margin-top:10px}.goal-meta strong{font-size:19px}.goal-meta small{color:rgba(255,255,255,.62);letter-spacing:.12em}.lulu-gifts{width:min(720px,100%);padding:18px}.gift-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.gift-grid>div{padding:13px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}.gift-grid small,.gift-grid strong,.gift-grid span{display:block}.gift-grid small{font-size:10px;color:rgba(255,255,255,.55);letter-spacing:.12em}.gift-grid strong{margin-top:5px;font-size:17px}.gift-grid span{margin-top:3px;color:rgba(255,255,255,.72)}.gift-last{margin-top:11px;color:rgba(255,255,255,.72);font-size:13px}@media(max-width:420px){.wallet{grid-template-columns:58px minmax(0,1fr);border-radius:24px}.avatar{width:58px;height:58px}.balance{grid-column:2;text-align:left}.playlist{padding:14px}}
  ${streamWidgetBackgroundCss(normalizedBackground)}${streamWidgetCustomCss(normalizedStyle)}${LuluWidgetDesign.css(normalizedStyle)}</style></head><body><section id="playlistCard" class="card playlist hidden"><div class="head"><strong>Lista de reproducción</strong><span class="badge" id="provider">LIVE</span></div><div id="now"></div><div class="queue" id="queue"></div></section><section id="walletCard" class="card wallet hidden"><div id="avatar" class="avatar">L</div><div class="wallet-name"><strong id="displayName">Esperando usuario</strong><small id="username">@usuario</small></div><div class="balance"><strong id="balance">0</strong><small id="currency">Lunitas</small></div></section><section id="gameCard" class="card game hidden"><div class="head"><strong id="gameTitle">Juegos del LIVE</strong><span class="badge" id="gameBadge">LIVE</span></div><div class="game-player"><div class="game-copy"><strong id="gamePlayer">Esperando jugador</strong><small id="gameUser">@usuario</small></div><div class="game-payout" id="gamePayout">🌙 0</div></div><div class="game-result" id="gameResult">Usa un comando de juego en el chat.</div><div class="game-meta"><span id="gameBet">Apuesta: —</span><span id="gameStatus">Esperando</span></div></section><section id="alertCard" class="card lulu-alert hidden"><div class="alert-icon" id="alertIcon">✦</div><div class="alert-copy"><strong id="alertTitle">Alertas de Lulu</strong><span id="alertText">Esperando un evento del LIVE.</span></div></section><section id="goalCard" class="card lulu-goal hidden"><div class="head"><strong id="goalTitle">Meta del LIVE</strong><span class="badge" id="goalPercent">0%</span></div><div class="goal-track"><span id="goalBar"></span></div><div class="goal-meta"><strong id="goalText">0 / 100</strong><small id="goalType">LIKES</small></div></section><section id="giftCard" class="card lulu-gifts hidden"><div class="head"><strong>Regalos del LIVE</strong><span class="badge" id="giftTotal">0 regalos</span></div><div class="gift-grid"><div><small>TOP REGALO</small><strong id="topGiftName">Esperando</strong><span id="topGiftDetail">—</span></div><div><small>MEJOR RACHA</small><strong id="topStreakName">Esperando</strong><span id="topStreakDetail">—</span></div></div><div class="gift-last" id="lastGiftText">Esperando regalos…</div></section><script>
  const widget=${safeType},preview='${previewFlag}'==='1',activeTheme=${safeTheme},activeBackground=${safeBackground},activeStyle=${safeStyle},clientId=(globalThis.crypto?.randomUUID?.()||('lf-'+Date.now()+'-'+Math.random().toString(16).slice(2)));let last='',hideTimer=0;
  const playlistCard=document.getElementById('playlistCard'),walletCard=document.getElementById('walletCard'),gameCard=document.getElementById('gameCard'),alertCard=document.getElementById('alertCard'),goalCard=document.getElementById('goalCard'),giftCard=document.getElementById('giftCard');
  const text=(v,f='')=>String(v??f);function hideAll(){clearTimeout(hideTimer);hideTimer=0;[playlistCard,walletCard,gameCard,alertCard,goalCard,giftCard].forEach((card)=>card&&card.classList.add('hidden'))}function timedActivityVisible(data,ready){if(preview)return true;const expiresAt=Number(data.expiresAt||0);return data.visible!==false&&Boolean(ready)&&expiresAt>Date.now()}function armActivityExpiry(data){if(preview)return;const expiresAt=Number(data.expiresAt||0);if(expiresAt>Date.now())hideTimer=setTimeout(hideAll,Math.max(250,expiresAt-Date.now()))}
  function renderPlaylist(data){const items=Array.isArray(data.queue)?data.queue:[];if(!preview&&(data.visible===false||(!data.current&&!items.length))){hideAll();return}hideAll();playlistCard.classList.remove('hidden');document.getElementById('provider').textContent=text(data.provider,'Música');const now=document.getElementById('now'),queue=document.getElementById('queue');now.replaceChildren();queue.replaceChildren();if(data.current){const box=document.createElement('div');box.className='now';const disc=document.createElement('div');disc.className='disc';disc.textContent='♪';const copy=document.createElement('div');copy.className='copy';const title=document.createElement('strong');title.textContent=text(data.current.title,'Canción actual');const by=document.createElement('small');by.textContent=data.current.requestedBy?'Solicitada por '+data.current.requestedBy:'Reproduciendo ahora';copy.append(title,by);box.append(disc,copy);now.appendChild(box)}else{const empty=document.createElement('div');empty.className='empty';empty.textContent='Preparando la canción solicitada…';now.appendChild(empty)}if(!items.length&&data.current){const empty=document.createElement('div');empty.className='empty';empty.textContent='La cola está vacía.';queue.appendChild(empty)}items.slice(0,5).forEach((item,index)=>{const row=document.createElement('div');row.className='song';const number=document.createElement('span');number.textContent=String(index+1);const copy=document.createElement('div');copy.className='copy';const title=document.createElement('strong');title.textContent=text(item.title,'Canción');const by=document.createElement('small');by.textContent=item.requestedBy?'Pedida por '+item.requestedBy:'Solicitud manual';copy.append(title,by);row.append(number,copy);queue.appendChild(row)})}
  function renderWallet(data){hideAll();if(!timedActivityVisible(data,data.user)){return}walletCard.classList.remove('hidden');const name=text(data.displayName||data.user,'Usuario'),currentAvatar=document.getElementById('avatar');let avatar;if(data.profilePictureUrl){avatar=document.createElement('img');avatar.src=text(data.profilePictureUrl);avatar.alt='';avatar.referrerPolicy='no-referrer'}else{avatar=document.createElement('div');avatar.textContent=name.slice(0,1).toUpperCase()}avatar.id='avatar';avatar.className='avatar';currentAvatar.replaceWith(avatar);document.getElementById('displayName').textContent=name;document.getElementById('username').textContent='@'+text(data.user);const symbol=text(data.currencySymbol,'🌙');document.getElementById('balance').textContent=symbol+' '+Number(data.balance||0).toLocaleString('es-MX');document.getElementById('currency').textContent=text(data.currencyName,'Lunitas');armActivityExpiry(data)}
  function renderGame(data){hideAll();if(!timedActivityVisible(data,data.user&&data.status&&data.status!=='idle')){return}gameCard.classList.remove('hidden');document.getElementById('gameTitle').textContent=text(data.title,'Juegos del LIVE');document.getElementById('gameBadge').textContent=data.status==='win'?'GANÓ':data.status==='loss'?'PERDIÓ':data.status==='push'?'EMPATE':'JUGANDO';document.getElementById('gamePlayer').textContent=text(data.displayName||data.user,'Jugador');document.getElementById('gameUser').textContent='@'+text(data.user);const symbol=text(data.currencySymbol,'🌙');document.getElementById('gamePayout').textContent=Number(data.payout||0)>0?symbol+' '+Number(data.payout||0).toLocaleString('es-MX'):symbol+' 0';const result=document.getElementById('gameResult');result.textContent=text(data.detail||data.text,'Partida activa');result.className='game-result '+text(data.status,'pending');document.getElementById('gameBet').textContent=Number(data.bet||0)>0?'Apuesta: '+symbol+' '+Number(data.bet).toLocaleString('es-MX'):'Apuesta: —';document.getElementById('gameStatus').textContent=data.status==='win'?'Victoria':data.status==='loss'?'Derrota':data.status==='push'?'Empate':'En juego';armActivityExpiry(data)}
  function renderAlert(data){hideAll();if(!timedActivityVisible(data,data.text)){return}alertCard.classList.remove('hidden');document.getElementById('alertIcon').textContent=text(data.icon,'✦');document.getElementById('alertTitle').textContent=text(data.title,'Alertas de Lulu');document.getElementById('alertText').textContent=text(data.text);armActivityExpiry(data)}
  function renderGoal(data){hideAll();if(!preview&&(data.visible===false||!data.title)){return}goalCard.classList.remove('hidden');const target=Math.max(1,Number(data.target||1)),progress=Math.max(0,Number(data.progress||0)),percent=Math.max(0,Math.min(100,Number(data.percent??(progress/target*100))));document.getElementById('goalTitle').textContent=text(data.title,'Meta del LIVE');document.getElementById('goalPercent').textContent=Math.round(percent)+'%';document.getElementById('goalBar').style.width=percent+'%';document.getElementById('goalText').textContent=text(data.text,progress.toLocaleString('es-MX')+' / '+target.toLocaleString('es-MX'));document.getElementById('goalType').textContent=text(data.goalType,'META').toUpperCase()}
  function renderGift(data){hideAll();if(!timedActivityVisible(data,data.lastGift)){return}giftCard.classList.remove('hidden');document.getElementById('giftTotal').textContent=Number(data.totalGifts||0).toLocaleString('es-MX')+' regalos';const top=data.topGift||{},streak=data.topStreak||{},last=data.lastGift||{};document.getElementById('topGiftName').textContent=text(top.displayName,'Esperando');document.getElementById('topGiftDetail').textContent=top.giftName?text(top.giftName)+' · '+Number(top.diamonds||0).toLocaleString('es-MX')+' monedas':'—';document.getElementById('topStreakName').textContent=text(streak.displayName,'Esperando');document.getElementById('topStreakDetail').textContent=streak.giftName?text(streak.giftName)+' ×'+Number(streak.repeatCount||1).toLocaleString('es-MX'):'—';document.getElementById('lastGiftText').textContent=text(last.displayName)+' envió '+text(last.giftName)+' ×'+Number(last.repeatCount||1).toLocaleString('es-MX');armActivityExpiry(data)}
  function render(data){if((data.theme&&data.theme!==activeTheme)||(data.background&&data.background!==activeBackground)||JSON.stringify(data.style||{})!==JSON.stringify(activeStyle)){const next=new URL(location.href);if(data.theme)next.searchParams.set('theme',data.theme);if(data.background)next.searchParams.set('background',data.background);location.replace(next);return}if(widget==='wallet')renderWallet(data);else if(widget==='game')renderGame(data);else if(widget==='alert')renderAlert(data);else if(widget==='goal')renderGoal(data);else if(widget==='gift')renderGift(data);else renderPlaylist(data)}
  async function poll(){try{const response=await fetch('/widget-snapshot?type='+encodeURIComponent(widget)+'&preview='+(preview?'1':'0')+'&client='+encodeURIComponent(clientId)+'&token='+encodeURIComponent(${safeToken}),{cache:'no-store'});if(response.ok){const payload=await response.text();if(payload!==last){last=payload;render(JSON.parse(payload))}if(preview&&parent!==window)parent.postMessage({type:'lulu-permanent-preview-ready',preview:widget},'*')}}catch{}setTimeout(poll,preview?1500:600)}poll();
  </script></body></html>`;
}

function streamWidgetClientCount(type = null) {
  if (type !== null) return pollingClientCount(streamWidgetPollClients, normalizeStreamWidgetType(type));
  return pollingClientCount(streamWidgetPollClients);
}

async function streamWidgetInfo(type = 'playlist', forceTunnel = false) {
  activateRuntimeModule('overlays');
  await startOverlayServer();
  const token = await overlayIdentity();
  const normalized = normalizeStreamWidgetType(type);
  const themes = normalizeStreamWidgetThemes(runtimeResourceSettings?.streamWidgetThemes);
  const backgrounds = normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds);
  const styles = normalizeStreamWidgetStyles(runtimeResourceSettings?.streamWidgetStyles);
  const theme = themes[normalized];
  const background = backgrounds[normalized];
  const localUrl = streamWidgetUrl(normalized, token, localOverlayBaseUrl(), theme, background);
  const stable = await stableOverlaySourceStatus('widget', normalized, forceTunnel);
  const fallback = stable.ok ? null : (forceTunnel ? await ensureOverlayHttpsTunnel(true) : currentOverlayTunnelInfo());
  const tunnel = reportedOverlayTunnel(stable, fallback);
  const url = stable.ok ? stable.url : (tunnel.ok && tunnel.url ? streamWidgetUrl(normalized, token, tunnel.url, theme, background) : '');
  return {
    ok: Boolean(url), widget: normalized, theme, background, style:styles[normalized], url, localUrl, previewUrl: `${localUrl}&preview=1`,
    connected: streamWidgetClientCount(normalized), totalConnected: streamWidgetClientCount(),
    tunnelStatus: tunnel.status || overlayTunnelStatus.status,
    tunnelMessage: tunnel.message || overlayTunnelStatus.message,
    snapshot: await streamWidgetSnapshot(normalized, false), port: overlayPort
  };
}


function getLiveGameManager() {
  if (liveGameManager) return liveGameManager;
  const LiveGameManager=getLiveGameManagerClass();
  liveGameManager = new LiveGameManager({
    getConfig: async () => ({ ...DEFAULT_SETTINGS, ...(await readJson(getDataPaths().settings, DEFAULT_SETTINGS)) }),
    charge: async (details) => mutateEconomy({ mode:'charge', user:details.user, displayName:details.displayName, profilePictureUrl:details.profilePictureUrl, amount:details.amount, reason:details.reason, transactionId:details.transactionId }),
    payout: async (details) => mutateEconomy({ mode:'add', user:details.user, displayName:details.displayName, profilePictureUrl:details.profilePictureUrl, amount:details.amount, reason:details.reason, transactionId:details.transactionId }),
    publish: async (result) => {
      const pending = result?.status === 'pending';
      setStreamWidgetState('game', {
        ...result,
        type:'game',
        visible:true,
        expiresAt:Date.now() + (pending ? 95_000 : 12_000)
      });
      send('games:result', result);
    }
  });
  return liveGameManager;
}


const RANKING_TYPES = new Set(['coins','likes','economy','gifts','comments','shares','follows','members','subscribes','fanStickers']);
const RANKING_STYLES = new Set(['tiktok','glass','neon','minimal']);
const RANKING_FONTS = new Set(['Segoe UI','Arial','Impact','Trebuchet MS','Georgia','Courier New','Comic Sans MS']);

function normalizeRankingSlot(value) {
  return Math.min(4, Math.max(1, Math.round(Number(value || 1))));
}

function normalizeRankingConfig(value = {}, slot = 1) {
  const fallback = DEFAULT_RANKING_OVERLAYS[normalizeRankingSlot(slot) - 1];
  const source = value && typeof value === 'object' ? value : {};
  const color = (candidate, fallbackColor) => /^#[0-9a-f]{6}$/i.test(String(candidate || '')) ? String(candidate) : fallbackColor;
  return {
    ...fallback,
    id: `ranking-${normalizeRankingSlot(slot)}`,
    type: RANKING_TYPES.has(source.type) ? source.type : fallback.type,
    title: String(source.title || fallback.title).trim().slice(0, 60),
    limit: Math.min(10, Math.max(3, Math.round(Number(source.limit || fallback.limit)))),
    style: RANKING_STYLES.has(source.style) ? source.style : fallback.style,
    font: RANKING_FONTS.has(source.font) ? source.font : fallback.font,
    textColor: color(source.textColor, fallback.textColor),
    accentColor: color(source.accentColor, fallback.accentColor),
    secondaryColor: color(source.secondaryColor, fallback.secondaryColor),
    backgroundColor: color(source.backgroundColor, fallback.backgroundColor),
    backgroundOpacity: Math.min(100, Math.max(0, Math.round(Number(source.backgroundOpacity ?? fallback.backgroundOpacity)))),
    rgbText: source.rgbText === true,
    showAvatar: source.showAvatar !== false,
    showValue: source.showValue !== false,
    showRank: source.showRank !== false,
    uppercaseNames: source.uppercaseNames === true
  };
}

function normalizeRankingUser(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase().slice(0, 80);
}

function normalizeRankingData(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    users: source.users && typeof source.users === 'object' ? source.users : {},
    processed: source.processed && typeof source.processed === 'object' ? source.processed : {},
    updatedAt: Number(source.updatedAt || Date.now())
  };
}

function queueRankingOperation(operation) {
  const run = rankingOperationChain.then(operation, operation);
  rankingOperationChain = run.catch(() => {});
  return run;
}

async function getRankingData() {
  if (!rankingDataCache) rankingDataCache = normalizeRankingData(await readJson(getDataPaths().rankings, null));
  return rankingDataCache;
}

function scheduleRankingWrite() {
  clearTimeout(rankingWriteTimer);
  rankingWriteTimer = setTimeout(() => {
    rankingWriteTimer = null;
    if (!rankingDataCache) return;
    writeJson(getDataPaths().rankings, rankingDataCache).catch((error) => console.error('No se pudieron guardar rankings:', error));
  }, 400);
}

function rankingMetricValue(account, type) {
  const metrics = account?.metrics || {};
  return Math.max(0, Math.round(Number(metrics[type] || 0)));
}

async function rankingEntries(type, limit) {
  if (type === 'economy') {
    const economy = await economySnapshot();
    return economy.balances.slice(0, limit).map((entry) => ({
      user: entry.user,
      displayName: entry.displayName || entry.user,
      profilePictureUrl: '',
      value: Math.max(0, Math.round(Number(entry.balance || 0)))
    }));
  }
  const data = await getRankingData();
  return Object.entries(data.users).map(([user, account]) => ({
    user,
    displayName: String(account?.displayName || user),
    profilePictureUrl: String(account?.profilePictureUrl || ''),
    value: rankingMetricValue(account, type),
    updatedAt: Number(account?.updatedAt || 0)
  })).filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value || b.updatedAt - a.updatedAt || a.user.localeCompare(b.user))
    .slice(0, limit);
}

function previewRankingEntries(type) {
  const values = type === 'likes' ? [18420, 12150, 8760, 4210, 1980]
    : type === 'coins' ? [3650, 2410, 1520, 890, 420]
      : type === 'economy' ? [12400, 9800, 7350, 4100, 2300]
        : [158, 121, 93, 64, 31];
  const names = ['LuluFan', 'AlyaTeam', 'Mikasita', 'Estrellita', 'Lunita'];
  return names.map((displayName, index) => ({ user: displayName.toLowerCase(), displayName, profilePictureUrl: '', value: values[index] }));
}

async function rankingSnapshot(slot = 1, preview = false) {
  const normalizedSlot = normalizeRankingSlot(slot);
  const settings = { ...DEFAULT_SETTINGS, ...(await readJson(getDataPaths().settings, DEFAULT_SETTINGS)) };
  const configs = Array.isArray(settings.rankingOverlays) ? settings.rankingOverlays : DEFAULT_RANKING_OVERLAYS;
  const config = normalizeRankingConfig(configs[normalizedSlot - 1], normalizedSlot);
  let entries = await rankingEntries(config.type, config.limit);
  if (preview && !entries.length) entries = previewRankingEntries(config.type).slice(0, config.limit);
  return { type: 'ranking', slot: normalizedSlot, config, entries };
}

async function recordRankingMetric(type, source = {}, amount = 1, eventId = '') {
  if (!runtimeModuleActive('rankings') && rankingClientCount() === 0) return;
  if (!RANKING_TYPES.has(type) || type === 'economy') return;
  const user = source?.user || source?.sender || source || {};
  const uniqueId = normalizeRankingUser(user.uniqueId || user.displayId || user.userId || source?.uniqueId || source?.userId);
  if (!uniqueId) return;
  const quantity = Math.max(0, Math.round(Number(amount || 0)));
  if (!quantity) return;
  return queueRankingOperation(async () => {
    const data = await getRankingData();
    const transactionId = String(eventId || '').slice(0, 180);
    if (transactionId && data.processed[transactionId]) return;
    const account = data.users[uniqueId] || { displayName: uniqueId, profilePictureUrl: '', metrics: {}, updatedAt: 0 };
    account.displayName = String(user.nickname || user.displayName || source?.nickname || account.displayName || uniqueId).slice(0, 100);
    account.profilePictureUrl = String(user.profilePicture?.urlList?.[0] || user.avatarThumb?.urlList?.[0] || source?.profilePictureUrl || account.profilePictureUrl || '').slice(0, 1000);
    account.metrics = account.metrics && typeof account.metrics === 'object' ? account.metrics : {};
    account.metrics[type] = rankingMetricValue(account, type) + quantity;
    account.updatedAt = Date.now();
    data.users[uniqueId] = account;
    data.updatedAt = account.updatedAt;
    if (transactionId) {
      data.processed[transactionId] = account.updatedAt;
      const keys = Object.keys(data.processed);
      if (keys.length > 5000) keys.slice(0, keys.length - 3500).forEach((key) => delete data.processed[key]);
    }
    scheduleRankingWrite();
    scheduleRankingBroadcast();
  });
}

function rankingUrl(slot, token, baseUrl = localOverlayBaseUrl()) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/ranking?slot=${normalizeRankingSlot(slot)}&token=${encodeURIComponent(token)}`;
}

function rankingClientCount(slot = null) {
  const countSseClients = (clients) => [...(clients || [])].filter((response) => !response.__luluPreview).length;
  if (slot !== null) {
    const normalized = normalizeRankingSlot(slot);
    return countSseClients(rankingClients.get(normalized)) + pollingClientCount(rankingPollClients, normalized);
  }
  let total = pollingClientCount(rankingPollClients);
  for (const clients of rankingClients.values()) total += countSseClients(clients);
  return total;
}

function rankingHtml(slot, token, preview = false) {
  const safeSlot = normalizeRankingSlot(slot);
  const safeToken = JSON.stringify(String(token || ''));
  const previewFlag = preview ? '1' : '0';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}body{display:flex;align-items:flex-start;justify-content:flex-start;padding:18px;color:#fff;font-family:Segoe UI,Arial,sans-serif}#board{--text:#fff;--accent:#ff2d8f;--accent2:#25f4ee;--bg:16,16,24;--opacity:.82;width:min(560px,100%);border-radius:22px;overflow:hidden;position:relative;background:rgba(var(--bg),var(--opacity));box-shadow:0 18px 55px rgba(0,0,0,.38);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(14px)}#board:before{content:'';position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,var(--accent2),var(--accent),var(--accent2));background-size:200% 100%;animation:flow 3s linear infinite}.head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px 13px;gap:12px}.title{font-size:25px;font-weight:900;letter-spacing:.06em;color:var(--text);text-shadow:2px 2px 0 var(--accent),-2px -2px 0 var(--accent2)}.live{font-size:11px;font-weight:800;letter-spacing:.12em;padding:6px 9px;border-radius:999px;background:rgba(255,45,143,.18);border:1px solid rgba(255,45,143,.38)}#list{display:flex;flex-direction:column;padding:0 12px 14px;gap:8px}.row{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;gap:11px;min-height:58px;padding:9px 12px;border-radius:15px;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.08);animation:enter .35s cubic-bezier(.2,.8,.2,1) both}.row:first-child{background:linear-gradient(90deg,rgba(255,45,143,.21),rgba(37,244,238,.13));border-color:rgba(255,255,255,.2)}.rank{width:31px;text-align:center;font-size:19px;font-weight:900;color:var(--text)}.rank.top:before{content:'♛';display:block;font-size:14px;line-height:10px;color:#ffd45e}.avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;font-weight:900}.name{min-width:0;font-size:18px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.user{display:block;font-size:11px;font-weight:600;opacity:.62;margin-top:2px}.value{font-size:18px;font-weight:900;color:var(--text);white-space:nowrap}.empty{padding:36px 20px 42px;text-align:center;font-size:17px;font-weight:800;opacity:.72}.rgb .title,.rgb .name,.rgb .value,.rgb .rank{color:transparent!important;background:linear-gradient(90deg,#ff334d,#ffcf33,#37ff8b,#34d8ff,#8d5cff,#ff45d7,#ff334d);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;animation:rgb 3s linear infinite;text-shadow:none}.style-glass{background:rgba(var(--bg),calc(var(--opacity)*.72))!important;border:1px solid rgba(255,255,255,.24)!important}.style-neon{box-shadow:0 0 24px var(--accent),inset 0 0 24px rgba(255,255,255,.04)!important;border:2px solid var(--accent)!important}.style-neon .row{box-shadow:inset 0 0 16px rgba(37,244,238,.08)}.style-minimal{background:rgba(var(--bg),var(--opacity))!important;border:0!important;box-shadow:none!important;border-radius:8px!important}.style-minimal:before{display:none}.style-minimal .row{background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,.14);border-radius:0}.style-minimal .title{text-shadow:none}.hide-avatar .avatar{display:none}.hide-avatar .row{grid-template-columns:auto minmax(0,1fr) auto}.hide-rank .rank{display:none}.hide-rank .row{grid-template-columns:auto minmax(0,1fr) auto}.hide-avatar.hide-rank .row{grid-template-columns:minmax(0,1fr) auto}.hide-value .value{display:none}.hide-value .row{grid-template-columns:auto auto minmax(0,1fr)}.hide-value.hide-avatar .row{grid-template-columns:auto minmax(0,1fr)}.hide-value.hide-rank .row{grid-template-columns:auto minmax(0,1fr)}.hide-value.hide-avatar.hide-rank .row{grid-template-columns:1fr}@keyframes enter{from{opacity:0;transform:translateX(-18px) scale(.98)}to{opacity:1;transform:none}}@keyframes flow{to{background-position:200% 0}}@keyframes rgb{to{background-position:300% 0}}
  </style></head><body><section id="board"><div class="head"><div class="title" id="title">RANKING</div><div class="live">● LIVE</div></div><div id="list"><div class="empty">Esperando datos del LIVE…</div></div></section><script>
  const board=document.getElementById('board'),title=document.getElementById('title'),list=document.getElementById('list');let renderedOnce=false;
  const fontMap={'Segoe UI':'Segoe UI,Arial,sans-serif','Arial':'Arial,sans-serif','Impact':'Impact,Arial Black,sans-serif','Trebuchet MS':'Trebuchet MS,Arial,sans-serif','Georgia':'Georgia,serif','Courier New':'Courier New,monospace','Comic Sans MS':'Comic Sans MS,cursive'};
  const metricLabels={coins:'monedas',likes:'tap taps',economy:'monedas',gifts:'regalos',comments:'comentarios',shares:'compartidos',follows:'seguidores',members:'entradas',subscribes:'suscripciones',fanStickers:'stickers'};
  const hexRgb=(hex)=>{const v=String(hex||'#101018').replace('#','');return [parseInt(v.slice(0,2),16)||0,parseInt(v.slice(2,4),16)||0,parseInt(v.slice(4,6),16)||0].join(',')};
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  function render(data){
    const c=data.config||{};
    board.className='style-'+(c.style||'tiktok');
    if(c.rgbText)board.classList.add('rgb');
    if(c.showAvatar===false)board.classList.add('hide-avatar');
    if(c.showRank===false)board.classList.add('hide-rank');
    if(c.showValue===false)board.classList.add('hide-value');
    board.style.setProperty('--text',c.textColor||'#fff');
    board.style.setProperty('--accent',c.accentColor||'#ff2d8f');
    board.style.setProperty('--accent2',c.secondaryColor||'#25f4ee');
    board.style.setProperty('--bg',hexRgb(c.backgroundColor));
    board.style.setProperty('--opacity',Math.max(0,Math.min(1,Number(c.backgroundOpacity??82)/100)));
    board.style.fontFamily=fontMap[c.font]||fontMap['Segoe UI'];
    title.textContent=c.title||'RANKING';
    const entries=Array.isArray(data.entries)?data.entries:[];
    list.replaceChildren();
    if(!entries.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Esperando datos del LIVE…';list.appendChild(empty);return;}
    entries.forEach((e,i)=>{
      const name=c.uppercaseNames?String(e.displayName||e.user||'Usuario').toUpperCase():String(e.displayName||e.user||'Usuario');
      const row=document.createElement('div');row.className='row';if(renderedOnce)row.style.animation='none';else row.style.animationDelay=String(i*.045)+'s';
      const rank=document.createElement('span');rank.className='rank'+(i===0?' top':'');rank.textContent=String(i+1);row.appendChild(rank);
      let avatar;if(e.profilePictureUrl){avatar=document.createElement('img');avatar.src=String(e.profilePictureUrl);avatar.alt='';avatar.referrerPolicy='no-referrer';}else{avatar=document.createElement('span');avatar.textContent=name.slice(0,1).toUpperCase();}avatar.className='avatar';row.appendChild(avatar);
      const nameBox=document.createElement('div');nameBox.className='name';nameBox.appendChild(document.createTextNode(name));const user=document.createElement('small');user.className='user';user.textContent='@'+String(e.user||'usuario');nameBox.appendChild(user);row.appendChild(nameBox);
      const value=document.createElement('strong');value.className='value';value.textContent=Number(e.value||0).toLocaleString('es-MX')+' '+(metricLabels[c.type]||'puntos');row.appendChild(value);
      list.appendChild(row);
    });
    renderedOnce=true;
  }
  const preview='${previewFlag}'==='1',clientId=(globalThis.crypto?.randomUUID?.()||('lf-'+Date.now()+'-'+Math.random().toString(16).slice(2)));let lastPayload='';
  async function poll(){try{const response=await fetch('/ranking-snapshot?slot=${safeSlot}&preview='+(preview?'1':'0')+'&client='+encodeURIComponent(clientId)+'&token='+encodeURIComponent(${safeToken}),{cache:'no-store'});if(response.ok){const text=await response.text();if(text!==lastPayload){lastPayload=text;render(JSON.parse(text));}if(preview&&parent!==window)parent.postMessage({type:'lulu-permanent-preview-ready',preview:'ranking'},'*')}}catch{}setTimeout(poll,700)}poll();
  </script></body></html>`;
}

async function broadcastRankingSlot(slot) {
  const normalizedSlot = normalizeRankingSlot(slot);
  queueStableOverlaySync('ranking', String(normalizedSlot));
  const clients = rankingClients.get(normalizedSlot);
  if (!clients?.size) return 0;
  const normal = await rankingSnapshot(normalizedSlot, false);
  let preview = null;
  let delivered = 0;
  for (const response of [...clients]) {
    try {
      if (response.__luluPreview && !preview) preview = await rankingSnapshot(normalizedSlot, true);
      response.write(`data: ${JSON.stringify(response.__luluPreview ? preview : normal)}\n\n`);
      delivered += 1;
    } catch { clients.delete(response); }
  }
  return delivered;
}

async function broadcastAllRankings() {
  const snapshots = [];
  for (let slot = 1; slot <= 4; slot += 1) {
    snapshots.push(await rankingSnapshot(slot, false));
    await broadcastRankingSlot(slot);
  }
  send('ranking:update', { snapshots, totalConnected: rankingClientCount() });
}

function scheduleRankingBroadcast() {
  const stableRankingActive = normalizeActiveHttpsSources(runtimeResourceSettings?.activeHttpsSources).some((key) => key.startsWith('ranking:'));
  if (!runtimeModuleActive('rankings') && rankingClientCount() === 0 && !stableRankingActive) return;
  clearTimeout(rankingBroadcastTimer);
  rankingBroadcastTimer = setTimeout(() => {
    rankingBroadcastTimer = null;
    broadcastAllRankings().catch((error) => console.error('No se pudieron actualizar rankings:', error));
  }, 140);
}

async function rankingInfo(slot = 1, forceTunnel = false) {
  activateRuntimeModule('rankings');
  await startOverlayServer();
  const token = await overlayIdentity();
  const normalizedSlot = normalizeRankingSlot(slot);
  const localUrl = rankingUrl(normalizedSlot, token, localOverlayBaseUrl());
  const stable = await stableOverlaySourceStatus('ranking', String(normalizedSlot), forceTunnel);
  const fallback = stable.ok ? null : (forceTunnel ? await ensureOverlayHttpsTunnel(true) : currentOverlayTunnelInfo());
  const tunnel = reportedOverlayTunnel(stable, fallback);
  const url = stable.ok ? stable.url : (tunnel.ok && tunnel.url ? rankingUrl(normalizedSlot, token, tunnel.url) : '');
  return {
    ok: Boolean(url),
    slot: normalizedSlot,
    url,
    localUrl,
    previewUrl: `${localUrl}&preview=1`,
    tunnelStatus: tunnel.status || overlayTunnelStatus.status,
    tunnelMessage: tunnel.message || overlayTunnelStatus.message,
    connected: rankingClientCount(normalizedSlot),
    totalConnected: rankingClientCount(),
    snapshot: await rankingSnapshot(normalizedSlot, false),
    port: overlayPort
  };
}

async function resetRankingData(type = 'all') {
  const normalizedType = RANKING_TYPES.has(type) ? type : 'all';
  await queueRankingOperation(async () => {
    const data = await getRankingData();
    if (normalizedType === 'all') {
      data.users = {};
      data.processed = {};
    } else if (normalizedType !== 'economy') {
      for (const account of Object.values(data.users)) {
        if (account?.metrics && typeof account.metrics === 'object') account.metrics[normalizedType] = 0;
      }
      data.processed = {};
    }
    data.updatedAt = Date.now();
    await writeJson(getDataPaths().rankings, data);
  });
  await broadcastAllRankings();
  return { ok: true, type: normalizedType };
}


function normalizeOverlayScreen(value) {
  const screen = Math.round(Number(value || 1));
  return Math.min(4, Math.max(1, screen));
}

async function overlayIdentity() {
  const settingsPath = getDataPaths().settings;
  const settings = { ...DEFAULT_SETTINGS, ...(await readJson(settingsPath, DEFAULT_SETTINGS)) };
  if (!String(settings.overlayToken || '').trim()) {
    settings.overlayToken = randomUUID().replace(/-/g, '');
    await writeJson(settingsPath, settings);
  }
  return settings.overlayToken;
}

function overlayUrl(screen, token, baseUrl = localOverlayBaseUrl()) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/overlay?screen=${normalizeOverlayScreen(screen)}&token=${encodeURIComponent(token)}`;
}

function overlayHtml(screen, token) {
  const safeScreen = normalizeOverlayScreen(screen);
  const safeToken = JSON.stringify(String(token || ''));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}#stage{position:fixed;inset:0;display:grid;place-items:center;pointer-events:none}#media{display:none;max-width:94vw;max-height:94vh;object-fit:contain;filter:drop-shadow(0 18px 38px rgba(0,0,0,.4));transform-origin:center}.show{display:block!important;animation:lf-in .22s ease both}.hide{animation:lf-out .22s ease both}@keyframes lf-in{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:scale(1)}}@keyframes lf-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.94)}}
  </style></head><body><div id="stage"><img id="media" alt=""></div><script>
  const media=document.getElementById('media');let timer=0,active='';const clientId=(globalThis.crypto?.randomUUID?.()||('lf-'+Date.now()+'-'+Math.random().toString(16).slice(2)));
  function clearMedia(id=''){if(id&&active===id)return;active=id||active;clearTimeout(timer);media.className=media.style.display==='none'?'':'hide';setTimeout(()=>{media.style.display='none';media.removeAttribute('src')},230)}
  function apply(data){if(!data||data.id===active)return;if(data.type==='clear'){clearMedia(data.id);return}if(data.type!=='show')return;if(Number(data.expiresAt||0)<=Date.now()){clearMedia(data.id);return}clearTimeout(timer);active=data.id||String(Date.now());media.className='';media.src=data.url;media.style.objectFit=data.fit||'contain';media.onload=()=>{media.className='show'};media.onerror=()=>{media.style.display='none'};timer=setTimeout(()=>clearMedia('expired-'+active),Math.max(100,Number(data.expiresAt||Date.now())-Date.now()))}
  async function poll(){try{const response=await fetch('/overlay-state?screen=${safeScreen}&client='+encodeURIComponent(clientId)+'&token='+encodeURIComponent(${safeToken}),{cache:'no-store'});if(response.ok)apply(await response.json())}catch{}setTimeout(poll,350)}poll();
  </script></body></html>`;
}

function overlayClientCount(screen = null) {
  if (screen !== null) {
    const normalized = normalizeOverlayScreen(screen);
    return (overlayClients.get(normalized)?.size || 0) + pollingClientCount(overlayPollClients, normalized);
  }
  let total = pollingClientCount(overlayPollClients);
  for (const clients of overlayClients.values()) total += clients.size;
  return total;
}

function broadcastOverlay(screen, payload) {
  const clients = overlayClients.get(normalizeOverlayScreen(screen));
  if (!clients?.size) return 0;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  let delivered = 0;
  for (const response of [...clients]) {
    try { response.write(line); delivered += 1; }
    catch { clients.delete(response); }
  }
  return delivered;
}

async function startOverlayServer() {
  if (overlayServer) return overlayPort;
  const token = await overlayIdentity();
  overlayServer = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.searchParams.get('token') !== token) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Enlace de superposición inválido.'); return;
      }
      const widgetType = normalizeStreamWidgetType(url.searchParams.get('type'));
      const widgetPreview = url.searchParams.get('preview') === '1';
      const widgetTheme = normalizeStreamWidgetTheme(url.searchParams.get('theme'), DEFAULT_STREAM_WIDGET_THEMES[widgetType]);
      const widgetBackground = normalizeStreamWidgetBackground(url.searchParams.get('background'), DEFAULT_STREAM_WIDGET_BACKGROUNDS[widgetType]);
      const widgetStyle = normalizeStreamWidgetStyles(runtimeResourceSettings?.streamWidgetStyles)[widgetType];
      if (url.pathname === '/widget') {
        response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
        response.end(streamWidgetHtml(widgetType, token, widgetPreview, widgetTheme, widgetBackground, widgetStyle)); return;
      }
      if (url.pathname === '/widget-snapshot') {
        const clientId = url.searchParams.get('client');
        const isNew = touchPollingClient(streamWidgetPollClients, widgetType, clientId, widgetPreview);
        const snapshot = {
          ...(await streamWidgetSnapshot(widgetType, widgetPreview)),
          theme: normalizeStreamWidgetThemes(runtimeResourceSettings?.streamWidgetThemes)[widgetType],
          background: normalizeStreamWidgetBackgrounds(runtimeResourceSettings?.streamWidgetBackgrounds)[widgetType],
          style: normalizeStreamWidgetStyles(runtimeResourceSettings?.streamWidgetStyles)[widgetType]
        };
        response.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
        response.end(JSON.stringify(snapshot));
        if (isNew) send('widget:status', { widget:widgetType, connected:streamWidgetClientCount(widgetType), totalConnected:streamWidgetClientCount() });
        return;
      }
      const rankingSlot = normalizeRankingSlot(url.searchParams.get('slot'));
      const rankingPreview = url.searchParams.get('preview') === '1';
      if (url.pathname === '/ranking') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(rankingHtml(rankingSlot, token, rankingPreview)); return;
      }
      if (url.pathname === '/ranking-snapshot') {
        const clientId = url.searchParams.get('client');
        const isNew = touchPollingClient(rankingPollClients, rankingSlot, clientId, rankingPreview);
        const snapshot = await rankingSnapshot(rankingSlot, rankingPreview);
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Access-Control-Allow-Origin': '*' });
        response.end(JSON.stringify(snapshot));
        if (isNew) send('ranking:status', { slot: rankingSlot, connected: rankingClientCount(rankingSlot), totalConnected: rankingClientCount() });
        return;
      }
      if (url.pathname === '/ranking-events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-store', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
        response.write(': Lulu Finity ranking\n\n');
        response.__luluPreview = rankingPreview;
        if (!rankingClients.has(rankingSlot)) rankingClients.set(rankingSlot, new Set());
        rankingClients.get(rankingSlot).add(response);
        const initial = await rankingSnapshot(rankingSlot, rankingPreview);
        response.write(`data: ${JSON.stringify(initial)}\n\n`);
        send('ranking:status', { slot: rankingSlot, connected: rankingClientCount(rankingSlot), totalConnected: rankingClientCount() });
        const keepAlive = setInterval(() => { try { response.write(': keepalive\n\n'); } catch {} }, 15000);
        request.on('close', () => { clearInterval(keepAlive); rankingClients.get(rankingSlot)?.delete(response); send('ranking:status', { slot: rankingSlot, connected: rankingClientCount(rankingSlot), totalConnected: rankingClientCount() }); });
        return;
      }
      const screen = normalizeOverlayScreen(url.searchParams.get('screen'));
      if (url.pathname === '/overlay') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(overlayHtml(screen, token)); return;
      }
      if (url.pathname === '/overlay-state') {
        const clientId = url.searchParams.get('client');
        const isNew = touchPollingClient(overlayPollClients, screen, clientId, false);
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Access-Control-Allow-Origin': '*' });
        response.end(JSON.stringify(overlayStateSnapshot(screen)));
        if (isNew) send('overlay:status', { screen, connected: overlayClientCount(screen), totalConnected: overlayClientCount() });
        return;
      }
      if (url.pathname === '/overlay-events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-store', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
        response.write(': Lulu Finity overlay\n\n');
        if (!overlayClients.has(screen)) overlayClients.set(screen, new Set());
        overlayClients.get(screen).add(response);
        send('overlay:status', { screen, connected: overlayClientCount(screen), totalConnected: overlayClientCount() });
        const keepAlive = setInterval(() => { try { response.write(': keepalive\n\n'); } catch {} }, 15000);
        request.on('close', () => { clearInterval(keepAlive); overlayClients.get(screen)?.delete(response); send('overlay:status', { screen, connected: overlayClientCount(screen), totalConnected: overlayClientCount() }); });
        return;
      }
      if (url.pathname.startsWith('/overlay-media/')) {
        const fileName = path.basename(decodeURIComponent(url.pathname.slice('/overlay-media/'.length)));
        const mediaRoot = path.resolve(getDataPaths().media);
        const file = path.resolve(mediaRoot, fileName);
        if (!file.startsWith(`${mediaRoot}${path.sep}`) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
        const ext = path.extname(file).toLowerCase();
        const types = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.bmp':'image/bmp' };
        if (!types[ext]) { response.writeHead(415); response.end(); return; }
        response.writeHead(200, { 'Content-Type': types[ext], 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(file).pipe(response); return;
      }
      response.writeHead(404); response.end();
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end(String(error?.message || error));
    }
  });
  overlayServer.on('clientError', (_error, socket) => { try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch {} });
  let lastError = null;
  for (let port = 17345; port <= 17354; port += 1) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => { overlayServer.off('listening', onListening); reject(error); };
        const onListening = () => { overlayServer.off('error', onError); resolve(); };
        overlayServer.once('error', onError);
        overlayServer.once('listening', onListening);
        overlayServer.listen(port, '127.0.0.1');
      });
      overlayPort = port;
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (error?.code !== 'EADDRINUSE') throw error;
    }
  }
  if (!overlayPort) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => { overlayServer.off('listening', onListening); reject(error); };
        const onListening = () => { overlayServer.off('error', onError); resolve(); };
        overlayServer.once('error', onError);
        overlayServer.once('listening', onListening);
        overlayServer.listen(0, '127.0.0.1');
      });
      overlayPort = Number(overlayServer.address()?.port || 0);
    } catch (error) {
      lastError = error;
    }
  }
  if (!overlayPort) {
    try { overlayServer.close(); } catch {}
    overlayServer = null;
    throw new Error(`No se pudo iniciar el servidor de superposiciones: ${lastError?.message || 'puertos ocupados'}`);
  }
  return overlayPort;
}

async function overlayInfo(screen = 1, forceTunnel = false) {
  activateRuntimeModule('overlays');
  await startOverlayServer();
  const token = await overlayIdentity();
  const normalized = normalizeOverlayScreen(screen);
  const localUrl = overlayUrl(normalized, token, localOverlayBaseUrl());
  const stable = await stableOverlaySourceStatus('screen', String(normalized), forceTunnel);
  const fallback = stable.ok ? null : (forceTunnel ? await ensureOverlayHttpsTunnel(true) : currentOverlayTunnelInfo());
  const tunnel = reportedOverlayTunnel(stable, fallback);
  const url = stable.ok ? stable.url : (tunnel.ok && tunnel.url ? overlayUrl(normalized, token, tunnel.url) : '');
  return {
    ok: Boolean(url),
    screen: normalized,
    url,
    localUrl,
    tunnelStatus: tunnel.status || overlayTunnelStatus.status,
    tunnelMessage: tunnel.message || overlayTunnelStatus.message,
    connected: overlayClientCount(normalized),
    totalConnected: overlayClientCount(),
    port: overlayPort
  };
}

async function showStreamOverlay(details = {}) {
  await startOverlayServer();
  const mediaRoot = path.resolve(getDataPaths().media);
  const mediaPath = path.resolve(String(details.mediaPath || ''));
  if (!mediaPath.startsWith(`${mediaRoot}${path.sep}`) || !fs.existsSync(mediaPath)) return { ok: false, message: 'La imagen o GIF ya no está disponible.' };
  const extension = path.extname(mediaPath).toLowerCase();
  if (!new Set(['.png','.jpg','.jpeg','.webp','.gif','.bmp']).has(extension)) return { ok: false, message: 'Formato de imagen no compatible.' };
  const screen = normalizeOverlayScreen(details.screen);
  const token = await overlayIdentity();
  const clients = overlayClientCount(screen);
  const stable = await stableOverlaySourceStatus('screen', String(screen), false);
  if (!clients && !stable.ok) return { ok: false, message: `La Superposición ${screen} no está conectada al stream. Agrega su enlace HTTPS o local como fuente.` };
  const duration = Math.min(60, Math.max(1, Number(details.duration || 6)));
  const payload = setOverlayState(screen, { type:'show', id: randomUUID(), url:`/overlay-media/${encodeURIComponent(path.basename(mediaPath))}?screen=${screen}&token=${encodeURIComponent(token)}`, duration, expiresAt:Date.now() + duration * 1000, fit:'contain' });
  const delivered = broadcastOverlay(screen, payload);
  if (stable.ok) {
    try { await syncStableOverlaySource('screen', String(screen)); }
    catch (error) { if (!clients) return { ok:false, delivered:0, screen, message:`No se pudo actualizar HTTPS: ${error?.message || error}` }; }
  }
  return { ok: clients > 0 || stable.ok, delivered: Math.max(delivered, clients, stable.ok ? 1 : 0), screen, message: '' };
}

async function stopOverlayServer() {
  await stopOverlayHttpsTunnel().catch(() => {});
  for (const clients of overlayClients.values()) for (const response of clients) { try { response.end(); } catch {} }
  overlayClients.clear();
  overlayPollClients.clear();
  streamWidgetPollClients.clear();
  overlayStates.clear();
  for (const clients of rankingClients.values()) for (const response of clients) { try { response.end(); } catch {} }
  rankingClients.clear();
  rankingPollClients.clear();
  if (!overlayServer) return;
  const server = overlayServer; overlayServer = null; overlayPort = 0;
  await new Promise((resolve) => server.close(() => resolve())).catch(() => {});
}


function sendUpdateStatus(status, extra = {}) {
  send('update:status', {
    status,
    currentVersion: app.getVersion(),
    repositoryUrl: UPDATE_REPOSITORY_URL,
    ...extra
  });
}

function isLikelyInstalledBuild() {
  if (!app.isPackaged || process.platform !== 'win32') return false;

  const executable = path.resolve(process.execPath).toLowerCase();
  const localAppData = String(process.env.LOCALAPPDATA || '').trim();

  if (localAppData) {
    const localPrograms = path.resolve(localAppData, 'Programs').toLowerCase();
    if (executable.startsWith(`${localPrograms}${path.sep}`)) return true;
  }

  // Electron no expone `localAppData` mediante app.getPath(). Esta comprobación
  // evita que la aplicación falle cuando Windows no entrega esa variable.
  const normalized = executable.replace(/\//g, '\\');
  return normalized.includes('\\appdata\\local\\programs\\lulu finity\\')
    || normalized.includes('\\programs\\lulu finity\\');
}

function friendlyUpdateError(error) {
  const message = String(error?.message || error || 'Error desconocido');
  if (/404|latest\.yml|cannot find/i.test(message)) {
    return 'Todavía no hay una versión pública disponible en el repositorio de Lulu Finity.';
  }
  if (/ENOTFOUND|EAI_AGAIN|internet|network|net::/i.test(message)) {
    return 'No se pudo consultar GitHub. Revisa tu conexión a internet.';
  }
  return message.replace(/^Error:\s*/i, '').slice(0, 280);
}

async function promptForAvailableUpdate(info) {
  if (updatePromptOpen || !mainWindow || mainWindow.isDestroyed()) return;
  updatePromptOpen = true;
  try {
    const version = info?.version || 'nueva';
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización de Lulu Finity',
      message: `Lulu Finity ${version} está disponible`,
      detail: isLikelyInstalledBuild()
        ? '¿Quieres instalarla ahora? Se descargará y Lulu Finity se reiniciará automáticamente al terminar.'
        : 'Esta copia fue abierta desde una carpeta ZIP. Se abrirá la página oficial para descargar el instalador nuevo.',
      buttons: ['Actualizar ahora', 'Después'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });

    if (response.response !== 0) {
      sendUpdateStatus('deferred', { version });
      return;
    }

    if (!isLikelyInstalledBuild()) {
      await shell.openExternal(UPDATE_RELEASES_URL);
      sendUpdateStatus('external', { version, message: 'Se abrió la descarga oficial en GitHub.' });
      return;
    }

    installUpdateWhenDownloaded = true;
    sendUpdateStatus('downloading', { version, percent: 0, message: 'Descargando; Lulu Finity se reiniciará automáticamente al terminar.' });
    // Libera el cuadro antes de iniciar la descarga. De otro modo, el evento
    // update-downloaded no podía abrir el instalador hasta entrar a Ajustes.
    updatePromptOpen = false;
    autoUpdater.downloadUpdate().catch((error) => {
      installUpdateWhenDownloaded = false;
      sendUpdateStatus('error', { message: friendlyUpdateError(error) });
    });
    return;
  } catch (error) {
    sendUpdateStatus('error', { message: friendlyUpdateError(error) });
  } finally {
    updatePromptOpen = false;
  }
}

async function promptToInstallDownloadedUpdate(info) {
  if (updatePromptOpen || !mainWindow || mainWindow.isDestroyed()) return;
  updatePromptOpen = true;
  try {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización lista',
      message: `Lulu Finity ${info?.version || ''} ya se descargó`,
      detail: 'Reinicia la aplicación para instalarla. Tus ajustes se conservarán.',
      buttons: ['Reiniciar e instalar', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (response.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
    } else {
      sendUpdateStatus('downloaded', {
        version: info?.version || '',
        message: 'Se instalará al cerrar la aplicación o cuando pulses instalar.'
      });
    }
  } finally {
    updatePromptOpen = false;
  }
}

function initializeUpdater() {
  if (updaterInitialized) return;
  updaterInitialized = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus('checking', { message: 'Buscando versiones nuevas en GitHub…' });
  });
  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('available', {
      version: info?.version || '',
      releaseName: info?.releaseName || '',
      message: `La versión ${info?.version || 'nueva'} está disponible.`
    });
    promptForAvailableUpdate(info).catch((error) => {
      sendUpdateStatus('error', { message: friendlyUpdateError(error) });
    });
  });
  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus('current', {
      version: info?.version || app.getVersion(),
      message: 'Lulu Finity está actualizada.'
    });
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus('downloading', {
      percent: Math.max(0, Math.min(100, Number(progress?.percent || 0))),
      transferred: Number(progress?.transferred || 0),
      total: Number(progress?.total || 0),
      bytesPerSecond: Number(progress?.bytesPerSecond || 0)
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    sendUpdateStatus('downloaded', {
      version: info?.version || '',
      message: installUpdateWhenDownloaded
        ? 'Descarga completa. Reiniciando para instalar…'
        : 'La actualización está lista para instalar.'
    });
    if (installUpdateWhenDownloaded) {
      installUpdateWhenDownloaded = false;
      sendUpdateStatus('installing', { version: info?.version || '', message: 'Cerrando Lulu Finity para instalar la actualización…' });
      setTimeout(() => autoUpdater.quitAndInstall(false, true), 700);
      return;
    }
    promptToInstallDownloadedUpdate(info).catch((error) => {
      sendUpdateStatus('error', { message: friendlyUpdateError(error) });
    });
  });
  autoUpdater.on('error', (error) => {
    sendUpdateStatus('error', {
      message: friendlyUpdateError(error),
      manual: lastUpdateCheckWasManual
    });
  });
}

async function checkForAppUpdates(manual = false) {
  initializeUpdater();
  lastUpdateCheckWasManual = Boolean(manual);
  if (!app.isPackaged) {
    const result = {
      status: 'development',
      currentVersion: app.getVersion(),
      message: 'La búsqueda automática solo funciona en la aplicación instalada.'
    };
    sendUpdateStatus(result.status, result);
    return result;
  }
  if (updateCheckInFlight) {
    return { status: 'checking', currentVersion: app.getVersion() };
  }
  updateCheckInFlight = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      status: result?.updateInfo?.version && result.updateInfo.version !== app.getVersion() ? 'available' : 'current',
      currentVersion: app.getVersion(),
      version: result?.updateInfo?.version || app.getVersion()
    };
  } catch (error) {
    const result = { status: 'error', currentVersion: app.getVersion(), message: friendlyUpdateError(error) };
    sendUpdateStatus('error', result);
    return result;
  } finally {
    updateCheckInFlight = false;
    lastUpdateCheckWasManual = false;
  }
}

async function getEdgeTtsModule() {
  if (!edgeTtsModulePromise) {
    edgeTtsModulePromise = import('edge-tts-universal').catch((error) => {
      edgeTtsModulePromise = null;
      throw error;
    });
  }
  return edgeTtsModulePromise;
}

let onlineVoiceCatalogCache = null;

function onlineVoiceCatalogCachePath() {
  return path.join(app.getPath('userData'), 'online-voice-catalog-v1.json');
}

async function readOnlineVoiceCatalogCache() {
  try {
    const data = JSON.parse(await fsp.readFile(onlineVoiceCatalogCachePath(), 'utf8'));
    const {prepareOnlineVoices}=getOnlineVoiceCatalog();
    const voices = prepareOnlineVoices(data?.voices);
    return voices.length ? voices : [];
  } catch {
    return [];
  }
}

async function writeOnlineVoiceCatalogCache(voices) {
  try {
    await fsp.writeFile(onlineVoiceCatalogCachePath(), JSON.stringify({ updatedAt: Date.now(), voices }), 'utf8');
  } catch (error) {
    console.warn('No se pudo guardar el catálogo de voces:', error?.message || error);
  }
}

async function listOnlineVoices(options = {}) {
  const refresh = Boolean(options?.refresh);
  if (!refresh && onlineVoiceCatalogCache?.length) {
    return { voices: onlineVoiceCatalogCache, fallback: false, cached: true };
  }
  try {
    const module = await getEdgeTtsModule();
    const listVoices = module.listVoices || module.default?.listVoices;
    if (typeof listVoices !== 'function') throw new Error('El proveedor no expuso la lista de voces.');
    const {prepareOnlineVoices}=getOnlineVoiceCatalog();
    const voices = prepareOnlineVoices(await listVoices());
    if (!voices.length) throw new Error('El proveedor devolvió un catálogo vacío.');
    onlineVoiceCatalogCache = voices;
    await writeOnlineVoiceCatalogCache(voices);
    return { voices, fallback: false, cached: false };
  } catch (error) {
    console.warn('No se pudo cargar la lista de voces online:', error?.message || error);
    const savedVoices = await readOnlineVoiceCatalogCache();
    if (savedVoices.length) {
      onlineVoiceCatalogCache = savedVoices;
      return { voices: savedVoices, fallback: true, cached: true, message: friendlyUpdateError(error) };
    }
    const {FALLBACK_ONLINE_VOICES}=getOnlineVoiceCatalog();
    return { voices: FALLBACK_ONLINE_VOICES, fallback: true, cached: false, message: friendlyUpdateError(error) };
  }
}

function percentFromRate(rate) {
  const value = Math.max(0.5, Math.min(2, Number(rate) || 1));
  const percent = Math.round((value - 1) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

function hertzFromPitch(pitch) {
  const value = Math.max(0.5, Math.min(2, Number(pitch) || 1));
  const hertz = Math.round((value - 1) * 50);
  return `${hertz >= 0 ? '+' : ''}${hertz}Hz`;
}

async function synthesizeOnlineVoice(request) {
  const text = String(request?.text || '').trim().slice(0, 500);
  const voice = String(request?.voice || '').trim();
  if (!text) throw new Error('No hay texto para leer.');
  if (!voice || !/^[A-Za-z0-9-]+Neural$/.test(voice)) {
    throw new Error('La voz online seleccionada no es válida.');
  }

  const module = await getEdgeTtsModule();
  const EdgeTTS = module.EdgeTTS || module.default?.EdgeTTS;
  if (typeof EdgeTTS !== 'function') throw new Error('El motor de voces online no está disponible.');
  const engine = new EdgeTTS(text, voice, {
    rate: percentFromRate(request?.rate),
    pitch: hertzFromPitch(request?.pitch),
    volume: '+0%'
  });
  const result = await engine.synthesize();
  if (!result?.audio || typeof result.audio.arrayBuffer !== 'function') {
    throw new Error('El proveedor no devolvió audio.');
  }
  const buffer = Buffer.from(await result.audio.arrayBuffer());
  if (!buffer.length) throw new Error('La voz online devolvió audio vacío.');
  if (buffer.length > 8 * 1024 * 1024) throw new Error('El audio generado es demasiado grande.');
  return {
    mimeType: result.audio.type || 'audio/mpeg',
    data: buffer.toString('base64'),
    bytes: buffer.length
  };
}

const TIKTOK_TTS_COOKIE_NAMES = new Set(['sessionid', 'sessionid_ss', 'sid_tt', 'passport_csrf_token']);
const BALANCED_KEEP_ACTIVE_KEYS = Object.freeze(['live','account','voice','music','overlays','rankings','automations','commands','games','economy']);

function normalizeBalancedKeepActive(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(BALANCED_KEEP_ACTIVE_KEYS.map((key) => [key, source[key] === true]));
}

function normalizeVoiceSettings(settings = {}) {
  const next = { ...settings };
  const retired = next.localVoiceId === 'lulu-official';
  if (retired) next.voiceMode = 'online';
  if (!['tiktok', 'online', 'local', 'system'].includes(next.voiceMode)) next.voiceMode = 'local';
  if (!/^[A-Za-z0-9_]{3,80}$/.test(String(next.tiktokVoice||''))) next.tiktokVoice = 'es_mx_002';
  if (!/^[A-Za-z0-9-]+Neural$/.test(String(next.onlineVoice || ''))) next.onlineVoice = 'es-MX-DaliaNeural';
  next.userVoiceRules = (Array.isArray(next.userVoiceRules) ? next.userVoiceRules : []).map((rule) => {
    const voice = String(rule?.voice || '');
    if (voice === 'local:lulu-official') return { ...rule, voice: `online:${next.onlineVoice}` };
    return rule;
  });
  next.balancedKeepActive = normalizeBalancedKeepActive(next.balancedKeepActive);
  return next;
}

runtimeResourceSettings = normalizeVoiceSettings(DEFAULT_SETTINGS);

async function removeRetiredVoiceEngine() {
  const retiredRoot = path.join(app.getPath('userData'), 'lulu-local-engines', 'lulu-official');
  await fsp.rm(retiredRoot, { recursive: true, force: true }).catch(() => {});
}

async function getTikTokTtsCookieHeader() {
  const chatSession = session.fromPartition(TIKTOK_CHAT_PARTITION);
  const cookies = await chatSession.cookies.get({ url: 'https://www.tiktok.com/' });
  const allowed = cookies.filter((cookie) => TIKTOK_TTS_COOKIE_NAMES.has(cookie.name) && cookie.value);
  const sessionCookie = allowed.find((cookie) => cookie.name === 'sessionid')
    || allowed.find((cookie) => cookie.name === 'sessionid_ss')
    || allowed.find((cookie) => cookie.name === 'sid_tt');
  if (!sessionCookie) throw new Error('Enlaza tu cuenta en Cuenta → TikTok antes de usar las voces de TikTok.');
  const values = new Map(allowed.map((cookie) => [cookie.name, String(cookie.value).replace(/[;\r\n]/g, '')]));
  if (!values.has('sessionid')) values.set('sessionid', String(sessionCookie.value).replace(/[;\r\n]/g, ''));
  return [...values].map(([name, value]) => `${name}=${value}`).join('; ');
}

function listTikTokVoices() {
  const {TIKTOK_VOICES}=getTikTokVoiceCatalog();
  return { voices: TIKTOK_VOICES, provider: 'tiktok', requiresAccount: true };
}

async function synthesizeTikTokVoice(request = {}) {
  const cookie = await getTikTokTtsCookieHeader();
  const {requestTikTokSpeech}=getTikTokTtsClient();
  return requestTikTokSpeech({ text: request?.text, voice: request?.voice, cookie });
}

function cleanUsername(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, '')
    .replace(/\/live.*$/i, '')
    .replace(/^@/, '')
    .trim();
}

function normalizeRelayWebSocketUrl(value) {
  const raw = String(value || '').trim().slice(0, 1000);
  if (!raw) return '';
  const withProtocol = /^[a-z]+:\/\//i.test(raw) ? raw : `wss://${raw}`;
  const normalizedProtocol = withProtocol.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  let parsed;
  try { parsed = new URL(normalizedProtocol); }
  catch { throw new Error('La URL del servidor Railway no es válida.'); }
  if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new Error('El servidor Railway debe usar ws:// o wss://.');
  if (!parsed.hostname) throw new Error('La URL del servidor Railway no incluye dominio.');
  if (!parsed.pathname || parsed.pathname === '/') parsed.pathname = DEFAULT_RELAY_PATH;
  parsed.hash = '';
  return parsed.toString();
}

function isYoutubeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
  } catch {
    return false;
  }
}

function youtubeTarget(rawQuery, suffix = '') {
  const query = String(rawQuery || '').trim().slice(0, 180);
  if (!query) return 'https://www.youtube.com/';
  if (isYoutubeUrl(query)) return query;
  const fullQuery = [query, String(suffix || '').trim()].filter(Boolean).join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(fullQuery)}`;
}


function youtubeUrlKind(value) {
  try {
    const url = new URL(String(value || ''));
    if (!isYoutubeUrl(url.href)) return 'other';
    if (url.pathname === '/results') return 'search';
    if (url.pathname === '/watch' || url.hostname.toLowerCase().replace(/^www\./, '') === 'youtu.be') return 'watch';
    return 'home';
  } catch {
    return 'other';
  }
}

function withYoutubeAutoplay(value) {
  try {
    const url = new URL(String(value || ''));
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      if (id) return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&autoplay=1`;
    }
    if (url.pathname === '/watch') url.searchParams.set('autoplay', '1');
    return url.href;
  } catch {
    return value;
  }
}



async function openExternalUrl(url) {
  const target = String(url || '').trim();
  if (!target) return { ok:false, url:'' };
  await shell.openExternal(target);
  return { ok:true, url:target };
}

function installYoutubeAdBlocker() {
  if (youtubeAdBlockInstalled) return;
  youtubeAdBlockInstalled = true;
  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);
  // Respaldo local inmediato: funciona incluso si las listas avanzadas todavía no cargaron.
  const filters = {
    urls: [
      '*://*.doubleclick.net/*',
      '*://*.googlesyndication.com/*',
      '*://*.googleadservices.com/*',
      '*://*.googletagservices.com/*',
      '*://*.adservice.google.com/*',
      '*://*.imasdk.googleapis.com/*',
      '*://*.2mdn.net/*',
      '*://*.google.com/pagead/*',
    ]
  };
  youtubeSession.webRequest.onBeforeRequest(filters, (_details, callback) => {
    callback({ cancel: youtubeAdBlockEnabled });
  });
}

async function ensureYoutubeNetworkAdBlocker() {
  installYoutubeAdBlocker();
  if (!youtubeAdBlockEnabled) return null;
  const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);

  if (youtubeFilterEngine) {
    if (!youtubeFilterEngineEnabled) {
      try {
        youtubeFilterEngine.enableBlockingInSession(youtubeSession);
        youtubeFilterEngineEnabled = true;
      } catch (error) {
        console.warn('No se pudo reactivar el anti anuncios avanzado:', error?.message || error);
      }
    }
    return youtubeFilterEngine;
  }

  if (!youtubeFilterEnginePromise) {
    youtubeFilterEnginePromise = (async () => {
      try {
        const module = await import('@ghostery/adblocker-electron');
        const ElectronBlocker = module.ElectronBlocker || module.default?.ElectronBlocker;
        if (!ElectronBlocker) throw new Error('ElectronBlocker no está disponible.');

        const cacheDirectory = path.join(app.getPath('userData'), 'adblock');
        const cachePath = path.join(cacheDirectory, 'youtube-ads.bin');
        await fsp.mkdir(cacheDirectory, { recursive: true });
        const blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
          path: cachePath,
          read: (file) => fsp.readFile(file),
          write: (file, data) => fsp.writeFile(file, data)
        });

        youtubeFilterEngine = blocker;
        if (youtubeAdBlockEnabled) {
          blocker.enableBlockingInSession(youtubeSession);
          youtubeFilterEngineEnabled = true;
        }
        console.info('Anti anuncios avanzado de YouTube activo (filtros EasyList/uBlock).');
        return blocker;
      } catch (error) {
        console.warn('Anti anuncios avanzado no disponible; se mantiene el bloqueo integrado:', error?.message || error);
        return null;
      }
    })();
  }
  return youtubeFilterEnginePromise;
}

function setYoutubeNetworkAdBlockEnabled(enabled) {
  youtubeAdBlockEnabled = Boolean(enabled);
  if (!youtubeAdBlockEnabled) {
    setYoutubeAdGuardMuted(false);
    if (youtubeFilterEngine && youtubeFilterEngineEnabled) {
      const youtubeSession = session.fromPartition(YOUTUBE_PARTITION);
      try { youtubeFilterEngine.disableBlockingInSession(youtubeSession); } catch {}
      youtubeFilterEngineEnabled = false;
    }
    return;
  }
  if (youtubeWindow && !youtubeWindow.isDestroyed()) void ensureYoutubeNetworkAdBlocker();
}

function setYoutubeAdGuardMuted(active) {
  youtubeAdGuardMuted = youtubeAdBlockEnabled && Boolean(active);
  if (!youtubeWindow || youtubeWindow.isDestroyed()) return;
  youtubeWindow.webContents.setAudioMuted(Boolean(youtubeMuted || youtubeAdGuardMuted));
}

async function readLimitedResponseBody(response, maximumBytes) {
  const limit = Math.max(1, Number(maximumBytes) || 1);
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error('El servidor no entregó una respuesta legible.');
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value || []);
    total += chunk.length;
    if (total > limit) {
      await reader.cancel('response-too-large').catch(() => {});
      throw new Error('El contador enviado por el servidor es demasiado grande.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function fetchRelayUsage(username = '') {
  const url = new URL(RELAY_USAGE_URL);
  const clean = cleanTikTokChatUsername(username);
  if (clean) url.searchParams.set('uniqueId', clean);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': `Lulu-Finity/${app.getVersion()}` },
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
    const responseUrl = new URL(response.url);
    if (responseUrl.origin !== url.origin || responseUrl.pathname !== url.pathname) {
      throw new Error('El servidor intentó redirigir la consulta de uso.');
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > 32 * 1024) throw new Error('El contador enviado por el servidor es demasiado grande.');
    const body = await readLimitedResponseBody(response, 32 * 1024);
    if (!body.length) throw new Error('El contador enviado por el servidor no tiene un tamaño válido.');
    let usage;
    try { usage = JSON.parse(body.toString('utf8')); }
    catch { throw new Error('El servidor no entregó JSON válido para el contador.'); }
    return sanitizeRelayUsage(usage);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('El servidor de uso tardó demasiado en responder.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


function cleanTikTokChatUsername(value) {
  return String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
}

function tiktokChatTarget(username = '') {
  const clean = cleanTikTokChatUsername(username);
  return clean ? `https://www.tiktok.com/@${encodeURIComponent(clean)}/live` : 'https://www.tiktok.com/live';
}

function isTikTokChatUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && /(^|\.)tiktok\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function tikTokOriginSummary(value = '') {
  try {
    const url = new URL(String(value || ''));
    const official = url.protocol === 'https:' && /(^|\.)tiktok\.com$/i.test(url.hostname);
    return { officialDomain: official, displayOrigin: official ? `https://${url.hostname}` : '' };
  } catch {
    return { officialDomain: false, displayOrigin: '' };
  }
}

async function getTikTokSessionSummary() {
  const chatSession = session.fromPartition(TIKTOK_CHAT_PARTITION);
  const cookies = await chatSession.cookies.get({ url: 'https://www.tiktok.com/' }).catch(() => []);
  return {
    sessionStored: cookies.some((cookie) => ['sessionid','sessionid_ss','sid_tt'].includes(cookie.name) && cookie.value),
    storageScope: 'local',
    permissionsBlocked: true
  };
}

function hardenTikTokSession(chatSession) {
  if (tiktokSessionSecurityInstalled) return;
  tiktokSessionSecurityInstalled = true;
  chatSession.setPermissionCheckHandler(() => false);
  chatSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  chatSession.on('will-download', (event) => event.preventDefault());
}
function emitTikTokChatStatus(extra = {}) {
  const open = Boolean(tiktokChatWindow && !tiktokChatWindow.isDestroyed());
  const currentUrl = open ? tiktokChatWindow.webContents.getURL() : '';
  const payload = {
    open,
    visible: Boolean(open && tiktokChatWindow.isVisible()),
    url: currentUrl,
    ...tikTokOriginSummary(currentUrl),
    storageScope: 'local',
    permissionsBlocked: true,
    ...extra
  };
  send('tiktok-chat:status', payload);
  return payload;
}

async function inspectTikTokChatWindow() {
  const sessionSummary = await getTikTokSessionSummary();
  if (!tiktokChatWindow || tiktokChatWindow.isDestroyed()) return { open: false, ready: false, loggedIn:sessionSummary.sessionStored, message:sessionSummary.sessionStored ? 'La sesión está guardada de forma local. Abre TikTok para comprobarla.' : 'Abre el sitio oficial de TikTok e inicia sesión.', ...sessionSummary };
  try {
    const result = await tiktokChatWindow.webContents.executeJavaScript(`(() => {
      const visible = (element) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const selectors = [
        '[data-e2e="comment-input"] [contenteditable="true"]',
        '[data-e2e="comment-input"][contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea[placeholder*="comment" i]',
        'textarea[placeholder*="coment" i]',
        'input[placeholder*="comment" i]',
        'input[placeholder*="coment" i]'
      ];
      const input = selectors.map((selector) => document.querySelector(selector)).find(visible) || null;
      const loginVisible = [...document.querySelectorAll('button,a')].some((element) => visible(element) && /^(log in|login|iniciar sesi[oó]n|acceder)$/i.test((element.innerText || element.textContent || '').trim()));
      const livePage = /\/live(?:[/?#]|$)/i.test(location.pathname + location.search + location.hash);
      return {
        ready: Boolean(input && livePage),
        loggedIn: Boolean(input || !loginVisible),
        requiresLogin: Boolean(!input && loginVisible),
        livePage,
        title: document.title || '',
        message: input && livePage ? 'Sesión lista para enviar mensajes.' : (loginVisible ? 'Inicia sesión dentro del sitio oficial de TikTok.' : (livePage ? 'Abre el chat del LIVE y espera a que termine de cargar.' : 'Abre el LIVE del creador para preparar el chat.'))
      };
    })()`, true);
    const currentUrl = tiktokChatWindow.webContents.getURL();
    return { open:true, ...result, ...sessionSummary, ...tikTokOriginSummary(currentUrl), url:currentUrl };
  } catch (error) {
    const currentUrl = tiktokChatWindow.webContents.getURL();
    return { open:true, ready:false, loggedIn:sessionSummary.sessionStored, message:error?.message || 'No se pudo revisar la sesión de TikTok.', ...sessionSummary, ...tikTokOriginSummary(currentUrl), url:currentUrl };
  }
}

function createTikTokChatWindow(username = '') {
  if (tiktokChatWindow && !tiktokChatWindow.isDestroyed()) return tiktokChatWindow;
  const chatSession = session.fromPartition(TIKTOK_CHAT_PARTITION);
  hardenTikTokSession(chatSession);
  tiktokChatWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 780,
    minHeight: 580,
    title: 'Sitio oficial de TikTok — Lulu Finity',
    backgroundColor: '#0f0f0f',
    autoHideMenuBar: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: TIKTOK_CHAT_PARTITION
    }
  });
  tiktokChatWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    tiktokChatWindow.hide();
    emitTikTokChatStatus({ message: 'La sesión sigue abierta en segundo plano.' });
  });
  tiktokChatWindow.on('closed', () => {
    tiktokChatWindow = null;
    emitTikTokChatStatus({ ready: false, message: 'Ventana de TikTok cerrada.' });
  });
  tiktokChatWindow.webContents.on('page-title-updated', (event) => { event.preventDefault(); const origin=tikTokOriginSummary(tiktokChatWindow.webContents.getURL()); tiktokChatWindow.setTitle(origin.officialDomain ? `Sitio oficial · ${origin.displayOrigin} — Lulu Finity` : 'Navegación bloqueada — Lulu Finity'); });
  tiktokChatWindow.webContents.on('will-navigate', (event, url) => { if (isTikTokChatUrl(url)) return; event.preventDefault(); if (/^https:\/\//i.test(url)) shell.openExternal(url); emitTikTokChatStatus({ ready:false, message:'Lulu bloqueó una navegación fuera de TikTok. Se abrió en tu navegador.', officialDomain:false }); });
  tiktokChatWindow.webContents.on('did-finish-load', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));
  tiktokChatWindow.webContents.on('did-navigate', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));
  tiktokChatWindow.webContents.on('did-navigate-in-page', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));
  tiktokChatWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    emitTikTokChatStatus({ ready: false, message: `${description} (${code})`, url });
  });
  tiktokChatWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTikTokChatUrl(url)) tiktokChatWindow.loadURL(url).catch(() => {});
    else if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  const target = tiktokChatTarget(username);
  tiktokChatWindow.loadURL(target).catch((error) => emitTikTokChatStatus({ ready: false, message: error.message || String(error) }));
  return tiktokChatWindow;
}

async function openTikTokChat(username = '') {
  const win = createTikTokChatWindow(username);
  const target = tiktokChatTarget(username);
  const current = win.webContents.getURL();
  if (!isTikTokChatUrl(current) || (cleanTikTokChatUsername(username) && !current.toLowerCase().includes(`/@${cleanTikTokChatUsername(username).toLowerCase()}/live`))) {
    await win.loadURL(target);
  }
  win.show();
  win.focus();
  const status = await inspectTikTokChatWindow();
  return emitTikTokChatStatus(status);
}

async function waitForTikTokChatLoad(win, timeoutMs = 15000) {
  if (!win.webContents.isLoadingMainFrame()) return;
  await Promise.race([
    new Promise((resolve) => win.webContents.once('did-finish-load', resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

async function sendTikTokChatMessage(details = {}) {
  const message = String(details.message || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  if (!message) return { ok: false, reason: 'empty', message: 'El mensaje está vacío.' };
  const username = cleanTikTokChatUsername(details.username);
  const cooldownSeconds = Math.max(5, Math.min(120, Number(details.cooldownSeconds || 8)));
  tiktokChatSendChain = tiktokChatSendChain.catch(() => {}).then(async () => {
    const elapsed = Date.now() - tiktokChatLastSentAt;
    const waitMs = cooldownSeconds * 1000 - elapsed;
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    if (message === tiktokChatLastMessage && Date.now() - tiktokChatLastSentAt < 60_000) {
      return { ok: false, reason: 'duplicate', message: 'Se evitó enviar el mismo mensaje dos veces seguidas.' };
    }

    const win = createTikTokChatWindow(username);
    const target = tiktokChatTarget(username);
    const current = win.webContents.getURL();
    if (!isTikTokChatUrl(current) || (username && !current.toLowerCase().includes(`/@${username.toLowerCase()}/live`))) {
      await win.loadURL(target);
    }
    await waitForTikTokChatLoad(win);

    let lastResult = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      lastResult = await win.webContents.executeJavaScript(`(async () => {
        const message = ${JSON.stringify(message)};
        const visible = (element) => {
          if (!element) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const selectors = [
          '[data-e2e="comment-input"] [contenteditable="true"]',
          '[data-e2e="comment-input"][contenteditable="true"]',
          'div[contenteditable="true"][role="textbox"]',
          'textarea[placeholder*="comment" i]',
          'textarea[placeholder*="coment" i]',
          'input[placeholder*="comment" i]',
          'input[placeholder*="coment" i]'
        ];
        const input = selectors.map((selector) => document.querySelector(selector)).find(visible) || null;
        const loginVisible = [...document.querySelectorAll('button,a')].some((element) => visible(element) && /^(log in|login|iniciar sesi[oó]n|acceder)$/i.test((element.innerText || element.textContent || '').trim()));
        if (!input) return { ok:false, ready:false, requiresLogin:loginVisible, message:loginVisible ? 'Inicia sesión con la cuenta creadora.' : 'No se encontró el campo de chat del LIVE.' };
        input.focus();
        if (input.isContentEditable) {
          try { document.execCommand('selectAll', false, null); document.execCommand('insertText', false, message); } catch {}
          if ((input.innerText || input.textContent || '').trim() !== message) input.textContent = message;
        } else {
          const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (setter) setter.call(input, message); else input.value = message;
        }
        input.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:message }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
        await new Promise((resolve) => setTimeout(resolve, 160));
        const sendSelectors = [
          '[data-e2e="comment-post"]',
          '[data-e2e*="comment-post"]',
          'button[aria-label*="send" i]',
          'button[aria-label*="enviar" i]',
          'button[type="submit"]'
        ];
        let button = sendSelectors.map((selector) => document.querySelector(selector)).find((element) => visible(element) && !element.disabled) || null;
        if (!button) {
          button = [...document.querySelectorAll('button')].find((element) => visible(element) && !element.disabled && /^(send|enviar|publicar)$/i.test((element.innerText || element.textContent || element.getAttribute('aria-label') || '').trim())) || null;
        }
        if (button) button.click();
        else {
          for (const type of ['keydown','keypress','keyup']) input.dispatchEvent(new KeyboardEvent(type, { key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true, cancelable:true }));
        }
        await new Promise((resolve) => setTimeout(resolve, 220));
        return { ok:true, ready:true, method:button ? 'button' : 'enter' };
      })()`, true);
      if (lastResult?.ok) break;
      if (lastResult?.requiresLogin) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!lastResult?.ok) {
      const status = await inspectTikTokChatWindow();
      emitTikTokChatStatus({ ...status, ready: false, message: lastResult?.message || status.message });
      return { ok: false, reason: lastResult?.requiresLogin ? 'login' : 'not-ready', message: lastResult?.message || 'El chat de TikTok todavía no está listo.' };
    }
    tiktokChatLastSentAt = Date.now();
    tiktokChatLastMessage = message;
    emitTikTokChatStatus({ ready: true, loggedIn: true, message: 'Mensaje enviado desde la cuenta iniciada en TikTok.', lastSentAt: tiktokChatLastSentAt });
    return { ok: true, message, sentAt: tiktokChatLastSentAt };
  });
  return tiktokChatSendChain;
}

async function resetTikTokChatSession() {
  if (tiktokChatWindow && !tiktokChatWindow.isDestroyed()) {
    tiktokChatWindow.removeAllListeners('close');
    tiktokChatWindow.destroy();
    tiktokChatWindow = null;
  }
  const chatSession = session.fromPartition(TIKTOK_CHAT_PARTITION);
  await chatSession.clearStorageData();
  await chatSession.clearCache().catch(() => {});
  tiktokChatLastSentAt = 0;
  tiktokChatLastMessage = '';
  return emitTikTokChatStatus({ ready: false, loggedIn: false, message: 'Sesión eliminada. Abre TikTok para iniciar sesión nuevamente.' });
}

function createYoutubeResolverWindow() {
  if (youtubeResolverWindow && !youtubeResolverWindow.isDestroyed()) return youtubeResolverWindow;
  installYoutubeAdBlocker();
  youtubeResolverWindow = new BrowserWindow({
    width: 960,
    height: 720,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
      partition: YOUTUBE_PARTITION
    }
  });
  youtubeResolverWindow.webContents.setAudioMuted(true);
  youtubeResolverWindow.on('closed', () => { youtubeResolverWindow = null; });
  youtubeResolverWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return youtubeResolverWindow;
}

async function findFirstOrganicYoutubeResult(win) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const result = await win.webContents.executeJavaScript(`(() => {
        const adContainers = [
          'ytd-promoted-video-renderer', 'ytd-display-ad-renderer', 'ytd-ad-slot-renderer',
          'ytd-promoted-sparkles-web-renderer', 'ytd-in-feed-ad-layout-renderer',
          '[is-ad]', '[data-is-ad="true"]'
        ].join(',');
        const adWords = /^(ad|ads|advertisement|sponsored|anuncio|anuncios|publicidad|patrocinado|promocionado)$/i;
        const renderers = [...document.querySelectorAll('ytd-search ytd-video-renderer, ytd-video-renderer')];
        for (const renderer of renderers) {
          if (renderer.closest(adContainers) || renderer.querySelector(adContainers)) continue;
          const badges = [...renderer.querySelectorAll('ytd-badge-supported-renderer, badge-shape, [aria-label]')]
            .map((node) => (node.getAttribute('aria-label') || node.textContent || '').trim())
            .filter(Boolean);
          if (badges.some((text) => adWords.test(text))) continue;
          const anchor = renderer.querySelector('a#thumbnail[href*="/watch"], a.ytd-thumbnail[href*="/watch"]');
          if (!anchor?.href) continue;
          const titleNode = renderer.querySelector('#video-title, h3 a');
          const channelNode = renderer.querySelector('ytd-channel-name a, #channel-name a');
          return {
            url: anchor.href,
            title: (titleNode?.textContent || '').trim(),
            channel: (channelNode?.textContent || '').trim()
          };
        }
        return null;
      })()`, true);
      if (result?.url) return result;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
  throw new Error('No se encontró un resultado normal de YouTube.');
}

function scheduleYoutubeResolverRelease(){
  clearTimeout(youtubeResolverIdleTimer);
  youtubeResolverIdleTimer=setTimeout(()=>{ if(youtubeResolverWindow&&!youtubeResolverWindow.isDestroyed()) youtubeResolverWindow.destroy(); youtubeResolverWindow=null; youtubeResolverIdleTimer=null; },15000);
  youtubeResolverIdleTimer.unref?.();
}

async function resolveYoutubeRequest(rawQuery, suffix = '') {
  await ensureYoutubeNetworkAdBlocker();
  const query = String(rawQuery || '').trim().slice(0, 180);
  if (!query) throw new Error('Falta la canción.');
  if (isYoutubeUrl(query) && youtubeUrlKind(query) === 'watch') {
    return { url: withYoutubeAutoplay(query), title: '', channel: '', query };
  }
  const searchUrl = youtubeTarget(query, suffix);
  const run = async () => {
    const win = createYoutubeResolverWindow();
    await withTimeout(win.loadURL(searchUrl), 18000, 'YouTube tardó demasiado en abrir la búsqueda.');
    const result = await findFirstOrganicYoutubeResult(win);
    return { ...result, url: withYoutubeAutoplay(result.url), query };
  };
  const task = youtubeResolveChain.then(run, run);
  const settled = task.finally(scheduleYoutubeResolverRelease);
  youtubeResolveChain = settled.catch(() => {});
  return settled;
}

function clearYoutubeAutomation() {
  youtubeAutomationNonce += 1;
  if (youtubeAutomationTimer) clearTimeout(youtubeAutomationTimer);
  youtubeAutomationTimer = null;
}

function scheduleYoutubeAutomation(url) {
  if (!youtubeWindow || youtubeWindow.isDestroyed()) return;
  const kind = youtubeUrlKind(url);
  const nonce = ++youtubeAutomationNonce;
  if (youtubeAutomationTimer) clearTimeout(youtubeAutomationTimer);
  const delay = kind === 'watch' ? 20 : 350;
  if (kind === 'watch' && youtubeAdBlockEnabled) setYoutubeAdGuardMuted(true);
  youtubeAutomationTimer = setTimeout(() => {
    youtubeAutomationTimer = null;
    if (kind === 'search') selectFirstOrganicYoutubeResult(nonce, 0);
    if (kind === 'watch') installYoutubePlaybackWatcher(nonce, 0);
  }, delay);
}

async function selectFirstOrganicYoutubeResult(nonce, attempt) {
  if (nonce !== youtubeAutomationNonce || !youtubeWindow || youtubeWindow.isDestroyed()) return;
  try {
    const result = await youtubeWindow.webContents.executeJavaScript(`(() => {
      const adContainers = [
        'ytd-promoted-video-renderer',
        'ytd-display-ad-renderer',
        'ytd-ad-slot-renderer',
        'ytd-promoted-sparkles-web-renderer',
        'ytd-in-feed-ad-layout-renderer',
        '[is-ad]',
        '[data-is-ad="true"]'
      ].join(',');
      const adWords = /^(ad|ads|advertisement|sponsored|anuncio|anuncios|publicidad|patrocinado|promocionado)$/i;
      const renderers = [...document.querySelectorAll('ytd-search ytd-video-renderer, ytd-video-renderer')];
      for (const renderer of renderers) {
        if (renderer.closest(adContainers) || renderer.querySelector(adContainers)) continue;
        const badges = [...renderer.querySelectorAll('ytd-badge-supported-renderer, badge-shape, [aria-label]')]
          .map((node) => (node.getAttribute('aria-label') || node.textContent || '').trim())
          .filter(Boolean);
        if (badges.some((text) => adWords.test(text))) continue;
        const anchor = renderer.querySelector('a#thumbnail[href*="/watch"], a.ytd-thumbnail[href*="/watch"]');
        if (!anchor?.href) continue;
        const titleNode = renderer.querySelector('#video-title, h3 a');
        return { url: anchor.href, title: (titleNode?.textContent || '').trim() };
      }
      return null;
    })()`, true);

    if (nonce !== youtubeAutomationNonce) return;
    if (result?.url) {
      const target = withYoutubeAutoplay(result.url);
      send('youtube:selected', { url: target, title: result.title || '', organic: true });
      await youtubeWindow.loadURL(target);
      return;
    }
  } catch (error) {
    console.warn('No se pudo seleccionar el resultado de YouTube:', error?.message || error);
  }

  if (attempt < 24 && nonce === youtubeAutomationNonce) {
    youtubeAutomationTimer = setTimeout(() => selectFirstOrganicYoutubeResult(nonce, attempt + 1), 600);
    return;
  }

  if (nonce === youtubeAutomationNonce) {
    send('youtube:unavailable', {
      message: 'No se encontró un resultado normal de video. La solicitud se omitirá automáticamente.'
    });
  }
}

async function installYoutubePlaybackWatcher(nonce, attempt) {
  if (nonce !== youtubeAutomationNonce || !youtubeWindow || youtubeWindow.isDestroyed()) return;
  try {
    const installed = await youtubeWindow.webContents.executeJavaScript(`(() => {
      if (window.__tvsPlaybackCleanup) window.__tvsPlaybackCleanup();
      let video = null;
      let endedSent = false;
      let playStarted = false;
      let contentDuration = 0;
      let lastContentTime = 0;
      let listeners = null;
      let lastPlayerReport = 0;
      let lastAdState = true;
      let adClearSince = 0;
      let observer = null;
      let userPauseUntil = 0;
      const elementIsVisible = (element) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
      };
      const playerIsShowingAd = () => {
        const player = document.querySelector('.html5-video-player');
        const visibleAdControl = [...document.querySelectorAll('.ytp-ad-player-overlay, .ytp-ad-preview-container, .ytp-ad-skip-button, .ytp-skip-ad-button')].some(elementIsVisible);
        return Boolean(
          player?.classList.contains('ad-showing') ||
          player?.classList.contains('ad-interrupting') ||
          visibleAdControl
        );
      };
      const noteUserPauseGesture = (event) => {
        if (!event.isTrusted) return;
        if (event.type === 'click' && event.target?.closest?.('.ytp-play-button, button[aria-label*="Pause" i], button[aria-label*="Pausa" i], button[aria-label*="Play" i], button[aria-label*="Reproducir" i]')) userPauseUntil = Date.now() + 1800;
        if (event.type === 'keydown' && [' ', 'k', 'K'].includes(event.key) && !event.target?.matches?.('input, textarea, [contenteditable="true"]')) userPauseUntil = Date.now() + 1800;
      };
      document.addEventListener('click', noteUserPauseGesture, true);
      document.addEventListener('keydown', noteUserPauseGesture, true);
      const reportAdState = () => {
        const ad = playerIsShowingAd();
        if (ad) {
          adClearSince = 0;
          if (lastAdState !== true) {
            lastAdState = true;
            console.info('__LULU_AD_STATE__:${nonce}:1');
          }
          return true;
        }
        if (!adClearSince) adClearSince = Date.now();
        if (lastAdState !== false && Date.now() - adClearSince >= 220) {
          lastAdState = false;
          console.info('__LULU_AD_STATE__:${nonce}:0');
        }
        return false;
      };
      const disableYouTubeAutoplay = () => {
        const toggle = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
        if (toggle) toggle.click();
      };
      const skipYouTubeAds = () => {
        const adContainers = [
          'ytd-display-ad-renderer', 'ytd-promoted-video-renderer', 'ytd-ad-slot-renderer',
          'ytd-in-feed-ad-layout-renderer', 'ytd-promoted-sparkles-web-renderer',
          '#player-ads', '.ytp-ad-overlay-container', 'ytd-companion-slot-renderer'
        ];
        for (const selector of adContainers) document.querySelectorAll(selector).forEach((node) => node.remove());
        const showingAd = reportAdState();
        if (!showingAd) {
          if (video && video.playbackRate > 2) video.playbackRate = 1;
          return false;
        }
        const skipSelectors = [
          '.ytp-ad-skip-button', '.ytp-skip-ad-button', '.ytp-ad-skip-button-modern',
          'button[class*="ytp-ad-skip"]', '#skip-button button', 'ytd-button-renderer#skip-button button',
          'button[data-testid*="skip" i]'
        ];
        let clicked = false;
        for (const selector of skipSelectors) {
          for (const button of document.querySelectorAll(selector)) {
            if (button && !button.disabled) { button.click(); clicked = true; }
          }
        }
        if (!clicked) {
          const skipText = /^(skip( ad| ads)?|skip video|omitir( anuncio| anuncios)?|saltar( anuncio| anuncios)?)/i;
          for (const button of document.querySelectorAll('button')) {
            const text = (button.innerText || button.textContent || button.getAttribute('aria-label') || '').trim();
            if (skipText.test(text) && !button.disabled) { button.click(); clicked = true; break; }
          }
        }
        if (video) {
          try {
            video.playbackRate = 16;
            if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Math.max(video.currentTime, video.duration - 0.05);
            video.play().catch(() => {});
          } catch {}
        }
        return clicked;
      };
      const reportPlayer = (force = false) => {
        if (!video || playerIsShowingAd()) return;
        const now = Date.now();
        if (!force && now - lastPlayerReport < 750) return;
        lastPlayerReport = now;
        const title = (document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || document.title || '').replace(/ - YouTube$/, '').trim();
        const channel = (document.querySelector('ytd-watch-metadata ytd-channel-name a, #owner #channel-name a, ytd-video-owner-renderer #channel-name a')?.textContent || '').trim();
        const payload = {
          title,
          channel,
          url: location.href,
          currentTime: Number(video.currentTime || 0),
          duration: Number.isFinite(video.duration) ? Number(video.duration || 0) : 0,
          paused: Boolean(video.paused),
          userPaused: Boolean(video.paused && Date.now() < userPauseUntil),
          muted: Boolean(video.muted),
          volume: Number(video.volume || 0)
        };
        console.info('__LULU_PLAYER__:${nonce}:' + encodeURIComponent(JSON.stringify(payload)));
      };
      const detach = () => {
        if (!video || !listeners) return;
        video.removeEventListener('playing', listeners.onPlaying);
        video.removeEventListener('timeupdate', listeners.onTimeUpdate);
        video.removeEventListener('ended', listeners.onEnded);
      };
      const reportEnded = () => {
        if (!video || endedSent || !playStarted || playerIsShowingAd()) return;
        const nearRealEnd = contentDuration > 0 && lastContentTime >= Math.max(2, contentDuration - 3);
        if (!nearRealEnd) return;
        endedSent = true;
        console.info('__TVS_VIDEO_ENDED__:${nonce}:' + location.href);
      };
      const attach = () => {
        const next = document.querySelector('video.html5-main-video') || document.querySelector('video');
        if (!next) return false;
        if (next === video && listeners) return true;
        detach();
        video = next;
        endedSent = false;
        playStarted = false;
        contentDuration = 0;
        lastContentTime = 0;
        listeners = {
          onPlaying: () => {
            if (!playerIsShowingAd()) {
              playStarted = true;
              endedSent = false;
              if (Number.isFinite(video.duration)) contentDuration = video.duration;
              reportPlayer(true);
            }
          },
          onTimeUpdate: () => {
            if (!playerIsShowingAd()) {
              lastContentTime = Number(video.currentTime || 0);
              if (Number.isFinite(video.duration)) contentDuration = video.duration;
              if (lastContentTime >= 2) playStarted = true;
              reportPlayer(false);
            }
          },
          onEnded: () => { reportPlayer(true); reportEnded(); }
        };
        video.addEventListener('playing', listeners.onPlaying);
        video.addEventListener('timeupdate', listeners.onTimeUpdate);
        video.addEventListener('ended', listeners.onEnded);
        video.addEventListener('pause', () => reportPlayer(true), { once: true });
        video.play().catch(() => {});
        reportPlayer(true);
        return true;
      };
      disableYouTubeAutoplay();
      attach();
      skipYouTubeAds();
      observer = new MutationObserver(() => { attach(); skipYouTubeAds(); });
      if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style','aria-label'] });
      const timer = setInterval(() => {
        disableYouTubeAutoplay();
        attach();
        skipYouTubeAds();
        reportPlayer(false);
        if (video?.ended) reportEnded();
        if (document.hidden && video && !playerIsShowingAd() && video.paused && video.currentTime < 1) video.play().catch(() => {});
      }, 500);
      window.__tvsPlaybackCleanup = () => {
        clearInterval(timer);
        if (observer) observer.disconnect();
        document.removeEventListener('click', noteUserPauseGesture, true);
        document.removeEventListener('keydown', noteUserPauseGesture, true);
        detach();
        delete window.__tvsPlaybackCleanup;
      };
      return Boolean(video);
    })()`, true);
    if (installed) return;
  } catch (error) {
    console.warn('No se pudo instalar el monitor de YouTube:', error?.message || error);
  }

  if (attempt < 20 && nonce === youtubeAutomationNonce) {
    youtubeAutomationTimer = setTimeout(() => installYoutubePlaybackWatcher(nonce, attempt + 1), 150);
  }
}

function musicWindow(provider) {
  return provider === 'spotify' ? spotifyWindow : youtubeWindow;
}

function markMusicExpected(provider, expected, userPaused = false) {
  const recovery = musicRecoveryState[provider];
  if (!recovery) return;
  recovery.expectedPlaying = Boolean(expected);
  recovery.userPaused = Boolean(userPaused);
  if (!expected && recovery.recoveryTimer) {
    clearTimeout(recovery.recoveryTimer);
    recovery.recoveryTimer = null;
  }
  refreshAppSuspensionBlocker();
}

function noteMusicPlayerPayload(provider, payload = {}) {
  const recovery = musicRecoveryState[provider];
  if (!recovery) return;
  const currentTime = Math.max(0, Number(payload.currentTime || 0));
  const now = Date.now();
  recovery.lastUrl = String(payload.url || musicWindow(provider)?.webContents?.getURL?.() || recovery.lastUrl || '');
  recovery.lastDuration = Math.max(0, Number(payload.duration || recovery.lastDuration || 0));
  if (currentTime > recovery.lastTime + 0.2 || currentTime < recovery.lastTime - 2) {
    recovery.lastProgressAt = now;
    recovery.recoveryAttempt = 0;
  }
  recovery.lastTime = currentTime;
  const win = musicWindow(provider);
  if (payload.paused === false) {
    if (recovery.recoveryTimer) {
      clearTimeout(recovery.recoveryTimer);
      recovery.recoveryTimer = null;
    }
    markMusicExpected(provider, true, false);
    if (!recovery.lastProgressAt) recovery.lastProgressAt = now;
  } else if (isManualPlayerPause({ ...recovery, visible:Boolean(win && !win.isDestroyed() && win.isVisible()) }, payload)) {
    markMusicExpected(provider, false, true);
  } else if (shouldResumeUnexpectedPause({ ...recovery, visible:Boolean(win && !win.isDestroyed() && win.isVisible()) }, payload)) {
    scheduleMusicPlayerRecovery(provider, 'pausa inesperada', false);
  }
}

function youtubeResumeUrl(rawUrl, seconds) {
  try {
    const url = new URL(String(rawUrl || ''));
    if (!isYoutubeUrl(url.href) || youtubeUrlKind(url.href) !== 'watch') return url.href;
    url.searchParams.set('autoplay', '1');
    if (Number(seconds) > 3) url.searchParams.set('t', `${Math.floor(Number(seconds))}s`);
    return url.href;
  } catch { return String(rawUrl || 'https://www.youtube.com/'); }
}

async function recoverMusicPlayer(provider, reason = 'watchdog', forceReload = false) {
  const recovery = musicRecoveryState[provider];
  if (!recovery?.expectedPlaying || recovery.userPaused || isQuitting) return;
  let win = musicWindow(provider);
  const shouldReload = forceReload || !win || win.isDestroyed() || recovery.recoveryAttempt >= 2;
  recovery.recoveryAttempt += 1;
  try {
    if (shouldReload) {
      if (win && !win.isDestroyed()) {
        recovery.replacing = true;
        try { win.destroy(); } catch {}
      }
      if (provider === 'spotify') spotifyWindow = null;
      else youtubeWindow = null;
      win = provider === 'spotify' ? createSpotifyWindow() : createYoutubeWindow();
      const target = provider === 'spotify'
        ? (isSpotifyUrl(recovery.lastUrl) ? recovery.lastUrl : 'https://open.spotify.com/')
        : youtubeResumeUrl(recovery.lastUrl, recovery.lastTime);
      await win.loadURL(target);
    }
    if (provider === 'spotify') await controlSpotifyPlayer('play');
    else await controlYoutubePlayer('play');
    recovery.lastProgressAt = Date.now();
    send(`${provider}:status`, { open:true, visible:win.isVisible(), recovered:true, reason });
  } catch (error) {
    console.warn(`Recuperación de ${provider}:`, error?.message || error);
    scheduleMusicPlayerRecovery(provider, reason, true);
  }
}

function scheduleMusicPlayerRecovery(provider, reason = 'watchdog', forceReload = false) {
  const recovery = musicRecoveryState[provider];
  if (!recovery?.expectedPlaying || recovery.userPaused || recovery.recoveryTimer || isQuitting) return;
  recovery.recoveryTimer = setTimeout(() => {
    recovery.recoveryTimer = null;
    void recoverMusicPlayer(provider, reason, forceReload);
  }, musicRecoveryDelay(recovery.recoveryAttempt));
}

function recoverActiveMusicPlayers(reason = 'resume') {
  for (const provider of ['youtube', 'spotify']) {
    if (musicRecoveryState[provider].expectedPlaying && !musicRecoveryState[provider].userPaused) scheduleMusicPlayerRecovery(provider, reason, true);
  }
}

function startMusicRecoveryWatchdog() {
  if (musicRecoveryWatchdogTimer) return;
  musicRecoveryWatchdogTimer = setInterval(() => {
    const now = Date.now();
    for (const provider of ['youtube', 'spotify']) {
      const recovery = musicRecoveryState[provider];
      const win = musicWindow(provider);
      if (!win || shouldRecoverPlayback({ ...recovery, visible:win.isVisible(), destroyed:win.isDestroyed() }, now)) scheduleMusicPlayerRecovery(provider, 'sin progreso', recovery.recoveryAttempt >= 1);
    }
  }, 3000);
  musicRecoveryWatchdogTimer.unref?.();
}

function attachMusicWindowRecovery(provider, win) {
  win.on('unresponsive', () => scheduleMusicPlayerRecovery(provider, 'ventana sin respuesta', true));
  win.on('responsive', () => { musicRecoveryState[provider].recoveryAttempt = 0; });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.warn(`${provider} se cerró inesperadamente:`, details?.reason || 'proceso terminado');
    scheduleMusicPlayerRecovery(provider, details?.reason || 'proceso terminado', true);
  });
}

function normalizedAudioVolume(value,fallback=.8){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(1,number)):fallback;}
async function setYoutubeVolume(value){youtubeVolume=normalizedAudioVolume(value,youtubeVolume);if(!youtubeWindow||youtubeWindow.isDestroyed())return{ok:true,deferred:true,volume:youtubeVolume};return controlYoutubePlayer('volume',youtubeVolume);}
async function setSpotifyVolume(value){spotifyVolume=normalizedAudioVolume(value,spotifyVolume);if(!spotifyWindow||spotifyWindow.isDestroyed())return{ok:true,deferred:true,volume:spotifyVolume};return controlSpotifyPlayer('volume',spotifyVolume);}

async function controlYoutubePlayer(action, value) {
  await ensureYoutubeNetworkAdBlocker();
  const win = createYoutubeWindow();
  if (!win.webContents.getURL()) await win.loadURL('https://www.youtube.com/');
  const result = await win.webContents.executeJavaScript(`(() => {
    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
    const action = ${JSON.stringify(action)};
    const value = ${JSON.stringify(value)};
    if (action === 'continue-recommended') {
      const next = document.querySelector('a.ytp-next-button[href*="/watch"], a.ytp-next-button');
      if (next?.href) { location.href = next.href; return { ok: true, url: next.href }; }
      if (next) { next.click(); return { ok: true }; }
      const recommendation = document.querySelector('ytd-watch-next-secondary-results-renderer a#thumbnail[href*="/watch"], ytd-compact-video-renderer a#thumbnail[href*="/watch"]');
      if (recommendation?.href) { location.href = recommendation.href; return { ok: true, url: recommendation.href }; }
      return { ok: false };
    }
    if (!video) return { ok: false };
    if (action === 'toggle') video.paused ? video.play().catch(() => {}) : video.pause();
    if (action === 'play') video.play().catch(() => {});
    if (action === 'pause') video.pause();
    if (action === 'restart') { video.currentTime = 0; video.play().catch(() => {}); }
    if (action === 'volume') { video.volume = Math.max(0, Math.min(1, Number(value) || 0)); video.muted = false; }
    return { ok: true, paused: video.paused, currentTime: video.currentTime, duration: video.duration, volume: video.volume };
  })()`, true);
  if (action === 'pause') markMusicExpected('youtube', false, false);
  if (action === 'play' || action === 'restart' || action === 'continue-recommended') markMusicExpected('youtube', true, false);
  if (action === 'toggle' && result?.ok) markMusicExpected('youtube', result.paused === false, result.paused === true && win.isVisible());
  return result;
}

function createYoutubeWindow() {
  if (youtubeWindow && !youtubeWindow.isDestroyed()) return youtubeWindow;
  installYoutubeAdBlocker();

  youtubeWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 850,
    minHeight: 580,
    title: 'YouTube — Lulu Finity',
    backgroundColor: '#0f0f0f',
    autoHideMenuBar: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
      partition: YOUTUBE_PARTITION
    }
  });

  attachMusicWindowRecovery('youtube', youtubeWindow);
  youtubeWindow.webContents.setAudioMuted(Boolean(youtubeMuted || youtubeAdGuardMuted));
  youtubeWindow.on('closed', () => {
    const replacing = musicRecoveryState.youtube.replacing;
    musicRecoveryState.youtube.replacing = false;
    if (!replacing && !isQuitting) markMusicExpected('youtube', false, true);
    clearYoutubeAutomation();
    youtubeWindow = null;
    send('youtube:status', { open: false, visible: false, muted: youtubeMuted });
  });
  youtubeWindow.webContents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (!isMainFrame) return;
    setYoutubeAdGuardMuted(youtubeUrlKind(url) === 'watch' && youtubeAdBlockEnabled);
  });
  youtubeWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    musicRecoveryState.youtube.lastUrl = String(url || musicRecoveryState.youtube.lastUrl || '');
    scheduleMusicPlayerRecovery('youtube', `${description} (${code})`, true);
    send('youtube:error', { message: `${description} (${code})`, url });
  });
  youtubeWindow.webContents.on('did-finish-load', () => {
    musicRecoveryState.youtube.lastUrl = youtubeWindow?.webContents.getURL() || musicRecoveryState.youtube.lastUrl;
    scheduleYoutubeAutomation(youtubeWindow?.webContents.getURL() || '');
  });
  youtubeWindow.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) scheduleYoutubeAutomation(url);
  });
  youtubeWindow.webContents.on('console-message', (_event, details, legacyMessage) => {
    const message = String(details && typeof details === 'object' ? details.message : (legacyMessage || details) || '');
    const adMatch = message.match(/^__LULU_AD_STATE__:(\d+):([01])$/);
    if (adMatch && Number(adMatch[1]) === youtubeAutomationNonce) {
      musicRecoveryState.youtube.adActive = adMatch[2] === '1';
      setYoutubeAdGuardMuted(adMatch[2] === '1');
      return;
    }
    const endedMatch = message.match(/^__TVS_VIDEO_ENDED__:(\d+):(.*)$/);
    if (endedMatch) {
      const nonce = Number(endedMatch[1]);
      if (nonce !== youtubeAutomationNonce) return;
      youtubeAutomationNonce += 1;
      markMusicExpected('youtube', false, false);
      send('youtube:ended', { url: endedMatch[2] || '', nonce });
      return;
    }
    const playerMatch = message.match(/^__LULU_PLAYER__:(\d+):(.*)$/);
    if (!playerMatch || Number(playerMatch[1]) !== youtubeAutomationNonce) return;
    try {
      const payload = JSON.parse(decodeURIComponent(playerMatch[2]));
      noteMusicPlayerPayload('youtube', payload);
      send('youtube:player', payload);
    } catch {}
  });
  youtubeWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isYoutubeUrl(url)) {
      youtubeWindow.loadURL(url).catch(() => shell.openExternal(url));
    } else if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  return youtubeWindow;
}

async function openYoutube(rawQuery, suffix = '') {
  await ensureYoutubeNetworkAdBlocker();
  const rawTarget = youtubeTarget(rawQuery, suffix);
  const target = youtubeUrlKind(rawTarget) === 'watch' ? withYoutubeAutoplay(rawTarget) : rawTarget;
  const win = createYoutubeWindow();
  musicRecoveryState.youtube.lastUrl = target;
  musicRecoveryState.youtube.lastTime = 0;
  musicRecoveryState.youtube.lastProgressAt = Date.now();
  markMusicExpected('youtube', true, false);
  if (youtubeUrlKind(target) === 'watch' && youtubeAdBlockEnabled) setYoutubeAdGuardMuted(true);
  try {
    await win.loadURL(target);
  } catch (error) {
    scheduleMusicPlayerRecovery('youtube', error?.message || 'fallo de carga', true);
    send('youtube:status', { open:true, visible:win.isVisible(), muted:youtubeMuted, target, recovering:true });
    return { open:true, visible:win.isVisible(), muted:youtubeMuted, target, query:String(rawQuery || '').trim(), recovering:true };
  }
  if (!(youtubeUrlKind(target) === 'watch' && youtubeAdBlockEnabled)) win.webContents.setAudioMuted(youtubeMuted);
  await setYoutubeVolume(youtubeVolume).catch(()=>{});
  const payload = { open: true, visible: win.isVisible(), muted: youtubeMuted, target, query: String(rawQuery || '').trim() };
  send('youtube:status', payload);
  return payload;
}


function isSpotifyUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return host === 'open.spotify.com' || host.endsWith('.spotify.com');
  } catch { return false; }
}


function spotifyDesktopTarget(rawQuery) {
  const query = String(rawQuery || '').trim().slice(0, 180);
  if (!query) return 'spotify:';
  try {
    const url = new URL(query);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'open.spotify.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['track', 'album', 'playlist', 'artist', 'show', 'episode'].includes(parts[0])) {
        return `spotify:${parts[0]}:${parts[1]}`;
      }
    }
  } catch {}
  return `spotify:search:${encodeURIComponent(query)}`;
}

async function openSpotifyDesktop(rawQuery) {
  const desktop = spotifyDesktopTarget(rawQuery);
  try {
    await shell.openExternal(desktop);
    return { ok: true, target: desktop, desktop: true };
  } catch (error) {
    const web = spotifyTarget(rawQuery);
    await shell.openExternal(web);
    return { ok: true, target: web, desktop: false, message: error?.message || '' };
  }
}

function spotifyTarget(rawQuery) {
  const query = String(rawQuery || '').trim().slice(0, 180);
  if (!query) return 'https://open.spotify.com/';
  if (isSpotifyUrl(query)) return query;
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

function spotifyUrlKind(value) {
  try {
    const url = new URL(String(value || ''));
    if (!isSpotifyUrl(url.href)) return 'other';
    if (url.pathname.startsWith('/search/')) return 'search';
    if (url.pathname.startsWith('/track/')) return 'track';
    return 'home';
  } catch { return 'other'; }
}

function clearSpotifyAutomation() {
  spotifyAutomationNonce += 1;
  if (spotifyAutomationTimer) clearTimeout(spotifyAutomationTimer);
  spotifyAutomationTimer = null;
}

function scheduleSpotifyAutomation(url) {
  if (!spotifyWindow || spotifyWindow.isDestroyed()) return;
  const kind = spotifyUrlKind(url);
  const nonce = ++spotifyAutomationNonce;
  if (spotifyAutomationTimer) clearTimeout(spotifyAutomationTimer);
  spotifyAutomationTimer = setTimeout(() => {
    spotifyAutomationTimer = null;
    if (kind === 'search') selectFirstSpotifyTrack(nonce, 0);
    if (kind === 'track' || kind === 'home') installSpotifyPlaybackWatcher(nonce, 0);
  }, 900);
}

async function selectFirstSpotifyTrack(nonce, attempt) {
  if (nonce !== spotifyAutomationNonce || !spotifyWindow || spotifyWindow.isDestroyed()) return;
  try {
    const result = await spotifyWindow.webContents.executeJavaScript(`(() => {
      const rows = [...document.querySelectorAll('[data-testid="tracklist-row"], [role="row"]')];
      for (const row of rows) {
        const link = row.querySelector('a[href*="/track/"]');
        if (!link?.href) continue;
        const title = (link.textContent || row.querySelector('[data-testid="internal-track-link"]')?.textContent || '').trim();
        const artist = (row.querySelector('a[href*="/artist/"]')?.textContent || '').trim();
        return { url: link.href, title, artist };
      }
      const link = document.querySelector('a[href*="/track/"]');
      return link?.href ? { url: link.href, title: (link.textContent || '').trim(), artist: '' } : null;
    })()`, true);
    if (nonce !== spotifyAutomationNonce) return;
    if (result?.url) {
      send('spotify:selected', result);
      await spotifyWindow.loadURL(result.url);
      return;
    }
  } catch (error) {
    console.warn('No se pudo seleccionar Spotify:', error?.message || error);
  }
  if (attempt < 24 && nonce === spotifyAutomationNonce) {
    spotifyAutomationTimer = setTimeout(() => selectFirstSpotifyTrack(nonce, attempt + 1), 700);
  } else if (nonce === spotifyAutomationNonce) {
    send('spotify:unavailable', { message: 'No se encontró una canción. Abre Spotify e inicia sesión si es necesario.' });
  }
}

async function installSpotifyPlaybackWatcher(nonce, attempt) {
  if (nonce !== spotifyAutomationNonce || !spotifyWindow || spotifyWindow.isDestroyed()) return;
  try {
    const installed = await spotifyWindow.webContents.executeJavaScript(`(() => {
      if (window.__luluSpotifyCleanup) window.__luluSpotifyCleanup();
      let lastTitle = '';
      let endedSent = false;
      let clickedPlay = false;
      let userPauseUntil = 0;
      const noteUserPauseGesture = (event) => {
        if (!event.isTrusted) return;
        if (event.type === 'click' && event.target?.closest?.('button[data-testid="control-button-playpause"]')) userPauseUntil = Date.now() + 1800;
        if (event.type === 'keydown' && event.key === ' ' && !event.target?.matches?.('input, textarea, [contenteditable="true"]')) userPauseUntil = Date.now() + 1800;
      };
      document.addEventListener('click', noteUserPauseGesture, true);
      document.addEventListener('keydown', noteUserPauseGesture, true);
      const clockToSeconds = (text) => {
        const parts = String(text || '').trim().split(':').map(Number);
        if (!parts.length || parts.some(Number.isNaN)) return 0;
        return parts.reduce((total, part) => total * 60 + part, 0);
      };
      const report = () => {
        const title = (document.querySelector('[data-testid="context-item-info-title"]')?.textContent || document.querySelector('[data-testid="now-playing-widget"] a[href*="/track/"]')?.textContent || document.title.replace(' | Spotify','')).trim();
        const artist = (document.querySelector('[data-testid="context-item-info-artist"]')?.textContent || document.querySelector('[data-testid="now-playing-widget"] a[href*="/artist/"]')?.textContent || '').trim();
        const positionText = document.querySelector('[data-testid="playback-position"]')?.textContent || '';
        const durationText = document.querySelector('[data-testid="playback-duration"]')?.textContent || '';
        const currentTime = clockToSeconds(positionText);
        const duration = clockToSeconds(durationText);
        const pauseButton = document.querySelector('button[data-testid="control-button-playpause"][aria-label*="Pause"], button[data-testid="control-button-playpause"][aria-label*="Paus"]');
        const paused = !pauseButton;
        const payload = { title, artist, url: location.href, currentTime, duration, paused, userPaused:Boolean(paused && Date.now() < userPauseUntil) };
        console.info('__LULU_SPOTIFY_PLAYER__:${nonce}:' + encodeURIComponent(JSON.stringify(payload)));
        if (title && title !== lastTitle) { lastTitle = title; endedSent = false; }
        if (!paused && duration > 4 && currentTime >= duration - 2 && !endedSent) {
          endedSent = true;
          console.info('__LULU_SPOTIFY_ENDED__:${nonce}:' + location.href);
        }
      };
      const tryPlay = () => {
        if (clickedPlay) return;
        const button = document.querySelector('button[data-testid="play-button"], button[aria-label="Play"], button[aria-label="Reproducir"]');
        if (button) { clickedPlay = true; button.click(); }
      };
      const timer = setInterval(() => { tryPlay(); report(); }, 750);
      window.__luluSpotifyCleanup = () => { clearInterval(timer); document.removeEventListener('click', noteUserPauseGesture, true); document.removeEventListener('keydown', noteUserPauseGesture, true); delete window.__luluSpotifyCleanup; };
      tryPlay(); report();
      return true;
    })()`, true);
    if (installed) return;
  } catch (error) {
    console.warn('No se pudo vigilar Spotify:', error?.message || error);
  }
  if (attempt < 20 && nonce === spotifyAutomationNonce) spotifyAutomationTimer = setTimeout(() => installSpotifyPlaybackWatcher(nonce, attempt + 1), 650);
}

async function controlSpotifyPlayer(action, value) {
  const win = createSpotifyWindow();
  if (!win.webContents.getURL()) await win.loadURL('https://open.spotify.com/');
  const result = await win.webContents.executeJavaScript(`(() => {
    const action = ${JSON.stringify(action)};
    const value = ${JSON.stringify(value)};
    const playPause = document.querySelector('button[data-testid="control-button-playpause"]');
    const next = document.querySelector('button[data-testid="control-button-skip-forward"]');
    const previous = document.querySelector('button[data-testid="control-button-skip-back"]');
    if (action === 'toggle' && playPause) playPause.click();
    const label = String(playPause?.getAttribute('aria-label') || '').toLowerCase();
    const currentlyPaused = /play|reproducir/.test(label);
    if (action === 'play' && currentlyPaused && playPause) playPause.click();
    if (action === 'pause' && !currentlyPaused && playPause) playPause.click();
    if (action === 'next' && next) next.click();
    if (action === 'previous' && previous) previous.click();
    if (action === 'volume') {
      const slider = document.querySelector('[data-testid="volume-bar"] input[type="range"], input[aria-label*="Volume"], input[aria-label*="volumen"]');
      if (slider) {
        const normalized = Math.max(0, Math.min(1, Number(value) || 0));
        const max = Number(slider.max || 1);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(slider, String(normalized * max));
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    const nextLabel = String(playPause?.getAttribute('aria-label') || '').toLowerCase();
    return { ok: Boolean(playPause || next || previous), paused: /play|reproducir/.test(nextLabel) };
  })()`, true);
  if (action === 'pause') markMusicExpected('spotify', false, false);
  if (action === 'play' || action === 'next' || action === 'previous') markMusicExpected('spotify', true, false);
  if (action === 'toggle' && result?.ok) markMusicExpected('spotify', result.paused === false, result.paused === true && win.isVisible());
  return result;
}

function createSpotifyWindow() {
  if (spotifyWindow && !spotifyWindow.isDestroyed()) return spotifyWindow;
  spotifyWindow = new BrowserWindow({
    width: 1240, height: 820, minWidth: 850, minHeight: 580,
    title: 'Spotify — Lulu Finity', backgroundColor: '#121212', autoHideMenuBar: true, show: false,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling:false, partition:SPOTIFY_PARTITION }
  });
  attachMusicWindowRecovery('spotify', spotifyWindow);
  spotifyWindow.webContents.setAudioMuted(spotifyMuted);
  spotifyWindow.on('closed', () => {
    const replacing = musicRecoveryState.spotify.replacing;
    musicRecoveryState.spotify.replacing = false;
    if (!replacing && !isQuitting) markMusicExpected('spotify', false, true);
    clearSpotifyAutomation(); spotifyWindow = null;
    send('spotify:status', { open: false, visible: false, muted: spotifyMuted });
  });
  spotifyWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    musicRecoveryState.spotify.lastUrl = String(url || musicRecoveryState.spotify.lastUrl || '');
    scheduleMusicPlayerRecovery('spotify', `${description} (${code})`, true);
    send('spotify:error', { message: `${description} (${code})`, url });
  });
  spotifyWindow.webContents.on('did-finish-load', () => {
    musicRecoveryState.spotify.lastUrl = spotifyWindow?.webContents.getURL() || musicRecoveryState.spotify.lastUrl;
    scheduleSpotifyAutomation(spotifyWindow?.webContents.getURL() || '');
  });
  spotifyWindow.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => { if (isMainFrame) scheduleSpotifyAutomation(url); });
  spotifyWindow.webContents.on('console-message', (_event, details, legacyMessage) => {
    const message = String(details && typeof details === 'object' ? details.message : (legacyMessage || details) || '');
    const ended = message.match(/^__LULU_SPOTIFY_ENDED__:(\d+):(.*)$/);
    if (ended && Number(ended[1]) === spotifyAutomationNonce) { markMusicExpected('spotify', false, false); send('spotify:ended', { url: ended[2] || '' }); return; }
    const player = message.match(/^__LULU_SPOTIFY_PLAYER__:(\d+):(.*)$/);
    if (player && Number(player[1]) === spotifyAutomationNonce) {
      try { const payload=JSON.parse(decodeURIComponent(player[2])); noteMusicPlayerPayload('spotify', payload); send('spotify:player', payload); } catch {}
    }
  });
  spotifyWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSpotifyUrl(url)) spotifyWindow.loadURL(url).catch(() => shell.openExternal(url));
    else if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  return spotifyWindow;
}

async function openSpotify(rawQuery) {
  const target = spotifyTarget(rawQuery);
  const win = createSpotifyWindow();
  musicRecoveryState.spotify.lastUrl = target;
  musicRecoveryState.spotify.lastTime = 0;
  musicRecoveryState.spotify.lastProgressAt = Date.now();
  markMusicExpected('spotify', true, false);
  try { await win.loadURL(target); }
  catch (error) {
    scheduleMusicPlayerRecovery('spotify', error?.message || 'fallo de carga', true);
    send('spotify:status', { open:true, visible:win.isVisible(), muted:spotifyMuted, target, recovering:true });
    return { open:true, visible:win.isVisible(), muted:spotifyMuted, target, query:String(rawQuery || '').trim(), recovering:true };
  }
  win.webContents.setAudioMuted(spotifyMuted);
  await setSpotifyVolume(spotifyVolume).catch(()=>{});
  const payload = { open: true, visible: win.isVisible(), muted: spotifyMuted, target, query: String(rawQuery || '').trim() };
  send('spotify:status', payload);
  return payload;
}

async function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(message);
          error.code = 'TVS_TIMEOUT';
          reject(error);
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function appendConnectionLog(stage, details = {}) {
  try {
    const file = path.join(getDataPaths().base, 'connection.log');
    const safeDetails = { ...details };
    if (safeDetails.error instanceof Error) {
      safeDetails.error = {
        name: safeDetails.error.name,
        code: safeDetails.error.code,
        message: safeDetails.error.message,
        stack: safeDetails.error.stack
      };
    }
    const line = JSON.stringify({ at: new Date().toISOString(), stage, ...safeDetails });
    await fsp.appendFile(file, `${line}\n`, 'utf8');
  } catch (error) {
    console.warn('No se pudo escribir el diagnóstico:', error?.message || error);
  }
}

async function safeDisconnect(connection) {
  if (!connection) return;
  try {
    await withTimeout(connection.disconnect(), 3500, 'La desconexión tardó demasiado.');
  } catch (error) {
    console.warn('Error al desconectar:', error?.message || error);
  }
}


const EULER_CLOSE_MESSAGES = {
  1000: 'Conexión cerrada normalmente.',
  1011: 'El servidor gratuito tuvo un error interno.',
  4005: 'El LIVE terminó.',
  4006: 'La conexión se cerró por falta de mensajes.',
  4400: 'La configuración enviada no es válida.',
  4401: 'La clave gratuita no es válida o fue eliminada.',
  4403: 'La cuenta gratuita no tiene permiso para esta conexión.',
  4404: 'TikTok no detecta que esta cuenta esté en LIVE.',
  4429: 'La cuenta alcanzó su límite de conexiones simultáneas.',
  4500: 'TikTok cerró la conexión inesperadamente.',
  4555: 'La conexión gratuita alcanzó su duración máxima. Vuelve a conectar.',
  4556: 'No se pudo obtener el flujo de eventos de TikTok.',
  4557: 'No se pudo obtener la información de la sala.'
};

function cloudCloseMessage(code, reason = '') {
  const cleanReason = String(reason || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160);
  return cleanReason || EULER_CLOSE_MESSAGES[Number(code)] || `La conexión se cerró con el código ${code}.`;
}

function cloudUser(data = {}) {
  return data?.user || data?.sender || data?.fromUser || data?.member || {};
}

function normalizeCloudMessageData(type, rawData = {}) {
  const data = rawData && typeof rawData === 'object' ? { ...rawData } : {};
  const user = cloudUser(data);
  if (user && typeof user === 'object') data.user = user;
  if (/ChatMessage$/i.test(type)) {
    data.comment = String(data.comment ?? data.content ?? data.text ?? '');
  }
  if (/GiftMessage$/i.test(type)) {
    const gift = data.giftDetails || data.gift || data.extendedGiftInfo || {};
    data.giftId = String(data.giftId || gift.giftId || gift.id || gift.gift_id || '');
    data.repeatCount = Math.max(1, Number(data.repeatCount || data.repeat_count || data.comboCount || 1));
    data.repeatEnd = Boolean(data.repeatEnd ?? data.repeat_end ?? data.comboEnd ?? true);
    data.giftDetails = {
      ...gift,
      giftId: data.giftId,
      giftName: String(gift.giftName || gift.name || data.giftName || `Regalo ${data.giftId}`),
      giftType: Number(gift.giftType ?? gift.type ?? data.giftType ?? 0),
      diamondCount: Number(gift.diamondCount ?? gift.diamond_count ?? gift.diamondCost ?? data.diamondCount ?? data.diamond_count ?? 0)
    };
    data.extendedGiftInfo = { ...gift, ...data.giftDetails };
  }
  if (/RoomUserSeqMessage$/i.test(type)) {
    data.viewerCount = Number(data.viewerCount ?? data.total ?? data.totalUser ?? data.total_user ?? 0);
  }
  if (/LikeMessage$/i.test(type)) {
    data.likeCount = Number(data.likeCount ?? data.count ?? 0);
    data.totalLikeCount = Number(data.totalLikeCount ?? data.total ?? data.total_count ?? 0);
  }
  if (/MemberMessage$/i.test(type)) {
    data.memberCount = Number(data.memberCount ?? data.member_count ?? data.count ?? 0);
  }
  return data;
}

class RailwayRelayConnection extends EventEmitter {
  constructor(uniqueId, relayUrl, relayClientToken, events) {
    super();
    this.uniqueId = cleanUsername(uniqueId);
    this.relayUrl = String(relayUrl || '').trim();
    this.relayClientToken = String(relayClientToken || '').trim();
    this.events = events || {};
    this.socket = null;
    this.availableGifts = null;
    this.roomId = '';
    this.isConnected = false;
    this.isConnecting = false;
    this.readyPromise = null;
    this.protocolViolationCount = 0;
    this.incomingWindowStartedAt = 0;
    this.incomingMessageCount = 0;
  }

  async fetchRoomId() {
    return this.roomId || 'relay';
  }

  rejectRelayProtocol(error) {
    this.protocolViolationCount += 1;
    appendConnectionLog('railway-relay-protocol-rejected', {
      code: String(error?.code || 'invalid_message').slice(0, 80),
      count: this.protocolViolationCount
    });
    const mustClose = error?.code === 'forbidden_remote_request'
      || error?.code === 'rate_limit'
      || this.protocolViolationCount >= 3;
    if (mustClose && this.socket && this.socket.readyState === WebSocket.OPEN) {
      try { this.socket.close(1008, 'Protocolo del relay rechazado'); } catch {}
    }
  }

  countIncomingMessages(amount) {
    const now = Date.now();
    if (!this.incomingWindowStartedAt || now - this.incomingWindowStartedAt >= 1000) {
      this.incomingWindowStartedAt = now;
      this.incomingMessageCount = 0;
    }
    this.incomingMessageCount += Math.max(0, Number(amount) || 0);
    if (this.incomingMessageCount > 500) {
      throw new RelayProtocolError('rate_limit', 'El relay excedió el límite de eventos por segundo.');
    }
  }

  emitCloudMessage(message) {
    const type = String(message?.type || '').trim();
    const data = normalizeCloudMessageData(type, message?.data);
    if (!type) return false;
    const E = this.events.WebcastEvent || {};
    const C = this.events.ControlEvent || {};
    if (type === 'lulu.relay.status') {
      appendConnectionLog('railway-relay-status', {
        state: String(data?.state || ''),
        attempt: Number(data?.attempt || 0),
        keyId: String(data?.keyId || '')
      });
      if (data?.state === 'rotating') {
        send('live:status', {
          status: 'connecting',
          username: this.uniqueId,
          message: 'Railway cambió automáticamente a otra API key…'
        });
      }
      if (data?.state === 'connected' && this.isConnected) {
        send('live:status', {
          status: 'connected',
          username: this.uniqueId,
          roomId: this.roomId || 'relay',
          message: 'Railway terminó la rotación y la conexión volvió a quedar activa.'
        });
      }
      return data?.state === 'connected';
    }
    if (type === 'lulu.relay.error') {
      this.emit(C.ERROR || 'error', new Error(data?.message || 'El servidor Railway reportó un error.'));
      return false;
    }
    if (type === 'workerInfo') {
      this.roomId = String(data?.roomId || data?.webSocketId || this.roomId || 'relay');
      return true;
    }
    if (type === 'tiktok.connect') {
      this.emit(C.CONNECTED || 'connected', { roomId: this.roomId || 'relay' });
      return true;
    }
    if (type === 'tiktok.disconnect') {
      appendConnectionLog('railway-upstream-disconnected', { reason: String(data?.reason || 'remote') });
      return false;
    }
    if (type === 'room.status') {
      const state = String(data?.state || '').toLowerCase();
      if (data?.roomId) this.roomId = String(data.roomId);
      if (state === 'connected') this.emit(C.CONNECTED || 'connected', { roomId: this.roomId || 'relay' });
      if (state === 'ended' || state === 'offline') this.emit(E.STREAM_END || 'streamEnd', data);
      if (state === 'error') this.emit(C.ERROR || 'error', new Error(data?.message || 'Error de la conexión mediante Railway.'));
      return true;
    }
    if (/WebcastChatMessage$/i.test(type)) this.emit(E.CHAT || 'chat', data);
    else if (/WebcastGiftMessage$/i.test(type)) this.emit(E.GIFT || 'gift', data);
    else if (/WebcastLikeMessage$/i.test(type)) this.emit(E.LIKE || 'like', data);
    else if (/WebcastMemberMessage$/i.test(type)) this.emit(E.MEMBER || 'member', data);
    else if (/WebcastRoomUserSeqMessage$/i.test(type)) this.emit(E.ROOM_USER || 'roomUser', data);
    else if (/WebcastSubNotifyMessage$/i.test(type)) this.emit(E.SUB_NOTIFY || 'subscribe', data);
    else if (/WebcastEmoteChatMessage$|WebcastBarrageMessage$/i.test(type)) this.emit(E.EMOTE || 'emote', data);
    else if (/WebcastControlMessage$/i.test(type)) {
      const action = Number(data?.action || data?.actionType || 0);
      if (action === 3 || /end/i.test(String(data?.displayType || data?.status || ''))) this.emit(E.STREAM_END || 'streamEnd', data);
    } else if (/WebcastSocialMessage$/i.test(type)) {
      const marker = `${data?.displayType || ''} ${data?.label || ''} ${data?.action || ''} ${data?.common?.displayText?.key || ''} ${data?.common?.displayText?.text || ''}`.toLowerCase();
      if (/follow|segu/.test(marker)) this.emit(E.FOLLOW || 'follow', data);
      if (/share|compart/.test(marker)) this.emit(E.SHARE || 'share', data);
    } else return false;
    return true;
  }

  connect() {
    if (!this.relayUrl) return Promise.reject(new Error('Configura la URL WebSocket de tu servidor Railway en Ajustes.'));
    if (this.readyPromise) return this.readyPromise;
    this.isConnecting = true;
    const relayUrl = normalizeRelayWebSocketUrl(this.relayUrl);
    const url = new URL(relayUrl);
    url.searchParams.set('uniqueId', this.uniqueId);
    url.searchParams.set('clientVersion', app.getVersion());
    const headers = { 'User-Agent': `Lulu-Finity/${app.getVersion()}` };
    if (this.relayClientToken) headers.Authorization = `Bearer ${this.relayClientToken}`;
    this.readyPromise = new Promise((resolve, reject) => {
      let settled = false;
      let opened = false;
      const finishReady = () => {
        if (settled || !opened) return;
        settled = true;
        this.isConnecting = false;
        this.isConnected = true;
        resolve({ roomId: this.roomId || 'relay', isConnected: true });
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        this.isConnecting = false;
        this.isConnected = false;
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      const timeout = setTimeout(() => fail(new Error('El servidor Railway no respondió en 24 segundos.')), 24000);
      // Canal unidireccional: Lulu recibe eventos públicos y nunca responde con datos de la app.
      this.socket = new WebSocket(url.toString(), {
        handshakeTimeout: 16000,
        headers,
        maxPayload: MAX_RELAY_FRAME_BYTES,
        perMessageDeflate: false,
        followRedirects: false
      });
      this.socket.on('open', () => {
        opened = true;
        this.emit(this.events.ControlEvent?.WEBSOCKET_CONNECTED || 'websocketConnected');
        setTimeout(finishReady, 1800);
      });
      this.socket.on('message', (raw, isBinary) => {
        try {
          if (isBinary) throw new RelayProtocolError('binary_frame', 'El relay envió un paquete binario no permitido.');
          const messages = parseRelayFrame(raw);
          this.countIncomingMessages(messages.length);
          let valid = false;
          for (const message of messages) valid = this.emitCloudMessage(message) || valid;
          if (valid) finishReady();
        } catch (error) {
          this.rejectRelayProtocol(error);
        }
      });
      this.socket.on('error', (error) => {
        this.emit(this.events.ControlEvent?.ERROR || 'error', error);
        if (!settled) fail(error);
      });
      this.socket.on('close', (code, reason) => {
        clearTimeout(timeout);
        const message = cloudCloseMessage(code, Buffer.isBuffer(reason) ? reason.toString('utf8') : reason);
        const closeError = new Error(message);
        closeError.code = Number(code) || 0;
        this.socket = null;
        this.isConnecting = false;
        this.isConnected = false;
        this.readyPromise = null;
        if (!settled) fail(closeError);
        this.emit(this.events.ControlEvent?.DISCONNECTED || 'disconnected', { reason: message, code });
      });
      this.readyPromise?.finally?.(() => clearTimeout(timeout));
    });
    return this.readyPromise;
  }

  async disconnect() {
    const socket = this.socket;
    this.socket = null;
    this.isConnecting = false;
    this.isConnected = false;
    this.readyPromise = null;
    if (!socket || socket.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      const timer = setTimeout(() => { try { socket.terminate(); } catch {} resolve(); }, 1200);
      socket.once('close', () => { clearTimeout(timer); resolve(); });
      try { socket.close(1000, 'Lulu Finity desconectada'); } catch { clearTimeout(timer); resolve(); }
    });
  }
}

function friendlyConnectionError(error) {
  const raw = String(error?.message || error || 'Error desconocido').trim();
  const lower = raw.toLowerCase();
  if (error?.code === 'TVS_TIMEOUT') {
    return `${raw} Revisa tu conexión, el Firewall de Windows y vuelve a intentarlo.`;
  }
  if (/offline|not live|useroffline|live has ended|room.*offline/.test(lower)) {
    return 'La cuenta existe, pero TikTok no detecta un LIVE activo en este momento.';
  }
  if (/429|rate.?limit|too many requests/.test(lower)) {
    return 'TikTok limitó temporalmente las conexiones. Espera uno o dos minutos y vuelve a intentarlo.';
  }
  if (/403|forbidden|access denied/.test(lower)) {
    return 'TikTok rechazó la consulta (403). Prueba otra red, desactiva temporalmente VPN/proxy y permite la app en el Firewall.';
  }
  if (/401|unauthorized|token.*inv[aá]lid/.test(lower)) {
    return 'El servidor del LIVE rechazó la conexión (401). Contacta al administrador de Lulu Finity.';
  }
  if (/429|503|1013|ocupadas|enfriamiento|no hay api keys/.test(lower)) {
    return `El servidor Railway no tiene una API key disponible en este momento: ${raw}`;
  }
  if (/railway|relay|websocket|upgrade|handshake/.test(lower)) {
    return `No se pudo abrir el relay WebSocket: ${raw}`;
  }
  if (/enotfound|eai_again|dns/.test(lower)) {
    return 'No se pudo resolver el servidor de TikTok. Revisa el DNS o la conexión a Internet.';
  }
  return raw;
}

function shouldRetryConnection(error) {
  const raw = String(error?.message || error || '').toLowerCase();
  return error?.code === 'TVS_TIMEOUT'
    || /econnreset|etimedout|eai_again|socket|websocket|handshake|502|503|504/.test(raw);
}

function clearLiveReconnectTimers() {
  if (liveReconnectTimer) clearTimeout(liveReconnectTimer);
  if (liveReconnectStableTimer) clearTimeout(liveReconnectStableTimer);
  liveReconnectTimer = null;
  liveReconnectStableTimer = null;
}

function stopLiveReconnectSession({ forgetUsername = true } = {}) {
  clearLiveReconnectTimers();
  liveReconnectEnabled = false;
  liveReconnectHasConnected = false;
  liveReconnectInFlight = false;
  liveReconnectAttempt = 0;
  if (forgetUsername) liveReconnectUsername = '';
  refreshAppSuspensionBlocker();
}
function beginLiveReconnectSession(username) {
  stopLiveReconnectSession();
  liveReconnectUsername = cleanUsername(username);
  liveReconnectEnabled = Boolean(liveReconnectUsername);
  refreshAppSuspensionBlocker();
}
function markLiveConnectionEstablished(connection, connectionNonce) {
  liveReconnectHasConnected = true;
  refreshAppSuspensionBlocker();
  if (liveReconnectStableTimer) clearTimeout(liveReconnectStableTimer);
  liveReconnectStableTimer = setTimeout(() => {
    liveReconnectStableTimer = null;
    if (liveReconnectEnabled && connectionNonce === liveConnectNonce && liveConnection === connection && connection?.isConnected) {
      liveReconnectAttempt = 0;
    }
  }, 30_000);
  liveReconnectStableTimer.unref?.();
}

function scheduleLiveReconnect(connectionNonce, details = {}) {
  if (!liveReconnectEnabled || !liveReconnectHasConnected || isQuitting || connectionNonce !== liveConnectNonce) return false;
  if (!shouldReconnectLive({ code: details?.code, reason: details?.reason, shuttingDown: isQuitting })) {
    stopLiveReconnectSession();
    return false;
  }
  if (liveReconnectTimer || liveReconnectInFlight || liveConnection) return true;
  if (liveReconnectAttempt >= LIVE_RECONNECT_DELAYS_MS.length) {
    const username = liveReconnectUsername;
    stopLiveReconnectSession();
    send('live:status', {
      status: 'error',
      username,
      message: 'Lulu no pudo recuperar el LIVE después de varios intentos. Pulsa Conectar para volver a intentarlo.'
    });
    return false;
  }

  liveReconnectAttempt += 1;
  const attemptNumber = liveReconnectAttempt;
  const delay = liveReconnectDelay(attemptNumber);
  const username = liveReconnectUsername;
  send('live:status', {
    status: 'connecting',
    username,
    reconnecting: true,
    attempt: attemptNumber,
    message: `La conexión se interrumpió. Lulu la recuperará automáticamente en ${Math.max(1, Math.ceil(delay / 1000))} s…`
  });
  appendConnectionLog('automatic-reconnect-scheduled', {
    username,
    attemptNumber,
    delay,
    code: Number(details?.code || 0),
    reason: String(details?.reason || '')
  });

  liveReconnectTimer = setTimeout(async () => {
    liveReconnectTimer = null;
    if (!liveReconnectEnabled || isQuitting || connectionNonce !== liveConnectNonce || liveConnection) return;
    liveReconnectInFlight = true;
    try {
      const result = await createAndConnectLive(username, connectionNonce, attemptNumber + 1);
      if (!liveReconnectEnabled || connectionNonce !== liveConnectNonce || liveConnection !== result.connection) {
        await safeDisconnect(result.connection);
        return;
      }
      markLiveConnectionEstablished(result.connection, connectionNonce);
      appendConnectionLog('automatic-reconnect-succeeded', { username, attemptNumber, roomId: result.roomId });
      send('live:status', {
        status: 'connected',
        username,
        roomId: result.roomId,
        reconnected: true,
        message: 'Lulu recuperó la conexión al LIVE automáticamente.'
      });
    } catch (error) {
      const failedConnection = liveConnection;
      if (liveConnection === failedConnection) liveConnection = null;
      await safeDisconnect(failedConnection);
      appendConnectionLog('automatic-reconnect-failed', { username, attemptNumber, error });
      liveReconnectInFlight = false;
      if (liveReconnectEnabled && connectionNonce === liveConnectNonce) {
        scheduleLiveReconnect(connectionNonce, { code: error?.code || 1006, reason: error?.message || String(error) });
      }
      return;
    } finally {
      liveReconnectInFlight = false;
    }
  }, delay);
  liveReconnectTimer.unref?.();
  return true;
}

function extractFanStickerEntries(data = {}) {
  const candidates = [];
  const append = (value) => {
    if (Array.isArray(value)) candidates.push(...value);
    else if (value && typeof value === 'object') candidates.push(value);
  };
  append(data.emotes);
  append(data.emoteList);
  append(data.stickers);
  append(data.stickerList);
  append(data.emote);
  const seen = new Set();
  return candidates.map((entry) => {
    const raw = entry?.emote || entry?.sticker || entry || {};
    const stickerId = String(raw.emoteId || raw.stickerId || raw.id || entry?.emoteId || entry?.stickerId || '').trim();
    const stickerName = String(raw.emoteName || raw.stickerName || raw.name || raw.displayName || entry?.emoteName || entry?.stickerName || '').trim();
    const image = raw.emoteImageUrl || raw.imageUrl || raw.image?.urlList?.[0] || raw.image?.url?.[0] || raw.image?.imageUrl || entry?.emoteImageUrl || entry?.imageUrl || '';
    const key = stickerId || image || stickerName;
    if (!key || seen.has(key)) return null;
    seen.add(key);
    return { stickerId, stickerName: stickerName || (stickerId ? `Sticker Fan ${stickerId}` : 'Sticker de Fan'), stickerImageUrl: String(image || '') };
  }).filter(Boolean);
}

function emitFanStickerEvents(data = {}, source = 'fan') {
  const user = data?.user || data?.sender || data || {};
  const uniqueId = String(user.uniqueId || user.displayId || user.userId || data?.uniqueId || data?.userId || '');
  const nickname = String(user.nickname || user.displayName || data?.nickname || uniqueId || 'Usuario');
  const messageId = String(data?.msgId || data?.messageId || data?.common?.msgId || '');
  const profilePictureUrl = user.profilePicture?.urlList?.[0] || user.avatarThumb?.urlList?.[0] || user.profilePictureUrl || data?.profilePictureUrl || '';
  const now = Date.now();
  for (const [key, timestamp] of fanStickerDedup) if (now - timestamp > 15000) fanStickerDedup.delete(key);
  extractFanStickerEntries(data).forEach((sticker) => {
    const dedupeKey = `${messageId}|${uniqueId}|${sticker.stickerId || sticker.stickerImageUrl || sticker.stickerName}`;
    if (fanStickerDedup.has(dedupeKey)) return;
    fanStickerDedup.set(dedupeKey, now);
    const stickerEventId = `fanSticker-${messageId || now}-${sticker.stickerId || Math.random()}`;
    void recordRankingMetric('fanStickers', { ...data, uniqueId, nickname, profilePictureUrl }, 1, stickerEventId);
    send('live:event', {
      id: stickerEventId,
      type: 'fanSticker',
      source,
      timestamp: now,
      uniqueId,
      nickname,
      profilePictureUrl,
      ...sticker
    });
  });
}

function attachLiveEvents(connection, connectionNonce) {
  const { WebcastEvent, ControlEvent } = connectorModule;

  connection.on(WebcastEvent.CHAT, (data) => {
    if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
    const user = data?.user || data?.sender || data || {};
    const messageId = String(data?.msgId || data?.messageId || `${Date.now()}-${Math.random()}`);
    const uniqueId = String(
      user.uniqueId
      || user.displayId
      || user.userId
      || user.userIdStr
      || data?.userId
      || `anon-${messageId}`
    );
    const nickname = String(
      user.nickname
      || user.nickName
      || user.displayName
      || user.uniqueId
      || 'Usuario'
    );
    const picture = user.profilePicture?.urlList?.[0]
      || user.avatarThumb?.urlList?.[0]
      || user.avatarMedium?.urlList?.[0]
      || '';

    const badges = Array.isArray(user.badgeList)
      ? user.badgeList
      : Array.isArray(user.badges)
        ? user.badges
        : [];
    const badgeText = badges.map((badge) => JSON.stringify(badge || {})).join(' ').toLowerCase();
    const memberLevel = Number(
      user.teamMemberLevel
      || user.memberLevel
      || data?.teamMemberLevel
      || data?.memberLevel
      || badges.map((badge) => Number(badge?.level || badge?.badgeLevel || 0)).find((level) => level > 0)
      || 0
    );
    const normalizedUniqueId = uniqueId.trim().replace(/^@/, '').toLowerCase();
    const isFollower = knownFollowers.has(normalizedUniqueId) || Boolean(
      user.isFollower
      || user.followInfo?.followStatus
      || user.followInfo?.follow_status
      || data?.isFollower
      || /follower|seguidor/.test(badgeText)
    );
    const isSubscriber = Boolean(
      user.isSubscriber
      || user.isSubscribing
      || data?.isSubscriber
      || memberLevel > 0
      || /subscriber|subscription|suscriptor|member|miembro/.test(badgeText)
    );

    void recordRankingMetric('comments', data, 1, `chat:${messageId}`);
    send('live:chat', {
      id: messageId,
      uniqueId,
      nickname,
      comment: String(data?.comment || data?.content || ''),
      profilePictureUrl: picture,
      isFollower,
      isSubscriber,
      memberLevel,
      badges: badges.slice(0, 8),
      timestamp: Date.now()
    });
    emitFanStickerEvents(data, 'chat');
  });

  const liveUser = (data = {}) => {
    const user = data?.user || data?.sender || data || {};
    return {
      uniqueId: String(user.uniqueId || user.displayId || user.userId || ''),
      nickname: String(user.nickname || user.displayName || user.uniqueId || 'Usuario'),
      profilePictureUrl: user.profilePicture?.urlList?.[0] || user.avatarThumb?.urlList?.[0] || ''
    };
  };
  const emitLiveEvent = (type, source = {}, extra = {}) => {
    if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
    const event = { id: `${type}-${Date.now()}-${Math.random()}`, type, timestamp: Date.now(), ...liveUser(source), ...extra };
    send('live:event', event);
    const metricMap = { follow:'follows', like:'likes', share:'shares', member:'members', subscribe:'subscribes' };
    if (metricMap[type]) void recordRankingMetric(metricMap[type], { ...source, ...event }, type === 'like' ? Number(extra.count || 0) : 1, `ranking:${event.id}:${metricMap[type]}`);
    if (type === 'gift') {
      void recordRankingMetric('coins', { ...source, ...event }, Number(extra.diamonds || extra.rewardUnits || 0), `ranking:${event.id}:coins`);
      void recordRankingMetric('gifts', { ...source, ...event }, Number(extra.repeatCount || 1), `ranking:${event.id}:gifts`);
    }
  };

  if (WebcastEvent.EMOTE) connection.on(WebcastEvent.EMOTE, (data) => {
    if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
    emitFanStickerEvents(data, 'fan');
  });

  if (WebcastEvent.GIFT) connection.on(WebcastEvent.GIFT, (data) => {
    const details = data?.giftDetails || {};
    const extended = data?.extendedGiftInfo || {};
    const giftType = Number(details?.giftType ?? extended?.giftType ?? data?.giftType ?? 0);
    const repeatEnd = Boolean(data?.repeatEnd);
    if (giftType === 1 && !repeatEnd) return;
    const repeatCount = Math.max(1, Number(data?.repeatCount || data?.repeat_count || 1));
    const giftId = String(data?.giftId || details?.giftId || details?.id || extended?.id || '');
    const available = Array.isArray(connection?.availableGifts)
      ? connection.availableGifts.find((gift) => String(gift?.id || gift?.gift_id || '') === giftId)
      : null;
    const diamondEach = Math.max(0, Number(
      extended?.diamondCount ?? extended?.diamond_count ?? extended?.diamondCost ??
      details?.diamondCount ?? details?.diamond_count ?? details?.diamondCost ??
      data?.diamondCount ?? data?.diamond_count ?? available?.diamond_count ?? available?.diamondCount ?? 0
    ));
    const diamonds = Math.max(0, Math.round(diamondEach * repeatCount));
    emitLiveEvent('gift', data, {
      giftName: String(details?.giftName || extended?.giftName || extended?.name || available?.name || `Regalo ${giftId}`).trim(),
      giftId,
      repeatCount,
      diamondEach,
      diamonds,
      rewardUnits: diamonds > 0 ? diamonds : repeatCount,
      diamondValueDetected: diamonds > 0
    });
  });

  if (WebcastEvent.FOLLOW) connection.on(WebcastEvent.FOLLOW, (data) => {
    const followerId = String(data?.user?.uniqueId || data?.user?.displayId || '').trim().replace(/^@/, '').toLowerCase();
    if (followerId) knownFollowers.add(followerId);
    emitLiveEvent('follow', data);
  });
  if (WebcastEvent.LIKE) connection.on(WebcastEvent.LIKE, (data) => {
    emitLiveEvent('like', data, { count: Number(data?.likeCount || 0), total: Number(data?.totalLikeCount || 0) });
    send('live:stats', { totalLikeCount: Number(data?.totalLikeCount || 0) });
  });
  if (WebcastEvent.SHARE) connection.on(WebcastEvent.SHARE, (data) => emitLiveEvent('share', data));
  if (WebcastEvent.MEMBER) connection.on(WebcastEvent.MEMBER, (data) => emitLiveEvent('member', data, { memberCount: Number(data?.memberCount || 0) }));
  if (WebcastEvent.SUB_NOTIFY) connection.on(WebcastEvent.SUB_NOTIFY, (data) => emitLiveEvent('subscribe', data));

  connection.on(WebcastEvent.ROOM_USER, (data) => {
    if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
    send('live:stats', { viewerCount: Number(data?.viewerCount || 0) });
  });

  connection.on(WebcastEvent.STREAM_END, () => {
    if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
    stopLiveReconnectSession();
    liveConnection = null;
    refreshAppSuspensionBlocker();
    void safeDisconnect(connection);
    send('live:status', { status: 'ended', message: 'El LIVE terminó.' });
  });

  if (ControlEvent?.CONNECTED) {
    connection.on(ControlEvent.CONNECTED, (state) => {
      appendConnectionLog('control-connected', { roomId: String(state?.roomId || '') });
    });
  }

  if (ControlEvent?.WEBSOCKET_CONNECTED) {
    connection.on(ControlEvent.WEBSOCKET_CONNECTED, () => {
      if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
      send('live:status', {
        status: 'connecting',
        username: connection.uniqueId,
        message: 'WebSocket abierto. Terminando de entrar a la sala…'
      });
      appendConnectionLog('websocket-open');
    });
  }

  if (ControlEvent?.DISCONNECTED) {
    connection.on(ControlEvent.DISCONNECTED, (details = {}) => {
      appendConnectionLog('control-disconnected', details);
      if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
      liveConnection = null;
      if (scheduleLiveReconnect(connectionNonce, details)) return;
      send('live:status', {
        status: 'disconnected',
        reason: details?.reason || 'remote'
      });
    });
  }

  if (ControlEvent?.ERROR) {
    connection.on(ControlEvent.ERROR, (error) => {
      appendConnectionLog('control-error', { error });
      if (connectionNonce !== liveConnectNonce || liveConnection !== connection) return;
      send('live:error', { message: friendlyConnectionError(error) });
    });
  }
}

async function disconnectLive(reason = 'manual') {
  stopLiveReconnectSession();
  liveConnectNonce += 1;
  const current = liveConnection;
  liveConnection = null;
  await safeDisconnect(current);
  refreshAppSuspensionBlocker();
  send('live:status', { status: 'disconnected', reason });
}

async function createAndConnectLive(username, connectionNonce, attemptNumber) {
  const relayUrl = EMBEDDED_RELAY_URL;
  const relayClientToken = EMBEDDED_RELAY_CLIENT_TOKEN;

  const connection = new RailwayRelayConnection(username, relayUrl, relayClientToken, connectorModule);
  liveConnection = connection;
  refreshAppSuspensionBlocker();
  attachLiveEvents(connection, connectionNonce);
  appendConnectionLog('railway-relay-attempt-start', { username, attemptNumber, hasClientToken: Boolean(relayClientToken) });

  send('live:status', {
    status: 'connecting',
    username,
    message: attemptNumber === 1
      ? 'Conectando con el servidor seguro de Railway…'
      : 'Reintentando la conexión con Railway…'
  });

  const state = await withTimeout(
    connection.connect(),
    28000,
    'El servidor Railway no respondió en 28 segundos.'
  );

  if (connectionNonce !== liveConnectNonce || liveConnection !== connection) {
    await safeDisconnect(connection);
    throw new Error('La conexión fue cancelada.');
  }

  return { connection, state, roomId: String(state?.roomId || connection.roomId || 'cloud') };
}

async function connectLive(rawUsername) {
  knownFollowers.clear();
  const username = cleanUsername(rawUsername);
  if (!username) throw new Error('Escribe el @usuario del creador que está en LIVE.');

  const old = liveConnection;
  stopLiveReconnectSession();
  liveConnection = null;
  liveConnectNonce += 1;
  const connectionNonce = liveConnectNonce;
  beginLiveReconnectSession(username);
  await safeDisconnect(old);

  send('live:status', {
    status: 'connecting',
    username,
    message: 'Preparando la conexión segura mediante Railway…'
  });

  try {
    if (!connectorModule) connectorModule = await import('tiktok-live-connector');
  } catch (error) {
    const message = `No se pudo cargar el conector de TikTok: ${error?.message || error}`;
    stopLiveReconnectSession();
    send('live:status', { status: 'error', username, message });
    throw new Error(message);
  }

  let lastError = null;
  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    try {
      const result = await createAndConnectLive(username, connectionNonce, attemptNumber);
      const payload = {
        status: 'connected',
        username,
        roomId: result.roomId,
        message: 'Conectado correctamente al LIVE.'
      };
      appendConnectionLog('connected', { username, roomId: result.roomId, attemptNumber });
      markLiveConnectionEstablished(result.connection, connectionNonce);
      send('live:status', payload);
      return payload;
    } catch (error) {
      lastError = error;
      const failedConnection = liveConnection;
      if (liveConnection === failedConnection) liveConnection = null;
      await safeDisconnect(failedConnection);
      appendConnectionLog('attempt-failed', { username, attemptNumber, error });

      if (connectionNonce !== liveConnectNonce || /cancelada/i.test(String(error?.message || ''))) {
        throw error;
      }
      if (attemptNumber < 2 && shouldRetryConnection(error)) {
        send('live:status', {
          status: 'connecting',
          username,
          message: 'La primera conexión no respondió. Reintentando una vez…'
        });
        await new Promise((resolve) => setTimeout(resolve, 1600));
        continue;
      }
      break;
    }
  }

  if (connectionNonce === liveConnectNonce) {
    liveConnection = null;
    stopLiveReconnectSession();
  }
  const message = friendlyConnectionError(lastError);
  send('live:status', { status: 'error', username, message });
  throw new Error(message);
}

function clearRuntimeAutomation() {
  stopLiveReconnectSession();
  liveConnectNonce += 1;
  youtubeAutomationNonce += 1;
  spotifyAutomationNonce += 1;
  if (youtubeAutomationTimer) clearTimeout(youtubeAutomationTimer);
  if (spotifyAutomationTimer) clearTimeout(spotifyAutomationTimer);
  youtubeAutomationTimer = null;
  spotifyAutomationTimer = null;
  clearInterval(musicRecoveryWatchdogTimer);
  musicRecoveryWatchdogTimer = null;
  for (const recovery of Object.values(musicRecoveryState)) {
    clearTimeout(recovery.recoveryTimer);
    recovery.recoveryTimer = null;
    recovery.expectedPlaying = false;
  }
}

function destroyWindowSafely(windowRef) {
  if (!windowRef || windowRef.isDestroyed()) return;
  try {
    windowRef.removeAllListeners('close');
    windowRef.destroy();
  } catch (error) {
    console.warn('No se pudo cerrar una ventana auxiliar:', error?.message || error);
  }
}

function releaseInactiveMusicProvider(provider='youtube'){
  if(provider==='spotify'){ markMusicExpected('youtube',false,false); clearYoutubeAutomation(); clearTimeout(youtubeResolverIdleTimer); youtubeResolverIdleTimer=null; destroyWindowSafely(youtubeResolverWindow); destroyWindowSafely(youtubeWindow); youtubeResolverWindow=null; youtubeWindow=null; }
  else { markMusicExpected('spotify',false,false); clearSpotifyAutomation(); destroyWindowSafely(spotifyWindow); spotifyWindow=null; }
}

function destroyAuxiliaryWindows() {
  destroyWindowSafely(youtubeResolverWindow);
  destroyWindowSafely(youtubeWindow);
  destroyWindowSafely(spotifyWindow);
  destroyWindowSafely(tiktokChatWindow);
  youtubeResolverWindow = null;
  youtubeWindow = null;
  spotifyWindow = null;
  tiktokChatWindow = null;
}

async function shutdownApplication(reason = 'user') {
  if (shutdownPromise) return shutdownPromise;
  isQuitting = true;
  refreshAppSuspensionBlocker();
  clearRuntimeAutomation();

  shutdownPromise = (async () => {
    const forceExitTimer = setTimeout(() => app.exit(0), 5000);
    forceExitTimer.unref?.();

    try {
      const currentConnection = liveConnection;
      liveConnection = null;
      await safeDisconnect(currentConnection);
    } finally {
      if (rankingWriteTimer) { clearTimeout(rankingWriteTimer); rankingWriteTimer = null; }
      if (rankingBroadcastTimer) { clearTimeout(rankingBroadcastTimer); rankingBroadcastTimer = null; }
      if (rankingDataCache) { try { await writeJson(getDataPaths().rankings, rankingDataCache); } catch {} }
      try { await stopOverlayServer(); } catch {}
      destroyAuxiliaryWindows();
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.removeAllListeners('close');
          mainWindow.destroy();
        } catch (error) {
          console.warn('No se pudo cerrar la ventana principal:', error?.message || error);
        }
      }
      mainWindow = null;
      clearTimeout(forceExitTimer);
      app.quit();

      // Respaldo para procesos de Chromium o audio que no respondan al cierre.
      const finalExitTimer = setTimeout(() => app.exit(0), 1200);
      finalExitTimer.unref?.();
      console.info(`Lulu Finity cerrada por: ${reason}`);
    }
  })();

  return shutdownPromise;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0d0b16',
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    try {
      const p = getDataPaths();
      const settings = { ...DEFAULT_SETTINGS, ...(await readJson(p.settings, DEFAULT_SETTINGS)) };
      if (settings.checkUpdatesOnStartup) {
        setTimeout(() => checkForAppUpdates(false).catch(() => {}), 2500);
      }
    } catch (error) {
      console.warn('No se pudo programar la búsqueda de actualizaciones:', error?.message || error);
    }
  });
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    void shutdownApplication('botón cerrar');
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.setName('Lulu Finity');
app.setAppUserModelId('com.mikasita.lulufinity');

async function startApplication() {
  await ensureDataFiles();
  await removeRetiredVoiceEngine();
  initializeUpdater();
  createWindow();
  startMusicRecoveryWatchdog();
  scheduleStableOverlayRecovery();
  setTimeout(() => { void flushStableOverlaySync(true); }, 1200).unref?.();
  powerMonitor.on('resume', () => {
    void flushStableOverlaySync(true);
    recoverActiveMusicPlayers('resume');
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.whenReady().then(startApplication).catch((error) => {
  console.error('Lulu Finity no pudo completar el arranque:', error);
  try { dialog.showErrorBox('Lulu Finity no pudo iniciar', error?.message || String(error)); } catch {}
  app.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isQuitting) {
    void shutdownApplication('todas las ventanas cerradas');
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  clearTimeout(stableOverlaySyncTimer);
  clearInterval(stableOverlayRecoveryTimer);
  stableOverlaySyncTimer = null;
  stableOverlayRecoveryTimer = null;
  refreshAppSuspensionBlocker();
  clearRuntimeAutomation();
  destroyAuxiliaryWindows();
  const currentConnection = liveConnection;
  liveConnection = null;
  if (currentConnection) currentConnection.disconnect().catch(() => {});
  void localVoiceManager?.release();
});

app.on('will-quit', () => {
  clearRuntimeAutomation();
  destroyAuxiliaryWindows();
  void localVoiceManager?.release();
});


const MEDIA_EXTENSIONS = {
  audio: new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']),
  image: new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])
};

async function pickAndCopyMedia(kind) {
  const type = kind === 'image' ? 'image' : 'audio';
  const filters = type === 'image'
    ? [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
    : [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'] }];
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: type === 'image' ? 'Elegir imagen' : 'Elegir sonido',
    properties: ['openFile'],
    filters
  });
  if (result.canceled || !result.filePaths?.[0]) return null;
  const source = result.filePaths[0];
  const extension = path.extname(source).toLowerCase();
  if (!MEDIA_EXTENSIONS[type].has(extension)) throw new Error(`Formato de ${type === 'image' ? 'imagen' : 'audio'} no compatible.`);
  const paths = getDataPaths();
  await fsp.mkdir(paths.media, { recursive: true });
  const destination = path.join(paths.media, `${type}-${Date.now()}-${randomUUID()}${extension}`);
  await fsp.copyFile(source, destination);
  const stats = await fsp.stat(destination);
  return {
    type,
    name: path.basename(source),
    path: destination,
    url: pathToFileURL(destination).href,
    size: stats.size
  };
}

ipcMain.handle('app:get-state', async () => {
  const p = getDataPaths();
  const settings = normalizeVoiceSettings({ ...DEFAULT_SETTINGS, ...(await readJson(p.settings, DEFAULT_SETTINGS)) });
  settings.streamWidgetThemes = normalizeStreamWidgetThemes(settings.streamWidgetThemes);
  settings.streamWidgetBackgrounds = normalizeStreamWidgetBackgrounds(settings.streamWidgetBackgrounds);
  settings.streamWidgetStyles = normalizeStreamWidgetStyles(settings.streamWidgetStyles);
  runtimeResourceSettings=settings;
  for (const key of normalizeActiveHttpsSources(settings.activeHttpsSources)) {
    const [kind, name] = key.split(':');
    queueStableOverlaySync(kind, name);
  }
  youtubeVolume=normalizedAudioVolume(settings.youtubeVolume,.8);
  spotifyVolume=normalizedAudioVolume(settings.spotifyVolume,.8);
  setYoutubeNetworkAdBlockEnabled(settings.youtubeAdBlockEnabled !== false);
  releaseInactiveMusicProvider(settings.musicProvider);
  const rendererSettings = { ...settings };
  delete rendererSettings.overlayRelaySecret;
  return {
    settings: rendererSettings,
    economy: null,
    version: app.getVersion(),
    dataDirectory: p.base,
    overlay: { screen:1, url:'', localUrl:'', connected:0, totalConnected:0, lazy:true },
    ranking: { slot:1, url:'', localUrl:'', connected:0, totalConnected:0, snapshot:null, lazy:true },
    widgets: {}
  };
});

ipcMain.handle('relay:usage', async () => {
  const settings = { ...DEFAULT_SETTINGS, ...(await readJson(getDataPaths().settings, DEFAULT_SETTINGS)) };
  return fetchRelayUsage(settings.username || '');
});

ipcMain.handle('settings:save', (_event, incoming) => queueStableOverlaySettings(async () => {
  const p = getDataPaths();
  const previous = await readJson(p.settings, DEFAULT_SETTINGS);
  const next = normalizeVoiceSettings({ ...DEFAULT_SETTINGS, ...previous, ...(incoming || {}) });
  next.blockedWords = Array.isArray(next.blockedWords) ? next.blockedWords : [];
  next.ignoredUsers = Array.isArray(next.ignoredUsers) ? next.ignoredUsers : [];
  next.allowedMusicUsers = Array.isArray(next.allowedMusicUsers) ? next.allowedMusicUsers : [];
  next.allowedTtsUsers = Array.isArray(next.allowedTtsUsers) ? next.allowedTtsUsers : [];
  next.userVoiceRules = Array.isArray(next.userVoiceRules) ? next.userVoiceRules : [];
  next.eventMediaRules = Array.isArray(next.eventMediaRules) ? next.eventMediaRules : [];
  next.pronunciationDictionary = Array.isArray(next.pronunciationDictionary)
    ? next.pronunciationDictionary.slice(0,250).map((item)=>({from:String(item?.from||'').slice(0,80),to:String(item?.to||'').slice(0,120)})).filter((item)=>item.from)
    : [];
  next.economyRewards = next.economyRewards && typeof next.economyRewards === 'object' ? next.economyRewards : DEFAULT_SETTINGS.economyRewards;
  next.musicProvider = next.musicProvider === 'spotify' ? 'spotify' : 'youtube';
  next.blockedSongs = Array.isArray(next.blockedSongs) ? next.blockedSongs : [];
  next.blockedChannels = Array.isArray(next.blockedChannels) ? next.blockedChannels : [];
  next.hiddenDashboardPanels = Array.isArray(next.hiddenDashboardPanels) ? next.hiddenDashboardPanels : [];
  next.customCommands = Array.isArray(next.customCommands) ? next.customCommands : DEFAULT_SETTINGS.customCommands;
  next.liveGameCommands = Array.isArray(next.liveGameCommands) ? next.liveGameCommands : DEFAULT_SETTINGS.liveGameCommands;
  next.automationRules = Array.isArray(next.automationRules) ? next.automationRules : DEFAULT_SETTINGS.automationRules;
  next.liveGoals = Array.isArray(next.liveGoals) ? next.liveGoals : DEFAULT_SETTINGS.liveGoals;
  next.streamWidgetThemes = normalizeStreamWidgetThemes(next.streamWidgetThemes);
  next.streamWidgetBackgrounds = normalizeStreamWidgetBackgrounds(next.streamWidgetBackgrounds);
  next.streamWidgetStyles = normalizeStreamWidgetStyles(next.streamWidgetStyles);
  delete next.eulerApiKey;
  delete next.relayUrl;
  delete next.relayClientToken;
  next.tiktokConnectionMode = 'railway-relay';
  setYoutubeNetworkAdBlockEnabled(next.youtubeAdBlockEnabled !== false);
  next.overlayToken = String(next.overlayToken || previous.overlayToken || randomUUID().replace(/-/g, ''));
  next.overlayRelaySecret = /^[a-f0-9]{64}$/i.test(String(previous.overlayRelaySecret || ''))
    ? previous.overlayRelaySecret
    : createHash('sha256').update(`${randomUUID()}:${randomUUID()}:${Date.now()}`).digest('hex');
  next.activeHttpsSources = normalizeActiveHttpsSources(previous.activeHttpsSources);
  next.firstInstalledVersion = String(previous.firstInstalledVersion || next.firstInstalledVersion || app.getVersion()).trim().slice(0, 64);
  next.lastSeenVersion = String(next.lastSeenVersion || '').trim().slice(0, 64);
  next.overlayScreenCount = 4;
  const rankingSource = Array.isArray(next.rankingOverlays) ? next.rankingOverlays : DEFAULT_RANKING_OVERLAYS;
  next.rankingOverlays = [1,2,3,4].map((slot) => normalizeRankingConfig(rankingSource[slot - 1], slot));
  await writeJson(p.settings, next);
  runtimeResourceSettings=next;
  youtubeVolume=normalizedAudioVolume(next.youtubeVolume,youtubeVolume);
  spotifyVolume=normalizedAudioVolume(next.spotifyVolume,spotifyVolume);
  releaseInactiveMusicProvider(next.musicProvider);
  scheduleRankingBroadcast();
  for (const key of next.activeHttpsSources) {
    const [kind, name] = key.split(':');
    queueStableOverlaySync(kind, name);
  }
  const rendererSettings = { ...next };
  delete rendererSettings.overlayRelaySecret;
  return rendererSettings;
}));

ipcMain.handle('ranking:get-info', async (_event, details) => rankingInfo(details?.slot));
ipcMain.handle('tts:list-local-voices', () => getLocalVoiceManager().list());
ipcMain.handle('tts:import-local-voice', () => getLocalVoiceManager().importVoice(mainWindow));
ipcMain.handle('tts:remove-local-voice', (_event,id) => getLocalVoiceManager().remove(id));
ipcMain.handle('tts:synthesize-local', (_event,request) => getLocalVoiceManager().synthesize(request));
ipcMain.handle('tts:release-local', () => getLocalVoiceManager().release());
ipcMain.handle('runtime:set-active-page', (_event,page) => { activeRendererPage=String(page||'dashboard').slice(0,40); activateRuntimeModuleForPage(activeRendererPage); return {ok:true,page:activeRendererPage,module:visibleRuntimeModule}; });
function runtimeWindowPid(win){
  if(!win||win.isDestroyed())return 0;
  try{return Number(win.webContents?.getOSProcessId?.()||win.webContents?.mainFrame?.processId||0);}catch{return 0;}
}

function runtimeProcessUsage(){
  const roleByPid=new Map([[Number(process.pid),'Núcleo']]);
  for(const [label,win] of [['Interfaz',mainWindow],['Spotify',spotifyWindow],['YouTube',youtubeWindow],['Buscador de YouTube',youtubeResolverWindow],['Cuenta TikTok',tiktokChatWindow]]){
    const pid=runtimeWindowPid(win);if(pid)roleByPid.set(pid,label);
  }
  const fallbackRole=(type)=>({Browser:'Núcleo',GPU:'Gráficos',Utility:'Servicios de Electron',Tab:'Renderizadores auxiliares','Zygote':'Servicios de Electron','Sandbox helper':'Servicios de Electron'}[String(type)]||'Otros procesos');
  const metrics=app.getAppMetrics();
  const totals=new Map();
  let workingSetKb=0;let privateKb=0;
  for(const metric of metrics){
    const memory=metric?.memory||{};
    const working=Math.max(0,Number(memory.workingSetSize)||0);
    const privateBytes=Math.max(0,Number(memory.privateBytes)||0);
    const role=roleByPid.get(Number(metric?.pid))||fallbackRole(metric?.type);
    workingSetKb+=working;privateKb+=privateBytes;
    totals.set(role,(totals.get(role)||0)+working);
  }
  const breakdown=[...totals.entries()].map(([label,kb])=>({label,memoryMb:Math.round(kb/1024)})).filter((item)=>item.memoryMb>0).sort((a,b)=>b.memoryMb-a.memoryMb);
  return{
    totalMemoryMb:Math.round(workingSetKb/1024),
    privateMemoryMb:Math.round(privateKb/1024),
    mainMemoryMb:breakdown.find((item)=>item.label==='Núcleo')?.memoryMb||0,
    processes:metrics.length,
    breakdown
  };
}

ipcMain.handle('runtime:status', async () => {
  const usage=runtimeProcessUsage();
  const settings=runtimeResourceSettings || DEFAULT_SETTINGS;
  return{
    activePage:activeRendererPage,
    memoryMb:usage.totalMemoryMb,
    ...usage,
    performanceProfile:settings.performanceProfile,
    balancedKeepActive:settings.balancedKeepActive,
    modules:{
      live:Boolean(liveConnection || liveReconnectEnabled), liveReconnect:{enabled:liveReconnectEnabled,attempt:liveReconnectAttempt,pending:Boolean(liveReconnectTimer || liveReconnectInFlight)}, localTts:localVoiceManager?{loaded:true,...localVoiceManager.status()}:{loaded:false,running:false,pid:null,pending:0,lastUsedAt:0},
      youtube:Boolean(youtubeWindow&&!youtubeWindow.isDestroyed()), spotify:Boolean(spotifyWindow&&!spotifyWindow.isDestroyed()),
      overlayServer:Boolean(overlayServer), overlayClients:overlayClientCount()+rankingClientCount()+streamWidgetClientCount(),
      gamesLoaded:Boolean(liveGameManager), automationsLoaded:Boolean(automationEngine), active:activeRuntimeModuleNames(), visible:visibleRuntimeModule
    }
  };
});
ipcMain.handle('runtime:release-idle', async (_event,details={}) => {
  const settings=runtimeResourceSettings || DEFAULT_SETTINGS;
  const force=details?.force===true;
  const requested=details?.activeServices&&typeof details.activeServices==='object'?details.activeServices:{};
  const nativeActive=(key)=>{
    if(key==='live')return Boolean(liveConnection||liveReconnectEnabled||liveReconnectTimer||liveReconnectInFlight);
    if(key==='voice')return Boolean(localVoiceManager?.status?.().pending);
    if(key==='music')return Boolean(details?.keepMusic);
    if(key==='overlays'||key==='rankings')return Boolean(overlayClientCount()+rankingClientCount()+streamWidgetClientCount()>0||(overlayPublicBaseUrl&&overlayTunnelProcess&&!overlayTunnelProcess.killed));
    if(key==='games')return Boolean(liveGameManager?.blackjackHands?.size);
    return requested[key]===true;
  };
  const prepared=(key)=>!force&&(settings.performanceProfile==='instant'||(settings.performanceProfile==='balanced'&&settings.balancedKeepActive?.[key]===true));
  const keep=(key)=>nativeActive(key)||prepared(key);
  const protectedCategories=[];
  if(keep('voice'))protectedCategories.push('voice');else{await localVoiceManager?.release();if(visibleRuntimeModule!=='tts')activeRuntimeModules.delete('tts');}
  clearTimeout(youtubeResolverIdleTimer);youtubeResolverIdleTimer=null;
  destroyWindowSafely(youtubeResolverWindow);youtubeResolverWindow=null;
  const preserveMusic=keep('music');
  if(preserveMusic){releaseInactiveMusicProvider(settings.musicProvider);protectedCategories.push('music');}
  else{clearYoutubeAutomation();clearSpotifyAutomation();destroyWindowSafely(youtubeWindow);destroyWindowSafely(spotifyWindow);youtubeWindow=null;spotifyWindow=null;activeRuntimeModules.delete('music');}
  if(!keep('account')&&tiktokChatWindow&&!tiktokChatWindow.isDestroyed()&&!tiktokChatWindow.isVisible()){destroyWindowSafely(tiktokChatWindow);tiktokChatWindow=null;activeRuntimeModules.delete('account');}else if(keep('account'))protectedCategories.push('account');
  const overlayInUse=nativeActive('overlays');
  if(!keep('overlays')&&!keep('rankings')&&!overlayInUse){await stopOverlayServer();activeRuntimeModules.delete('overlays');activeRuntimeModules.delete('rankings');}else{if(keep('overlays'))protectedCategories.push('overlays');if(keep('rankings'))protectedCategories.push('rankings');}
  if(!keep('automations')){automationEngine=null;try{delete require.cache[require.resolve('./automation-engine')];}catch{}activeRuntimeModules.delete('automations');}else protectedCategories.push('automations');
  const gameInUse=nativeActive('games');
  if(!keep('games')&&!gameInUse){liveGameManager=null;try{delete require.cache[require.resolve('./live-games')];}catch{}activeRuntimeModules.delete('games');}else if(keep('games'))protectedCategories.push('games');
  for(const key of ['live','commands','economy']){if(keep(key))protectedCategories.push(key);else if(key!=='live'||!liveConnection)activeRuntimeModules.delete(key);}
  refreshAppSuspensionBlocker();
  return {ok:true,keptMusic:preserveMusic,protectedCategories,activeServices:Object.fromEntries(['live','voice','music','overlays','rankings','automations','commands','games','economy'].map((key)=>[key,nativeActive(key)])),profile:settings.performanceProfile};
});
ipcMain.handle('ranking:copy-url', async (_event, details) => { const info = await rankingInfo(details?.slot, true); if (info.url) clipboard.writeText(info.url); return info; });
ipcMain.handle('ranking:copy-local-url', async (_event, details) => { const info = await rankingInfo(details?.slot, false); clipboard.writeText(info.localUrl); return info; });
ipcMain.handle('ranking:refresh', async (_event, details) => { const slot = normalizeRankingSlot(details?.slot); await broadcastRankingSlot(slot); return rankingInfo(slot); });
ipcMain.handle('ranking:reset', async (_event, details) => resetRankingData(details?.type));

ipcMain.handle('widget:get-info', async (_event, details) => streamWidgetInfo(details?.type));
ipcMain.handle('widget:copy-url', async (_event, details) => { const info = await streamWidgetInfo(details?.type, true); if (info.url) clipboard.writeText(info.url); return info; });
ipcMain.handle('widget:copy-local-url', async (_event, details) => { const info = await streamWidgetInfo(details?.type, false); clipboard.writeText(info.localUrl); return info; });
ipcMain.handle('widget:update', async (_event, details) => setStreamWidgetState(details?.type, details?.payload || {}));
ipcMain.handle('widget:apply-design', async (_event, details) => {
  const type = normalizeStreamWidgetType(details?.type);
  const synced = await ensureStableOverlaySource('widget', type);
  const info = await streamWidgetInfo(type, false);
  return { ...info, designSynced:Boolean(synced.ok), syncMessage:synced.message || '' };
});

ipcMain.handle('overlay:get-info', async (_event, details) => overlayInfo(details?.screen));
ipcMain.handle('overlay:copy-url', async (_event, details) => { const info = await overlayInfo(details?.screen, true); if (info.url) clipboard.writeText(info.url); return info; });
ipcMain.handle('overlay:copy-local-url', async (_event, details) => { const info = await overlayInfo(details?.screen, false); clipboard.writeText(info.localUrl); return info; });
ipcMain.handle('overlay:show', async (_event, details) => showStreamOverlay(details));
ipcMain.handle('overlay:clear', async (_event, details) => {
  const screen = normalizeOverlayScreen(details?.screen);
  const payload = setOverlayState(screen, { type:'clear', id:randomUUID() });
  const delivered = broadcastOverlay(screen, payload);
  const stable = await stableOverlaySourceStatus('screen', String(screen), false);
  if (stable.ok) await syncStableOverlaySource('screen', String(screen)).catch(() => {});
  return { ok: overlayClientCount(screen) > 0 || stable.ok, delivered:Math.max(delivered, stable.ok ? 1 : 0), screen };
});

ipcMain.handle('widget:import-image', async () => {
  const selected = await dialog.showOpenDialog(mainWindow || undefined, { title:'Elegir imagen para el widget', properties:['openFile'], filters:[{name:'Imágenes', extensions:['png','jpg','jpeg','webp','bmp']}] });
  if (selected.canceled || !selected.filePaths?.[0]) return null;
  const source = selected.filePaths[0];
  const stats = await fsp.stat(source);
  if (!stats.isFile() || stats.size > 12 * 1024 * 1024) throw new Error('Elige una imagen de hasta 12 MB.');
  const { nativeImage } = require('electron');
  let image = nativeImage.createFromPath(source);
  if (image.isEmpty()) throw new Error('No se pudo abrir esta imagen.');
  const size = image.getSize();
  if (Math.max(size.width, size.height) > 1920) image = image.resize(size.width >= size.height ? {width:1920} : {height:1920});
  const bytes = image.toPNG();
  if (bytes.length > 12 * 1024 * 1024) throw new Error('La imagen es demasiado grande; elige otra.');
  const name = createHash('sha256').update(bytes).digest('hex') + '.png';
  const media = getDataPaths().media;
  await fsp.mkdir(media, {recursive:true});
  await fsp.writeFile(path.join(media,name),bytes);
  return {url:'/overlay-media/' + name, name:path.basename(source)};
});

ipcMain.handle('media:pick', async (_event, kind) => pickAndCopyMedia(kind));
ipcMain.handle('economy:get', async () => economySnapshot());
ipcMain.handle('economy:balance', async (_event, details) => {
  const snapshot = await economySnapshot();
  const user = normalizeEconomyUser(details?.user);
  const account = snapshot.balances.find((item) => item.user === user);
  const settings = { ...DEFAULT_SETTINGS, ...(await readJson(getDataPaths().settings, DEFAULT_SETTINGS)) };
  return { user, balance: account ? account.balance : Math.round(Number(settings.economyStartingBalance || 0)), found: Boolean(account) };
});
ipcMain.handle('economy:mutate', async (_event, details) => mutateEconomy(details));
ipcMain.handle('games:play', async (_event, details) => getLiveGameManager().play(details || {}));
ipcMain.handle('automations:evaluate', async (_event, details = {}) => getAutomationEngine().evaluateAutomations(details.rules, details.event, details.context));
ipcMain.handle('goals:apply-event', async (_event, details = {}) => getAutomationEngine().applyGoalEvent(details.goals, details.event));
ipcMain.handle('goals:reset', async (_event, details = {}) => getAutomationEngine().resetGoal(details.goals, details.goalId));
ipcMain.handle('gifts:update-stats', async (_event, details = {}) => getAutomationEngine().updateGiftStats(details.state, details.event));
ipcMain.handle('widget:publish', async (_event, details) => {
  const type=String(details?.type||'');
  if (!STREAM_WIDGET_TYPES.has(type) || ['playlist','wallet','game'].includes(type)) throw new Error('Widget no publicable.');
  setStreamWidgetState(type,{ ...(details?.snapshot||{}), type, updatedAt:Date.now() });
  return { ok:true };
});
function packagedDefaultSoundsDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'lulu-default-sounds')
    : path.join(__dirname, 'default-sounds');
}
ipcMain.handle('sounds:list-default', async () => defaultSoundCatalog(packagedDefaultSoundsDirectory()));
ipcMain.handle('sounds:open-source', async () => {
  await shell.openExternal(DEFAULT_SOUND_SOURCE_URL);
  return { ok:true, url:DEFAULT_SOUND_SOURCE_URL };
});
ipcMain.handle('alerts:pick-sound', async () => {
  const result=await dialog.showOpenDialog({ title:'Elegir sonido para Lulu', properties:['openFile'], filters:[{name:'Audio',extensions:['mp3','wav','ogg','m4a','aac','flac']}] });
  if (result.canceled || !result.filePaths?.[0]) return null;
  const fs=require('fs'), path=require('path'), {pathToFileURL}=require('url');
  const source=result.filePaths[0], dir=path.join(app.getPath('userData'),'alert-sounds');
  fs.mkdirSync(dir,{recursive:true});
  const ext=path.extname(source).toLowerCase().slice(0,8), base=path.basename(source,ext).replace(/[^a-z0-9 _.-]/gi,'').slice(0,80)||'sonido';
  const destination=path.join(dir,`${Date.now()}-${base}${ext}`);
  fs.copyFileSync(source,destination);
  return { name:path.basename(source), path:destination, url:pathToFileURL(destination).href };
});
ipcMain.handle('automations:webhook', async (_event, details) => {
  const target=String(details?.url||'').trim();
  if (!/^https?:\/\//i.test(target)) throw new Error('El webhook debe usar HTTP o HTTPS.');
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),8000);
  try {
    const method=String(details?.method||'POST').toUpperCase()==='GET'?'GET':'POST';
    const options={method,signal:controller.signal,headers:{'User-Agent':`Lulu-Finity/${app.getVersion()}`,'Accept':'application/json,text/plain,*/*'}};
    if(method==='POST'){options.headers['Content-Type']='application/json';options.body=JSON.stringify(details?.body||{});}
    const response=await fetch(target,options);
    return { ok:response.ok, status:response.status };
  } finally { clearTimeout(timer); }
});

ipcMain.handle('tiktok-chat:open', async (_event, details) => openTikTokChat(details?.username));
ipcMain.handle('tiktok-chat:status', async () => emitTikTokChatStatus(await inspectTikTokChatWindow()));
ipcMain.handle('tiktok-chat:send', async (_event, details) => sendTikTokChatMessage(details));
ipcMain.handle('tiktok-chat:reset', async () => resetTikTokChatSession());

ipcMain.handle('youtube:resolve', async (_event, details) => resolveYoutubeRequest(details?.query, details?.suffix));
ipcMain.handle('youtube:open', async (_event, details) => openYoutube(details?.query, details?.suffix));
ipcMain.handle('youtube:home', async () => {
  const result = await openYoutube('', '');
  const win = createYoutubeWindow();
  win.show();
  win.focus();
  send('youtube:status', { ...result, visible: true });
  return result;
});
ipcMain.handle('youtube:show', async () => {
  await ensureYoutubeNetworkAdBlocker();
  const win = createYoutubeWindow();
  if (!win.webContents.getURL()) await win.loadURL('https://www.youtube.com/');
  win.show();
  win.focus();
  send('youtube:status', { open: true, visible: true, muted: youtubeMuted });
  return true;
});
ipcMain.handle('youtube:control', async (_event, details) => controlYoutubePlayer(details?.action, details?.value));
ipcMain.handle('youtube:continue-recommended', async () => controlYoutubePlayer('continue-recommended'));
ipcMain.handle('youtube:set-volume', async (_event, volume) => setYoutubeVolume(volume));
ipcMain.handle('youtube:mute', async (_event, muted) => {
  youtubeMuted = Boolean(muted);
  if (youtubeWindow && !youtubeWindow.isDestroyed()) youtubeWindow.webContents.setAudioMuted(Boolean(youtubeMuted || youtubeAdGuardMuted));
  send('youtube:status', { open: Boolean(youtubeWindow && !youtubeWindow.isDestroyed()), visible: Boolean(youtubeWindow && !youtubeWindow.isDestroyed() && youtubeWindow.isVisible()), muted: youtubeMuted });
  return youtubeMuted;
});
ipcMain.handle('youtube:external', async (_event, details) => {
  const target = youtubeTarget(details?.query, details?.suffix);
  await openExternalUrl(target);
  return target;
});

ipcMain.handle('spotify:open', async (_event, details) => openSpotify(details?.query));
ipcMain.handle('spotify:show', async () => {
  const win = createSpotifyWindow();
  if (!win.webContents.getURL()) await win.loadURL('https://open.spotify.com/');
  win.show(); win.focus();
  send('spotify:status', { open: true, visible: true, muted: spotifyMuted });
  return { open: true, visible: true, muted: spotifyMuted };
});
ipcMain.handle('spotify:control', async (_event, details) => controlSpotifyPlayer(details?.action, details?.value));
ipcMain.handle('spotify:set-volume', async (_event, volume) => setSpotifyVolume(volume));
ipcMain.handle('spotify:mute', async (_event, muted) => {
  spotifyMuted = Boolean(muted);
  if (spotifyWindow && !spotifyWindow.isDestroyed()) spotifyWindow.webContents.setAudioMuted(spotifyMuted);
  send('spotify:status', { open: Boolean(spotifyWindow && !spotifyWindow.isDestroyed()), visible: Boolean(spotifyWindow && !spotifyWindow.isDestroyed() && spotifyWindow.isVisible()), muted: spotifyMuted });
  return spotifyMuted;
});
ipcMain.handle('spotify:desktop', async (_event, details) => openSpotifyDesktop(details?.query));
ipcMain.handle('spotify:external', async (_event, details) => shell.openExternal(spotifyTarget(details?.query)));

ipcMain.handle('live:connect', async (_event, username) => connectLive(username));
ipcMain.handle('live:disconnect', async () => disconnectLive('manual'));
ipcMain.handle('tts:list-online-voices', async (_event, options) => listOnlineVoices(options));
ipcMain.handle('tts:synthesize-online', async (_event, request) => synthesizeOnlineVoice(request));
ipcMain.handle('tts:list-tiktok-voices', () => listTikTokVoices());
ipcMain.handle('tts:synthesize-tiktok', async (_event, request) => synthesizeTikTokVoice(request));
ipcMain.handle('update:check', async (_event, manual) => checkForAppUpdates(Boolean(manual)));
ipcMain.handle('update:install', async () => {
  if (!updateDownloaded) return false;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
});
ipcMain.handle('update:rollback-v027', async () => {
  const url='https://github.com/Mikasita25/Lulu-Finity/releases/download/v0.27.0/Lulu-Finity-Setup-0.27.0.exe';
  await shell.openExternal(url); return {ok:true,version:'0.27.0',url};
});
ipcMain.handle('update:open-repository', async () => {
  await shell.openExternal(UPDATE_REPOSITORY_URL);
  return UPDATE_REPOSITORY_URL;
});
ipcMain.handle('update:open-releases', async () => {
  await shell.openExternal(UPDATE_RELEASES_URL);
  return UPDATE_RELEASES_URL;
});

function ciSmokeMarker(name) {
  const runnerRoot = String(process.env.RUNNER_TEMP || '').trim();
  const marker = String(process.env[name] || '').trim();
  if (process.env.CI !== 'true' || !runnerRoot || !marker) return;
  const allowedRoot = path.resolve(runnerRoot);
  const markerPath = path.resolve(marker);
  if (!markerPath.startsWith(`${allowedRoot}${path.sep}`)) return;
  return markerPath;
}

ipcMain.on('app:renderer-ready', async (event) => {
  const startupMarker = ciSmokeMarker('LULU_STARTUP_SMOKE_MARKER');
  if (startupMarker) {
    try { fs.writeFileSync(startupMarker, 'ready', { encoding:'utf8', flag:'wx' }); }
    catch (error) { console.error('No se pudo escribir la marca de arranque:', error); }
  }
  const navigationMarker = ciSmokeMarker('LULU_NAVIGATION_SMOKE_MARKER');
  const contents = event?.sender || mainWindow?.webContents;
  if (!navigationMarker || !contents?.executeJavaScript) return;
  try {
    const result = await contents.executeJavaScript(`(async()=>{
      const pages=[...document.querySelectorAll('.main-content > .page')];
      const results=[];
      for(const page of pages){
        const name=String(page.id||'').replace(/^page-/,'');
        const changed=typeof goToPage==='function'&&goToPage(name,{activateModules:false,notifyMain:false,scroll:false});
        await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const visible=[...document.querySelectorAll('.main-content > .page.active:not([hidden])')];
        let ancestor=page.parentElement;let hiddenAncestor=false;
        while(ancestor&&ancestor!==document.body){if(ancestor.hidden||getComputedStyle(ancestor).display==='none'){hiddenAncestor=true;break;}ancestor=ancestor.parentElement;}
        results.push({name,changed:Boolean(changed),active:page.classList.contains('active'),hidden:page.hidden,inert:page.inert,ariaHidden:page.getAttribute('aria-hidden'),display:getComputedStyle(page).display,visibleCount:visible.length,hiddenAncestor});
      }
      for(const name of ['rankings','automations','games']){
        goToPage(name,{activateModules:true,notifyMain:false,scroll:false});
        await new Promise((resolve)=>setTimeout(resolve,900));
      }
      const previewDeadline=Date.now()+20000;
      while(Date.now()<previewDeadline&&document.querySelectorAll('.stream-widget-preview.preview-ready,.ranking-preview-shell.preview-ready').length<7){
        await new Promise((resolve)=>setTimeout(resolve,250));
      }
      const csp=String(document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content||'');
      const previews={
        fallbackCount:document.querySelectorAll('[data-preview-fallback]').length,
        readyCount:document.querySelectorAll('.stream-widget-preview.preview-ready,.ranking-preview-shell.preview-ready').length,
        frameSources:[...document.querySelectorAll('#rankingPreviewFrame,[id$="WidgetPreviewFrame"]')].filter((frame)=>{try{const url=new URL(frame.src);return url.protocol==='http:'&&url.hostname==='127.0.0.1'&&Number(url.port)>0}catch{return false}}).length,
        cspAllowsLocalFrames:csp.includes('frame-src http://127.0.0.1:*')
      };
      const widgetEditors={
        count:document.querySelectorAll('[data-widget-style-editor]').length,
        primaryColors:document.querySelectorAll('[data-widget-style-field="primaryColor"]').length,
        secondaryColors:document.querySelectorAll('[data-widget-style-field="secondaryColor"]').length,
        backgroundColors:document.querySelectorAll('[data-widget-style-field="backgroundColor"]').length,
        goalBarControls:document.querySelectorAll('[data-widget-style-editor="goal"] [data-widget-style-field="goalBarHeight"]').length
      };
      goToPage('dashboard',{activateModules:false,notifyMain:false,scroll:false});
      return {ok:results.length>0&&results.every((item)=>item.changed&&item.active&&!item.hidden&&!item.inert&&item.ariaHidden==='false'&&item.display!=='none'&&item.visibleCount===1&&!item.hiddenAncestor)&&previews.fallbackCount===7&&previews.readyCount===7&&previews.frameSources>=1&&previews.cspAllowsLocalFrames&&widgetEditors.count===6&&widgetEditors.primaryColors===6&&widgetEditors.secondaryColors===6&&widgetEditors.backgroundColors===6&&widgetEditors.goalBarControls===1,results,previews,widgetEditors};
    })()`, true);
    fs.writeFileSync(navigationMarker, JSON.stringify(result), { encoding:'utf8', flag:'wx' });
  } catch (error) {
    try { fs.writeFileSync(navigationMarker, JSON.stringify({ok:false,error:error?.message||String(error)}), { encoding:'utf8', flag:'wx' }); } catch {}
    console.error('Falló la prueba de navegación:', error);
  }
});

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => { void shutdownApplication('botón cerrar'); });
