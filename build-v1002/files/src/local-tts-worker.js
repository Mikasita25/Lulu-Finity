'use strict';

const path = require('node:path');

let activeVoiceId = '';
let activeTts = null;

function safeInside(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, String(relative || ''));
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('El paquete de voz contiene una ruta no segura.');
  return target;
}

function freeEngine() {
  try { activeTts?.free?.(); } catch {}
  try { activeTts?.release?.(); } catch {}
  activeTts = null;
  activeVoiceId = '';
}

function createEngine(voice) {
  const sherpa = require('sherpa-onnx-node');
  const root = voice.root;
  const engine = voice.engine || {};
  const vits = {
    model: safeInside(root, engine.model),
    tokens: safeInside(root, engine.tokens),
    dataDir: safeInside(root, engine.dataDir || 'espeak-ng-data'),
    lexicon: engine.lexicon ? safeInside(root, engine.lexicon) : ''
  };
  const config = {
    model: {
      vits,
      numThreads: Math.max(1, Math.min(4, Number(voice.numThreads) || 2)),
      debug: false,
      provider: 'cpu'
    },
    maxNumSentences: 1,
    ruleFsts: engine.ruleFsts ? safeInside(root, engine.ruleFsts) : '',
    ruleFars: ''
  };
  return new sherpa.OfflineTts(config);
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

function synthesize(message) {
  const voice = message.voice || {};
  if (!activeTts || activeVoiceId !== voice.id) {
    freeEngine();
    activeTts = createEngine(voice);
    activeVoiceId = voice.id;
  }
  const sherpa = require('sherpa-onnx-node');
  const generationConfig = new sherpa.GenerationConfig({
    sid: Math.max(0, Number(message.sid ?? voice.sid) || 0),
    speed: Math.max(0.5, Math.min(2, Number(message.speed) || 1)),
    silenceScale: 0.2
  });
  const audio = activeTts.generate({ text: String(message.text || '').slice(0, 500), generationConfig });
  const wave = pcm16Wave(audio.samples, audio.sampleRate);
  return { mimeType: 'audio/wav', data: wave.toString('base64'), bytes: wave.length, sampleRate: audio.sampleRate };
}

process.parentPort.on('message', ({ data: message }) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'release') {
    freeEngine();
    process.parentPort.postMessage({ type: 'released' });
    return;
  }
  if (message.type !== 'synthesize') return;
  try {
    process.parentPort.postMessage({ type: 'result', requestId: message.requestId, result: synthesize(message) });
  } catch (error) {
    process.parentPort.postMessage({ type: 'error', requestId: message.requestId, message: error?.message || String(error) });
  }
});

process.on('exit', freeEngine);
