'use strict';

const { EventEmitter } = require('node:events');
const { fork } = require('node:child_process');
const { Console } = require('node:console');
const path = require('node:path');
const { createHostProtocol } = require('./host-protocol.cjs');

const output = process.stdout;
global.console = new Console({ stdout: process.stderr, stderr: process.stderr });
process.resourcesPath = path.resolve(__dirname, '..');

const app = new EventEmitter();
const windows = new Map();
const handlers = new Map();
const ipcMain = new EventEmitter();
const rendererChannels = new Set(require('../renderer-channels.json'));
const mainLabel = 'main';
const youtubePartition = 'persist:lulu-youtube';
const spotifyPartition = 'persist:lulu-spotify';
const tikTokPartition = 'persist:lulu-tiktok-chat';
const browserSessions = new Map();
const powerMonitor = new EventEmitter();
let closing = false;
let lastWakeHeartbeat = Date.now();

const bridge = createHostProtocol({
  input: process.stdin,
  output,
  async onCall(channel, args) {
    if (channel === '$host-close') {
      windows.get(mainLabel)?.emit('close', { preventDefault() {} });
      return;
    }
    if (!rendererChannels.has(channel) || !Array.isArray(args)) throw new Error('Comando de escritorio desconocido.');
    if (channel === 'runtime:status') desktopMetrics = await bridge.call('metrics');
    const sender = windows.get(mainLabel)?.webContents;
    if (handlers.has(channel)) return handlers.get(channel)({ sender }, ...args);
    if (ipcMain.listenerCount(channel)) return ipcMain.emit(channel, { sender }, ...args);
    throw new Error(`Comando de escritorio sin implementación: ${channel}.`);
  },
  onEvent({ label, event, args = [] }) {
    const win = windows.get(label);
    if (!win || win.destroyed) return;
    const contents = win.webContents;
    if (event === 'navigation-start') {
      contents.loading = true;
      contents.url = args[0];
      contents.emit('did-start-navigation', {}, args[0], false, true);
    } else if (event === 'navigation-complete') {
      contents.loading = false;
      contents.url = args[0];
      contents.emit('did-navigate', {}, contents.url);
      contents.emit('did-finish-load');
    } else if (event === 'navigation-failed') {
      contents.loading = false;
      contents.emit('did-fail-load', {}, args[1], args[2], args[0], true);
    } else if (event === 'navigation-in-page') {
      contents.url = args[0];
      contents.emit('did-navigate-in-page', {}, contents.url, true);
    } else if (event === 'console') {
      contents.emit('console-message', {}, { message: args[0] });
    } else if (event === 'new-window') {
      contents.openHandler?.({ url: args[0] });
    } else if (event === 'blocked-navigation') {
      contents.emit('will-navigate', { preventDefault() {} }, args[0]);
    } else if (event === 'render-process-gone') {
      contents.emit('render-process-gone', {}, { reason: args[0] });
    } else if (event === 'close') {
      let prevented = false;
      win.emit('close', { preventDefault() { prevented = true; } });
      if (!prevented && !win.destroyed) win.destroy();
    }
  },
  onClose() {
    app.emit('before-quit');
    process.exit(0);
  }
});
const hostCall = bridge.call;

ipcMain.handle = (name, callback) => handlers.set(name, callback);
let desktopMetrics = [];

class BrowserWindow extends EventEmitter {
  static getAllWindows() { return [...windows.values()]; }

  constructor(options) {
    super();
    const partition = options.webPreferences?.partition;
    this.label = partition === youtubePartition ? (options.title ? 'youtube' : 'youtube-search')
      : partition === spotifyPartition ? 'spotify'
      : partition === tikTokPartition ? 'tiktok' : mainLabel;
    this.destroyed = false;
    this.visible = false;
    this.maximized = false;
    const { width, height, minWidth, minHeight, title } = options;
    this.ready = hostCall('window-create', { label: this.label, width, height, minWidth, minHeight, title });
    windows.set(this.label, this);
    this.webContents = Object.assign(new EventEmitter(), {
      getURL: () => this.webContents.url,
      isLoadingMainFrame: () => this.webContents.loading,
      executeJavaScript: expression => this.call('window-eval', { expression }),
      setAudioMuted: value => this.notify('window-mute', { value }),
      setWindowOpenHandler: callback => { this.webContents.openHandler = callback; },
      send: (channel, value) => bridge.send({ type: 'renderer-event', channel, value }),
      url: '',
      loading: false
    });
  }

  async call(method, args = {}) {
    await this.ready;
    if (this.destroyed) throw new Error('La ventana se cerró.');
    return hostCall(method, { label: this.label, ...args });
  }

