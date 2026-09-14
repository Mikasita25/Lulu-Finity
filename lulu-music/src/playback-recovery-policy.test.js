'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  YOUTUBE_STALL_MS,
  YOUTUBE_MAX_RECOVERY_ATTEMPTS,
  AUDIUS_STALL_MS,
  AUDIUS_MAX_LOCAL_RECOVERY_ATTEMPTS,
  AUDIUS_MAX_RESOLVE_RETRIES,
  recoveryDelay,
  shouldRecoverUnexpectedPause,
  shouldReportStall,
  canRetry
} = require('./playback-recovery-policy');

test('recovery limits remain bounded', () => {
  assert.equal(YOUTUBE_STALL_MS, 10000);
  assert.equal(YOUTUBE_MAX_RECOVERY_ATTEMPTS, 3);
  assert.equal(AUDIUS_STALL_MS, 7000);
  assert.equal(AUDIUS_MAX_LOCAL_RECOVERY_ATTEMPTS, 2);
  assert.equal(AUDIUS_MAX_RESOLVE_RETRIES, 1);
  assert.equal(recoveryDelay(1), 700);
  assert.equal(recoveryDelay(2), 1400);
  assert.equal(recoveryDelay(99), 2600);
});

test('unexpected pauses recover but explicit user pauses do not', () => {
  assert.equal(shouldRecoverUnexpectedPause({ paused:true, ended:false, userPaused:false, ad:false }), true);
  assert.equal(shouldRecoverUnexpectedPause({ paused:true, ended:false, userPaused:true, ad:false }), false);
  assert.equal(shouldRecoverUnexpectedPause({ paused:true, ended:true, userPaused:false, ad:false }), false);
  assert.equal(shouldRecoverUnexpectedPause({ paused:true, ended:false, userPaused:false, ad:true }), false);
});

test('stall reports only after the threshold and never during a user pause', () => {
  assert.equal(shouldReportStall({ stalledMs:9999 }), false);
  assert.equal(shouldReportStall({ stalledMs:10000 }), true);
  assert.equal(shouldReportStall({ stalledMs:20000, userPaused:true }), false);
  assert.equal(shouldReportStall({ stalledMs:20000, ad:true }), false);
});

test('retry budgets are deterministic', () => {
  assert.equal(canRetry(0, 3), true);
  assert.equal(canRetry(2, 3), true);
  assert.equal(canRetry(3, 3), false);
});
