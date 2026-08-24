'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classifyUpstreamFailure } = require('./failure-classifier');

const serverSource = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

test('no cierra un LIVE tranquilo después de 300 segundos', () => {
  assert.equal(serverSource.includes('features.closeInactiveWebSocketAfter'), false);
  assert.match(serverSource, /client\.ping\(\)/);
  assert.match(serverSource, /client\.on\('pong'/);
});

test('el relay de producción incluye Microsoft TTS', () => {
  assert.match(serverSource, /\/v1\/tts\/microsoft/);
  assert.match(serverSource, /MAX_TTS_CONCURRENT/);
});

test('rota la conexión del proveedor ante inactividad o duración máxima', () => {
  assert.equal(classifyUpstreamFailure(4006, 'inactive websocket'), 'transient');
  assert.equal(classifyUpstreamFailure(4555, 'maximum duration reached'), 'temporary-limit');
});
