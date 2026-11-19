'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { test } = require('node:test');
const { once } = require('node:events');

const backend = path.resolve(__dirname, '../generated/sidecar');

async function launch(t, executable) {
  const directory = await mkdtemp(path.join(tmpdir(), 'lulu-rust-test-'));
  const child = spawn(executable, [path.join(backend, 'src/main.js')], {
    cwd: backend,
    env: { ...process.env, APPDATA: directory, LULU_USER_DATA: directory, LULU_APP_VERSION: '1.4.0-beta.5', LULU_UPDATE_FEED: 'releases' },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let diagnostics = '';
  child.stderr.on('data', data => { diagnostics += data; });
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
    await rm(directory, { recursive: true, force: true });
  });
  let sequence = 0;
  const pending = new Map();
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  function send(message) { child.stdin.write(JSON.stringify(message) + '\n'); }
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  lines.on('line', line => {
    const message = JSON.parse(line);
    if (message.type === 'host-call') {
      const hostCalls = {
        'window-create': null, 'window-show': null, 'window-destroy': null, 'keep-awake': null,
        'adblock-enabled': null, 'profile-cookies': [], metrics: []
      };
      if (message.method in hostCalls) send({ type: 'host-result', id: message.id, value: hostCalls[message.method] });
      else send({ type: 'host-result', id: message.id, error: `Unexpected host method ${message.method}` });
      if (message.method === 'window-show') ready();
      return;
    }
    if (message.type === 'invoke-result') {
      const reply = pending.get(message.id);
      if (!reply) return;
      pending.delete(message.id);
      if (message.error) reply.reject(new Error(message.error));
      else reply.resolve(message.value);
    }
  });
  await Promise.race([started, exited.then(([code]) => { throw new Error(`Backend quit (${code}) \n${diagnostics}`); })]);
  return {
    directory,
    invoke(channel, ...args) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ type: 'invoke', id, channel, args });
      });
    }
  };
}

test('el backend conserva configuración, voces y widgets a través del puente de escritorio', { timeout: 25_000 }, async t => {
  const node = process.platform === 'win32' ? path.join(backend, 'node.exe') : process.execPath;
  const { invoke, directory } = await launch(t, node);
  const current = await invoke('app:get-state');
  assert.equal(current.version, '1.4.0-beta.5');
  assert.ok(current.settings.overlayToken);
  await invoke('settings:save', { ...current.settings, username: 'lulu_test', checkUpdatesOnStartup: false });
  const saved = JSON.parse(await readFile(path.join(directory, 'settings.json'), 'utf8'));
  assert.equal(saved.username, 'lulu_test');

  const [sounds, localVoices, tiktokVoices, ranking, widget, economy] = await Promise.all([
    invoke('sounds:list-default'), invoke('tts:list-local-voices'), invoke('tts:list-tiktok-voices'),
    invoke('ranking:get-info', { slot: 1 }), invoke('widget:get-info', { type: 'playlist' }), invoke('economy:get')
  ]);
  assert.ok(sounds.length >= 20);
  assert.ok(localVoices.some(voice => voice.bundled));
  assert.ok(tiktokVoices.voices.length > 0);
  assert.ok(Array.isArray(economy.balances));
  for (const url of [ranking.localUrl, widget.localUrl]) {
    assert.match(url, /^http:\/\/127\.0\.0\.1:/);
    assert.equal((await fetch(url)).status, 200);
  }
  const release = await invoke('runtime:release-idle', {});
  assert.equal(typeof release, 'object');
  await assert.rejects(invoke('shell:arbitrary'), /desconocido/);
});

test('la edición Rust incluye todas las localidades del catálogo de voces Microsoft', () => {
  const { prepareOnlineVoices } = require('../generated/sidecar/src/online-voice-catalog');
  const voices = [
    { ShortName: 'es-MX-DaliaNeural', Locale: 'es-MX' },
    { ShortName: 'ja-JP-NanamiNeural', Locale: 'ja-JP' },
    { ShortName: 'ko-KR-SunHiNeural', Locale: 'ko-KR' },
    { ShortName: 'zh-CN-XiaoxiaoNeural', Locale: 'zh-CN' }
  ];
  assert.equal(prepareOnlineVoices(voices).length, voices.length);
});

test('la voz local reutiliza un proceso y lo libera al terminar en Windows', { skip: process.platform !== 'win32', timeout: 100_000 }, async t => {
  const { invoke } = await launch(t, path.join(backend, 'node.exe'));
  const say = text => invoke('tts:synthesize-local', { voiceId: 'lulu-es-mx', text });
  const first = await say('Hola, primera prueba de voz local.');
  const pid = (await invoke('runtime:status')).modules.localTts.pid;
  assert.ok(pid > 0);
  const rest = await Promise.all([say('Segunda prueba.'), say('Tercera prueba.')]);
  assert.ok([first, ...rest].every(clip => Buffer.from(clip.data, 'base64').length > 44));
  assert.equal((await invoke('runtime:status')).modules.localTts.pid, pid);
  await invoke('tts:release-local');
  for (let attempt = 0; attempt < 24; attempt++) {
    try { process.kill(pid, 0); }
    catch (error) { if (error.code === 'ESRCH') return; throw error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('El proceso de síntesis siguió vivo después de liberar la voz.');

});
test('el ahorro conserva reproductores activos, pausados o cargando', () => {
  const { retainMusicWindow } = require('./music-idle-policy.cjs');
  const window = { isDestroyed: () => false, isVisible: () => false, webContents: { isLoadingMainFrame: () => false } };
  assert.equal(retainMusicWindow(window, {}), false);
  for (const key of ['expectedPlaying', 'userPaused', 'replacing', 'recoveryTimer']) {
    assert.equal(retainMusicWindow(window, { [key]: true }), true);
  }
  window.webContents.isLoadingMainFrame = () => true;
  assert.equal(retainMusicWindow(window, {}), true);
});
