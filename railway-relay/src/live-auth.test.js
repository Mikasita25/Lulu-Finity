'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isLiveAuthorized } = require('./live-auth');

const known = new Set(['valid-client-token']);

test('private LIVE rejects a missing or invalid token', () => {
  assert.equal(isLiveAuthorized({}, known, false), false);
  assert.equal(isLiveAuthorized({ authorization: 'Bearer invalid' }, known, false), false);
});

test('private LIVE accepts a matching bearer or client header', () => {
  assert.equal(isLiveAuthorized({ authorization: 'Bearer valid-client-token' }, known, false), true);
  assert.equal(isLiveAuthorized({ 'x-lulu-client-token': 'valid-client-token' }, known, false), true);
});

test('explicit public LIVE mode accepts older clients without a token', () => {
  assert.equal(isLiveAuthorized({}, known, true), true);
  assert.equal(isLiveAuthorized({ authorization: 'Bearer invalid' }, known, true), true);
});

test('an empty allowlist maintains backward-compatible public LIVE behavior', () => {
  assert.equal(isLiveAuthorized({}, new Set(), false), true);
});
