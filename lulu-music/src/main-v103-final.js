'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

function loadStablePatch() {
  const previous = process.env.LULU_MUSIC_PATCH_TEST;
  process.env.LULU_MUSIC_PATCH_TEST = '1';
  let patch;
  try {
    delete require.cache[require.resolve('./main-v103-stable')];
    patch = require('./main-v103-stable').patchMainSource;
  } finally {
    if (previous === undefined) delete process.env.LULU_MUSIC_PATCH_TEST;
    else process.env.LULU_MUSIC_PATCH_TEST = previous;
  }
  if (typeof patch !== 'function') throw new Error('No se pudo cargar el parche estable de Lulu Music.');
  return patch;
}

const stablePatchMainSource = loadStablePatch();

function normalizeSource(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

function patchMainSource(input) {
  return stablePatchMainSource(normalizeSource(input));
}

if (process.env.LULU_MUSIC_PATCH_TEST === '1') {
  module.exports = { patchMainSource, normalizeSource };
} else {
  const filename = path.join(__dirname, 'main.js');
  const source = patchMainSource(fs.readFileSync(filename, 'utf8'));
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(source, filename);
  module.exports = compiled.exports;
}
