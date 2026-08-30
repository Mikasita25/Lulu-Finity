'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fsp = fs.promises;

const PUBLIC_ID_RE = /^[a-f0-9]{32}$/;
const ASSET_NAME_RE = /^[a-f0-9]{64}\.(?:png|jpe?g|webp|gif|bmp)$/;
const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const SOURCE_NAMES = Object.freeze({
  widget: new Set(['playlist', 'wallet', 'game', 'alert', 'goal', 'gift']),
  ranking: new Set(['1', '2', '3', '4']),
  screen: new Set(['1', '2', '3', '4'])
});
const ASSET_MIME = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
});

function publicIdForSecret(secret) {
  const normalized = String(secret || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(normalized)) return '';
  return crypto.createHash('sha256').update(normalized.toLowerCase()).digest('hex').slice(0, 32);
}

function safePublicId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return PUBLIC_ID_RE.test(normalized) ? normalized : '';
}

function safeSource(kind, name) {
  const normalizedKind = String(kind || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!SOURCE_NAMES[normalizedKind]?.has(normalizedName)) return null;
  return { kind: normalizedKind, name: normalizedName };
}

function safeAssetName(value) {
  const normalized = path.basename(String(value || '')).toLowerCase();
  return ASSET_NAME_RE.test(normalized) ? normalized : '';
}

function assetLooksValid(bytes, extension) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4) return false;
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (extension === '.gif') return bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a';
  if (extension === '.webp') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (extension === '.bmp') return bytes.subarray(0, 2).toString('ascii') === 'BM';
  return false;
}

function capabilityMatches(publicId, secret) {
  const expected = safePublicId(publicId);
  const actual = publicIdForSecret(secret);
  if (!expected || !actual) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

class OverlayStore {
  constructor(options = {}) {
    this.root = path.resolve(String(options.root || process.env.OVERLAY_STATE_DIR || path.join(process.cwd(), '.lulu-overlays')));
  }

  instanceDirectory(publicId) {
    const id = safePublicId(publicId);
    if (!id) throw Object.assign(new Error('Identidad pública inválida.'), { statusCode: 400 });
    return path.join(this.root, id);
  }

  authorize(publicId, secret) {
    if (!capabilityMatches(publicId, secret)) throw Object.assign(new Error('Capacidad de escritura inválida.'), { statusCode: 401 });
  }

  sourcePath(publicId, kind, name) {
    const source = safeSource(kind, name);
    if (!source) throw Object.assign(new Error('Fuente inválida.'), { statusCode: 400 });
    return path.join(this.instanceDirectory(publicId), 'sources', `${source.kind}-${source.name}.json`);
  }

  async putSource(publicId, kind, name, data, secret) {
    this.authorize(publicId, secret);
    const source = safeSource(kind, name);
    if (!source) throw Object.assign(new Error('Fuente inválida.'), { statusCode: 400 });
    const document = { version: 1, updatedAt: Date.now(), kind: source.kind, name: source.name, data };
    const encoded = Buffer.from(JSON.stringify(document));
    if (encoded.length > MAX_SOURCE_BYTES) throw Object.assign(new Error('El estado de la fuente supera el límite.'), { statusCode: 413 });
    const file = this.sourcePath(publicId, source.kind, source.name);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(temporary, encoded, { mode: 0o600 });
    await fsp.rename(temporary, file);
    return document;
  }

  async getSource(publicId, kind, name) {
    const file = this.sourcePath(publicId, kind, name);
    try {
      const stats = await fsp.stat(file);
      if (!stats.isFile() || stats.size > MAX_SOURCE_BYTES) return null;
      return JSON.parse(await fsp.readFile(file, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async putAsset(publicId, name, bytes, suppliedMime, secret) {
    this.authorize(publicId, secret);
    const safeName = safeAssetName(name);
    if (!safeName) throw Object.assign(new Error('Nombre de recurso inválido.'), { statusCode: 400 });
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_ASSET_BYTES) throw Object.assign(new Error('El recurso supera el límite de 12 MB.'), { statusCode: 413 });
    const extension = path.extname(safeName);
    const mime = ASSET_MIME[extension];
    if (!mime || String(suppliedMime || '').split(';')[0].trim().toLowerCase() !== mime || !assetLooksValid(bytes, extension)) {
      throw Object.assign(new Error('El tipo o contenido del recurso no coincide.'), { statusCode: 415 });
    }
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (path.basename(safeName, extension) !== digest) throw Object.assign(new Error('La huella del recurso no coincide.'), { statusCode: 400 });
    const directory = path.join(this.instanceDirectory(publicId), 'assets');
    const file = path.join(directory, safeName);
    await fsp.mkdir(directory, { recursive: true });
    try {
      const existing = await fsp.stat(file);
      if (existing.isFile() && existing.size === bytes.length) return { name: safeName, mime, size: bytes.length, digest };
    } catch {}
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(temporary, bytes, { mode: 0o600 });
    await fsp.rename(temporary, file);
    return { name: safeName, mime, size: bytes.length, digest };
  }

  async getAsset(publicId, name) {
    const safeName = safeAssetName(name);
    if (!safeName) return null;
    const file = path.join(this.instanceDirectory(publicId), 'assets', safeName);
    try {
      const stats = await fsp.stat(file);
      if (!stats.isFile() || stats.size > MAX_ASSET_BYTES) return null;
      return { file, size: stats.size, mime: ASSET_MIME[path.extname(safeName)] };
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async manifest(publicId, secret) {
    this.authorize(publicId, secret);
    const directory = this.instanceDirectory(publicId);
    const list = async (child) => {
      try { return (await fsp.readdir(path.join(directory, child), { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name).sort(); }
      catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
    };
    const [sourceFiles, assets] = await Promise.all([list('sources'), list('assets')]);
    return { ok: true, publicId: safePublicId(publicId), sources: sourceFiles.map((file) => file.replace(/\.json$/, '')), assets };
  }
}

module.exports = {
  ASSET_MIME,
  MAX_ASSET_BYTES,
  MAX_SOURCE_BYTES,
  OverlayStore,
  assetLooksValid,
  capabilityMatches,
  publicIdForSecret,
  safeAssetName,
  safePublicId,
  safeSource
};
