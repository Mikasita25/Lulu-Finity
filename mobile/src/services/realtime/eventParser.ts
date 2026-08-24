import type { LiveEvent, RelayState } from '@/types/live';

export type ParsedRealtimeMessage =
  | { kind: 'event'; event: LiveEvent }
  | { kind: 'stats'; viewers?: number; likes?: number }
  | {
      kind: 'relay';
      state: RelayState;
      message?: string;
      attempt?: number;
      transportReconnect?: boolean;
    };

const alias: Record<string, LiveEvent['type'] | undefined> = {
  chat: 'comment',
  comment: 'comment',
  webcastchatmessage: 'comment',
  emote: 'fanSticker',
  emotechat: 'fanSticker',
  webcastemotechatmessage: 'fanSticker',
  fansticker: 'fanSticker',
  fan_sticker: 'fanSticker',
  webcastfanstickermessage: 'fanSticker',
  gift: 'gift',
  webcastgiftmessage: 'gift',
  like: 'like',
  webcastlikemessage: 'like',
  follow: 'follow',
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

/**
 * La app de PC llama `fanStickers` a los emotes/stickers exclusivos de fans.
 * Euler/TikTok suele entregarlos como WebcastEmoteChatMessage + emoteList.
 * No convertimos cualquier sticker visual de un comentario en Fan Sticker: exigimos
 * una señal de emote/fan/subscriber para mantener esta métrica igual que en PC.
 */
function isFanStickerSignal(rawType: string, payload: any) {
  if (rawType.includes('emote') || rawType.includes('fansticker') || rawType.includes('fan_sticker')) return true;
  if (payload?.fanSticker || payload?.fan_sticker || payload?.fanStickerInfo || payload?.fan_sticker_info) return true;
  if (Array.isArray(payload?.emoteList) || Array.isArray(payload?.emote_list)) return true;
  if (payload?.subscriberEmote || payload?.subscriber_emote) return true;
  return false;
}

function fanStickerFrom(payload: any) {
  const extra = firstObject(payload?.textExtra ?? payload?.text_extra);
  const candidate =
    firstObject(payload?.fanSticker) ??
    firstObject(payload?.fan_sticker) ??
    firstObject(payload?.fanStickerInfo) ??
    firstObject(payload?.fan_sticker_info) ??
    firstObject(payload?.subscriberEmote) ??
    firstObject(payload?.subscriber_emote) ??
    firstObject(payload?.emote) ??
    firstObject(payload?.emoteDetails) ??
    firstObject(payload?.emotes) ??
    firstObject(payload?.emoteList) ??
    firstObject(payload?.emote_list) ??
    firstObject(payload?.comment?.emotes) ??
    (extra && (extra?.emote || extra?.fanSticker || extra?.fan_sticker));

  if (!candidate) return undefined;

  const id = text(
    candidate?.fanStickerId,
    candidate?.fan_sticker_id,
    candidate?.emoteId,
    candidate?.emote_id,
    candidate?.stickerId,
    candidate?.sticker_id,
    candidate?.id,
    candidate?.emoticonId,
  );
  const name = text(
    candidate?.fanStickerName,
    candidate?.fan_sticker_name,
    candidate?.emoteName,
    candidate?.emote_name,
    candidate?.stickerName,
    candidate?.sticker_name,
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
  return { id, name: name || (id ? `Fan Sticker ${id}` : 'Fan Sticker'), imageUrl };
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
  const rawTimestamp = number(
    payload?.timestamp ?? payload?.createTime ?? payload?.common?.createTime,
    Date.now(),
  );
  return rawTimestamp > 0 && rawTimestamp < 1_000_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
}

function baseEvent(raw: any, payload: any, type: LiveEvent['type'], suffix = ''): LiveEvent {
  const { user, uniqueId, nickname } = eventIdentity(payload);
  return {
    id:
      text(payload?.id, payload?.msgId, payload?.common?.msgId, raw?.id) ||
      `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}${suffix}`,
    type,
    timestamp: eventTimestamp(payload),
    uniqueId,
    nickname,
    profilePictureUrl: avatar(user) || text(payload?.profilePictureUrl),
  };
}

function bundledMessages(raw: any): any[] | undefined {
  const candidates = [
    raw?.events,
    raw?.messages,
    raw?.data?.events,
    raw?.data?.messages,
    raw?.payload?.events,
    raw?.payload?.messages,
  ];
  return candidates.find(Array.isArray);
}

function statsValue(payload: any, ...keys: string[]) {
  const sources = [
    payload,
    payload?.stats,
    payload?.room,
    payload?.room?.stats,
    payload?.roomInfo,
    payload?.roomInfo?.stats,
  ];
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }
  return undefined;
}

function normalizeOne(raw: any): ParsedRealtimeMessage[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      return normalizeOne(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw.flatMap(normalizeOne);
  const bundle = bundledMessages(raw);
  if (bundle) return bundle.flatMap(normalizeOne);

  const rawType = compactType(raw?.type ?? raw?.event ?? raw?.eventType ?? raw?.msgType);
  const payload = raw?.data ?? raw?.payload ?? raw;

  // Algunos gateways envuelven cada evento en `data` sin copiar el tipo al nivel
  // superior. Abrimos ese sobre antes de intentar normalizarlo.
  if (!rawType && payload !== raw && payload && typeof payload === 'object') {
    return normalizeOne(payload);
  }

  if (rawType === 'lulurelaystatus' || rawType === 'lulu_relay_status') {
    const state = compactType(payload?.state);
    return [
      {
        kind: 'relay',
        state:
          state === 'connected'
            ? 'connected'
            : state === 'rotating'
              ? 'rotating'
              : state === 'offline'
                ? 'offline'
                : state === 'error'
                  ? 'error'
                  : state === 'idle'
                    ? 'idle'
                    : 'connecting',
        message: text(payload?.message),
        attempt: Math.max(1, number(payload?.attempt, 1)),
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
    rawType === 'roominfo' ||
    rawType === 'roomstats' ||
    rawType === 'roomupdate' ||
    rawType === 'stats' ||
    rawType === 'live_stats' ||
    rawType.includes('roomuser') ||
    rawType.includes('userseq') ||
    rawType.includes('roominfo') ||
    rawType.includes('roomstats') ||
    rawType.includes('roomupdate')
  ) {
    return [
      {
        kind: 'stats',
        viewers: number(
          statsValue(payload, 'viewerCount', 'roomUserCount', 'userCount', 'memberCount'),
          NaN,
        ),
        likes: number(statsValue(payload, 'totalLikeCount', 'likeCount'), NaN),
      },
    ];
  }

  const hasFanStickerSignal = isFanStickerSignal(rawType, payload);
  const fanSticker = hasFanStickerSignal ? fanStickerFrom(payload) : undefined;
  let normalizedType = alias[rawType];

  if (rawType.includes('social')) {
    const socialSignal = compactType(
      payload?.displayType ??
        payload?.label ??
        payload?.action ??
        payload?.socialType ??
        payload?.common?.displayText,
    );
    if (socialSignal.includes('share')) normalizedType = 'share';
    else if (socialSignal.includes('follow')) normalizedType = 'follow';
  }
  if (!normalizedType && hasFanStickerSignal) normalizedType = 'fanSticker';
  if (!normalizedType && rawType.includes('gift')) normalizedType = 'gift';
  if (!normalizedType && rawType.includes('chat')) normalizedType = 'comment';
  if (!normalizedType && rawType.includes('like')) normalizedType = 'like';
  if (!normalizedType && rawType.includes('follow')) normalizedType = 'follow';
  if (!normalizedType && rawType.includes('share')) normalizedType = 'share';
  if (!normalizedType && rawType.includes('member')) normalizedType = 'member';
  if (!normalizedType && rawType.includes('sub')) normalizedType = 'subscribe';
  if (!normalizedType) return [];

  const gift = payload?.giftDetails ?? payload?.extendedGiftInfo ?? payload?.gift ?? {};
  const giftType = number(gift?.giftType ?? payload?.giftType ?? 0);
  if (normalizedType === 'gift' && giftType === 1 && payload?.repeatEnd === false) return [];
  const repeatCount = Math.max(1, number(payload?.repeatCount ?? payload?.comboCount ?? 1, 1));
  const diamondEach = Math.max(
    0,
    number(gift?.diamondCount ?? gift?.diamond_count ?? payload?.diamondCount ?? 0),
  );

  const event = baseEvent(raw, payload, normalizedType);
  if (normalizedType === 'comment') {
    event.comment = text(
      typeof payload?.comment === 'string' ? payload.comment : undefined,
      payload?.comment?.text,
      payload?.text,
      payload?.message,
    );
  } else if (normalizedType === 'fanSticker') {
    const resolved = fanSticker ?? {
      id: text(payload?.fanStickerId, payload?.fan_sticker_id, payload?.emoteId, payload?.emote_id),
      name: text(payload?.fanStickerName, payload?.fan_sticker_name, payload?.emoteName, payload?.emote_name, 'Fan Sticker'),
      imageUrl: text(payload?.imageUrl),
    };
    event.fanStickerId = resolved.id;
    event.fanStickerName = resolved.name;
    event.fanStickerImageUrl = resolved.imageUrl;
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
