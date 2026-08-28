'use strict';

const MAX_PAGE_BYTES = 350_000;
const MAX_JSON_BYTES = 20 * 1024 * 1024;
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;
const WIDGET_TYPES = new Set(['playlist', 'wallet', 'game', 'alert', 'goal', 'gift']);

function bearerToken(request) {
  const authorization = String(request.headers.authorization || '');
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim();
  return String(request.headers['x-lulu-client-token'] || '').trim();
}

function safeOverlayToken(value) {
  const token = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{24,128}$/.test(token) ? token : '';
}

function safeSource(value) {
  const source = String(value || '').trim().toLowerCase();
  return /^(widget:(playlist|wallet|game|alert|goal|gift)|ranking:[1-4]|overlay:[1-4])$/.test(source) ? source : '';
}

function readJsonBody(request, maxBytes = MAX_JSON_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const fail = (message, statusCode) => {
      if (done) return;
      done = true;
      const error = new Error(message);
      error.statusCode = statusCode;
      reject(error);
    };
    request.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > maxBytes) return fail('La publicación del overlay es demasiado grande.', 413);
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (done) return;
      done = true;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { const error = new Error('El cuerpo del overlay debe ser JSON válido.'); error.statusCode = 400; reject(error); }
    });
    request.on('error', (error) => fail(error?.message || 'Error de lectura.', 400));
  });
}

function contentTypeForMedia(name, fallback = '') {
  const cleanFallback = String(fallback || '').toLowerCase();
  if (/^image\/(png|jpeg|webp|gif|bmp)$/.test(cleanFallback)) return cleanFallback;
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return '';
}

function responseHeaders(type = 'application/json; charset=utf-8') {
  return {
    'content-type': type,
    'cache-control': 'no-store, no-cache, must-revalidate',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff'
  };
}

function missingPageHtml() {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;font-family:Segoe UI,Arial,sans-serif;color:white}.box{position:fixed;inset:20px;display:grid;place-items:center;text-align:center;border:1px dashed rgba(255,255,255,.18);border-radius:18px;background:rgba(12,10,22,.34)}strong,small{display:block}small{margin-top:6px;opacity:.55}</style></head><body><div class="box"><div><strong>Esperando a Lulu Finity…</strong><small>Abre la app para volver a sincronizar esta fuente.</small></div></div></body></html>';
}

class OverlayHub {
  constructor({ clientTokens = new Set(), now = () => Date.now() } = {}) {
    this.clientTokens = clientTokens instanceof Set ? clientTokens : new Set(clientTokens || []);
    this.now = now;
    this.records = new Map();
    this.lastPrune = 0;
  }

  authorized(request) {
    return this.clientTokens.size > 0 && this.clientTokens.has(bearerToken(request));
  }

  key(token, source) { return `${token}:${source}`; }

  getRecord(token, source) {
    this.prune();
    return this.records.get(this.key(token, source)) || null;
  }

  prune(force = false) {
    const now = this.now();
    if (!force && now - this.lastPrune < 5 * 60 * 1000) return;
    this.lastPrune = now;
    for (const [key, record] of this.records) {
      if (now - Number(record.updatedAt || 0) > RECORD_TTL_MS) this.records.delete(key);
    }
  }

  snapshot() {
    this.prune(true);
    return { sources: this.records.size };
  }

