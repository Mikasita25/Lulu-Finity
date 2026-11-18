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

window.addEventListener('DOMContentLoaded', () => {
  const titlebar = document.querySelector('.titlebar');
  titlebar?.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button,a,input,select,textarea')) return;
    void tauriWindow.getCurrentWindow().startDragging().catch(console.error);
  });
}, { once: true });
