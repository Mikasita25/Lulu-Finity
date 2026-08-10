'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_RELAY_FRAME_BYTES,
  parseRelayFrame,
  sanitizeRelayMessage,
  sanitizeRelayUsage,
} = require('./relay-protocol');

test('solo conserva campos públicos necesarios de un comentario LIVE', () => {
  const [message] = parseRelayFrame(JSON.stringify({
    type: 'WebcastChatMessage',
    data: {
      comment: 'hola',
      cookie: 'sessionid=secreto',
      path: 'C:\\Users\\persona\\Documents',
      user: {
        uniqueId: 'usuario_publico',
        nickname: 'Usuario',
        email: 'privado@example.com',
        token: 'secreto',
        profilePicture: { urlList: ['https://p16.example/avatar.jpg', 'file:///etc/passwd'] },
      },
      __protoPollution: { admin: true },
    },
  }));
  assert.equal(message.type, 'WebcastChatMessage');
  assert.equal(message.data.comment, 'hola');
  assert.equal(message.data.user.uniqueId, 'usuario_publico');
  assert.deepEqual(message.data.user.profilePicture.urlList, ['https://p16.example/avatar.jpg']);
  assert.equal('cookie' in message.data, false);
  assert.equal('path' in message.data, false);
  assert.equal('email' in message.data.user, false);
  assert.equal('token' in message.data.user, false);
});

test('rechaza solicitudes, RPC, métodos y canales inventados por el servidor', () => {
  for (const type of [
    'lulu.client.request',
    'rpc.read-files',
    'ipc.invoke',
    'get.cookies',
    'session.export',
    'device_upload',
  ]) {
    assert.throws(
      () => sanitizeRelayMessage({ type, data: { channel: 'settings:save' } }),
      (error) => error?.code === 'forbidden_remote_request',
      type,
    );
  }
  assert.throws(
    () => sanitizeRelayMessage({ method: 'read.files', payload: { path: '/' } }),
    (error) => error?.code === 'missing_type',
  );
});

test('rechaza tipos desconocidos, datos no estructurados y paquetes excesivos', () => {
  assert.throws(
    () => sanitizeRelayMessage({ type: 'WebcastChatMessage.evil', data: {} }),
    (error) => error?.code === 'unsupported_type',
  );
  assert.throws(
    () => sanitizeRelayMessage({ type: 'WebcastChatMessage', data: 'hola' }),
    (error) => error?.code === 'invalid_data',
  );
  assert.throws(
    () => parseRelayFrame('x'.repeat(MAX_RELAY_FRAME_BYTES + 1)),
    (error) => error?.code === 'frame_size',
  );
  assert.throws(
    () => parseRelayFrame(JSON.stringify(Array.from({ length: 129 }, () => ({ type: 'tiktok.connect', data: {} })))),
    (error) => error?.code === 'batch_size',
  );
});

test('el contador de uso queda reducido a números y fechas permitidas', () => {
  const usage = sanitizeRelayUsage({
    ok: true,
    used: 10,
    limit: 100,
    percent: 10,
    resetAt: '2026-08-10T00:00:00Z',
    command: 'read settings',
    user: { used: 2, limit: 20, cookie: 'secreto' },
  });
  assert.deepEqual(Object.keys(usage).sort(), ['estimatedConnections', 'limit', 'ok', 'perConnection', 'percent', 'remaining', 'resetAt', 'used', 'user'].sort());
  assert.equal('command' in usage, false);
  assert.equal('cookie' in usage.user, false);
});

test('limita texto, URLs, números y cantidad de eventos', () => {
  const batch = parseRelayFrame(JSON.stringify({ messages: [
    {
      type: 'WebcastGiftMessage',
      data: {
        giftId: '1',
        repeatCount: Number.MAX_VALUE,
        giftDetails: { giftName: 'x'.repeat(1000), diamondCount: Number.MAX_VALUE },
        user: { profilePicture: { urlList: ['javascript:alert(1)', 'http://inseguro/avatar', 'https://seguro/avatar'] } },
      },
    },
    { type: 'tiktok.connect', data: {} },
  ] }));
  assert.equal(batch.length, 2);
  assert.equal(batch[0].data.giftDetails.giftName.length, 160);
  assert.equal(batch[0].data.repeatCount, 1_000_000);
  assert.deepEqual(batch[0].data.user.profilePicture.urlList, ['https://seguro/avatar']);
});

test('reconoce el esquema v2 oficial sin entregar eventos no utilizados a la interfaz', () => {
  for (const type of [
    'WebcastCaptionMessage',
    'WebcastPollMessage',
    'WebcastRankUpdateMessage',
    'WebcastQuestionNewMessage',
    'roomInfo',
    'decodeError',
    'SyntheticLeaveMessage',
  ]) {
    assert.deepEqual(sanitizeRelayMessage({ type, data: { privateField: 'descartar' } }), { type: 'lulu.ignored', data: {} });
  }
  assert.equal(sanitizeRelayMessage({ type: 'superFan', data: { user: { uniqueId: 'fan' } } }).type, 'WebcastBarrageMessage');
  assert.equal(sanitizeRelayMessage({ type: 'SyntheticJoinMessage', data: { user: { uniqueId: 'nuevo' } } }).type, 'WebcastMemberMessage');
  assert.throws(
    () => sanitizeRelayMessage({ type: 'WebcastMadeUpMessage', data: {} }),
    (error) => error?.code === 'unsupported_type',
  );
});
