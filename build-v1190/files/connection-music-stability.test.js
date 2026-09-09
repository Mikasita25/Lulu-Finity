'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const source = fs.readFileSync(require('node:path').join(__dirname, 'main.js'), 'utf8');
function harness(extra = {}) {
  const timers = new Map();
  let now = 100000;
  const context = vm.createContext({
    console, URL, EventEmitter, Date: { now: () => now },
    setTimeout(fn, delay) { const id = { unref() {} }; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }, clearInterval() {},
    ...extra
  });
  return { context, timers, advance(ms) { now += ms; } };
}
function music() {
  let plays = 0;
  const state = { expectedPlaying:true, userPaused:false, lastTime:10, lastProgressAt:1000, recoveryAttempt:0 };
  const win = { isDestroyed: () => false, isVisible: () => false };
  const h = harness({ musicRecoveryState:{ youtube:state }, youtubeWindow:win,
    spotifyWindow:null, isQuitting:false, refreshAppSuspensionBlocker() {}, send() {},
    isManualPlayerPause:require('./music-recovery-policy').isManualPlayerPause,
    shouldResumeUnexpectedPause:require('./music-recovery-policy').shouldResumeUnexpectedPause,
    musicRecoveryDelay:require('./music-recovery-policy').musicRecoveryDelay,
    controlYoutubePlayer:async () => { plays++; }, isYoutubeUrl:() => true, youtubeUrlKind:() => 'watch'
  });
  vm.runInContext(source.slice(source.indexOf('function musicWindow('), source.indexOf('function recoverActiveMusicPlayers(')), h.context);
  return { ...h, state, win, plays:() => plays };
}
test('buffering telemetry does not cancel recovery; real progress does', () => {
  const h = music();
  h.context.scheduleMusicPlayerRecovery('youtube');
  h.context.noteMusicPlayerPayload('youtube', { currentTime:10, paused:false });
  assert.equal(h.timers.size, 1);
  h.context.noteMusicPlayerPayload('youtube', { currentTime:11, paused:false });
  assert.equal(h.timers.size, 0);
  assert.equal(h.state.lastProgressAt, 100000);
});
test('slow player recovery is single flight and successful IPC is not progress', async () => {
  const h = music();
  let finish;
  h.context.controlYoutubePlayer = () => new Promise(resolve => { finish = resolve; });
  const running = h.context.recoverMusicPlayer('youtube');
  await h.context.recoverMusicPlayer('youtube');
  h.context.scheduleMusicPlayerRecovery('youtube');
  assert.equal(h.state.recoveryAttempt, 1);
  assert.equal(h.timers.size, 0);
  finish(); await running;
  assert.equal(h.state.inFlight, false);
  assert.equal(h.state.lastProgressAt, 1000);
  h.context.scheduleMusicPlayerRecovery('youtube');
  assert.equal([...h.timers.values()][0].delay, 30000);
});
test('manual pause during page reload prevents automatic play', async () => {
  const h = music();
  let finishLoad;
  const newWin = { ...h.win, loadURL:() => new Promise(resolve => { finishLoad = resolve; }) };
  h.win.destroy = () => {};
  h.context.createYoutubeWindow = () => { h.context.youtubeWindow = newWin; return newWin; };
  const running = h.context.recoverMusicPlayer('youtube', 'crash', true);
  h.context.markMusicExpected('youtube', false, true);
  finishLoad(); await running;
  assert.equal(h.plays(), 0);
  assert.equal(h.state.inFlight, false);
});
function relay() {
  const h = harness({ cleanUsername:x => x, normalizeCloudMessageData:(_t, d) => d || {},
    appendConnectionLog() {}, send() {}, WebSocket:{ CLOSED:3 } });
  vm.runInContext(source.slice(source.indexOf('class RailwayRelayConnection'), source.indexOf('function friendlyConnectionError')) + '\nthis.Relay = RailwayRelayConnection;', h.context);
  const connection = new h.context.Relay('lulu', 'wss://example.test', '', {});
  connection.isConnected = true;
  let disconnected = 0;
  connection.on('disconnected', () => { disconnected++; });
  return { ...h, connection, disconnected:() => disconnected };
}
test('Railway rotation can recover without disconnecting the app', () => {
  const h = relay();
  h.connection.emitCloudMessage({ type:'tiktok.disconnect' });
  h.connection.emitCloudMessage({ type:'tiktok.disconnect' });
  assert.equal(h.disconnected(), 0);
  assert.equal(h.timers.size, 1);
  h.connection.emitCloudMessage({ type:'lulu.relay.status', data:{ state:'connected' } });
  assert.equal(h.timers.size, 0);
  assert.equal(h.disconnected(), 0);
});
test('stuck upstream reconnects after bounded grace; manual disconnect clears it', async () => {
  const h = relay();
  h.connection.emitCloudMessage({ type:'tiktok.disconnect' });
  const [timer] = h.timers.values();
  assert.equal(timer.delay, 45000);
  timer.fn();
  assert.equal(h.disconnected(), 1);
  const other = relay();
  other.connection.emitCloudMessage({ type:'tiktok.disconnect' });
  await other.connection.disconnect();
  assert.equal(other.timers.size, 0);
});
test('temporary LIVE outage retries beyond eight attempts at a capped delay', () => {
  const h = harness({ liveReconnectEnabled:true, liveReconnectHasConnected:true,
    isQuitting:false, liveConnectNonce:1, liveReconnectTimer:null, liveReconnectInFlight:false,
    liveConnection:null, liveReconnectAttempt:40, liveReconnectUsername:'lulu',
    ...require('./live-reconnect-policy'), send() {}, appendConnectionLog() {},
    stopLiveReconnectSession() { throw new Error('must not abandon temporary outages'); }
  });
  vm.runInContext(source.slice(source.indexOf('function scheduleLiveReconnect('), source.indexOf('function extractFanStickerEntries(')), h.context);
  assert.equal(h.context.scheduleLiveReconnect(1, { code:1006 }), true);
  assert.equal([...h.timers.values()][0].delay, 120000);
});
