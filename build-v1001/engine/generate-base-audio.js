'use strict';

const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(process.argv[2] || 'app');
const output = path.resolve(process.argv[3] || 'base-voice.wav');
const sherpa = require(path.join(appRoot, 'node_modules/sherpa-onnx-node'));
const voiceRoot = path.join(appRoot, 'resources/voices/lulu-es-mx');

const tts = new sherpa.OfflineTts({
  model: {
    vits: {
      model: path.join(voiceRoot, 'es_MX-ald-medium.onnx'),
      tokens: path.join(voiceRoot, 'tokens.txt'),
      dataDir: path.join(voiceRoot, 'espeak-ng-data'),
      lexicon: ''
    },
    numThreads: 2,
    debug: false,
    provider: 'cpu'
  },
  maxNumSentences: 1
});

const audio = tts.generate({
  text: 'Hola, esta es una prueba nueva de la voz oficial de Lulu Finity.',
  generationConfig: new sherpa.GenerationConfig({ speed: 1, sid: 0, silenceScale: 0.2 })
});

const buffer = Buffer.allocUnsafe(44 + audio.samples.length * 2);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + audio.samples.length * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(audio.sampleRate, 24);
buffer.writeUInt32LE(audio.sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(audio.samples.length * 2, 40);
for (let index = 0; index < audio.samples.length; index += 1) {
  const sample = Math.max(-1, Math.min(1, Number(audio.samples[index]) || 0));
  buffer.writeInt16LE(sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), 44 + index * 2);
}
fs.writeFileSync(output, buffer);
console.log(JSON.stringify({ output, bytes: buffer.length, sampleRate: audio.sampleRate }));
