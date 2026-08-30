'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { OverlayStore, capabilityMatches, publicIdForSecret, safeSource } = require('./overlay-store');

const SECRET = 'ab'.repeat(32);

test('deriva una identidad pública estable sin exponer la capacidad', () => {
  const id = publicIdForSecret(SECRET);
  assert.match(id, /^[a-f0-9]{32}$/);
  assert.equal(capabilityMatches(id, SECRET), true);
  assert.equal(capabilityMatches(id, 'cd'.repeat(32)), false);
});

test('restringe tipos y nombres de fuente', () => {
  assert.deepEqual(safeSource('widget', 'playlist'), { kind: 'widget', name: 'playlist' });
  assert.equal(safeSource('widget', '../../settings'), null);
  assert.equal(safeSource('screen', '5'), null);
});

test('persiste fuentes y permite reconstruir el manifiesto', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lulu-overlay-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new OverlayStore({ root });
  const id = publicIdForSecret(SECRET);
  await store.putSource(id, 'widget', 'playlist', { current: { title: 'Lulu' } }, SECRET);
  assert.equal((await store.getSource(id, 'widget', 'playlist')).data.current.title, 'Lulu');
  assert.deepEqual((await store.manifest(id, SECRET)).sources, ['widget-playlist']);
  await assert.rejects(() => store.putSource(id, 'widget', 'playlist', {}, 'cd'.repeat(32)), /Capacidad/);
});

test('valida extensión, MIME, huella y firma de recursos', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lulu-overlay-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new OverlayStore({ root });
  const id = publicIdForSecret(SECRET);
  const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.alloc(16)]);
  const digest = require('node:crypto').createHash('sha256').update(png).digest('hex');
  const name = `${digest}.png`;
  await store.putAsset(id, name, png, 'image/png', SECRET);
  assert.equal((await store.getAsset(id, name)).mime, 'image/png');
  await assert.rejects(() => store.putAsset(id, name, png, 'image/jpeg', SECRET), /tipo o contenido/);
});
