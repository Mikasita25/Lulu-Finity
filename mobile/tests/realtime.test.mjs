import assert from 'node:assert/strict';
import { parseRealtimePayload } from '../src/services/realtime/eventParser.ts';
import { socketPayloadToText } from '../src/services/realtime/socketPayload.ts';
import { LiveFreshnessGate, RECONNECT_DRAIN_MS } from '../src/services/realtime/liveFreshness.ts';
import { TtsDeliveryLedger } from '../src/services/ttsDeliveryLedger.ts';

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
  JSON.stringify({ type: 'lulu.relay.status', data: { state: 'connected', attempt: 2 } }),
);
assert.deepEqual(relayStatus, [{ kind: 'relay', state: 'connected', message: '', attempt: 2 }]);

const giftPayload = parseRealtimePayload(
  JSON.stringify({
    type: 'WebcastGiftMessage',
    data: {
      common: { msgId: 'gift-1' },
      user: { uniqueId: 'gift_user', nickname: 'Gift User' },
      giftDetails: {
        giftId: '5655',
        giftName: 'Rosa',
        diamondCount: 1,
        image: { urlList: ['https://example.test/rose.png'] },
      },
      repeatCount: 3,
      repeatEnd: true,
    },
  }),
);
assert.equal(giftPayload[0].kind, 'event');
assert.equal(giftPayload[0].event.giftId, '5655');
assert.equal(giftPayload[0].event.giftImageUrl, 'https://example.test/rose.png');
assert.equal(giftPayload[0].event.diamonds, 3);

assert.deepEqual(parseRealtimePayload('no es json'), []);

const utf8 = new TextEncoder().encode('{"mensaje":"Lulú 💗"}');
assert.equal(await socketPayloadToText(utf8), '{"mensaje":"Lulú 💗"}');
assert.equal(
  await socketPayloadToText({ text: async () => 'paquete blob' }),
  'paquete blob',
);

const freshness = new LiveFreshnessGate();
const now = 1_800_000_000_000;
const event = (id, timestamp) => ({
  id,
  type: 'comment',
  timestamp,
  uniqueId: 'lulu_fan',
  nickname: 'Lulu Fan',
  comment: id,
});

freshness.startSession(now);
assert.equal(freshness.accept(event('nuevo', now - 500), now), true, 'acepta actividad actual');
assert.equal(freshness.accept(event('nuevo', now), now), false, 'descarta IDs repetidos');
assert.equal(freshness.accept(event('antiguo', now - 30_000), now), false, 'descarta backlog viejo');

freshness.beginReconnect(now + 1_000);
assert.equal(
  freshness.accept(event('durante-reconexion', now + 1_200), now + 1_200),
  false,
  'drena el paquete inicial de una reconexión',
);
freshness.markConnected(now + 1_500, true);
assert.equal(
  freshness.accept(event('despues-reconexion', now + 5_000), now + 1_500 + RECONNECT_DRAIN_MS),
  true,
  'acepta mensajes nuevos después de drenar la reconexión',
);

let ledgerNow = now;
const delivery = new TtsDeliveryLedger(10, () => ledgerNow);
const deliveryKey = delivery.claim('lulu_streamer', 'comment-1');
assert.ok(deliveryKey, 'reserva un comentario nuevo antes de encolarlo');
assert.equal(
  delivery.claim('lulu_streamer', 'comment-1'),
  undefined,
  'no permite duplicar un comentario pendiente',
);
delivery.transition(deliveryKey, 'playing');
delivery.transition(deliveryKey, 'completed');
assert.equal(delivery.get(deliveryKey)?.status, 'completed');
assert.equal(
  delivery.claim('lulu_streamer', 'comment-1'),
  undefined,
  'un comentario terminado no vuelve a reservarse',
);

const restored = new TtsDeliveryLedger(10, () => ledgerNow);
restored.hydrate(delivery.completed());
assert.equal(
  restored.claim('lulu_streamer', 'comment-1'),
  undefined,
  'el historial completado persiste entre recuperaciones',
);

const cancelledKey = delivery.claim('lulu_streamer', 'comment-2');
delivery.transition(cancelledKey, 'cancelled', 'reconexión');
assert.equal(delivery.get(cancelledKey)?.status, 'cancelled');

console.log('Realtime móvil: 22 regresiones verificadas.');
