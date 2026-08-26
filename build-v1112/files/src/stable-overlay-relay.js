'use strict';

const path = require('path');

const MAX_MEDIA_BYTES = 12 * 1024 * 1024;

function mediaType(filePath) {
  const extension = path.extname(String(filePath || '')).toLowerCase();
  return ({ '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.bmp':'image/bmp' })[extension] || '';
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

class StableOverlayRelay {
  constructor({ baseUrl, clientToken, fetchImpl = globalThis.fetch, fs, appVersion = '0.0.0' } = {}) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.clientToken = String(clientToken || '').trim();
    this.fetch = fetchImpl;
    this.fs = fs;
    this.appVersion = String(appVersion || '0.0.0');
  }

  publicUrl(pathname = '') {
    return `${this.baseUrl}/${String(pathname || '').replace(/^\/+/, '')}`;
  }

  async request(body, attempts = 2) {
    if (!this.baseUrl || !/^https:\/\//i.test(this.baseUrl)) throw new Error('El servidor HTTPS estable no está configurado.');
    if (!this.clientToken || /__LULU_RELAY_CLIENT_TOKEN__/.test(this.clientToken)) throw new Error('La compilación no contiene el token del servidor estable.');
    if (typeof this.fetch !== 'function') throw new Error('fetch no está disponible.');
    let lastError = null;
    for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      timeout.unref?.();
      try {
        const response = await this.fetch(this.publicUrl('/v1/overlays/publish'), {
          method: 'POST',
          signal: controller.signal,
          redirect: 'error',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${this.clientToken}`,
            'Content-Type': 'application/json',
            'User-Agent': `Lulu-Finity/${this.appVersion}`,
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(body)
        });
        let payload = null;
        try { payload = await response.json(); } catch {}
        if (!response.ok || payload?.ok === false) {
          const error = new Error(payload?.error || `Servidor HTTPS ${response.status}`);
          error.statusCode = response.status;
          throw error;
        }
        return { ok: true, status: response.status, payload };
      } catch (error) {
        lastError = error;
        if (Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500) break;
        if (attempt + 1 < attempts) await sleep(350 * (attempt + 1));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError || new Error('No se pudo sincronizar la fuente HTTPS estable.');
  }

  async publish({ token, source, html, state, mediaPath = '' } = {}) {
    const body = {
      token: String(token || ''),
      source: String(source || ''),
      state: state && typeof state === 'object' ? state : {}
    };
    if (html !== undefined && html !== null) body.html = String(html);
    if (mediaPath) {
      if (!this.fs) throw new Error('No se puede leer el medio del overlay.');
      const type = mediaType(mediaPath);
      if (!type) throw new Error('Formato de imagen no compatible con HTTPS estable.');
      const stats = await this.fs.promises.stat(mediaPath);
      if (!stats.isFile() || stats.size <= 0) throw new Error('El medio ya no está disponible.');
      if (stats.size > MAX_MEDIA_BYTES) throw new Error('La imagen o GIF supera 12 MB para el enlace HTTPS estable.');
      const buffer = await this.fs.promises.readFile(mediaPath);
      body.media = { name: path.basename(mediaPath), type, base64: buffer.toString('base64') };
    }
    return this.request(body);
  }
}

module.exports = { StableOverlayRelay, MAX_MEDIA_BYTES, mediaType };
