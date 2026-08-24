'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_TEXT_LENGTH,
  MICROSOFT_VOICES,
  normalizeMicrosoftTtsRequest
} = require('./microsoft-tts');

test('publica las voces neuronales Microsoft usadas por Android', () => {
  const ids = new Set(MICROSOFT_VOICES.map((voice) => voice.identifier));
  assert.ok(ids.has('es-MX-DaliaNeural'));
  assert.ok(ids.has('es-MX-JorgeNeural'));
  assert.ok(ids.has('es-ES-ElviraNeural'));
  assert.ok(ids.has('en-US-AriaNeural'));
});

test('normaliza una voz desconocida y limita ritmo y tono', () => {
  const request = normalizeMicrosoftTtsRequest({
    text: '  Hola   desde Lulú  ',
    voice: 'motor-local-android',
    rate: 9,
    pitch: 0
  });
  assert.equal(request.text, 'Hola desde Lulú');
  assert.equal(request.voice, 'es-MX-DaliaNeural');
  assert.equal(request.rate, 1.5);
  assert.equal(request.pitch, 0.7);
  assert.equal(request.edgeOptions.rate, '+50%');
  assert.equal(request.edgeOptions.pitch, '-15Hz');
});

test('rechaza textos mayores que la cola móvil', () => {
  assert.throws(
    () => normalizeMicrosoftTtsRequest({ text: 'x'.repeat(MAX_TEXT_LENGTH + 1) }),
    (error) => error.statusCode === 413
  );
});
