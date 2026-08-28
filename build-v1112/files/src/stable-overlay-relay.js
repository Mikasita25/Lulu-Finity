'use strict';

const path = require('path');

const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const MEDIA_VERIFY_TTL_MS = 20_000;

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
    this.mediaKnown = new Map();
    this.mediaVerifiedAt = new Map();
  }

  publicUrl(pathname = '') {
    return `${this.baseUrl}/${String(pathname || '').replace(/^\/+/, '')}`;
  }

  validateClient() {
    if (!this.baseUrl || !/^https:\/\//i.test(this.baseUrl)) throw new Error('El servidor HTTPS estable no está configurado.');
    if (!this.clientToken || /__LULU_RELAY_CLIENT_TOKEN__/.test(this.clientToken)) throw new Error('La compilación no contiene el token del servidor estable.');
    if (typeof this.fetch !== 'function') throw new Error('fetch no está disponible.');
  }

  headers() {
    return {
      Authorization: `Bearer ${this.clientToken}`,
      'User-Agent': `Lulu-Finity/${this.appVersion}`,
      'Cache-Control': 'no-cache'
    };
  }

  async request(body, attempts = 2) {
    this.validateClient();
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
          headers: { ...this.headers(), 'Content-Type': 'application/json' },
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

  async mediaManifest(token, source) {
    this.validateClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    timeout.unref?.();
    try {
      const url = this.publicUrl(`/v1/overlays/media-manifest?token=${encodeURIComponent(String(token || ''))}&source=${encodeURIComponent(String(source || ''))}`);
      const response = await this.fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
        headers: this.headers()
      });
      let payload = null;
      try { payload = await response.json(); } catch {}
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `Servidor HTTPS ${response.status}`);
      return new Set(Array.isArray(payload?.media) ? payload.media.map((name) => String(name || '')) : []);
    } finally {
      clearTimeout(timeout);
    }
  }

  async mediaBody(mediaPath) {
    if (!this.fs) throw new Error('No se puede leer el medio del overlay.');
    const type = mediaType(mediaPath);
    if (!type) throw new Error('Formato de imagen no compatible con HTTPS estable.');
    const stats = await this.fs.promises.stat(mediaPath);
    if (!stats.isFile() || stats.size <= 0) throw new Error('El medio ya no está disponible.');
    if (stats.size > MAX_MEDIA_BYTES) throw new Error('La imagen o GIF supera 12 MB para el enlace HTTPS estable.');
    const buffer = await this.fs.promises.readFile(mediaPath);
    return { name: path.basename(mediaPath), type, base64: buffer.toString('base64') };
  }

  async publish({ token, source, html, state, mediaPath = '', mediaPaths = [], verifyMedia = false } = {}) {
    const body = {
      token: String(token || ''),
      source: String(source || ''),
      state: state && typeof state === 'object' ? state : {}
    };
    if (html !== undefined && html !== null) body.html = String(html);
    const result = await this.request(body);

    const paths = [...new Set([mediaPath, ...(Array.isArray(mediaPaths) ? mediaPaths : [])].map((item) => String(item || '').trim()).filter(Boolean))];
    if (!paths.length) return result;

    const sourceKey = String(source || '');
    let known = this.mediaKnown.get(sourceKey) || new Set();
    const lastVerified = Number(this.mediaVerifiedAt.get(sourceKey) || 0);
    if (verifyMedia || !this.mediaKnown.has(sourceKey) || Date.now() - lastVerified > MEDIA_VERIFY_TTL_MS) {
      try {
        known = await this.mediaManifest(token, source);
        this.mediaKnown.set(sourceKey, known);
        this.mediaVerifiedAt.set(sourceKey, Date.now());
      } catch {
        // Backward compatible with a relay that has not deployed the manifest
        // endpoint yet: upload the desired assets and keep the public source alive.
        known = new Set();
      }
    }

    for (const filePath of paths) {
      const name = path.basename(filePath);
      if (known.has(name)) continue;
      const media = await this.mediaBody(filePath);
      await this.request({ token: String(token || ''), source: sourceKey, media });
      known.add(media.name);
      this.mediaKnown.set(sourceKey, known);
    }
    return result;
  }
}

module.exports = { StableOverlayRelay, MAX_MEDIA_BYTES, MEDIA_VERIFY_TTL_MS, mediaType };
