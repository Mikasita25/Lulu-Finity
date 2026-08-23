'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
process.env.LULU_MUSIC_UNIT_TEST = '1';
const { sanitizeSettings } = require('../src/main');

test('sanea todos los ajustes antes de usarlos', () => {
  const value = sanitizeSettings({
    creatorUsername:'@@Lulu Fan', command:' canción ', provider:'otro', permission:'root',
    queueLimit:9999, volume:20, selectedUsers:['@ANA','ana',''], blockedTerms:['x'.repeat(100)],
    widgetTheme:'inexistente', widgetBackground:'inexistente'
  });
  assert.equal(value.creatorUsername,'lulu fan');
  assert.equal(value.command,'!canción');
  assert.equal(value.provider,'auto');
  assert.equal(value.permission,'all');
  assert.equal(value.queueLimit,100);
  assert.equal(value.volume,1);
  assert.deepEqual(value.selectedUsers,['ana']);
  assert.equal(value.blockedTerms[0].length,80);
  assert.equal('widgetTheme' in value,false);
  assert.equal('widgetBackground' in value,false);
});
