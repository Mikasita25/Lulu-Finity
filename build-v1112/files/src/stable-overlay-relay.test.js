'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { StableOverlayRelay } = require('./stable-overlay-relay');

test('publishes authenticated overlay state to the fixed Railway endpoint', async () => {
  let request = null;
  const relay = new StableOverlayRelay({
    baseUrl: 'https://lulu.example',
    clientToken: 'secret-token',
    appVersion: '1.1.2',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
  });
  const result = await relay.publish({ token: 'a'.repeat(32), source: 'widget:goal', html: '<b>goal</b>', state: { progress: 72 } });
  assert.equal(result.ok, true);
  assert.equal(request.url, 'https://lulu.example/v1/overlays/publish');
  assert.equal(request.options.headers.Authorization, 'Bearer secret-token');
  const body = JSON.parse(request.options.body);
  assert.equal(body.source, 'widget:goal');
  assert.equal(body.state.progress, 72);
});

test('refuses source publication when the release token is still a build marker', async () => {
  const relay = new StableOverlayRelay({ baseUrl: 'https://lulu.example', clientToken: '__LULU_RELAY_CLIENT_TOKEN__', fetchImpl: async () => ({ ok: true }) });
  await assert.rejects(() => relay.publish({ token: 'b'.repeat(32), source: 'overlay:1', state: {} }), /token/);
});

test('does not retry deterministic 4xx responses', async () => {
  let calls = 0;
  const relay = new StableOverlayRelay({
    baseUrl: 'https://lulu.example',
    clientToken: 'secret-token',
    fetchImpl: async () => { calls += 1; return { ok: false, status: 401, json: async () => ({ ok: false, error: 'No autorizado.' }) }; }
  });
  await assert.rejects(() => relay.publish({ token: 'c'.repeat(32), source: 'ranking:1', state: {} }), /No autorizado/);
  assert.equal(calls, 1);
});
