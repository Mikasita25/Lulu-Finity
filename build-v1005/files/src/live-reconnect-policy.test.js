'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LIVE_RECONNECT_DELAYS_MS,
  cleanCloseReason,
  shouldReconnectLive,
  liveReconnectDelay
} = require('./live-reconnect-policy');

test('reconecta cortes temporales, reinicios y cierres por inactividad o duración', () => {
  for (const code of [1006, 1011, 1012, 1013, 4006, 4500, 4555, 4556, 4557]) {
    assert.equal(shouldReconnectLive({ code, reason: 'temporary interruption' }), true, `código ${code}`);
  }
  assert.equal(shouldReconnectLive({ code: 0, reason: 'ECONNRESET' }), true);
});

test('no reconecta una salida manual, un LIVE finalizado ni un rechazo de seguridad', () => {
  for (const code of [1000, 1008, 4005, 4400, 4401, 4403, 4404, 4429]) {
    assert.equal(shouldReconnectLive({ code }), false, `código ${code}`);
  }
  assert.equal(shouldReconnectLive({ code: 1006, manuallyStopped: true }), false);
  assert.equal(shouldReconnectLive({ code: 1006, streamEnded: true }), false);
  assert.equal(shouldReconnectLive({ code: 1006, shuttingDown: true }), false);
  assert.equal(shouldReconnectLive({ code: 1006, reason: 'TikTok reports user offline' }), false);
});

test('usa retroceso limitado y limpia razones no imprimibles', () => {
  assert.equal(LIVE_RECONNECT_DELAYS_MS.length, 8);
  assert.equal(liveReconnectDelay(1), 1000);
  assert.equal(liveReconnectDelay(4), 10_000);
  assert.equal(liveReconnectDelay(99), 120_000);
  assert.equal(cleanCloseReason('  corte\u0000 temporal  '), 'corte temporal');
});
