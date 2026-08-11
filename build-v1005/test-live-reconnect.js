'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');

const sourceRoot = path.resolve(process.argv[2] || 'work-v1005');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lulu-reconnect-'));
const appRoot = path.join(temporaryRoot, 'app');
fs.mkdirSync(appRoot, { recursive: true });
fs.cpSync(path.join(sourceRoot, 'src'), path.join(appRoot, 'src'), { recursive: true });
fs.symlinkSync(path.join(sourceRoot, 'node_modules'), path.join(appRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
let mainSource = fs.readFileSync(path.join(appRoot, 'src', 'main.js'), 'utf8');
mainSource = mainSource.replace('__LULU_RELAY_CLIENT_TOKEN__', 'test-token-1234567890-1234567890-1234567890');
fs.writeFileSync(path.join(appRoot, 'src', 'main.js'), mainSource, 'utf8');

process.env.CI = 'true';
process.env.RUNNER_TEMP = temporaryRoot;

const ipcHandlers = new Map();
const ipcListeners = new Map();
const sentEvents = [];
const ipcMain = {
  handle(channel, handler) {
    assert.equal(ipcHandlers.has(channel), false, `IPC duplicado: ${channel}`);
    ipcHandlers.set(channel, handler);
  },
  on(channel, handler) {
    assert.equal(ipcListeners.has(channel), false, `IPC listener duplicado: ${channel}`);
    ipcListeners.set(channel, handler);
  }
};

class FakeWebContents extends EventEmitter {
  setWindowOpenHandler() {}
  getURL() { return ''; }
  send(channel, payload) { sentEvents.push({ channel, payload }); }
  isDestroyed() { return false; }
  getOSProcessId() { return 1001; }
  async executeJavaScript() { return { ok: true, results: [{ name: 'dashboard', visibleCount: 1 }] }; }
}

class FakeBrowserWindow extends EventEmitter {
  static instances = [];
  static getAllWindows() { return FakeBrowserWindow.instances.filter((item) => !item.destroyed); }

  constructor(options) {
    super();
    this.options = options;
    this.destroyed = false;
    this.visible = false;
    this.webContents = new FakeWebContents();
    FakeBrowserWindow.instances.push(this);
  }

  async loadFile(file) {
    assert.equal(fs.existsSync(file), true);
    setImmediate(() => this.emit('ready-to-show'));
  }
  show() { this.visible = true; }
  focus() {}
  destroy() { this.destroyed = true; this.emit('closed'); }
  isDestroyed() { return this.destroyed; }
  isVisible() { return this.visible; }
  isMaximized() { return false; }
  minimize() {}
  maximize() {}
  unmaximize() {}
}

class FakeApp extends EventEmitter {
  constructor() { super(); this.isPackaged = false; this.exitCode = null; }
  setName(name) { this.name = name; }
  setAppUserModelId(id) { this.appUserModelId = id; }
  whenReady() { return Promise.resolve(); }
  getVersion() { return '1.0.5'; }
  getAppMetrics() { return []; }
  getPath(name) {
    const target = path.join(temporaryRoot, name);
    fs.mkdirSync(target, { recursive: true });
    return target;
  }
  quit() {}
  exit(code) { this.exitCode = code; }
}

class FakeWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    this.readyState = FakeWebSocket.CONNECTING;
    FakeWebSocket.instances.push(this);
    setImmediate(() => {
      if (this.readyState !== FakeWebSocket.CONNECTING) return;
      this.readyState = FakeWebSocket.OPEN;
      this.emit('open');
      setImmediate(() => {
        if (this.readyState !== FakeWebSocket.OPEN) return;
        const status = Buffer.from(JSON.stringify({ type: 'lulu.relay.status', data: { state: 'connected', attempt: 1, keyId: 'test' } }));
        this.emit('message', status, false);
      });
    });
  }

  close(code = 1000, reason = '') {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSING;
    setImmediate(() => this.remoteClose(code, reason));
  }

  terminate() { this.remoteClose(1006, 'terminated'); }

  remoteClose(code, reason = '') {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.emit('close', code, Buffer.from(String(reason)));
  }
}

