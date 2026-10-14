'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const mainPath = path.join(projectRoot, 'src', 'main.js');

function loadPatch() {
  const previous = process.env.LULU_MUSIC_PATCH_TEST;
  process.env.LULU_MUSIC_PATCH_TEST = '1';
  try {
    delete require.cache[require.resolve('../src/main-v103-final')];
    const loaded = require('../src/main-v103-final');
    if (typeof loaded.patchMainSource !== 'function') throw new Error('El parche de reproducción no exportó patchMainSource.');
    return loaded.patchMainSource;
  } finally {
    if (previous === undefined) delete process.env.LULU_MUSIC_PATCH_TEST;
    else process.env.LULU_MUSIC_PATCH_TEST = previous;
  }
}

const original = fs.readFileSync(mainPath, 'utf8');
if (/function recoverYoutubePlayback\(/.test(original) && /function retryAudiusSameTrack\(/.test(original)) {
  console.log('Playback stability 1.0.3 ya estaba aplicada.');
  process.exit(0);
}

const patched = loadPatch()(original);
if (!/function recoverYoutubePlayback\(/.test(patched) || !/__LULU_MUSIC_STALLED__/.test(patched) || !/retryAudiusSameTrack/.test(patched)) {
  throw new Error('La verificación posterior al parche de reproducción falló.');
}
fs.writeFileSync(mainPath, patched, 'utf8');
console.log('Playback stability 1.0.3 aplicada directamente a src/main.js.');
