'use strict';

const { OverlayHub: BaseOverlayHub, safeOverlayToken, safeSource } = require('./overlay-hub');

const WIDGET_TYPES = new Set(['playlist','wallet','game','alert','goal','gift']);

function responseHeaders(type = 'application/json; charset=utf-8') {
  return {
    'content-type': type,
    'cache-control': 'no-store, no-cache, must-revalidate',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff'
  };
}

function safeMediaName(value) {
  const name = String(value || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 180);
  return /^[a-zA-Z0-9._-]{1,180}$/.test(name) ? name : '';
}

class OverlayHub extends BaseOverlayHub {
  serveCustomMedia(response, record, name) {
    const media = record?.media instanceof Map ? record.media.get(name) : null;
    if (!media) {
      response.writeHead(404, responseHeaders('text/plain; charset=utf-8'));
      response.end('Not found');
      return;
    }
    response.writeHead(200, { ...responseHeaders(media.type), 'content-length': media.data.length });
    response.end(media.data);
  }

  async handleHttpRequest(request, response, url) {
    if (request.method === 'GET' && url.pathname === '/v1/overlays/media-manifest') {
      if (!this.authorized(request)) {
        response.writeHead(401, responseHeaders());
        response.end(JSON.stringify({ ok:false, error:'No autorizado.' }));
        return true;
      }
      const token = safeOverlayToken(url.searchParams.get('token'));
      const source = safeSource(url.searchParams.get('source'));
      if (!token || !source) {
        response.writeHead(400, responseHeaders());
        response.end(JSON.stringify({ ok:false, error:'Token o fuente inválidos.' }));
        return true;
      }
      const record = this.getRecord(token, source);
      const media = record?.media instanceof Map ? [...record.media.keys()] : [];
      response.writeHead(200, responseHeaders());
      response.end(JSON.stringify({ ok:true, source, media }));
      return true;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/widget-media/')) {
      const token = safeOverlayToken(url.searchParams.get('token'));
      const type = WIDGET_TYPES.has(url.searchParams.get('type')) ? url.searchParams.get('type') : '';
      const name = safeMediaName(decodeURIComponent(url.pathname.slice('/widget-media/'.length)));
      if (!token || !type || !name) return false;
      this.serveCustomMedia(response, this.getRecord(token, `widget:${type}`), name);
      return true;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/ranking-media/')) {
      const token = safeOverlayToken(url.searchParams.get('token'));
      const slot = Math.min(4, Math.max(1, Math.round(Number(url.searchParams.get('slot') || 1))));
      const name = safeMediaName(decodeURIComponent(url.pathname.slice('/ranking-media/'.length)));
      if (!token || !name) return false;
      this.serveCustomMedia(response, this.getRecord(token, `ranking:${slot}`), name);
      return true;
    }

    return super.handleHttpRequest(request, response, url);
  }
}

module.exports = { OverlayHub, safeMediaName };
