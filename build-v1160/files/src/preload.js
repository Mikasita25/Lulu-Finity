'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

// Estos controles no dependen del arranque del renderer.
window.addEventListener('DOMContentLoaded', () => {
  for (const [id, channel] of [
    ['minimizeBtn', 'window:minimize'],
    ['maximizeBtn', 'window:maximize'],
    ['closeBtn', 'window:close']
  ]) {
    document.getElementById(id)?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      ipcRenderer.send(channel);
    }, true);
  }
}, { once:true });

contextBridge.exposeInMainWorld('voiceStudio', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getRelayUsage: () => ipcRenderer.invoke('relay:usage'),
  openTikTokChat: (details) => ipcRenderer.invoke('tiktok-chat:open', details),
  getTikTokChatStatus: () => ipcRenderer.invoke('tiktok-chat:status'),
  sendTikTokChat: (details) => ipcRenderer.invoke('tiktok-chat:send', details),
  resetTikTokChatSession: () => ipcRenderer.invoke('tiktok-chat:reset'),
  pickMedia: (kind) => ipcRenderer.invoke('media:pick', kind),
  getOverlayInfo: (screen = 1) => ipcRenderer.invoke('overlay:get-info', { screen }),
  getRankingInfo: (slot = 1) => ipcRenderer.invoke('ranking:get-info', { slot }),
  copyRankingUrl: (slot = 1) => ipcRenderer.invoke('ranking:copy-url', { slot }),
  copyRankingLocalUrl: (slot = 1) => ipcRenderer.invoke('ranking:copy-local-url', { slot }),
  refreshRanking: (slot = 1) => ipcRenderer.invoke('ranking:refresh', { slot }),
  resetRanking: (type = 'all') => ipcRenderer.invoke('ranking:reset', { type }),
  getStreamWidgetInfo: (type = 'playlist') => ipcRenderer.invoke('widget:get-info', { type }),
  copyStreamWidgetUrl: (type = 'playlist') => ipcRenderer.invoke('widget:copy-url', { type }),
  copyStreamWidgetLocalUrl: (type = 'playlist') => ipcRenderer.invoke('widget:copy-local-url', { type }),
  updateStreamWidget: (type, payload) => ipcRenderer.invoke('widget:update', { type, payload }),
  applyStreamWidgetDesign: (type = 'playlist') => ipcRenderer.invoke('widget:apply-design', { type }),
  copyOverlayUrl: (screen = 1) => ipcRenderer.invoke('overlay:copy-url', { screen }),
  copyOverlayLocalUrl: (screen = 1) => ipcRenderer.invoke('overlay:copy-local-url', { screen }),
  showOverlay: (details) => ipcRenderer.invoke('overlay:show', details),
  clearOverlay: (screen = 1) => ipcRenderer.invoke('overlay:clear', { screen }),
  getEconomy: () => ipcRenderer.invoke('economy:get'),
  getBalance: (user) => ipcRenderer.invoke('economy:balance', { user }),
  mutateEconomy: (details) => ipcRenderer.invoke('economy:mutate', details),
  playLiveGame: (details) => ipcRenderer.invoke('games:play', details),
  evaluateAutomations: (rules,event,context) => ipcRenderer.invoke('automations:evaluate', { rules, event, context }),
  applyGoalEvent: (goals,event) => ipcRenderer.invoke('goals:apply-event', { goals, event }),
  resetGoal: (goals,goalId) => ipcRenderer.invoke('goals:reset', { goals, goalId }),
  updateGiftStats: (state,event) => ipcRenderer.invoke('gifts:update-stats', { state, event }),
  publishStreamWidget: (type,snapshot) => ipcRenderer.invoke('widget:publish',{type,snapshot}),
  pickAlertSound: () => ipcRenderer.invoke('alerts:pick-sound'),
  listDefaultSounds: () => ipcRenderer.invoke('sounds:list-default'),
  openDefaultSoundSource: () => ipcRenderer.invoke('sounds:open-source'),
  runAutomationWebhook: (details) => ipcRenderer.invoke('automations:webhook',details),
  resolveYouTube: (details) => ipcRenderer.invoke('youtube:resolve', details),
  openYouTube: (details) => ipcRenderer.invoke('youtube:open', details),
  openYouTubeHome: () => ipcRenderer.invoke('youtube:home'),
  showYouTube: () => ipcRenderer.invoke('youtube:show'),
  muteYouTube: (muted) => ipcRenderer.invoke('youtube:mute', muted),
  controlYouTube: (action, value = null) => ipcRenderer.invoke('youtube:control', { action, value }),
  continueYouTubeRecommended: () => ipcRenderer.invoke('youtube:continue-recommended'),
  setYouTubeVolume: (volume) => ipcRenderer.invoke('youtube:set-volume', volume),
  openYouTubeExternal: (details) => ipcRenderer.invoke('youtube:external', details),
  openSpotify: (details) => ipcRenderer.invoke('spotify:open', details),
  showSpotify: () => ipcRenderer.invoke('spotify:show'),
  controlSpotify: (action, value = null) => ipcRenderer.invoke('spotify:control', { action, value }),
  setSpotifyVolume: (volume) => ipcRenderer.invoke('spotify:set-volume', volume),
  muteSpotify: (muted) => ipcRenderer.invoke('spotify:mute', muted),
  openSpotifyDesktop: (details) => ipcRenderer.invoke('spotify:desktop', details),
  openSpotifyExternal: (details) => ipcRenderer.invoke('spotify:external', details),
  connect: (username) => ipcRenderer.invoke('live:connect', username),
  disconnect: () => ipcRenderer.invoke('live:disconnect'),
  listOnlineVoices: (options = {}) => ipcRenderer.invoke('tts:list-online-voices', options),
  synthesizeOnlineVoice: (request) => ipcRenderer.invoke('tts:synthesize-online', request),
  listTikTokVoices: () => ipcRenderer.invoke('tts:list-tiktok-voices'),
  synthesizeTikTokVoice: (request) => ipcRenderer.invoke('tts:synthesize-tiktok', request),
  listLocalVoices: () => ipcRenderer.invoke('tts:list-local-voices'),
  importLocalVoice: () => ipcRenderer.invoke('tts:import-local-voice'),
  removeLocalVoice: (id) => ipcRenderer.invoke('tts:remove-local-voice', id),
  synthesizeLocalVoice: (request) => ipcRenderer.invoke('tts:synthesize-local', request),
  releaseLocalVoice: () => ipcRenderer.invoke('tts:release-local'),
  setActivePage: (page) => ipcRenderer.invoke('runtime:set-active-page', page),
  getRuntimeStatus: () => ipcRenderer.invoke('runtime:status'),
  releaseIdleResources: (details = {}) => ipcRenderer.invoke('runtime:release-idle', details),
  checkForUpdates: (manual = true) => ipcRenderer.invoke('update:check', manual),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  rollbackToV027: () => ipcRenderer.invoke('update:rollback-v027'),
  openUpdateRepository: () => ipcRenderer.invoke('update:open-repository'),
  openLatestRelease: () => ipcRenderer.invoke('update:open-releases'),
  onChat: (callback) => subscribe('live:chat', callback),
  onStatus: (callback) => subscribe('live:status', callback),
  onStats: (callback) => subscribe('live:stats', callback),
  onLiveEvent: (callback) => subscribe('live:event', callback),
  onError: (callback) => subscribe('live:error', callback),
  onYouTubeStatus: (callback) => subscribe('youtube:status', callback),
  onYouTubeError: (callback) => subscribe('youtube:error', callback),
  onYouTubeSelected: (callback) => subscribe('youtube:selected', callback),
  onYouTubeEnded: (callback) => subscribe('youtube:ended', callback),
  onYouTubePlayer: (callback) => subscribe('youtube:player', callback),
  onYouTubeUnavailable: (callback) => subscribe('youtube:unavailable', callback),
  onSpotifyStatus: (callback) => subscribe('spotify:status', callback),
  onSpotifyError: (callback) => subscribe('spotify:error', callback),
  onSpotifySelected: (callback) => subscribe('spotify:selected', callback),
  onSpotifyEnded: (callback) => subscribe('spotify:ended', callback),
  onSpotifyPlayer: (callback) => subscribe('spotify:player', callback),
  onSpotifyUnavailable: (callback) => subscribe('spotify:unavailable', callback),
  onTikTokChatStatus: (callback) => subscribe('tiktok-chat:status', callback),
  onUpdateStatus: (callback) => subscribe('update:status', callback),
  onOverlayStatus: (callback) => subscribe('overlay:status', callback),
  onOverlayTunnelStatus: (callback) => subscribe('overlay:tunnel-status', callback),
  onRankingStatus: (callback) => subscribe('ranking:status', callback),
  onRankingUpdate: (callback) => subscribe('ranking:update', callback),
  onStreamWidgetStatus: (callback) => subscribe('widget:status', callback),
  onStreamWidgetUpdate: (callback) => subscribe('widget:update', callback),
  onLiveGameResult: (callback) => subscribe('games:result', callback),
  reportRendererReady: () => ipcRenderer.send('app:renderer-ready'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close')
});
