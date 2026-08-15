import assert from 'node:assert/strict';
import { parseRealtimePayload } from '../src/services/realtime/eventParser.ts';
import { socketPayloadToText } from '../src/services/realtime/socketPayload.ts';

const bundle = JSON.stringify({
  timestamp: 1_786_790_000_000,
  messages: [
    {
      type: 'WebcastChatMessage',
      data: {
        common: { msgId: 'comment-1' },
        user: { uniqueId: 'lulu_fan', nickname: 'Lulu Fan' },
        comment: 'hola desde el live',
        createTime: 1_786_790_000,
      },
    },
    {
      type: 'WebcastLikeMessage',
      data: {
        user: { uniqueId: 'likes_user', nickname: 'Likes User' },
        likeCount: 4,
        totalLikeCount: 120,
      },
    },
    {
      type: 'WebcastSocialMessage',
      data: {
        user: { uniqueId: 'share_user', nickname: 'Share User' },
        displayType: 'pm_mt_guidance_share',
      },
    },
  ],
});

const parsedBundle = parseRealtimePayload(bundle);
assert.equal(parsedBundle.length, 3, 'debe abrir ClientMessageBundle.messages');
assert.deepEqual(
  parsedBundle.map((item) => item.kind === 'event' ? item.event.type : item.kind),
  ['comment', 'like', 'share'],
);

const comment = parsedBundle[0];
assert.equal(comment.kind, 'event');
assert.equal(comment.event.comment, 'hola desde el live');
assert.equal(comment.event.uniqueId, 'lulu_fan');

const nestedBundle = parseRealtimePayload(JSON.stringify({ data: JSON.parse(bundle) }));
assert.equal(nestedBundle.length, 3, 'debe abrir bundles anidados por el relay');

const roomInfo = parseRealtimePayload(
  JSON.stringify({
    type: 'roomInfo',
    data: { roomInfo: { stats: { userCount: 321, totalLikeCount: 999 } } },
  }),
);
assert.deepEqual(roomInfo, [{ kind: 'stats', viewers: 321, likes: 999 }]);

const relayStatus = parseRealtimePayload(
  JSON.stringify({ type: 'lulu.relay.status', data: { state: 'connected' } }),
);
assert.deepEqual(relayStatus, [{ kind: 'relay', state: 'connected', message: '' }]);

assert.deepEqual(parseRealtimePayload('no es json'), []);

const utf8 = new TextEncoder().encode('{"mensaje":"Lulú 💗"}');
assert.equal(await socketPayloadToText(utf8), '{"mensaje":"Lulú 💗"}');
assert.equal(
  await socketPayloadToText({ text: async () => 'paquete blob' }),
  'paquete blob',
);

console.log('Realtime móvil: 7 regresiones verificadas.');
