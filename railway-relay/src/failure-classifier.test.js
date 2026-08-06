'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyUpstreamFailure } = require('./failure-classifier');

test('clasifica cierres que deben rotar la API key', () => {
  assert.equal(classifyUpstreamFailure(4429, ''), 'temporary-limit');
  assert.equal(classifyUpstreamFailure(4555, 'maximum duration reached'), 'temporary-limit');
  assert.equal(classifyUpstreamFailure(1006, 'monthly quota exhausted'), 'quota');
});

test('separa claves inválidas, configuración y LIVE offline', () => {
  assert.equal(classifyUpstreamFailure(4401, 'invalid api key'), 'invalid');
  assert.equal(classifyUpstreamFailure(4400, 'invalid configuration'), 'configuration');
  assert.equal(classifyUpstreamFailure(4404, 'not live'), 'offline');
});
