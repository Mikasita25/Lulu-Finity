'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, child) {
  let lastError = null;
  for (let i = 0; i < 50; i += 1) {
    if (child.exitCode !== null) throw new Error(`El relay terminó con código ${child.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/health`, { cache: 'no-store' });
      if (response.ok) return response.json();
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError || new Error('El relay no abrió /health.');
}

test('public server exposes a fixed overlay URL and authenticated publishing', { timeout: 15000 }, async (t) => {
  const port = await freePort();
  const token = 'integration-secret-token-for-overlays';
  const cwd = path.resolve(__dirname, '..');
  const child = spawn(process.execPath, ['src/public-server.js'], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      EULER_API_KEYS: 'dummy-integration-key',
      CLIENT_TOKENS: token,
      TTS_CLIENT_TOKENS: token,
      MAX_CLIENTS: '3'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += String(chunk); });
  child.stderr.on('data', (chunk) => { logs += String(chunk); });
  t.after(() => { try { child.kill('SIGTERM'); } catch {} });

  const baseUrl = `http://127.0.0.1:${port}`;
  const health = await waitForHealth(baseUrl, child).catch((error) => {
    throw new Error(`${error.message}\n${logs}`);
  });
  assert.equal(health.overlays?.stablePublicUrls, true);

  const capability = 'a'.repeat(32);
  const denied = await fetch(`${baseUrl}/v1/overlays/publish`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: capability, source: 'widget:goal', html: '<b>x</b>', state: {} })
  });
  assert.equal(denied.status, 401);

  const published = await fetch(`${baseUrl}/v1/overlays/publish`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ token: capability, source: 'widget:goal', html: '<!doctype html><b>Meta fija</b>', state: { type:'goal', progress:725 } })
  });
  assert.equal(published.status, 200, logs);

  const page = await fetch(`${baseUrl}/widget?type=goal&token=${capability}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Meta fija/);

  const state = await fetch(`${baseUrl}/widget-snapshot?type=goal&token=${capability}`);
  assert.equal(state.status, 200);
  assert.equal((await state.json()).progress, 725);
});
