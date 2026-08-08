'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TIKTOK_VOICES, getTikTokVoice, isTikTokVoiceId } = require('./tiktok-voice-catalog');

test('catálogo TikTok real, único y sin idiomas CJK', () => {
  assert.ok(TIKTOK_VOICES.length >= 70);
  assert.equal(new Set(TIKTOK_VOICES.map((voice) => voice.id)).size, TIKTOK_VOICES.length);
  assert.ok(TIKTOK_VOICES.some((voice) => voice.id === 'es_mx_002'));
  assert.ok(TIKTOK_VOICES.some((voice) => voice.id === 'en_us_002'));
  assert.ok(TIKTOK_VOICES.some((voice) => voice.category === 'Personajes'));
  assert.equal(TIKTOK_VOICES.some((voice) => /^(jp|kr|zh|ja)_/i.test(voice.id)), false);
});

test('solo acepta códigos incluidos en el catálogo', () => {
  assert.equal(isTikTokVoiceId('en_us_stitch'), true);
  assert.equal(isTikTokVoiceId('es-MX-DaliaNeural'), false);
  assert.equal(getTikTokVoice('en_us_stitch')?.name, 'Stitch');
});
