'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { classifyUpstreamFailure } = require('./failure-classifier');

const serverSource = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const encodedRuntime = ['00', '01']
  .map((part) => fs.readFileSync(path.join(__dirname, `server-v027-part-${part}.txt`), 'utf8').trim())
  .join('');
const runtimeSource = zlib.gunzipSync(Buffer.from(encodedRuntime, 'base64')).toString('utf8');

test('no cierra un LIVE tranquilo después de 300 segundos', () => {
  for (const source of [serverSource, runtimeSource]) {
    assert.equal(source.includes('features.closeInactiveWebSocketAfter'), false);
    assert.match(source, /client\.ping\(\)/);
    assert.match(source, /client\.on\('pong'/);
  }
});

test('el runtime desplegado incluye Microsoft TTS y la cuota individual', () => {
  for (const source of [serverSource, runtimeSource]) {
    assert.match(source, /\/v1\/tts\/microsoft/);
    assert.match(source, /userSnapshot\(uniqueId\)/);
  }
});

test('rota la conexión del proveedor ante inactividad o duración máxima', () => {
  assert.equal(classifyUpstreamFailure(4006, 'inactive websocket'), 'transient');
  assert.equal(classifyUpstreamFailure(4555, 'maximum duration reached'), 'temporary-limit');
});
