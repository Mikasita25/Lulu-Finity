'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RECOVERY_DELAYS_MS, tunnelRecoveryDelay, probeTunnelUrl } = require('./overlay-tunnel-health');

test('recovery delay grows and caps at 30 seconds', () => {
  assert.deepEqual(RECOVERY_DELAYS_MS, [1200, 2500, 5000, 10000, 20000, 30000]);
  assert.equal(tunnelRecoveryDelay(-4), 1200);
  assert.equal(tunnelRecoveryDelay(0), 1200);
  assert.equal(tunnelRecoveryDelay(3), 10000);
  assert.equal(tunnelRecoveryDelay(999), 30000);
});

test('403 still means the quick tunnel reached Lulu Finity', async () => {
  const result = await probeTunnelUrl(async () => ({ status: 403 }), 'https://example.trycloudflare.com', 1500);
  assert.equal(result.ok, true);
  assert.equal(result.status, 403);
});

test('server failures and invalid URLs are unhealthy', async () => {
  assert.equal((await probeTunnelUrl(async () => ({ status: 502 }), 'https://broken.trycloudflare.com')).ok, false);
  assert.equal((await probeTunnelUrl(async () => ({ status: 200 }), 'http://127.0.0.1:17345')).ok, false);
});

test('network errors are reported without throwing', async () => {
  const result = await probeTunnelUrl(async () => { throw new Error('offline'); }, 'https://gone.trycloudflare.com');
  assert.equal(result.ok, false);
  assert.match(result.error, /offline/);
});
