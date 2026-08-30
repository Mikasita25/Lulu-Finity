'use strict';

const http = require('http');
const { URL } = require('url');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const { KeyPool, parseList } = require('./key-pool');
const { classifyUpstreamFailure } = require('./failure-classifier');
const { DailyUsageMeter } = require('./usage-meter');
const { MICROSOFT_VOICES, synthesizeMicrosoftSpeech } = require('./microsoft-tts');
const { MAX_ASSET_BYTES, MAX_SOURCE_BYTES, OverlayStore, safePublicId, safeSource } = require('./overlay-store');
const { overlayPageCsp, renderOverlayPage } = require('./overlay-page');

const PORT = Math.max(1, Number(process.env.PORT || 3000));
const UPSTREAM_WS_URL = String(process.env.UPSTREAM_WS_URL || 'wss://ws.eulerstream.com').trim();
const CLIENT_TOKENS = new Set(parseList(process.env.CLIENT_TOKENS || process.env.CLIENT_TOKEN));
const TTS_CLIENT_TOKENS = new Set(parseList(
  process.env.TTS_CLIENT_TOKENS || process.env.CLIENT_TOKENS || process.env.CLIENT_TOKEN
));
const MAX_CLIENTS = Math.max(1, Number(process.env.MAX_CLIENTS || 50));
const MAX_ATTEMPTS_PER_MINUTE = Math.max(1, Number(process.env.MAX_CONNECTION_ATTEMPTS_PER_MINUTE || 30));
const MAX_TTS_REQUESTS_PER_MINUTE = Math.max(1, Number(process.env.MAX_TTS_REQUESTS_PER_MINUTE || 90));
const MAX_TTS_CONCURRENT = Math.max(1, Number(process.env.MAX_TTS_CONCURRENT || 4));
const RELAY_BUILD = 'microsoft-tts-on-demand-music-widget-v4';
const UPSTREAM_OPEN_TIMEOUT_MS = Math.max(3000, Number(process.env.UPSTREAM_OPEN_TIMEOUT_MS || 18000));
const DAILY_USAGE_LIMIT = Math.max(1, Number(process.env.DAILY_USAGE_LIMIT || 7500));
const USAGE_PER_CONNECTION = Math.max(0.1, Number(process.env.USAGE_PER_CONNECTION || 2));
const USER_DAILY_CONNECTION_LIMIT = Math.max(1, Number(process.env.USER_DAILY_CONNECTION_LIMIT || 600));
const USAGE_STATE_FILE = String(process.env.USAGE_STATE_FILE || '').trim();
const usageMeter = new DailyUsageMeter({
  limit: DAILY_USAGE_LIMIT,
  perConnection: USAGE_PER_CONNECTION,
  userLimit: USER_DAILY_CONNECTION_LIMIT,
  stateFile: USAGE_STATE_FILE || undefined
});
const keyPool = new KeyPool(parseList(process.env.EULER_API_KEYS), {
  cooldownMs: process.env.KEY_COOLDOWN_MS,
  quotaCooldownMs: process.env.QUOTA_COOLDOWN_MS,
  maxConnectionsPerKey: process.env.MAX_CONNECTIONS_PER_KEY
});
const overlayStore = new OverlayStore({ root: process.env.OVERLAY_STATE_DIR });

if (!keyPool.size) {
  console.error('[startup] EULER_API_KEYS está vacío. Configura al menos una clave en Railway.');
  process.exit(1);
}

let activeClients = 0;
let activeTtsRequests = 0;
let shuttingDown = false;
const attemptsByIp = new Map();
const ttsAttemptsByIp = new Map();
const sessions = new Set();

function cleanUsername(value) {
  return String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
}

function requestIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || request.socket.remoteAddress || 'unknown';
}

function rateLimitAllows(ip, now = Date.now()) {
  const windowStart = now - 60_000;
  const current = (attemptsByIp.get(ip) || []).filter((time) => time >= windowStart);
  current.push(now);
  attemptsByIp.set(ip, current);
  return current.length <= MAX_ATTEMPTS_PER_MINUTE;
}

