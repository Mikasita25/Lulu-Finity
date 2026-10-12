'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { sanitizeRelayMessage } = require('./relay-protocol');
const text = require('./text-processor');
const renderer = fs.readFileSync(path.join(__dirname, 'renderer.js'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

test('relay chat reaches the actual desktop handler with handle, nickname and direct avatar', () => {
  const connection = new EventEmitter();
  const sent = [];
  const context = {
    connectorModule: { WebcastEvent: { CHAT: 'chat', ROOM_USER: 'room', STREAM_END: 'end' }, ControlEvent: {} },
    liveConnectNonce: 1, liveConnection: connection, knownFollowers: new Set(),
    send: (channel, data) => sent.push({ channel, data }),
    recordRankingMetric() {}, emitFanStickerEvents() {},
  };
  vm.createContext(context);
  vm.runInContext(main.slice(main.indexOf('function cloudUser('), main.indexOf('function normalizeCloudMessageData(')) +
    main.slice(main.indexOf('const recentLiveChatIds ='), main.indexOf('async function disconnectLive(')), context);
  // Keep sticker extraction out of this handler test.
  context.attachLiveEvents(connection, 1);
  connection.emit('chat', sanitizeRelayMessage({ type: 'WebcastChatMessage', data: {
    msgId: '123', uniqueId: 'lulu.com', nickname: '🌸Lulú',
    profilePictureUrl: 'https://example.com/avatar.png', user: { userId: '999' }, comment: 'Hola',
  }}).data);
  const chat = sent.find(item => item.channel === 'live:chat').data;
  assert.equal(chat.uniqueId, 'lulu.com');
  assert.equal(chat.nickname, '🌸Lulú');
  assert.equal(chat.profilePictureUrl, 'https://example.com/avatar.png');
});

function rendererFunction(name, nextName) {
  return renderer.slice(renderer.indexOf(`function ${name}(`), renderer.indexOf(`function ${nextName}(`));
}

test('partial nested user retains top-level handle, name and avatar through sanitization', () => {
  const data = sanitizeRelayMessage({ type: 'WebcastChatMessage', data: {
    uniqueId: 'lulu.com', nickname: '🌸Lulú', profilePictureUrl: 'https://example.com/avatar.png',
    comment: 'Hola', user: { uniqueId: '', userId: '1234567890123456789' },
    cookie: 'must-not-leak',
  }}).data;
  assert.equal(data.user.uniqueId, 'lulu.com');
  assert.equal(data.user.nickname, '🌸Lulú');
  assert.equal(data.user.profilePictureUrl, 'https://example.com/avatar.png');
  assert.equal(data.user.userId, '1234567890123456789');
  assert.equal('cookie' in data.user, false);
  assert.equal('cookie' in data, false);
});

test('nested sender takes precedence without losing fallback fields or explicit false', () => {
  const data = sanitizeRelayMessage({ type: 'WebcastChatMessage', data: {
    uniqueId: 'fallback', nickname: 'Lulu', isFollower: true,
    sender: { uniqueId: 'actual_user', isFollower: false }, comment: 'Hola',
  }}).data;
  assert.equal(data.user.uniqueId, 'actual_user');
  assert.equal(data.user.nickname, 'Lulu');
  assert.equal(data.user.isFollower, false);
});

test('spoken names preserve dotted handles and fall back from emoji-only nicknames', () => {
  assert.equal(text.prepareUsername('lulu.com').text, 'lulu com');
  assert.equal(text.speechForMessage({ nickname: '🌸💖', uniqueId: 'lulu.com', comment: 'Hola' }).text, 'lulu com dice: Hola');
  const context = { state: { settings: { includeUsername: true } }, window: { LuluText: text }, smartTextOptions: () => ({}) };
  vm.createContext(context);
  vm.runInContext(rendererFunction('makeSpeechText', 'cleanupReadCommentIds'), context);
  assert.equal(context.makeSpeechText({ nickname: '🌸💖', uniqueId: 'lulu.com', comment: 'Hola' }), 'lulu com dice: Hola');
});

function queueHarness(settings = {}) {
  let now = 100000;
  const context = {
    state: { settings: { ttsEnabled: true, queueLimit: 100, maxCommentDelaySeconds: 8, ...settings }, speechQueue: [], speechPlaybackStarted: false },
    Date: { now: () => now },
    clamp: (value, low, high) => Math.min(high, Math.max(low, Number(value))),
    hasAudienceAccess: () => true, reserveAudioLock: () => true,
    released: [], results: [],
    releaseAudioLock(key) { context.released.push(key); },
    updateCommentResult(...args) { context.results.push(args); },
    makeSpeechText: message => message.comment, voiceForMessage: () => null,
    renderStats() {}, speakNext() {}, prepareNextSpeech() {},
  };
  vm.createContext(context);
  vm.runInContext(rendererFunction('enqueueSpeech', 'stopCurrentAudio') + rendererFunction('speechItemExpired', 'adaptiveSpeechMultiplier'), context);
  return { context, advance: ms => { now += ms; }, enqueue: (id, options = {}) => context.enqueueSpeech({ id, comment: `Mensaje ${id}`, timestamp: now }, options) };
}

test('100 accepted messages survive waiting and the 101st cannot evict any of them', () => {
  const { context, advance, enqueue } = queueHarness();
  for (let id = 1; id <= 100; id++) assert.equal(enqueue(id).added, true);
  advance(600000);
  assert.equal(context.speechItemExpired(context.state.speechQueue[0]), false);
  assert.equal(enqueue(101).added, false);
  assert.equal(context.state.speechQueue.length, 100);
  assert.deepEqual(Array.from(context.state.speechQueue, item => item.id), Array.from({ length: 100 }, (_, i) => i + 1));
  assert.equal(context.results.length, 0);
});

test('configured queue timeout uses enqueue time and frees expired entries before capacity check', () => {
  const { context, advance, enqueue } = queueHarness({ queueLimit: 1, queueWaitSeconds: 20 });
  context.enqueueSpeech({ id: 'old-source', comment: 'Hola', timestamp: 1 });
  assert.equal(context.speechItemExpired(context.state.speechQueue[0]), false);
  advance(21000);
  assert.equal(enqueue('fresh').added, true);
  assert.deepEqual(Array.from(context.state.speechQueue, item => item.id), ['fresh']);
  assert.deepEqual(context.results[0], ['old-source', 'skipped', 'comentario vencido']);
});

test('priority commands keep their own FIFO and rejected commands release their lock', () => {
  const { context, enqueue } = queueHarness({ queueLimit: 4 });
  enqueue('normal1'); enqueue('command1', { lockKey: 'c1' });
  enqueue('normal2'); enqueue('command2', { lockKey: 'c2' });
  assert.deepEqual(Array.from(context.state.speechQueue, item => item.id), ['command1', 'command2', 'normal1', 'normal2']);
  assert.equal(enqueue('command3', { lockKey: 'c3' }).added, false);
  assert.ok(context.released.includes('c3'));
});
