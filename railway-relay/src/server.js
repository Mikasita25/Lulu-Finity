'use strict';

const http = require('http');
const { URL } = require('url');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const { KeyPool, parseList } = require('./key-pool');
const { classifyUpstreamFailure } = require('./failure-classifier');
const { DailyUsageMeter } = require('./usage-meter');

const PORT = Math.max(1, Number(process.env.PORT || 3000));
const UPSTREAM_WS_URL = String(process.env.UPSTREAM_WS_URL || 'wss://ws.eulerstream.com').trim();
const CLIENT_TOKENS = new Set(parseList(process.env.CLIENT_TOKENS || process.env.CLIENT_TOKEN));
const MAX_CLIENTS = Math.max(1, Number(process.env.MAX_CLIENTS || 50));
const MAX_ATTEMPTS_PER_MINUTE = Math.max(1, Number(process.env.MAX_CONNECTION_ATTEMPTS_PER_MINUTE || 30));
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

if (!keyPool.size) {
  console.error('[startup] EULER_API_KEYS está vacío. Configura al menos una clave en Railway.');
  process.exit(1);
}

let activeClients = 0;
let shuttingDown = false;
const attemptsByIp = new Map();
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

function suppliedToken(request) {
  const authorization = String(request.headers.authorization || '');
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim();
  return String(request.headers['x-lulu-client-token'] || '').trim();
}

function authorized(request) {
  if (!CLIENT_TOKENS.size) return true;
  return CLIENT_TOKENS.has(suppliedToken(request));
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
    'access-control-allow-origin': '*'
  };
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && url.pathname === '/health') {
    const snapshot = keyPool.snapshot();
    const usage = usageMeter.snapshot();
    response.writeHead(200, jsonHeaders());
    response.end(JSON.stringify({
      ok: true,
      service: 'lulu-finity-railway-relay',
      uptimeSeconds: Math.round(process.uptime()),
      clients: activeClients,
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
  response.writeHead(404, jsonHeaders());
  response.end(JSON.stringify({ ok: false, error: 'Not found' }));
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
