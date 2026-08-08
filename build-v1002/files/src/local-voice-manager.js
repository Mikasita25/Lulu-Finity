'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const AdmZip = require('adm-zip');

const MAX_PACKAGE_BYTES = 650 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['', '.json', '.onnx', '.txt', '.bin', '.fst', '.far', '.dat', '.md']);

function safeId(value) {
  return String(value || '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 64) || `voice-${Date.now()}`;
}

function safeInside(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, String(relative || ''));
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('Ruta inválida dentro del paquete de voz.');
  return target;
}

async function readManifest(root, bundled = false) {
  const manifestPath = path.join(root, 'voice.json');
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  const id = safeId(manifest.id || path.basename(root));
  const engine = manifest.engine && typeof manifest.engine === 'object' ? manifest.engine : {};
  if (manifest.format !== 'lulu-local-v1' || manifest.type !== 'vits') throw new Error('La voz no usa el formato Lulu Local V1 (VITS/Piper).');
  for (const key of ['model', 'tokens']) {
    const file = safeInside(root, engine[key]);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Falta ${key} en el paquete de voz.`);
  }
  const dataDir = safeInside(root, engine.dataDir || 'espeak-ng-data');
  if (!fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) throw new Error('Falta espeak-ng-data en el paquete de voz.');
  return {
    id,
    name: String(manifest.name || id).slice(0, 80),
    author: String(manifest.author || 'Voz local').slice(0, 80),
    language: String(manifest.language || 'es-MX').slice(0, 20),
    description: String(manifest.description || '').slice(0, 240),
    type: 'vits',
    format: 'lulu-local-v1',
    sid: Math.max(0, Number(manifest.sid) || 0),
    engine,
    root,
    bundled,
    removable: !bundled
  };
}

class LocalVoiceManager {
  constructor({ app, dialog, utilityProcess, workerPath }) {
    this.app = app;
    this.dialog = dialog;
    this.utilityProcess = utilityProcess;
    this.workerPath = workerPath;
    this.worker = null;
    this.pending = new Map();
    this.idleTimer = null;
    this.lastUsedAt = 0;
  }

  customRoot() { return path.join(this.app.getPath('userData'), 'lulu-local-voices'); }
  bundledRoot() { return this.app.isPackaged ? path.join(process.resourcesPath, 'lulu-voices') : path.join(__dirname, '..', 'resources', 'voices'); }

  async list() {
    const voices = [];
    for (const [root, bundled] of [[this.bundledRoot(), true], [this.customRoot(), false]]) {
      await fsp.mkdir(root, { recursive: true }).catch(() => {});
      const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try { voices.push(await readManifest(path.join(root, entry.name), bundled)); }
        catch (error) { console.warn(`Voz local omitida (${entry.name}):`, error?.message || error); }
      }
    }
    return voices.map(({ root, engine, ...voice }) => voice);
  }

  async resolve(id) {
    const wanted = safeId(id);
    for (const [root, bundled] of [[this.bundledRoot(), true], [this.customRoot(), false]]) {
      const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const voice = await readManifest(path.join(root, entry.name), bundled);
          if (voice.id === wanted) return voice;
        } catch {}
      }
    }
    throw new Error('La voz local seleccionada no está instalada.');
  }

  async importVoice(ownerWindow) {
    const result = await this.dialog.showOpenDialog(ownerWindow || undefined, {
      title: 'Importar voz de Lulu Local',
      properties: ['openFile'],
      filters: [{ name: 'Voz Lulu Local', extensions: ['lfvoice'] }]
    });
    if (result.canceled || !result.filePaths?.[0]) return null;
    const source = result.filePaths[0];
    const stats = await fsp.stat(source);
    if (stats.size > MAX_PACKAGE_BYTES) throw new Error('El paquete de voz supera 650 MB.');
    const zip = new AdmZip(source);
    const entries = zip.getEntries();
    if (!entries.length || entries.length > 1500) throw new Error('El paquete contiene una cantidad de archivos no válida.');
    let total = 0;
    for (const entry of entries) {
      const name = String(entry.entryName || '').replace(/\\/g, '/');
      if (!name || name.startsWith('/') || name.split('/').includes('..')) throw new Error('El paquete contiene rutas no seguras.');
      if (entry.isDirectory) continue;
      const extension = path.extname(name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error(`Archivo no permitido en la voz: ${path.basename(name)}`);
      const expandedSize = Number(entry.header?.size || 0);
      if (!Number.isFinite(expandedSize) || expandedSize < 0 || expandedSize > MAX_PACKAGE_BYTES) throw new Error(`Tamaño no válido en ${path.basename(name)}.`);
      total += expandedSize;
      if (total > MAX_PACKAGE_BYTES) throw new Error('El contenido de la voz supera 650 MB.');
    }
    const manifestEntry = entries.find((entry) => !entry.isDirectory && /(^|\/)voice\.json$/i.test(entry.entryName));
    if (!manifestEntry) throw new Error('El paquete no contiene voice.json.');
    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    const id = safeId(manifest.id || manifest.name);
    const destination = path.join(this.customRoot(), id);
    const temporary = path.join(this.customRoot(), `.import-${randomUUID()}`);
    await fsp.mkdir(temporary, { recursive: true });
    try {
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const normalized = String(entry.entryName).replace(/\\/g, '/');
        const parts = normalized.split('/');
        const relative = parts.length > 1 && /voice\.json/i.test(manifestEntry.entryName) ? parts.slice(1).join('/') : normalized;
        const output = safeInside(temporary, relative);
        await fsp.mkdir(path.dirname(output), { recursive: true });
        await fsp.writeFile(output, entry.getData());
      }
      const voice = await readManifest(temporary, false);
      await fsp.rm(destination, { recursive: true, force: true });
      await fsp.rename(temporary, destination);
      return { ...voice, root: undefined, engine: undefined, id };
    } catch (error) {
      await fsp.rm(temporary, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  async remove(id) {
    const voice = await this.resolve(id);
    if (voice.bundled) throw new Error('La voz incluida con Lulu no se puede eliminar.');
    await this.release();
    await fsp.rm(voice.root, { recursive: true, force: true });
    return { ok: true };
  }

  ensureWorker() {
    if (this.worker?.pid) return this.worker;
    const worker = this.utilityProcess.fork(this.workerPath, [], { serviceName: 'Lulu Local TTS', stdio: 'pipe' });
    this.worker = worker;
    worker.on('message', (message) => {
      const pending = this.pending.get(message?.requestId);
      if (!pending) return;
      this.pending.delete(message.requestId);
      if (message.type === 'result') pending.resolve(message.result);
      else pending.reject(new Error(message.message || 'Lulu Local no pudo generar el audio.'));
    });
    worker.on('exit', () => {
      if (this.worker === worker) this.worker = null;
      for (const pending of this.pending.values()) pending.reject(new Error('El proceso de Lulu Local se cerró.'));
      this.pending.clear();
    });
    worker.stderr?.on('data', (chunk) => console.warn('Lulu Local:', String(chunk).trim()));
    return worker;
  }

  armIdleRelease(minutes = 2) {
    clearTimeout(this.idleTimer);
    const delay = Math.max(30_000, Number(minutes || 2) * 60_000);
    this.idleTimer = setTimeout(() => { void this.release(); }, delay);
    this.idleTimer.unref?.();
  }

  async synthesize(request = {}) {
    const text = String(request.text || '').trim().slice(0, 500);
    if (!text) throw new Error('No hay texto para leer.');
    const voice = await this.resolve(request.voiceId || 'lulu-es-mx');
    const requestId = randomUUID();
    const worker = this.ensureWorker();
    this.lastUsedAt = Date.now();
    this.armIdleRelease(request.idleMinutes || 2);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Lulu Local tardó demasiado en generar la voz.'));
      }, 90_000);
      this.pending.set(requestId, {
        resolve: (value) => { clearTimeout(timeout); resolve(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); }
      });
      worker.postMessage({
        type: 'synthesize',
        requestId,
        text,
        speed: request.speed,
        sid: request.sid,
        voice
      });
    });
  }

  async release() {
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      try { worker.postMessage({ type: 'release' }); } catch {}
      setTimeout(() => { try { worker.kill(); } catch {} }, 250).unref?.();
    }
  }

  status() {
    return { running: Boolean(this.worker?.pid), pid: this.worker?.pid || null, pending: this.pending.size, lastUsedAt: this.lastUsedAt };
  }
}

module.exports = { LocalVoiceManager, readManifest, safeId, safeInside };
