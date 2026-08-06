'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { EventEmitter } = require('events');

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Falta la ruta de src/main.js.');
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('const EULER_CLOSE_MESSAGES');
const end = source.indexOf('function friendlyConnectionError', start);
assert(start >= 0 && end > start, 'No se encontró la implementación de Community.');

const selected = source.slice(start, end) + '\n' +
  'globalThis.FreeEulerCloudConnection=FreeEulerCloudConnection;' +
  'globalThis.cloudCloseMessage=cloudCloseMessage;';

class FakeWebSocket extends EventEmitter {
  static CLOSED = 3;
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 1;
    setImmediate(() => {
      this.emit('open');
      this.emit('message', Buffer.from(JSON.stringify({ messages: [
        { type: 'workerInfo', data: { webSocketId: 'room-test' } },
        { type: 'WebcastChatMessage', data: { comment: 'hola', user: { uniqueId: 'alice' } } },
        { type: 'WebcastGiftMessage', data: { giftId: '123', repeatCount: 2, giftDetails: { giftName: 'Rosa', diamondCount: 1 }, user: { uniqueId: 'bob' } } },
        { type: 'WebcastSocialMessage', data: { common: { displayText: { key: 'pm_mt_guidance_viewer_share' } }, user: { uniqueId: 'carol' } } },
        { type: 'WebcastSocialMessage', data: { common: { displayText: { key: 'pm_main_follow_message' } }, user: { uniqueId: 'dani' } } }
      ] })));
    });
  }
  close(code, reason) {
    this.readyState = FakeWebSocket.CLOSED;
    setImmediate(() => this.emit('close', code, Buffer.from(reason || '')));
  }
  terminate() { this.close(1006, 'terminated'); }
}

const sandbox = {
  EventEmitter,
  WebSocket: FakeWebSocket,
  URLSearchParams,
  Buffer,
  setTimeout,
  clearTimeout,
  EULER_CLOUD_WEBSOCKET_URL: 'wss://ws.eulerstream.com',
  cleanUsername: (value) => String(value || '').replace(/^@/, '').trim(),
  appendConnectionLog: () => {},
  console
};
vm.createContext(sandbox);
vm.runInContext(selected, sandbox);

const events = {
  WebcastEvent: { CHAT: 'chat', GIFT: 'gift', FOLLOW: 'follow', SHARE: 'share' },
  ControlEvent: { WEBSOCKET_CONNECTED: 'websocketConnected', ERROR: 'error', DISCONNECTED: 'disconnected' }
};

(async () => {
  const connection = new sandbox.FreeEulerCloudConnection('@tester', 'free-key', events);
  const received = [];
  for (const event of ['chat', 'gift', 'follow', 'share']) connection.on(event, (data) => received.push([event, data]));

  const state = await connection.connect();
  assert.equal(state.isConnected, true);
  assert.equal(connection.roomId, 'room-test');
  assert(received.some(([event, data]) => event === 'chat' && data.comment === 'hola'));
  assert(received.some(([event, data]) => event === 'gift' && data.giftDetails.diamondCount === 1 && data.repeatCount === 2));
  assert(received.some(([event]) => event === 'follow'));
  assert(received.some(([event]) => event === 'share'));
  assert(connection.socket.url.includes('apiKey=free-key'));
  assert(connection.socket.url.includes('features.bundleEvents=true'));
  await connection.disconnect();

  await assert.rejects(
    () => new sandbox.FreeEulerCloudConnection('tester', '', events).connect(),
    /clave gratuita/i
  );
  assert.match(sandbox.cloudCloseMessage(4401, ''), /no es válida/i);
  assert.match(sandbox.cloudCloseMessage(4404, ''), /en LIVE/i);
  console.log('Conexión Community: pruebas correctas.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
