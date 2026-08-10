'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const publicServer = fs.readFileSync(path.join(root, 'public-server.js'), 'utf8');

test('el despliegue usa el servidor auditable y no el cargador anterior', () => {
  assert.match(publicServer, /require\('\.\/server'\)/);
  assert.doesNotMatch(publicServer, /server-v027-loader/);
});

test('el canal hacia la app es de solo recepción y limita mensajes entrantes', () => {
  assert.match(server, /maxPayload:\s*1024/);
  assert.match(server, /perMessageDeflate:\s*false/);
  assert.match(server, /client\.on\('message',[\s\S]*client\.close\(1008, 'Canal de solo recepción'\)/);
});

test('conserva la cuota individual al activar el servidor legible', () => {
  assert.match(server, /USER_DAILY_CONNECTION_LIMIT/);
  assert.match(server, /usageMeter\.userSnapshot\(uniqueId\)/);
  assert.match(server, /usageMeter\.recordConnection\(1, uniqueId\)/);
});
