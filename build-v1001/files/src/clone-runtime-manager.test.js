'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runtimeSpec, safeInside, validateEngineUrl } = require('./clone-runtime-manager');

const officialVoice = {
  id: 'lulu-official',
  engine: {
    runtime: {
      version: 'openvoice-v2-2024-04',
      url: 'https://github.com/Mikasita25/Lulu-Finity/releases/download/v1.0.1/Lulu-Finity-Clone-Engine-1.0.1-win-x64.zip',
      sha256: 'a'.repeat(64),
      executable: 'python/python.exe',
      script: 'lulu-clone-engine.py',
      config: 'checkpoints_v2/converter/config.json',
      checkpoint: 'checkpoints_v2/converter/checkpoint.pth'
    }
  }
};

test('acepta únicamente la publicación oficial y sus redirecciones', () => {
  assert.equal(validateEngineUrl(officialVoice.engine.runtime.url).hostname, 'github.com');
  assert.equal(validateEngineUrl('https://release-assets.githubusercontent.com/file.zip', true).hostname, 'release-assets.githubusercontent.com');
  assert.throws(() => validateEngineUrl('http://github.com/Mikasita25/Lulu-Finity/releases/download/x/file.zip'));
  assert.throws(() => validateEngineUrl('https://example.com/engine.zip'));
});

test('rechaza rutas que salen del directorio del motor', () => {
  const root = path.resolve('/tmp/lulu-engine');
  assert.equal(safeInside(root, 'python/python.exe'), path.join(root, 'python/python.exe'));
  assert.throws(() => safeInside(root, '../escape.exe'));
});

test('normaliza el manifiesto del motor clonado', () => {
  const spec = runtimeSpec(officialVoice);
  assert.equal(spec.version, 'openvoice-v2-2024-04');
  assert.equal(spec.sha256, 'a'.repeat(64));
  assert.equal(spec.executable, 'python/python.exe');
});
