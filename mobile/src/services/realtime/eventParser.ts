import type { LiveEvent, RelayState } from '@/types/live';

export type ParsedRealtimeMessage =
  | { kind: 'event'; event: LiveEvent }
  | { kind: 'stats'; viewers?: number; likes?: number }
  | { kind: 'relay'; state: RelayState; message?: string };

const alias: Record<string, LiveEvent['type'] | undefined> = {
  chat: 'comment',
  comment: 'comment',
  webcastchatmessage: 'comment',
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
          payload?.viewerCount ??
            payload?.roomUserCount ??
            payload?.userCount ??
            payload?.memberCount,
          NaN,
        ),
        likes: number(payload?.totalLikeCount ?? payload?.likeCount, NaN),
      },
    ];
  }

  let normalizedType = alias[rawType];
  if (!normalizedType && rawType.includes('social')) {
    const socialSignal = compactType(
      payload?.displayType ?? payload?.label ?? payload?.action ?? payload?.socialType,
    );
    if (socialSignal.includes('share')) normalizedType = 'share';
    else if (socialSignal.includes('follow')) normalizedType = 'follow';
  }
  if (!normalizedType && rawType.includes('gift')) normalizedType = 'gift';
  if (!normalizedType && rawType.includes('chat')) normalizedType = 'comment';
  if (!normalizedType && rawType.includes('like')) normalizedType = 'like';
  if (!normalizedType && rawType.includes('follow')) normalizedType = 'follow';
  if (!normalizedType && rawType.includes('share')) normalizedType = 'share';
  if (!normalizedType && rawType.includes('member')) normalizedType = 'member';
  if (!normalizedType && rawType.includes('sub')) normalizedType = 'subscribe';
  if (!normalizedType) return [];

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

  const gift = payload?.giftDetails ?? payload?.extendedGiftInfo ?? payload?.gift ?? {};
  const giftType = number(gift?.giftType ?? payload?.giftType ?? 0);
  // En regalos con streak, TikTok manda actualizaciones intermedias. Igual que PC,
  // contamos únicamente el cierre del streak para no duplicar monedas/regalos.
  if (normalizedType === 'gift' && giftType === 1 && payload?.repeatEnd === false) return [];
  const repeatCount = Math.max(1, number(payload?.repeatCount ?? payload?.comboCount ?? 1, 1));
  const diamondEach = Math.max(
    0,
    number(gift?.diamondCount ?? gift?.diamond_count ?? payload?.diamondCount ?? 0),
  );

  const rawTimestamp = number(payload?.timestamp ?? payload?.createTime, Date.now());
  const timestamp = rawTimestamp > 0 && rawTimestamp < 1_000_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;

  const event: LiveEvent = {
    id: text(payload?.id, payload?.msgId, raw?.id) || `${normalizedType}-${Date.now()}-${Math.random()}`,
    type: normalizedType,
    timestamp,
    uniqueId,
    nickname,
    profilePictureUrl: avatar(user) || text(payload?.profilePictureUrl),
  };

  if (normalizedType === 'comment') {
    event.comment = text(payload?.comment, payload?.text, payload?.message);
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
