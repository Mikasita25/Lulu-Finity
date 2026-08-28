'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { OverlayHub, safeOverlayToken, safeSource } = require('./overlay-hub');

class FakeRequest extends EventEmitter {
  constructor({ method = 'GET', headers = {}, body = '' } = {}) {
    super();
    this.method = method;
    this.headers = headers;
    this.body = Buffer.from(body);
  }
  flush() {
    if (this.body.length) this.emit('data', this.body);
    this.emit('end');
  }
}

class FakeResponse {
  constructor() { this.statusCode = 0; this.headers = {}; this.chunks = []; }
  writeHead(statusCode, headers = {}) { this.statusCode = statusCode; this.headers = headers; }
  end(chunk = '') { if (chunk) this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); }
  text() { return Buffer.concat(this.chunks).toString('utf8'); }
}

async function publish(hub, body, token = 'secret') {
  const request = new FakeRequest({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const response = new FakeResponse();
  const pending = hub.handleHttpRequest(request, response, new URL('http://localhost/v1/overlays/publish'));
  request.flush();
  await pending;
  return response;
}

test('validates capability tokens and source names', () => {
  assert.equal(safeOverlayToken('a'.repeat(32)), 'a'.repeat(32));
  assert.equal(safeOverlayToken('short'), '');
  assert.equal(safeSource('widget:goal'), 'widget:goal');
  assert.equal(safeSource('ranking:4'), 'ranking:4');
  assert.equal(safeSource('overlay:2'), 'overlay:2');
  assert.equal(safeSource('widget:hacked'), '');
});

test('publishes page and state then serves the same stable public routes', async () => {
  const hub = new OverlayHub({ clientTokens: new Set(['secret']) });
  const token = 'b'.repeat(32);
  const response = await publish(hub, { token, source: 'widget:goal', html: '<!doctype html><b>meta</b>', state: { type: 'goal', progress: 725 } });
  assert.equal(response.statusCode, 200);

  const page = new FakeResponse();
  assert.equal(await hub.handleHttpRequest(new FakeRequest(), page, new URL(`http://localhost/widget?type=goal&token=${token}`)), true);
  assert.equal(page.statusCode, 200);
  assert.match(page.text(), /meta/);

  const state = new FakeResponse();
  assert.equal(await hub.handleHttpRequest(new FakeRequest(), state, new URL(`http://localhost/widget-snapshot?type=goal&token=${token}`)), true);
  assert.equal(JSON.parse(state.text()).progress, 725);
});

test('rejects publishing without the server-side client token', async () => {
  const hub = new OverlayHub({ clientTokens: new Set(['secret']) });
  const response = await publish(hub, { token: 'c'.repeat(32), source: 'overlay:1', html: '<b>x</b>', state: {} }, 'wrong');
  assert.equal(response.statusCode, 401);
});

test('serves published overlay media by the same token and screen', async () => {
  const hub = new OverlayHub({ clientTokens: new Set(['secret']) });
  const token = 'd'.repeat(32);
  const bytes = Buffer.from('fake-image');
  const response = await publish(hub, {
    token,
    source: 'overlay:2',
    html: '<!doctype html>',
    state: { type: 'show', url: `/overlay-media/test.png?screen=2&token=${token}` },
    media: { name: 'test.png', type: 'image/png', base64: bytes.toString('base64') }
  });
  assert.equal(response.statusCode, 200);

  const media = new FakeResponse();
  await hub.handleHttpRequest(new FakeRequest(), media, new URL(`http://localhost/overlay-media/test.png?screen=2&token=${token}`));
  assert.equal(media.statusCode, 200);
  assert.deepEqual(Buffer.concat(media.chunks), bytes);
});
