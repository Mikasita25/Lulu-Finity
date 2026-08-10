'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');

const root = path.resolve(process.argv[2] || 'app');
const mainPath = path.join(root, 'src', 'main.js');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lulu-startup-'));
const markerPath = path.join(temporaryRoot, 'renderer-ready.txt');
process.env.CI = 'true';
process.env.RUNNER_TEMP = temporaryRoot;
process.env.LULU_STARTUP_SMOKE_MARKER = markerPath;

const ipcHandlers = new Map();
const ipcListeners = new Map();
const ipcMain = {
  handle(channel, handler) {
    assert.equal(ipcHandlers.has(channel), false, `IPC handle duplicado: ${channel}`);
    ipcHandlers.set(channel, handler);
  },
  on(channel, handler) {
    assert.equal(ipcListeners.has(channel), false, `IPC listener duplicado: ${channel}`);
    ipcListeners.set(channel, handler);
  }
};

class FakeWebContents extends EventEmitter {
  constructor() {
    super();
    this.currentUrl = '';
  }

  setWindowOpenHandler(handler) { this.windowOpenHandler = handler; }
  getURL() { return this.currentUrl; }
  send() {}
  isDestroyed() { return false; }
  getOSProcessId() { return 1001; }
}

class FakeBrowserWindow extends EventEmitter {
  static instances = [];

  static getAllWindows() {
    return FakeBrowserWindow.instances.filter((window) => !window.destroyed);
  }

  constructor(options) {
    super();
    this.options = options;
    this.destroyed = false;
    this.visible = false;
    this.webContents = new FakeWebContents();
    FakeBrowserWindow.instances.push(this);
  }

  async loadFile(file) {
    this.loadedFile = file;
    assert.equal(fs.existsSync(file), true, `No existe la interfaz: ${file}`);
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
  constructor() {
    super();
    this.isPackaged = false;
    this.exitCode = null;
  }

  setName(name) { this.name = name; }
  setAppUserModelId(id) { this.appUserModelId = id; }
  whenReady() { return Promise.resolve(); }
  getVersion() { return '1.0.3'; }
  getAppMetrics() { return []; }
  getPath(name) {
    const target = path.join(temporaryRoot, name);
    fs.mkdirSync(target, { recursive: true });
    return target;
  }
  quit() {}
  exit(code) { this.exitCode = code; }
}

const app = new FakeApp();
const autoUpdater = new EventEmitter();
autoUpdater.quitAndInstall = () => {};
autoUpdater.checkForUpdates = async () => ({ updateInfo: { version: '1.0.3' } });

class FakeWebSocket extends EventEmitter {}
FakeWebSocket.OPEN = 1;

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

const failures = [];
process.on('unhandledRejection', (error) => failures.push(error));
process.on('uncaughtException', (error) => failures.push(error));

async function waitFor(predicate, timeoutMs = 2500) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('El arranque simulado excedió el tiempo límite.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

(async () => {
  try {
    require(mainPath);
    await waitFor(() => FakeBrowserWindow.instances.length === 1 && FakeBrowserWindow.instances[0].visible);
    assert.equal(failures.length, 0, failures[0]?.stack || failures[0]);
    assert.equal(app.exitCode, null, 'La app intentó salir durante el arranque');
    assert.equal(app.name, 'Lulu Finity');
    assert.equal(app.appUserModelId, 'com.mikasita.lulufinity');
    assert.ok(ipcHandlers.size >= 60, `Solo se registraron ${ipcHandlers.size} handlers IPC`);
    assert.ok(ipcHandlers.has('app:get-state'));
    assert.ok(ipcHandlers.has('runtime:status'));

    const initial = await ipcHandlers.get('app:get-state')();
    assert.equal(initial.version, '1.0.3');
    assert.equal(initial.settings.performanceProfile, 'balanced');
    assert.deepEqual(initial.settings.balancedKeepActive, {
      live: false,
      account: false,
      voice: false,
      music: false,
      overlays: false,
      rankings: false,
      automations: false,
      commands: false,
      games: false,
      economy: false
    });

    const rendererReady = ipcListeners.get('app:renderer-ready');
    assert.equal(typeof rendererReady, 'function');
    const outsideMarker = path.join(os.tmpdir(), `lulu-outside-${process.pid}.txt`);
    fs.rmSync(outsideMarker, { force: true });
    process.env.LULU_STARTUP_SMOKE_MARKER = outsideMarker;
    rendererReady();
    assert.equal(fs.existsSync(outsideMarker), false, 'La prueba escribió fuera de RUNNER_TEMP');
    process.env.LULU_STARTUP_SMOKE_MARKER = markerPath;
    rendererReady();
    assert.equal(fs.readFileSync(markerPath, 'utf8'), 'ready');
    assert.equal(FakeBrowserWindow.instances.length, 1, 'El arranque abrió reproductores auxiliares');
    console.log(`Arranque principal validado: ${ipcHandlers.size} handlers, una ventana y renderer listo`);
  } finally {
    Module._load = originalLoad;
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