function ttsRateLimitAllows(ip, now = Date.now()) {
  const windowStart = now - 60_000;
  const current = (ttsAttemptsByIp.get(ip) || []).filter((time) => time >= windowStart);
  current.push(now);
  ttsAttemptsByIp.set(ip, current);
  return current.length <= MAX_TTS_REQUESTS_PER_MINUTE;
}

function suppliedToken(request) {
  const authorization = String(request.headers.authorization || '');
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim();
  return String(request.headers['x-lulu-client-token'] || '').trim();
}

function authorized(request) {
  if (!CLIENT_TOKENS.size) return true;
  return CLIENT_TOKENS.has(suppliedToken(request));
}

function authorizedTts(request) {
  if (!TTS_CLIENT_TOKENS.size) return true;
  return TTS_CLIENT_TOKENS.has(suppliedToken(request));
}

function readJsonBody(request, maxBytes = 4096) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    request.on('data', (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maxBytes) {
        rejected = true;
        const error = new Error('La solicitud es demasiado grande.');
        error.statusCode = 413;
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (rejected) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        const error = new Error('El cuerpo debe ser JSON válido.');
        error.statusCode = 400;
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function readBufferBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    request.on('data', (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maxBytes) {
        rejected = true;
        reject(Object.assign(new Error('La solicitud es demasiado grande.'), { statusCode: 413 }));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks)); });
    request.on('error', reject);
  });
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  try { socket.send(JSON.stringify(payload)); } catch {}
}

class RelaySession {
  constructor(client, request, uniqueId) {
    this.client = client;
    this.request = request;
    this.uniqueId = uniqueId;
    this.upstream = null;
    this.key = null;
    this.closed = false;
    this.attempted = new Set();
    this.rotationCount = 0;
    this.openTimer = null;
  }

  start() {
    this.connectNext('initial');
  }

  releaseCurrentKey() {
    if (this.key) keyPool.release(this.key.id);
    this.key = null;
  }

  closeUpstream() {
    const socket = this.upstream;
    this.upstream = null;
    if (!socket) return;
    socket.removeAllListeners();
    try { socket.close(1000, 'relay rotation'); } catch {}
    try { socket.terminate(); } catch {}
  }

