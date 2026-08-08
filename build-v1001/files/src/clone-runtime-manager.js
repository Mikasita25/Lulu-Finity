'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const { createHash, randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');

const MAX_ENGINE_BYTES = 1_500 * 1024 * 1024;
const OFFICIAL_RELEASE_PREFIX = '/Mikasita25/Lulu-Finity/releases/download/';

function safeSegment(value, fallback = 'runtime') {
  const clean = String(value || '').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return clean || fallback;
}

function safeInside(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, String(relative || ''));
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('El motor contiene una ruta no segura.');
  return target;
}

function validateEngineUrl(value, redirected = false) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:') throw new Error('La descarga del motor debe usar HTTPS.');
  const host = url.hostname.toLowerCase();
  const official = host === 'github.com' && url.pathname.startsWith(OFFICIAL_RELEASE_PREFIX);
  const releaseAsset = redirected && (host === 'release-assets.githubusercontent.com' || host.endsWith('.githubusercontent.com'));
  if (!official && !releaseAsset) throw new Error('La descarga del motor no pertenece a la publicación oficial de Lulu Finity.');
  return url;
}

function runtimeSpec(voice) {
  const spec = voice?.engine?.runtime && typeof voice.engine.runtime === 'object' ? voice.engine.runtime : {};
  const sha256 = String(spec.sha256 || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('La publicación no contiene una firma válida para el motor de clonación.');
  return {
    version: safeSegment(spec.version, 'openvoice-v2'),
    url: validateEngineUrl(spec.url).toString(),
    sha256,
    executable: String(spec.executable || 'python/python.exe'),
    script: String(spec.script || 'lulu-clone-engine.py'),
    config: String(spec.config || 'checkpoints_v2/converter/config.json'),
    checkpoint: String(spec.checkpoint || 'checkpoints_v2/converter/checkpoint.pth'),
    bytes: Math.max(0, Number(spec.bytes) || 0)
  };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk).slice(-4000); });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `El extractor terminó con código ${code}.`)));
  });
}

function download(urlValue, destination, onProgress, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('La descarga del motor tuvo demasiadas redirecciones.'));
  const url = validateEngineUrl(urlValue, redirects > 0);
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Lulu-Finity/1.0.1', Accept: 'application/octet-stream' } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        try {
          const next = new URL(response.headers.location, url).toString();
          resolve(download(next, destination, onProgress, redirects + 1));
        } catch (error) { reject(error); }
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`La descarga del motor respondió ${response.statusCode || 'sin estado'}.`));
        return;
      }
      const declared = Number(response.headers['content-length'] || 0);
      if (declared > MAX_ENGINE_BYTES) {
        response.resume();
        reject(new Error('El motor publicado supera el tamaño permitido.'));
        return;
      }
      const output = fs.createWriteStream(destination, { flags: 'wx' });
      let received = 0;
      response.on('data', (chunk) => {
        received += chunk.length;
        if (received > MAX_ENGINE_BYTES) response.destroy(new Error('La descarga del motor supera el tamaño permitido.'));
        else onProgress?.({ stage: 'download', received, total: declared || 0 });
      });
      response.once('error', reject);
      output.once('error', reject);
      output.once('finish', () => output.close(() => resolve({ bytes: received })));
      response.pipe(output);
    });
    request.setTimeout(45_000, () => request.destroy(new Error('La descarga del motor tardó demasiado en responder.')));
    request.once('error', reject);
  });
}

async function sha256File(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(file);
    input.on('data', (chunk) => hash.update(chunk));
    input.once('error', reject);
    input.once('end', resolve);
  });
  return hash.digest('hex');
}

class CloneRuntimeManager {
  constructor({ app, platform = process.platform }) {
    this.app = app;
    this.platform = platform;
    this.installing = new Map();
  }

  root() { return path.join(this.app.getPath('userData'), 'lulu-local-engines'); }

  destination(voice) {
    const spec = runtimeSpec(voice);
    return path.join(this.root(), safeSegment(voice.id, 'voice'), spec.version);
  }

  paths(voice, root = this.destination(voice)) {
    const spec = runtimeSpec(voice);
    return {
      root,
      executable: safeInside(root, spec.executable),
      script: safeInside(root, spec.script),
      config: safeInside(root, spec.config),
      checkpoint: safeInside(root, spec.checkpoint),
      reference: safeInside(voice.root, voice.engine.reference)
    };
  }

  validate(voice, root = this.destination(voice)) {
    const files = this.paths(voice, root);
    for (const key of ['executable', 'script', 'config', 'checkpoint']) {
      if (!fs.existsSync(files[key]) || !fs.statSync(files[key]).isFile()) throw new Error(`El motor instalado está incompleto: falta ${key}.`);
    }
    if (!fs.existsSync(files.reference) || !fs.statSync(files.reference).isFile()) throw new Error('Falta la muestra autorizada de la voz.');
    return files;
  }

  status(voice) {
    const spec = runtimeSpec(voice);
    let installed = false;
    try { this.validate(voice); installed = true; } catch {}
    return { installed, installable: true, installing: this.installing.has(voice.id), downloadBytes: spec.bytes, runtimeVersion: spec.version };
  }

  runtimeFor(voice) {
    if (this.platform !== 'win32') throw new Error('La Voz Oficial está disponible en la versión de Windows de Lulu Finity.');
    return this.validate(voice);
  }

  async install(voice, onProgress) {
    if (this.platform !== 'win32') throw new Error('La Voz Oficial sólo puede instalarse en Lulu Finity para Windows.');
    if (this.installing.has(voice.id)) return this.installing.get(voice.id);
    const task = this.installNow(voice, onProgress).finally(() => this.installing.delete(voice.id));
    this.installing.set(voice.id, task);
    return task;
  }

  async installNow(voice, onProgress) {
    const spec = runtimeSpec(voice);
    const root = this.root();
    const destination = this.destination(voice);
    const temporary = path.join(root, `.install-${safeSegment(voice.id)}-${randomUUID()}`);
    const archive = path.join(root, `.download-${safeSegment(voice.id)}-${randomUUID()}.zip`);
    await fsp.mkdir(root, { recursive: true });
    await fsp.mkdir(temporary, { recursive: true });
    try {
      onProgress?.({ stage: 'starting', received: 0, total: spec.bytes });
      const result = await download(spec.url, archive, onProgress);
      onProgress?.({ stage: 'verifying', received: result.bytes, total: result.bytes });
      const digest = await sha256File(archive);
      if (digest !== spec.sha256) throw new Error('La firma del motor descargado no coincide con la publicación oficial.');
      onProgress?.({ stage: 'extracting', received: result.bytes, total: result.bytes });
      await run(this.platform === 'win32' ? 'tar.exe' : 'tar', ['-xf', archive, '-C', temporary]);
      this.validate(voice, temporary);
      await fsp.rm(destination, { recursive: true, force: true });
      await fsp.mkdir(path.dirname(destination), { recursive: true });
      await fsp.rename(temporary, destination);
      onProgress?.({ stage: 'ready', received: result.bytes, total: result.bytes });
      return { ok: true, ...this.status(voice) };
    } catch (error) {
      onProgress?.({ stage: 'error', message: error?.message || String(error) });
      throw error;
    } finally {
      await fsp.rm(archive, { force: true }).catch(() => {});
      await fsp.rm(temporary, { recursive: true, force: true }).catch(() => {});
    }
  }
}

module.exports = { CloneRuntimeManager, runtimeSpec, safeInside, safeSegment, validateEngineUrl };