  notify(method, args) {
    void this.call(method, args).catch(error => {
      if (!this.destroyed) console.warn(error.message);
    });
  }

  async loadFile() {
    await this.ready;
    this.emit('ready-to-show');
  }

  async loadURL(url) {
    const previousUrl = this.webContents.url;
    this.webContents.url = url;
    this.webContents.loading = true;
    try { return await this.call('window-navigate', { url }); }
    catch (error) { this.webContents.url = previousUrl; throw error; }
    finally { this.webContents.loading = false; }
  }

  show() { this.visible = true; this.notify('window-show'); }
  hide() { this.visible = false; this.notify('window-hide'); }
  focus() { this.notify('window-focus'); }
  minimize() { this.notify('window-minimize'); }
  maximize() { this.maximized = true; this.notify('window-maximize', { value: true }); }
  unmaximize() { this.maximized = false; this.notify('window-maximize', { value: false }); }
  isDestroyed() { return this.destroyed; }
  isVisible() { return this.visible; }
  isMaximized() { return this.maximized; }
  setTitle(title) { this.notify('window-title', { title }); }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    windows.delete(this.label);
    void this.ready.then(() => hostCall('window-destroy', { label: this.label })).catch(console.warn);
    this.emit('closed');
  }
}

function sessionFor(partition) {
  if (!browserSessions.has(partition)) {
    const browser = new EventEmitter();
    const profile = partition === tikTokPartition ? 'tiktok' : 'youtube';
    Object.assign(browser, {
      cookies: { get: ({ url }) => hostCall('profile-cookies', { label: profile, url }) },
      clearStorageData: () => hostCall('profile-clear', { label: profile }),
      clearCache: () => Promise.resolve(),
      setPermissionCheckHandler() {},
      setPermissionRequestHandler() {},
      setAdBlockEnabled: value => hostCall('adblock-enabled', { value }).catch(console.warn),
      setAdvancedFilters: lists => hostCall('adblock-filters', { lists }).catch(console.warn),
      webRequest: {
        onBeforeRequest: ({ urls }) => { void hostCall('adblock-base', { urls }).catch(console.warn); }
      }
    });
    browserSessions.set(partition, browser);
  }
  return browserSessions.get(partition);
}

app.isPackaged = true;
app.getVersion = () => process.env.LULU_APP_VERSION;
app.getPath = key => ({ userData: process.env.LULU_USER_DATA, appData: process.env.APPDATA })[key];
app.whenReady = () => Promise.resolve();
app.setName = () => {};
app.setAppUserModelId = () => {};
app.getAppMetrics = () => desktopMetrics;
app.quit = () => {
  if (closing) return;
  closing = true;
  app.emit('before-quit');
  app.emit('will-quit');
  bridge.send({ type: 'quit', code: 0 });
};
app.exit = code => bridge.send({ type: 'quit', code });
setInterval(() => {
  const now = Date.now();
  if (now - lastWakeHeartbeat > 18_000) powerMonitor.emit('resume');
  lastWakeHeartbeat = now;
}, 5_000).unref();

const dialog = {
  showOpenDialog(owner, options) { return hostCall('dialog-file', options || owner); },
  showMessageBox(owner, options) { return hostCall('dialog-message', options || owner); },
  showErrorBox(title, message) { void hostCall('dialog-error', { title, message }).catch(console.warn); }
};

const utilityProcess = {
  fork(file) {
    const worker = fork(path.join(__dirname, 'voice-child.cjs'), [file], {
      execArgv: [],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      windowsHide: true
    });
    worker.postMessage = message => {
      worker.send(message, error => {
        if (error && message.requestId) {
          worker.emit('message', { requestId: message.requestId, type: 'error', message: error.message });
        }
      });
    };
    return worker;
  }
};

let awake = false;
const powerSaveBlocker = {
  start() { awake = true; void hostCall('keep-awake', { value: true }).catch(console.warn); return 1; },
  isStarted() { return awake; },
  stop() { awake = false; void hostCall('keep-awake', { value: false }).catch(console.warn); }
};

const shell = { openExternal: url => hostCall('open-external', { url }) };
const clipboard = { writeText: value => { void hostCall('clipboard', { value }).catch(console.warn); } };
const convertImage = async file => Buffer.from(await hostCall('convert-image', { path: file }), 'base64');

module.exports = { app, BrowserWindow, clipboard, convertImage, dialog, hostCall, ipcMain, powerMonitor, powerSaveBlocker, session: { fromPartition: sessionFor }, shell, utilityProcess };
