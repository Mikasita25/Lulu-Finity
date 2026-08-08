'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FALLBACK_ONLINE_VOICES,
  isAllowedVoiceLocale,
  prepareOnlineVoices
} = require('./online-voice-catalog');

test('keeps the free catalog broad but excludes CJK locales', () => {
  assert.equal(isAllowedVoiceLocale('es-MX'), true);
  assert.equal(isAllowedVoiceLocale('en-US'), true);
  for (const locale of ['zh-CN', 'ja-JP', 'ko-KR', 'yue-CN', 'wuu-CN']) {
    assert.equal(isAllowedVoiceLocale(locale), false, locale);
  }
  assert.ok(FALLBACK_ONLINE_VOICES.length >= 35);
  assert.equal(FALLBACK_ONLINE_VOICES.some((voice) => !isAllowedVoiceLocale(voice.locale)), false);
});

test('normalizes, filters, deduplicates and prioritizes Spanish voices', () => {
  const voices = prepareOnlineVoices([
    { ShortName: 'en-US-JennyNeural', LocalName: 'Jenny', Locale: 'en-US', Gender: 'Female' },
    { ShortName: 'zh-CN-XiaoxiaoNeural', LocalName: 'Xiaoxiao', Locale: 'zh-CN', Gender: 'Female' },
    { shortName: 'es-MX-DaliaNeural', localName: 'Dalia', locale: 'es-MX', gender: 'Female' },
    { ShortName: 'es-MX-DaliaNeural', LocalName: 'Duplicada', Locale: 'es-MX', Gender: 'Female' },
    { ShortName: 'invalid_voice', LocalName: 'Inválida', Locale: 'es-MX', Gender: 'Female' }
  ]);
  assert.deepEqual(voices.map((voice) => voice.shortName), ['es-MX-DaliaNeural', 'en-US-JennyNeural']);
});