  connectNext(trigger, lastMessage = '') {
    if (this.closed || this.client.readyState !== WebSocket.OPEN || shuttingDown) return;
    this.closeUpstream();
    this.releaseCurrentKey();
    clearTimeout(this.openTimer);

    let selected = keyPool.acquire(this.attempted);
    if (!selected && this.attempted.size) {
      this.attempted.clear();
      selected = keyPool.acquire(this.attempted);
    }
    if (!selected) {
      const nextAt = keyPool.nextAvailability();
      const waitMs = nextAt ? Math.max(1000, nextAt - Date.now()) : 0;
      const message = waitMs
        ? `Todas las API keys están ocupadas o en enfriamiento. Próximo intento en ${Math.ceil(waitMs / 1000)} segundos.`
        : 'No hay API keys disponibles. Revisa límites, claves inválidas y MAX_CONNECTIONS_PER_KEY.';
      sendJson(this.client, { type: 'lulu.relay.error', data: { message, trigger, lastMessage } });
      this.client.close(1013, message.slice(0, 120));
      return;
    }

    this.key = selected;
    this.attempted.add(selected.id);
    this.rotationCount += 1;
    sendJson(this.client, {
      type: 'lulu.relay.status',
      data: { state: this.rotationCount === 1 ? 'connecting' : 'rotating', attempt: this.rotationCount, keyId: selected.id }
    });

    const params = new URLSearchParams({
      uniqueId: this.uniqueId,
      apiKey: selected.secret,
      'features.bundleEvents': 'true',
      'features.rawMessages': 'false',
      'features.normalizeUniqueId': 'true',
      'features.schemaVersion': 'v2',
      'features.syntheticPresence': 'true'
    });
    const separator = UPSTREAM_WS_URL.includes('?') ? '&' : '?';
    const upstreamUrl = `${UPSTREAM_WS_URL}${separator}${params.toString()}`;
    const upstream = new WebSocket(upstreamUrl, {
      handshakeTimeout: UPSTREAM_OPEN_TIMEOUT_MS,
      headers: { 'User-Agent': 'Lulu-Finity-Railway-Relay/1.0' }
    });
    this.upstream = upstream;
    let opened = false;
    let handledFailure = false;

    const rotate = (code, reason, error = null) => {
      if (handledFailure || this.closed) return;
      handledFailure = true;
      clearTimeout(this.openTimer);
      const classification = classifyUpstreamFailure(code, reason, error);
      const detail = String(reason || error?.message || error || `código ${code || 0}`).slice(0, 180);
      if (classification === 'offline' || classification === 'normal' || classification === 'configuration') {
        this.releaseCurrentKey();
        const message = classification === 'offline'
          ? 'TikTok no detecta un LIVE activo para esta cuenta.'
          : classification === 'configuration'
            ? 'La configuración enviada al proveedor no es válida; rotar claves no resolvería este error.'
            : 'La conexión terminó normalmente.';
        sendJson(this.client, { type: 'lulu.relay.error', data: { message, classification } });
        this.client.close(classification === 'offline' ? 4404 : classification === 'configuration' ? 4400 : 1000, message);
        return;
      }
      if (classification === 'quota') keyPool.markQuotaLimit(selected.id, detail);
      else if (classification === 'temporary-limit') keyPool.markTemporaryLimit(selected.id, detail);
      else if (classification === 'invalid') keyPool.markInvalid(selected.id, detail);
      else keyPool.markTemporaryLimit(selected.id, detail);
      this.connectNext(classification, detail);
    };

    this.openTimer = setTimeout(() => rotate(1006, 'Tiempo de apertura agotado'), UPSTREAM_OPEN_TIMEOUT_MS + 1000);
    upstream.on('open', () => {
      opened = true;
      clearTimeout(this.openTimer);
      keyPool.markSuccess(selected.id);
      sendJson(this.client, { type: 'lulu.relay.status', data: { state: 'connected', attempt: this.rotationCount, keyId: selected.id } });
    });
    upstream.on('message', (data, isBinary) => {
      if (this.closed || this.client.readyState !== WebSocket.OPEN) return;
      try { this.client.send(data, { binary: isBinary }); } catch {}
    });
    upstream.on('error', (error) => {
      if (!opened) rotate(1006, '', error);
    });
    upstream.on('close', (code, reasonBuffer) => {
      const reason = Buffer.isBuffer(reasonBuffer) ? reasonBuffer.toString('utf8') : String(reasonBuffer || '');
      rotate(code, reason);
    });
    upstream.on('pong', () => {});
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.openTimer);
    this.closeUpstream();
    this.releaseCurrentKey();
  }
}

function jsonHeaders() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, x-lulu-client-token',
    'access-control-allow-methods': 'GET, POST, PUT, OPTIONS'
  };
}

function sendHttpJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, { ...jsonHeaders(), 'x-content-type-options':'nosniff', ...extraHeaders });
  response.end(JSON.stringify(payload));
}

function noStorePageHeaders() {
  return {
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'content-security-policy':overlayPageCsp(),
    'cross-origin-resource-policy':'cross-origin',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
  };
}

