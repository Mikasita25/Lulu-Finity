'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.LULU_MUSIC_PATCH_TEST = '1';
const { patchMainSource } = require('./main-v103-stable');
delete process.env.LULU_MUSIC_PATCH_TEST;

test('runtime patch adds bounded YouTube recovery and Audius retry', () => {
  const original = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const patched = patchMainSource(original);
  assert.match(patched, /recoverYoutubePlayback/);
  assert.match(patched, /__LULU_MUSIC_STALLED__/);
  assert.match(patched, /window\.__luluMusicUserPaused/);
  assert.match(patched, /retryAudiusSameTrack/);
  assert.match(patched, /YOUTUBE_MAX_RECOVERY_ATTEMPTS/);
  assert.match(patched, /AUDIUS_MAX_RESOLVE_RETRIES/);
  assert.doesNotMatch(patched, /El reproductor ligero de YouTube no cargó:[\s\S]{0,120}advanceQueue\(\)/);
});

test('runtime patch refuses to silently drift from the audited 1.0.2 source', () => {
  assert.throws(() => patchMainSource("'use strict';\nmodule.exports={};"), /No se pudo aplicar/);
});
