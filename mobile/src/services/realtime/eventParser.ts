import type { LiveEvent, RelayState } from '@/types/live';

export type ParsedRealtimeMessage =
  | { kind: 'event'; event: LiveEvent }
  | { kind: 'stats'; viewers?: number; likes?: number }
  | { kind: 'relay'; state: RelayState; message?: string };

const alias: Record<string, LiveEvent['type'] | undefined> = {
  chat: 'comment',
  comment: 'comment',
  webcastchatmessage: 'comment',
  emote: 'sticker',
  sticker: 'sticker',
  emotechat: 'sticker',
  webcastemotechatmessage: 'sticker',
  webcaststickerchatmessage: 'sticker',
  gift: 'gift',
  webcastgiftmessage: 'gift',
  like: 'like',
  webcastlikemessage: 'like',
  follow: 'follow',
  social: 'follow',
  share: 'share',
  member: 'member',
  join: 'member',
  subscribe: 'subscribe',
  sub_notify: 'subscribe',
  subnotify: 'subscribe',
};

function compactType(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(...values: unknown[]) {
  for (const value of values) {
    const result = String(value ?? '').trim();
    if (result) return result;
  }
  return '';
}

function avatar(user: any) {
  return text(
    user?.profilePictureUrl,
    user?.profilePicture?.urlList?.[0],
    user?.avatarThumb?.urlList?.[0],
    user?.avatarLarger?.urlList?.[0],
    user?.avatarMedium?.urlList?.[0],
  );
}

function firstObject(value: unknown): any | undefined {
  if (Array.isArray(value)) return value.find((item) => item && typeof item === 'object');
  return value && typeof value === 'object' ? value : undefined;
}

function stickerFrom(payload: any) {
  const extra = firstObject(payload?.textExtra ?? payload?.text_extra);
  const candidate =
    firstObject(payload?.sticker) ??
    firstObject(payload?.stickerDetails) ??
    firstObject(payload?.stickerInfo) ??
    firstObject(payload?.emote) ??
    firstObject(payload?.emoteDetails) ??
    firstObject(payload?.emotes) ??
    firstObject(payload?.emoteList) ??
    firstObject(payload?.emote_list) ??
    firstObject(payload?.comment?.emotes) ??
    (extra && (extra?.emote || extra?.sticker || extra));

  if (!candidate) return undefined;

  const id = text(
    candidate?.stickerId,
    candidate?.sticker_id,
    candidate?.emoteId,
    candidate?.emote_id,
    candidate?.id,
    candidate?.emoticonId,
  );
  const name = text(
    candidate?.stickerName,
    candidate?.sticker_name,
    candidate?.emoteName,
    candidate?.emote_name,
    candidate?.name,
    candidate?.displayName,
    candidate?.shortcode,
    candidate?.text,
  );
  const imageUrl = text(
    candidate?.imageUrl,
    candidate?.image_url,
    candidate?.url,
    candidate?.image?.urlList?.[0],
    candidate?.image?.url_list?.[0],
    candidate?.picture?.urlList?.[0],
  );

  if (!id && !name && !imageUrl) return undefined;
  return { id, name: name || (id ? `Sticker ${id}` : 'Sticker'), imageUrl };
}

function eventIdentity(payload: any) {
  const user = payload?.user ?? payload?.sender ?? payload?.fromUser ?? {};
  const uniqueId = text(
    payload?.uniqueId,
    user?.uniqueId,
    user?.displayId,
    user?.username,
    user?.userId,
  ).replace(/^@/, '');
  const nickname = text(
    payload?.nickname,
    user?.nickname,
    user?.displayName,
    user?.uniqueId,
    uniqueId,
    'Usuario',
  );
  return { user, uniqueId, nickname };
}

function eventTimestamp(payload: any) {
  const rawTimestamp = number(payload?.timestamp ?? payload?.createTime, Date.now());
  return rawTimestamp > 0 && rawTimestamp < 1_000_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
}

function baseEvent(raw: any, payload: any, type: LiveEvent['type'], suffix = ''): LiveEvent {
  const { user, uniqueId, nickname } = eventIdentity(payload);
  return {
    id:
      text(payload?.id, payload?.msgId, raw?.id) ||
      `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}${suffix}`,
    type,
    timestamp: eventTimestamp(payload),
    uniqueId,
    nickname,
    profilePictureUrl: avatar(user) || text(payload?.profilePictureUrl),
  };
}

function normalizeOne(raw: any): ParsedRealtimeMessage[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.flatMap(normalizeOne);
  if (Array.isArray(raw?.events)) return raw.events.flatMap(normalizeOne);

  const rawType = compactType(raw?.type ?? raw?.event ?? raw?.eventType ?? raw?.msgType);
  const payload = raw?.data ?? raw?.payload ?? raw;

  if (rawType === 'lulurelaystatus' || rawType === 'lulu_relay_status') {
    const state = compactType(payload?.state);
    return [
      {
        kind: 'relay',
        state: state === 'connected' ? 'connected' : state === 'rotating' ? 'rotating' : 'connecting',
        message: text(payload?.message),
      },
    ];
  }

  if (rawType === 'lulurelayerror' || rawType === 'lulu_relay_error') {
    const message = text(payload?.message, 'La conexión con el LIVE se cerró.');
    return [
      {
        kind: 'relay',
        state: /no detecta un live|offline/i.test(message) ? 'offline' : 'error',
        message,
      },
    ];
  }

  if (
    rawType === 'roomuser' ||
    rawType === 'roomusercount' ||
    rawType === 'stats' ||
    rawType === 'live_stats' ||
    rawType.includes('roomuser') ||
    rawType.includes('userseq')
  ) {
    return [
      {
        kind: 'stats',
        viewers: number(
          payload?.viewerCount ?? payload?.roomUserCount ?? payload?.userCount ?? payload?.memberCount,
          NaN,
        ),
        likes: number(payload?.totalLikeCount ?? payload?.likeCount, NaN),
      },
    ];
  }

  const sticker = stickerFrom(payload);
  let normalizedType = alias[rawType];
  if (!normalizedType && rawType.includes('social')) {
    const socialSignal = compactType(
      payload?.displayType ?? payload?.label ?? payload?.action ?? payload?.socialType,
    );
    if (socialSignal.includes('share')) normalizedType = 'share';
    else if (socialSignal.includes('follow')) normalizedType = 'follow';
  }
  if (!normalizedType && (rawType.includes('emote') || rawType.includes('sticker'))) normalizedType = 'sticker';
  if (!normalizedType && rawType.includes('gift')) normalizedType = 'gift';
  if (!normalizedType && rawType.includes('chat')) normalizedType = sticker ? 'sticker' : 'comment';
  if (!normalizedType && rawType.includes('like')) normalizedType = 'like';
  if (!normalizedType && rawType.includes('follow')) normalizedType = 'follow';
  if (!normalizedType && rawType.includes('share')) normalizedType = 'share';
  if (!normalizedType && rawType.includes('member')) normalizedType = 'member';
  if (!normalizedType && rawType.includes('sub')) normalizedType = 'subscribe';
  if (!normalizedType && sticker) normalizedType = 'sticker';
  if (!normalizedType) return [];

  const gift = payload?.giftDetails ?? payload?.extendedGiftInfo ?? payload?.gift ?? {};
  const giftType = number(gift?.giftType ?? payload?.giftType ?? 0);
  if (normalizedType === 'gift' && giftType === 1 && payload?.repeatEnd === false) return [];
  const repeatCount = Math.max(1, number(payload?.repeatCount ?? payload?.comboCount ?? 1, 1));
  const diamondEach = Math.max(
    0,
    number(gift?.diamondCount ?? gift?.diamond_count ?? payload?.diamondCount ?? 0),
  );

  // Algunos payloads de chat contienen texto y un sticker a la vez. Conservamos ambos
  // eventos para que historial/TTS y automatizaciones puedan reaccionar por separado.
  if (normalizedType === 'comment' && sticker) {
    const results: ParsedRealtimeMessage[] = [];
    const comment = text(payload?.comment, payload?.text, payload?.message);
    if (comment) {
      const commentEvent = baseEvent(raw, payload, 'comment', '-comment');
      commentEvent.comment = comment;
      results.push({ kind: 'event', event: commentEvent });
    }
    const stickerEvent = baseEvent(raw, payload, 'sticker', '-sticker');
    stickerEvent.stickerId = sticker.id;
    stickerEvent.stickerName = sticker.name;
    stickerEvent.stickerImageUrl = sticker.imageUrl;
    results.push({ kind: 'event', event: stickerEvent });
    return results;
  }

  const event = baseEvent(raw, payload, normalizedType);
  if (normalizedType === 'comment') {
    event.comment = text(payload?.comment, payload?.text, payload?.message);
  } else if (normalizedType === 'sticker') {
    const resolved = sticker ?? {
      id: text(payload?.stickerId, payload?.emoteId),
      name: text(payload?.stickerName, payload?.emoteName, payload?.name, 'Sticker'),
      imageUrl: text(payload?.imageUrl),
    };
    event.stickerId = resolved.id;
    event.stickerName = resolved.name;
    event.stickerImageUrl = resolved.imageUrl;
  } else if (normalizedType === 'gift') {
    event.giftName = text(gift?.giftName, gift?.name, payload?.giftName, 'Regalo');
    event.repeatCount = repeatCount;
    event.diamonds = diamondEach * repeatCount;
  } else if (normalizedType === 'like') {
    event.count = Math.max(1, number(payload?.likeCount ?? payload?.count ?? 1, 1));
    event.total = Math.max(0, number(payload?.totalLikeCount ?? payload?.total ?? 0));
  } else if (normalizedType === 'member') {
    event.memberCount = Math.max(
      0,
      number(payload?.memberCount ?? payload?.roomUserCount ?? payload?.viewerCount ?? 0),
    );
  }

  return [{ kind: 'event', event }];
}

export function parseRealtimePayload(payload: string): ParsedRealtimeMessage[] {
  try {
    return normalizeOne(JSON.parse(payload));
  } catch {
    return [];
  }
}