async function handleHttpRequest(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
  if (request.method === 'OPTIONS') {
    response.writeHead(204, jsonHeaders());
    response.end();
    return;
  }
  if (request.method === 'GET' && url.pathname === '/health') {
    const snapshot = keyPool.snapshot();
    const usage = usageMeter.snapshot();
    response.writeHead(200, jsonHeaders());
    response.end(JSON.stringify({
      ok: true,
      service: 'lulu-finity-railway-relay',
      build: RELAY_BUILD,
      overlays: { stableHttps: true },
      uptimeSeconds: Math.round(process.uptime()),
      clients: activeClients,
      tts: { provider: 'microsoft-edge', activeRequests: activeTtsRequests, voices: MICROSOFT_VOICES.length },
      keys: { total: snapshot.total, available: snapshot.available, activeConnections: snapshot.activeConnections },
      usage: { used: usage.used, limit: usage.limit, percent: usage.percent, resetAt: usage.resetAt }
    }));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/usage') {
    response.writeHead(200, jsonHeaders());
    const uniqueId = cleanUsername(url.searchParams.get('uniqueId'));
    response.end(JSON.stringify({ ok: true, ...usageMeter.snapshot(), user: uniqueId ? usageMeter.userSnapshot(uniqueId) : null }));
    return;
  }
  if (request.method === 'GET' && parts[0] === 'overlays' && parts.length === 4) {
    const publicId = safePublicId(parts[1]);
    const source = safeSource(parts[2], parts[3]);
    if (!publicId || !source) return sendHttpJson(response, 404, { ok:false, error:'Not found' });
    response.writeHead(200, noStorePageHeaders());
    response.end(renderOverlayPage(publicId, source.kind, source.name));
    return;
  }
  if (parts[0] === 'v1' && parts[1] === 'overlays' && parts[3] === 'sources' && parts.length === 6) {
    const publicId = safePublicId(parts[2]);
    const source = safeSource(parts[4], parts[5]);
    if (!publicId || !source) return sendHttpJson(response, 404, { ok:false, error:'Not found' });
    if (request.method === 'GET') {
      const document = await overlayStore.getSource(publicId, source.kind, source.name);
      return document ? sendHttpJson(response, 200, document) : sendHttpJson(response, 404, { ok:false, error:'Source not registered' });
    }
    if (request.method === 'PUT') {
      overlayStore.authorize(publicId, suppliedToken(request));
      const data = await readJsonBody(request, MAX_SOURCE_BYTES);
      const document = await overlayStore.putSource(publicId, source.kind, source.name, data, suppliedToken(request));
      return sendHttpJson(response, 200, { ok:true, updatedAt:document.updatedAt });
    }
  }
  if (parts[0] === 'v1' && parts[1] === 'overlays' && parts[3] === 'assets' && parts.length === 5) {
    const publicId = safePublicId(parts[2]);
    if (!publicId) return sendHttpJson(response, 404, { ok:false, error:'Not found' });
    if (request.method === 'GET') {
      const asset = await overlayStore.getAsset(publicId, parts[4]);
      if (!asset) return sendHttpJson(response, 404, { ok:false, error:'Asset not found' });
      response.writeHead(200, { 'content-type':asset.mime, 'content-length':asset.size, 'cache-control':'public, max-age=31536000, immutable', 'cross-origin-resource-policy':'cross-origin', 'x-content-type-options':'nosniff' });
      require('fs').createReadStream(asset.file).pipe(response);
      return;
    }
    if (request.method === 'PUT') {
      overlayStore.authorize(publicId, suppliedToken(request));
      const bytes = await readBufferBody(request, MAX_ASSET_BYTES);
      const asset = await overlayStore.putAsset(publicId, parts[4], bytes, request.headers['content-type'], suppliedToken(request));
      return sendHttpJson(response, 200, { ok:true, asset });
    }
  }
  if (request.method === 'GET' && parts[0] === 'v1' && parts[1] === 'overlays' && parts[3] === 'manifest' && parts.length === 4) {
    const publicId = safePublicId(parts[2]);
    if (!publicId) return sendHttpJson(response, 404, { ok:false, error:'Not found' });
    return sendHttpJson(response, 200, await overlayStore.manifest(publicId, suppliedToken(request)));
  }
  if (request.method === 'GET' && url.pathname === '/v1/tts/voices') {
    response.writeHead(200, jsonHeaders());
    response.end(JSON.stringify({ ok: true, provider: 'microsoft-edge', voices: MICROSOFT_VOICES }));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/v1/tts/microsoft') {
    if (!authorizedTts(request)) {
      response.writeHead(401, jsonHeaders());
      response.end(JSON.stringify({ ok: false, error: 'No autorizado.' }));
      return;
    }
    if (!ttsRateLimitAllows(requestIp(request))) {
      response.writeHead(429, { ...jsonHeaders(), 'retry-after': '60' });
      response.end(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes de voz. Intenta en un minuto.' }));
      return;
    }
    if (activeTtsRequests >= MAX_TTS_CONCURRENT) {
      response.writeHead(503, { ...jsonHeaders(), 'retry-after': '2' });
      response.end(JSON.stringify({ ok: false, error: 'El servicio de voz está ocupado. Intenta de nuevo.' }));
      return;
    }

    activeTtsRequests += 1;
    try {
      const body = await readJsonBody(request);
      const result = await synthesizeMicrosoftSpeech(body);
      response.writeHead(200, {
        'content-type': 'audio/mpeg',
        'content-length': result.audio.length,
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
        'x-lulu-tts-voice': result.voice,
        'x-lulu-tts-cache': result.cacheHit ? 'hit' : 'miss'
      });
      response.end(result.audio);
    } catch (error) {
      const statusCode = Number(error?.statusCode) || 502;
      if (statusCode >= 500) console.error('[tts] Microsoft TTS falló:', error?.message || error);
      response.writeHead(statusCode, jsonHeaders());
      response.end(JSON.stringify({
        ok: false,
        error: statusCode >= 500 ? 'No se pudo generar la voz Microsoft.' : String(error.message || error)
      }));
    } finally {
      activeTtsRequests = Math.max(0, activeTtsRequests - 1);
    }
    return;
  }
  response.writeHead(404, jsonHeaders());
  response.end(JSON.stringify({ ok: false, error: 'Not found' }));
}

const server = http.createServer((request, response) => {
  void handleHttpRequest(request, response).catch((error) => {
    console.error('[http] Solicitud fallida:', error?.message || error);
    if (response.headersSent) return response.end();
    const statusCode = Number(error?.statusCode || 500);
    response.writeHead(statusCode, jsonHeaders());
    response.end(JSON.stringify({ ok: false, error:statusCode >= 500 ? 'Error interno.' : String(error?.message || error) }));
  });
});

// El cliente oficial nunca envía mensajes de aplicación al relay.
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const ip = requestIp(request);
  if (shuttingDown || url.pathname !== '/v1/tiktok/live') return socket.destroy();
  if (!authorized(request)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    return socket.destroy();
  }
  if (!rateLimitAllows(ip)) {
    socket.write('HTTP/1.1 429 Too Many Requests\r\nRetry-After: 60\r\nConnection: close\r\n\r\n');
    return socket.destroy();
  }
  if (activeClients >= MAX_CLIENTS) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 30\r\nConnection: close\r\n\r\n');
    return socket.destroy();
  }
  const uniqueId = cleanUsername(url.searchParams.get('uniqueId'));
  if (!uniqueId) {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(request, socket, head, (client) => wss.emit('connection', client, request, uniqueId));
});

