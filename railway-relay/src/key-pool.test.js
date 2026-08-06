'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { KeyPool, parseList } = require('./key-pool');

test('parseList acepta JSON y listas separadas', () => {
  assert.deepEqual(parseList('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseList('a,b\nc'), ['a', 'b', 'c']);
});

test('KeyPool reparte por menor uso y respeta concurrencia', () => {
  const pool = new KeyPool(['a', 'b'], { maxConnectionsPerKey: 1 });
  const first = pool.acquire();
  const second = pool.acquire();
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.id, second.id);
  assert.equal(pool.acquire(), null);
  pool.release(first.id);
  assert.equal(pool.acquire().id, first.id);
});

test('KeyPool pone una clave limitada en enfriamiento', () => {
  const now = 1000;
  const pool = new KeyPool(['a', 'b'], { cooldownMs: 5000, maxConnectionsPerKey: 1 });
  const first = pool.acquire(new Set(), now);
  pool.release(first.id);
  pool.markTemporaryLimit(first.id, '429', now);
  const next = pool.acquire(new Set(), now + 1);
  assert.ok(next);
  assert.notEqual(next.id, first.id);
});

test('KeyPool desactiva una clave inválida sin revelar secretos', () => {
  const pool = new KeyPool(['super-secret']);
  const key = pool.acquire();
  pool.release(key.id);
  pool.markInvalid(key.id, '401');
  assert.equal(pool.acquire(), null);
  assert.equal(JSON.stringify(pool.snapshot()).includes('super-secret'), false);
});