  async publish(request, response) {
    if (!this.authorized(request)) {
      response.writeHead(401, responseHeaders());
      response.end(JSON.stringify({ ok: false, error: 'No autorizado.' }));
      return true;
    }
    try {
      const body = await readJsonBody(request);
      const token = safeOverlayToken(body.token);
      const source = safeSource(body.source);
      if (!token || !source) {
        response.writeHead(400, responseHeaders());
        response.end(JSON.stringify({ ok: false, error: 'Token o fuente inválidos.' }));
        return true;
      }
      const key = this.key(token, source);
      const previous = this.records.get(key) || { token, source, html: '', state: {}, media: new Map(), updatedAt: 0 };
      if (body.html !== undefined) {
        const html = String(body.html || '');
        if (!html || Buffer.byteLength(html, 'utf8') > MAX_PAGE_BYTES) {
          response.writeHead(413, responseHeaders());
          response.end(JSON.stringify({ ok: false, error: 'La página del overlay es demasiado grande.' }));
          return true;
        }
        previous.html = html;
      }
      if (body.state && typeof body.state === 'object' && !Array.isArray(body.state)) previous.state = body.state;
      if (!(previous.media instanceof Map)) previous.media = new Map();
      if (body.media && typeof body.media === 'object') {
        const name = String(body.media.name || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 180);
        const type = contentTypeForMedia(name, body.media.type);
        const encoded = String(body.media.base64 || '');
        if (!name || !type || !encoded) {
          response.writeHead(400, responseHeaders());
          response.end(JSON.stringify({ ok: false, error: 'Medio inválido.' }));
          return true;
        }
        let data;
        try { data = Buffer.from(encoded, 'base64'); } catch { data = Buffer.alloc(0); }
        if (!data.length || data.length > MAX_MEDIA_BYTES) {
          response.writeHead(413, responseHeaders());
          response.end(JSON.stringify({ ok: false, error: 'El medio supera el límite de 12 MB.' }));
          return true;
        }
        previous.media.set(name, { data, type, updatedAt: this.now() });
        if (previous.media.size > 4) {
          const oldest = [...previous.media.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
          if (oldest) previous.media.delete(oldest[0]);
        }
      }
      previous.updatedAt = this.now();
      this.records.set(key, previous);
      response.writeHead(200, responseHeaders());
      response.end(JSON.stringify({ ok: true, source, updatedAt: previous.updatedAt }));
      return true;
    } catch (error) {
      const status = Math.max(400, Number(error?.statusCode) || 500);
      response.writeHead(status, responseHeaders());
      response.end(JSON.stringify({ ok: false, error: status >= 500 ? 'No se pudo publicar la fuente.' : String(error?.message || error) }));
      return true;
    }
  }

  servePage(response, record) {
    response.writeHead(record?.html ? 200 : 503, responseHeaders('text/html; charset=utf-8'));
    response.end(record?.html || missingPageHtml());
  }

  serveState(response, record, fallback = {}) {
    response.writeHead(200, responseHeaders());
    response.end(JSON.stringify(record?.state && typeof record.state === 'object' ? record.state : fallback));
  }

  async handleHttpRequest(request, response, url) {
    if (request.method === 'POST' && url.pathname === '/v1/overlays/publish') return this.publish(request, response);
    if (request.method !== 'GET') return false;
    const token = safeOverlayToken(url.searchParams.get('token'));
    if (!token) return false;

    if (url.pathname === '/widget' || url.pathname === '/widget-snapshot') {
      const type = WIDGET_TYPES.has(url.searchParams.get('type')) ? url.searchParams.get('type') : 'playlist';
      const record = this.getRecord(token, `widget:${type}`);
      if (url.pathname === '/widget') this.servePage(response, record);
      else this.serveState(response, record, { type, id: `${type}-relay-empty`, updatedAt: 0 });
      return true;
    }

    if (url.pathname === '/ranking' || url.pathname === '/ranking-snapshot') {
      const slot = Math.min(4, Math.max(1, Math.round(Number(url.searchParams.get('slot') || 1))));
      const record = this.getRecord(token, `ranking:${slot}`);
      if (url.pathname === '/ranking') this.servePage(response, record);
      else this.serveState(response, record, { type: 'ranking', slot, config: {}, entries: [] });
      return true;
    }

    if (url.pathname === '/overlay' || url.pathname === '/overlay-state') {
      const screen = Math.min(4, Math.max(1, Math.round(Number(url.searchParams.get('screen') || 1))));
      const record = this.getRecord(token, `overlay:${screen}`);
      if (url.pathname === '/overlay') this.servePage(response, record);
      else this.serveState(response, record, { type: 'clear', id: 'relay-empty' });
      return true;
    }

    if (url.pathname.startsWith('/overlay-media/')) {
      const name = String(decodeURIComponent(url.pathname.slice('/overlay-media/'.length))).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 180);
      const screen = Math.min(4, Math.max(1, Math.round(Number(url.searchParams.get('screen') || 1))));
      const record = this.getRecord(token, `overlay:${screen}`);
      const media = record?.media instanceof Map ? record.media.get(name) : null;
      if (!media) { response.writeHead(404, responseHeaders('text/plain; charset=utf-8')); response.end('Not found'); return true; }
      response.writeHead(200, { ...responseHeaders(media.type), 'content-length': media.data.length });
      response.end(media.data);
      return true;
    }
    return false;
  }
}

module.exports = { OverlayHub, safeOverlayToken, safeSource, MAX_MEDIA_BYTES };
