'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

let activeVitsVoiceId = '';
let activeTts = null;
let cloneRuntime = null;

function safeInside(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, String(relative || ''));
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('El paquete de voz contiene una ruta no segura.');
  return target;
}

function freeVitsEngine() {
  try { activeTts?.free?.(); } catch {}
  try { activeTts?.release?.(); } catch {}
  activeTts = null;
  activeVitsVoiceId = '';
}

function createVitsEngine(voice) {
  const sherpa = require('sherpa-onnx-node');
  const root = voice.root;
  const engine = voice.engine || {};
  const vits = {
    model: safeInside(root, engine.model),
    tokens: safeInside(root, engine.tokens),
    dataDir: safeInside(root, engine.dataDir || 'espeak-ng-data'),
    lexicon: engine.lexicon ? safeInside(root, engine.lexicon) : ''
  };
  return new sherpa.OfflineTts({
    model: {
      vits,
      numThreads: Math.max(1, Math.min(4, Number(voice.numThreads) || 2)),
      debug: false,
      provider: 'cpu'
    },
    maxNumSentences: 1,
    ruleFsts: engine.ruleFsts ? safeInside(root, engine.ruleFsts) : '',
    ruleFars: ''
  });
}

function getVitsEngine(voice) {
  if (!activeTts || activeVitsVoiceId !== voice.id) {
    freeVitsEngine();
    activeTts = createVitsEngine(voice);
    activeVitsVoiceId = voice.id;
  }
  return activeTts;
}

function pcm16Wave(samples, sampleRate) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.allocUnsafe(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, Number(samples[index]) || 0));
    buffer.writeInt16LE(sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), 44 + index * 2);
  }
  return buffer;
}

function synthesizeVits(voice, text, speed, sid) {
  const sherpa = require('sherpa-onnx-node');
  const generationConfig = new sherpa.GenerationConfig({
    sid: Math.max(0, Number(sid ?? voice.sid) || 0),
    speed: Math.max(0.5, Math.min(2, Number(speed) || 1)),
    silenceScale: 0.2
  });
  const audio = getVitsEngine(voice).generate({ text: String(text || '').slice(0, 500), generationConfig });
  return { wave: pcm16Wave(audio.samples, audio.sampleRate), sampleRate: audio.sampleRate };
}

class CloneRuntimeProcess {
  constructor(runtime) {
    this.runtime = runtime;
    this.key = [runtime.root, runtime.reference, runtime.checkpoint].join('|');
    this.child = null;
    this.buffer = '';
    this.pending = new Map();
    this.ready = null;
  }

  start() {
    if (this.child?.pid && this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const child = spawn(this.runtime.executable, [
        '-u', this.runtime.script, '--serve',
        '--config', this.runtime.config,
        '--checkpoint', this.runtime.checkpoint,
        '--reference', this.runtime.reference
      ], { cwd: this.runtime.root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      this.child = child;
      const startupTimer = setTimeout(() => reject(new Error('El motor de clonación tardó demasiado en iniciar.')), 180_000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        this.buffer += chunk;
        while (this.buffer.includes('\n')) {
          const split = this.buffer.indexOf('\n');
          const line = this.buffer.slice(0, split).trim();
          this.buffer = this.buffer.slice(split + 1);
          if (!line) continue;
          let message;
          try { message = JSON.parse(line); } catch { continue; }
          if (message.type === 'ready') {
            clearTimeout(startupTimer);
            resolve();
            continue;
          }
          const pending = this.pending.get(message.requestId);
          if (!pending) continue;
          this.pending.delete(message.requestId);
          if (message.type === 'result') pending.resolve(message);
          else pending.reject(new Error(message.message || 'La clonación local no pudo convertir el audio.'));
        }
      });
      child.stderr.on('data', (chunk) => console.warn('Voz Oficial:', String(chunk).trim()));
      child.once('error', (error) => {
        clearTimeout(startupTimer);
        reject(error);
        this.failAll(error);
      });
      child.once('exit', (code) => {
        clearTimeout(startupTimer);
        const error = new Error(`El motor de clonación se cerró${Number.isInteger(code) ? ` (${code})` : ''}.`);
        reject(error);
        this.failAll(error);
        this.child = null;
        this.ready = null;
      });
    });
    return this.ready;
  }

  failAll(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  async convert(requestId, wave) {
    await this.start();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('La Voz Oficial tardó demasiado en generar audio.'));
      }, 180_000);
      this.pending.set(requestId, {
        resolve: (value) => { clearTimeout(timeout); resolve(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); }
      });
      this.child.stdin.write(`${JSON.stringify({ type: 'convert', requestId, audio: wave.toString('base64') })}\n`, (error) => {
        if (!error) return;
        const pending = this.pending.get(requestId);
        this.pending.delete(requestId);
        pending?.reject(error);
      });
    });
  }

  stop() {
    const child = this.child;
    this.child = null;
    this.ready = null;
    this.failAll(new Error('El motor de clonación fue liberado.'));
    if (child) {
      try { child.stdin.end(); } catch {}
      setTimeout(() => { try { child.kill(); } catch {} }, 250).unref?.();
    }
  }
}

function getCloneRuntime(runtime) {
  const key = [runtime.root, runtime.reference, runtime.checkpoint].join('|');
  if (!cloneRuntime || cloneRuntime.key !== key) {
    cloneRuntime?.stop();
    cloneRuntime = new CloneRuntimeProcess(runtime);
  }
  return cloneRuntime;
}

async function synthesize(message) {
  const voice = message.voice || {};
  const text = String(message.text || '').slice(0, 500);
  if (voice.type === 'vits') {
    const audio = synthesizeVits(voice, text, message.speed, message.sid);
    return { mimeType: 'audio/wav', data: audio.wave.toString('base64'), bytes: audio.wave.length, sampleRate: audio.sampleRate };
  }
  if (voice.type !== 'openvoice-v2' || !message.baseVoice || !message.runtime) throw new Error('La voz local seleccionada no tiene un motor compatible.');
  const base = synthesizeVits(message.baseVoice, text, message.speed, message.sid);
  const result = await getCloneRuntime(message.runtime).convert(message.requestId, base.wave);
  return { mimeType: 'audio/wav', data: result.audio, bytes: Number(result.bytes) || Buffer.byteLength(result.audio || '', 'base64'), sampleRate: Number(result.sampleRate) || 22050 };
}

async function releaseAll() {
  freeVitsEngine();
  cloneRuntime?.stop();
  cloneRuntime = null;
}

process.parentPort.on('message', async ({ data: message }) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'release') {
    await releaseAll();
    process.parentPort.postMessage({ type: 'released' });
    return;
  }
  if (message.type !== 'synthesize') return;
  try {
    process.parentPort.postMessage({ type: 'result', requestId: message.requestId, result: await synthesize(message) });
  } catch (error) {
    process.parentPort.postMessage({ type: 'error', requestId: message.requestId, message: error?.message || String(error) });
  }
});

process.on('exit', () => { void releaseAll(); });

module.exports = { CloneRuntimeProcess, pcm16Wave, safeInside };
