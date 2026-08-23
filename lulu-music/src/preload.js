'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);
const listen = (channel, callback) => {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('luluMusic', Object.freeze({
  getState: () => invoke('app:get-state'),
  rendererReady: () => ipcRenderer.send('app:renderer-ready'),
  saveSettings: (settings) => invoke('settings:save', settings),
  connectLive: (username) => invoke('live:connect', { username }),
  disconnectLive: () => invoke('live:disconnect'),
  addSong: (query) => invoke('music:add', { query }),
  removeSong: (id) => invoke('music:remove', { id }),
  moveSong: (id, direction) => invoke('music:move', { id, direction }),
  clearQueue: () => invoke('music:clear'),
  playerControl: (action, value) => invoke('player:control', { action, value }),
  showPlayer: () => invoke('player:show'),
  reportAudiusState: (state) => ipcRenderer.send('audius:state', state),
  onState: (callback) => listen('music:state', callback),
  onLiveStatus: (callback) => listen('live:status', callback),
  onRequest: (callback) => listen('music:request', callback),
  onNotice: (callback) => listen('app:notice', callback),
  onAudiusLoad: (callback) => listen('audius:load', callback),
  onAudiusCommand: (callback) => listen('audius:command', callback)
}));
