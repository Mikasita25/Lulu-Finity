'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { DailyUsageMeter } = require('./usage-meter');

test('suma dos usos por conexión y calcula el porcentaje', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lulu-usage-'));
  const meter = new DailyUsageMeter({
    limit: 7500,
    perConnection: 2,
    stateFile: path.join(directory, 'usage.json'),
    now: () => new Date('2026-08-06T10:00:00Z')
  });
  const snapshot = meter.recordConnection();
  assert.equal(snapshot.used, 2);
  assert.equal(snapshot.estimatedConnectionsUsed, 1);
  assert.equal(snapshot.estimatedConnectionsRemaining, 3749);
  assert.equal(snapshot.percent, 0);
});

test('reinicia el contador al cambiar el día UTC', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lulu-usage-'));
  let now = new Date('2026-08-06T23:59:00Z');
  const meter = new DailyUsageMeter({
    stateFile: path.join(directory, 'usage.json'),
    now: () => now
  });
  meter.recordConnection(3);
  assert.equal(meter.snapshot().used, 6);
  now = new Date('2026-08-07T00:01:00Z');
  assert.equal(meter.snapshot().used, 0);
  assert.equal(meter.snapshot().date, '2026-08-07');
});
