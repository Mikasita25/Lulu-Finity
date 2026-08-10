'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const AdmZip = require('adm-zip');
const { LocalVoiceManager } = require('./local-voice-manager');

test('adm-zip actualizado importa una voz Lulu Local válida', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lulu-voice-import-'));
  const packagePath = path.join(root, 'prueba.lfvoice');
  const zip = new AdmZip();
  zip.addFile('voice.json', Buffer.from(JSON.stringify({
    id: 'voz-prueba',
    name: 'Voz de prueba',
    format: 'lulu-local-v1',
    type: 'vits',
    engine: { model: 'model.onnx', tokens: 'tokens.txt', dataDir: 'espeak-ng-data' }
  })));
  zip.addFile('model.onnx', Buffer.from('modelo'));
  zip.addFile('tokens.txt', Buffer.from('tokens'));
  zip.addFile('espeak-ng-data/es_dict', Buffer.from('diccionario'));
  zip.writeZip(packagePath);

  const manager = new LocalVoiceManager({
    app: {
      isPackaged: false,
      getPath: () => root
    },
    dialog: {
      showOpenDialog: async () => ({ canceled: false, filePaths: [packagePath] })
    },
    utilityProcess: {},
    workerPath: path.join(root, 'worker.js')
  });

  try {
    const imported = await manager.importVoice();
    assert.equal(imported.id, 'voz-prueba');
    assert.equal(fs.existsSync(path.join(root, 'lulu-local-voices', 'voz-prueba', 'voice.json')), true);
    assert.equal(fs.existsSync(path.join(root, 'lulu-local-voices', 'voz-prueba', 'model.onnx')), true);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});