const app = new FakeApp();
const autoUpdater = new EventEmitter();
autoUpdater.quitAndInstall = () => {};
autoUpdater.checkForUpdates = async () => ({ updateInfo: { version: '1.0.5' } });
const electronStub = {
  app,
  BrowserWindow: FakeBrowserWindow,
  ipcMain,
  shell: { openExternal: async () => {} },
  dialog: {
    showErrorBox(title, message) { throw new Error(`${title}: ${message}`); },
    showMessageBox: async () => ({ response: 1 }),
    showOpenDialog: async () => ({ canceled: true, filePaths: [] })
  },
  clipboard: { writeText() {} },
  session: { fromPartition: () => ({ cookies: { get: async () => [], remove: async () => {} } }) },
  utilityProcess: {}
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'electron') return electronStub;
  if (request === 'electron-updater') return { autoUpdater };
  if (request === 'ws') return FakeWebSocket;
  return originalLoad.call(this, request, parent, isMain);
};

async function waitFor(predicate, timeoutMs = 4000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('La simulación de reconexión excedió el tiempo límite.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function latestStatus() {
  return [...sentEvents].reverse().find((entry) => entry.channel === 'live:status')?.payload || null;
}

(async () => {
  try {
    require(path.join(appRoot, 'src', 'main.js'));
    await waitFor(() => FakeBrowserWindow.instances.length === 1 && FakeBrowserWindow.instances[0].visible);
    assert.equal(FakeBrowserWindow.instances[0].options.webPreferences.backgroundThrottling, false);
    await ipcHandlers.get('app:get-state')();

    const connect = ipcHandlers.get('live:connect');
    const disconnect = ipcHandlers.get('live:disconnect');
    const runtimeStatus = ipcHandlers.get('runtime:status');
    const setActivePage = ipcHandlers.get('runtime:set-active-page');
    const releaseIdle = ipcHandlers.get('runtime:release-idle');
    assert.equal(typeof connect, 'function');
    assert.equal(typeof disconnect, 'function');

    await connect(null, 'lulutest');
    assert.equal(FakeWebSocket.instances.length, 1);
    assert.equal(latestStatus()?.status, 'connected');
    await setActivePage(null, 'settings');
    await releaseIdle(null, { force: true, keepMusic: false });
    assert.equal(FakeWebSocket.instances[0].readyState, FakeWebSocket.OPEN, 'La optimización cerró el LIVE activo');
    assert.equal((await runtimeStatus()).modules.live, true);

    FakeWebSocket.instances[0].remoteClose(4006, 'inactive websocket');
    await waitFor(() => FakeWebSocket.instances.length === 2, 3000);
    await waitFor(() => latestStatus()?.reconnected === true, 3000);
    assert.equal(latestStatus()?.status, 'connected');
    assert.equal((await runtimeStatus()).modules.live, true);

    FakeWebSocket.instances[1].remoteClose(4404, 'TikTok user offline');
    await new Promise((resolve) => setTimeout(resolve, 1300));
    assert.equal(FakeWebSocket.instances.length, 2, 'Reconectó un LIVE que TikTok marcó como terminado');
    assert.equal(latestStatus()?.status, 'disconnected');

    await connect(null, 'lulutest');
    assert.equal(FakeWebSocket.instances.length, 3);
    FakeWebSocket.instances[2].remoteClose(1012, 'Railway restart');
    await waitFor(() => latestStatus()?.reconnecting === true);
    await disconnect();
    await new Promise((resolve) => setTimeout(resolve, 1300));
    assert.equal(FakeWebSocket.instances.length, 3, 'Desconectar no canceló el intento automático pendiente');
    assert.equal(latestStatus()?.status, 'disconnected');

    console.log('Reconexión LIVE validada: segundo plano, liberación de recursos, recuperación, cierre terminal y cancelación manual.');
  } finally {
    Module._load = originalLoad;
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
