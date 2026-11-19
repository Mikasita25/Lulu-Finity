'use strict';

const { core, event: tauriEvents, window: tauriWindow } = window.__TAURI__;
const listeners = new Map();

function dispatchDesktopEvent({ payload }) {
  for (const listener of listeners.get(payload.channel) || []) {
    try { listener(null, payload.value); }
    catch (error) { console.error('Evento de Lulu Finity:', error); }
  }
}

const desktopReady = tauriEvents.listen('lulu:desktop', dispatchDesktopEvent);

const ipcRenderer = {
  invoke: (channel, ...args) => desktopReady.then(() => core.invoke('desktop_invoke', { channel, args })),
  send: (channel, ...args) => {
    void ipcRenderer.invoke(channel, ...args).catch(error => console.error('Control de Lulu Finity:', error));
  },
  on: (channel, listener) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(listener);
  },
  removeListener: (channel, listener) => listeners.get(channel)?.delete(listener)
};

const contextBridge = {
  exposeInMainWorld(name, value) {
    Object.defineProperty(window, name, { value: Object.freeze(value) });
  }
};

function luluMediaUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('file:')) return url;
  try {
    const file = new URL(url);
    if (file.hostname) return '';
    const path = decodeURIComponent(file.pathname).replace(/^\/(?=[A-Z]:\/)/i, '');
    return core.convertFileSrc(path);
  } catch {
    return '';
  }
}

function luluWebVoice(encoded, volume) {
  const wave = atob(encoded);
  if (wave.length < 46 || wave.slice(0, 4) !== 'RIFF' || wave.slice(36, 40) !== 'data') {
    throw new Error('Audio local PCM inválido.');
  }
  const sampleRate = wave.charCodeAt(24) + (wave.charCodeAt(25) << 8) + (wave.charCodeAt(26) << 16);
  const context = new AudioContext();
  const source = context.createBufferSource();
  const buffer = context.createBuffer(1, (wave.length - 44) / 2, sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) {
    const offset = 44 + index * 2;
    const sample = wave.charCodeAt(offset) | (wave.charCodeAt(offset + 1) << 8);
    samples[index] = ((sample << 16) >> 16) / 32768 * volume;
  }
  source.buffer = buffer;
  source.connect(context.destination);
  let stopped = false;
  let settle;
  const ended = new Promise(resolve => { settle = resolve; });
  const finish = played => {
    if (stopped) return;
    stopped = true;
    source.disconnect();
    void context.close().catch(() => {});
    settle(played);
  };
  source.onended = () => finish(true);
  const started = context.resume().then(() => { if (!stopped) source.start(); });
  return { started, ended, duration: buffer.duration, stop: () => finish(false) };
}

window.addEventListener('DOMContentLoaded', () => {
  const titlebar = document.querySelector('.titlebar');
  titlebar?.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button,a,input,select,textarea')) return;
    void tauriWindow.getCurrentWindow().startDragging().catch(console.error);
  });
}, { once: true });