wss.on('connection', (client, request, uniqueId) => {
  const before = usageMeter.userSnapshot(uniqueId);
  if (before.remaining <= 0) {
    const message = `Esta cuenta ya utilizó sus ${before.limit} conexiones diarias de Lulu Finity. Vuelve a intentarlo después del reinicio diario.`;
    sendJson(client, { type:'lulu.relay.error', data:{ message, classification:'user-daily-limit', usage:before } });
    try { client.close(4429, message.slice(0, 120)); } catch {}
    return;
  }
  activeClients += 1;
  const usage = usageMeter.recordConnection(1, uniqueId);
  console.info(`[usage] ${usage.used}/${usage.limit} usos globales; usuario ${usage.user.used}/${usage.user.limit} conexiones.`);
  const session = new RelaySession(client, request, uniqueId);
  sessions.add(session);
  let alive = true;
  client.on('pong', () => { alive = true; });
  client.on('close', () => {
    session.close();
    sessions.delete(session);
    activeClients = Math.max(0, activeClients - 1);
  });
  client.on('error', () => {});
  client.on('message', () => {
    try { client.close(1008, 'Canal de solo recepción'); } catch {}
  });
  session.start();

  const heartbeat = setInterval(() => {
    if (client.readyState !== WebSocket.OPEN) return clearInterval(heartbeat);
    if (!alive) return client.terminate();
    alive = false;
    try { client.ping(); } catch {}
  }, 30_000);
  heartbeat.unref?.();
  client.once('close', () => clearInterval(heartbeat));
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[shutdown] ${signal}`);
  for (const session of sessions) {
    sendJson(session.client, { type: 'lulu.relay.error', data: { message: 'El relay se está reiniciando.' } });
    try { session.client.close(1012, 'Reinicio del servidor'); } catch {}
    session.close();
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (error) => console.error('[uncaughtException]', error));
process.on('unhandledRejection', (error) => console.error('[unhandledRejection]', error));

server.listen(PORT, '0.0.0.0', () => {
  const usage = usageMeter.snapshot();
  console.info(`[startup] Relay listo en el puerto ${PORT}; ${keyPool.size} API keys cargadas; uso diario ${usage.used}/${usage.limit}.`);
});
