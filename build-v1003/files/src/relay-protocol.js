'use strict';

const MAX_RELAY_FRAME_BYTES = 512 * 1024;
const MAX_RELAY_MESSAGES_PER_FRAME = 128;

const RELAY_MESSAGE_TYPES = new Set([
  'lulu.relay.status',
  'lulu.relay.error',
  'workerInfo',
  'tiktok.connect',
  'tiktok.disconnect',
  'room.status',
  'WebcastChatMessage',
  'WebcastGiftMessage',
  'WebcastLikeMessage',
  'WebcastMemberMessage',
  'WebcastRoomUserSeqMessage',
  'WebcastSubNotifyMessage',
  'WebcastEmoteChatMessage',
  'WebcastBarrageMessage',
  'WebcastControlMessage',
  'WebcastSocialMessage',
  'roomInfo',
  'superFan',
  'decodeError',
  'SyntheticJoinMessage',
  'SyntheticLeaveMessage',
  'WebcastCaptionMessage',
  'WebcastEnvelopeMessage',
  'WebcastGoalUpdateMessage',
  'WebcastHourlyRankMessage',
  'WebcastImDeleteMessage',
  'WebcastImEnterRoomMessage',
  'WebcastInRoomBannerMessage',
  'WebcastLinkLayerMessage',
  'WebcastLinkMessage',
  'WebcastLinkmicBattleTaskMessage',
  'WebcastLiveIntroMessage',
  'WebcastMsgDetectMessage',
  'WebcastOecLiveShoppingMessage',
  'WebcastPollMessage',
  'WebcastQuestionNewMessage',
  'WebcastRankTextMessage',
  'WebcastRankUpdateMessage',
  'WebcastRoomMessage',
  'WebcastRoomPinMessage',
  'WebcastSystemMessage',
  'WebcastUnauthorizedMemberMessage',
]);

const IGNORED_RELAY_MESSAGE_TYPES = new Set([
  'roomInfo',
  'decodeError',
  'SyntheticLeaveMessage',
  'WebcastCaptionMessage',
  'WebcastEnvelopeMessage',
  'WebcastGoalUpdateMessage',
  'WebcastHourlyRankMessage',
  'WebcastImDeleteMessage',
  'WebcastImEnterRoomMessage',
  'WebcastInRoomBannerMessage',
  'WebcastLinkLayerMessage',
  'WebcastLinkMessage',
  'WebcastLinkmicBattleTaskMessage',
  'WebcastLiveIntroMessage',
  'WebcastMsgDetectMessage',
  'WebcastOecLiveShoppingMessage',
  'WebcastPollMessage',
  'WebcastQuestionNewMessage',
  'WebcastRankTextMessage',
  'WebcastRankUpdateMessage',
  'WebcastRoomMessage',
  'WebcastRoomPinMessage',
  'WebcastSystemMessage',
  'WebcastUnauthorizedMemberMessage',
]);

const FORBIDDEN_REMOTE_TYPE = /(?:^|[.:_-])(?:request|command|rpc|invoke|execute|eval|read|get|export|upload|settings?|cookies?|session|credentials?|tokens?|files?|paths?|device|ipc)(?:$|[.:_-])/i;

class RelayProtocolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RelayProtocolError';
    this.code = code;
  }
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function safeText(value, maxLength = 160) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .slice(0, Math.max(0, maxLength));
}

function safeNumber(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function safeInteger(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return Math.round(safeNumber(value, minimum, maximum));
}

function safeBoolean(value) {
  return value === true || value === 1 || value === '1';
}

function safeHttpsUrl(value) {
  const source = safeText(value, 2048).trim();
  if (!source) return '';
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href.slice(0, 2048);
  } catch {
    return '';
  }
}

function safeUrlList(value) {
  const source = Array.isArray(value) ? value : [];
  return source.slice(0, 4).map(safeHttpsUrl).filter(Boolean);
}

function safeImage(value) {
  const source = record(value);
  const urlList = safeUrlList(source.urlList || source.url);
  const direct = safeHttpsUrl(source.imageUrl || source.url || source.uri);
  if (direct && !urlList.includes(direct)) urlList.unshift(direct);
  return { urlList: urlList.slice(0, 4) };
}

function safeBadge(value) {
  const source = record(value);
  const nested = record(source.badge);
  return {
    name: safeText(source.name ?? nested.name, 80),
    type: safeText(source.type ?? nested.type, 80),
    displayType: safeText(source.displayType ?? nested.displayType, 120),
    level: safeInteger(source.level ?? nested.level, 0, 10_000),
    badgeLevel: safeInteger(source.badgeLevel ?? nested.badgeLevel, 0, 10_000),
  };
}

function safeUser(value) {
  const source = record(value);
  const badges = Array.isArray(source.badgeList)
    ? source.badgeList
    : Array.isArray(source.badges)
      ? source.badges
      : [];
  return {
    uniqueId: safeText(source.uniqueId, 100),
    displayId: safeText(source.displayId, 100),
    userId: safeText(source.userId, 100),
    userIdStr: safeText(source.userIdStr, 100),
    nickname: safeText(source.nickname, 120),
    nickName: safeText(source.nickName, 120),
    displayName: safeText(source.displayName, 120),
    profilePicture: safeImage(source.profilePicture),
    avatarThumb: safeImage(source.avatarThumb),
    avatarMedium: safeImage(source.avatarMedium),
    profilePictureUrl: safeHttpsUrl(source.profilePictureUrl),
    badgeList: badges.slice(0, 8).map(safeBadge),
    badges: badges.slice(0, 8).map(safeBadge),
    teamMemberLevel: safeInteger(source.teamMemberLevel, 0, 10_000),
    memberLevel: safeInteger(source.memberLevel, 0, 10_000),
    isFollower: safeBoolean(source.isFollower),
    isSubscriber: safeBoolean(source.isSubscriber),
    isSubscribing: safeBoolean(source.isSubscribing),
    followInfo: { followStatus: safeInteger(record(source.followInfo).followStatus ?? record(source.followInfo).follow_status, 0, 10) },
  };
}

function eventUser(source) {
  return safeUser(source.user || source.sender || source.fromUser || source.member || source);
}

function safeGift(value, fallback = {}) {
  const source = record(value);
  const backup = record(fallback);
  const giftId = safeText(source.giftId ?? source.id ?? source.gift_id ?? backup.giftId, 100);
  return {
    giftId,
    id: safeText(source.id ?? giftId, 100),
    giftName: safeText(source.giftName ?? source.name ?? backup.giftName, 160),
    name: safeText(source.name ?? source.giftName ?? backup.giftName, 160),
    giftType: safeInteger(source.giftType ?? source.type ?? backup.giftType, 0, 100),
    diamondCount: safeInteger(source.diamondCount ?? source.diamond_count ?? source.diamondCost ?? backup.diamondCount, 0, 1_000_000_000),
    diamond_count: safeInteger(source.diamond_count ?? source.diamondCount ?? source.diamondCost ?? backup.diamondCount, 0, 1_000_000_000),
    diamondCost: safeInteger(source.diamondCost ?? source.diamondCount ?? source.diamond_count ?? backup.diamondCount, 0, 1_000_000_000),
  };
}

function safeStickerCore(value) {
  const source = record(value);
  const image = safeImage(source.image);
  const direct = safeHttpsUrl(source.emoteImageUrl || source.stickerImageUrl || source.imageUrl);
  if (direct && !image.urlList.includes(direct)) image.urlList.unshift(direct);
  return {
    emoteId: safeText(source.emoteId, 100),
    stickerId: safeText(source.stickerId, 100),
    id: safeText(source.id, 100),
    emoteName: safeText(source.emoteName, 120),
    stickerName: safeText(source.stickerName, 120),
    name: safeText(source.name, 120),
    displayName: safeText(source.displayName, 120),
    emoteImageUrl: direct,
    stickerImageUrl: direct,
    imageUrl: direct,
    image,
  };
}

function safeSticker(value) {
  const source = record(value);
  const core = safeStickerCore(source.emote || source.sticker || source);
  return { ...core, emote: core, sticker: core };
}

function safeStickerList(value) {
  return (Array.isArray(value) ? value : value ? [value] : []).slice(0, 12).map(safeSticker);
}

function baseEventData(source) {
  return {
    user: eventUser(source),
    msgId: safeText(source.msgId, 120),
    messageId: safeText(source.messageId, 120),
    userId: safeText(source.userId, 100),
    uniqueId: safeText(source.uniqueId, 100),
    nickname: safeText(source.nickname, 120),
    profilePictureUrl: safeHttpsUrl(source.profilePictureUrl),
    isFollower: safeBoolean(source.isFollower),
    isSubscriber: safeBoolean(source.isSubscriber),
    teamMemberLevel: safeInteger(source.teamMemberLevel, 0, 10_000),
    memberLevel: safeInteger(source.memberLevel, 0, 10_000),
  };
}

function safeCommon(value) {
  const source = record(value);
  const displayText = record(source.displayText);
  return {
    msgId: safeText(source.msgId, 120),
    displayText: {
      key: safeText(displayText.key, 160),
      text: safeText(displayText.text, 240),
    },
  };
}

function sanitizeRelayData(type, rawValue) {
  const source = record(rawValue);
  if (type === 'lulu.relay.status') {
    const state = safeText(source.state, 24).toLowerCase();
    return {
      state: ['connecting', 'rotating', 'connected'].includes(state) ? state : '',
      attempt: safeInteger(source.attempt, 0, 100),
      keyId: safeText(source.keyId, 80),
    };
  }
  if (type === 'lulu.relay.error') {
    return {
      message: safeText(source.message, 280),
      classification: safeText(source.classification, 80),
    };
  }
  if (type === 'workerInfo') {
    return { roomId: safeText(source.roomId ?? source.webSocketId, 120), webSocketId: safeText(source.webSocketId, 120) };
  }
  if (type === 'tiktok.connect') return {};
  if (type === 'tiktok.disconnect') return { reason: safeText(source.reason, 160) };
  if (type === 'room.status') {
    const state = safeText(source.state, 24).toLowerCase();
    return {
      state: ['connected', 'ended', 'offline', 'error'].includes(state) ? state : '',
      roomId: safeText(source.roomId, 120),
      message: safeText(source.message, 280),
    };
  }

  const base = baseEventData(source);
  if (type === 'WebcastChatMessage') {
    return {
      ...base,
      comment: safeText(source.comment ?? source.content ?? source.text, 500),
      emotes: safeStickerList(source.emotes),
      emoteList: safeStickerList(source.emoteList),
      stickers: safeStickerList(source.stickers),
      stickerList: safeStickerList(source.stickerList),
      emote: safeStickerList(source.emote),
    };
  }
  if (type === 'WebcastGiftMessage') {
    const rawGift = source.giftDetails || source.gift || source.extendedGiftInfo;
    const giftDetails = safeGift(rawGift, source);
    return {
      ...base,
      giftId: safeText(source.giftId ?? giftDetails.giftId, 100),
      giftName: safeText(source.giftName ?? giftDetails.giftName, 160),
      giftType: safeInteger(source.giftType ?? giftDetails.giftType, 0, 100),
      diamondCount: safeInteger(source.diamondCount ?? source.diamond_count ?? giftDetails.diamondCount, 0, 1_000_000_000),
      repeatCount: safeInteger(source.repeatCount ?? source.repeat_count ?? source.comboCount, 1, 1_000_000),
      repeatEnd: safeBoolean(source.repeatEnd ?? source.repeat_end ?? source.comboEnd ?? true),
      giftDetails,
      extendedGiftInfo: giftDetails,
    };
  }
  if (type === 'WebcastLikeMessage') {
    return {
      ...base,
      likeCount: safeInteger(source.likeCount ?? source.count, 0, 1_000_000_000),
      totalLikeCount: safeInteger(source.totalLikeCount ?? source.total ?? source.total_count, 0, 1_000_000_000_000),
    };
  }
  if (type === 'WebcastMemberMessage') {
    return { ...base, memberCount: safeInteger(source.memberCount ?? source.member_count ?? source.count, 0, 1_000_000_000) };
  }
  if (type === 'WebcastRoomUserSeqMessage') {
    return { ...base, viewerCount: safeInteger(source.viewerCount ?? source.total ?? source.totalUser ?? source.total_user, 0, 1_000_000_000) };
  }
  if (type === 'WebcastControlMessage') {
    return {
      ...base,
      action: safeInteger(source.action ?? source.actionType, 0, 100),
      actionType: safeInteger(source.actionType ?? source.action, 0, 100),
      displayType: safeText(source.displayType, 160),
      status: safeText(source.status, 80),
    };
  }
  if (type === 'WebcastSocialMessage') {
    return {
      ...base,
      displayType: safeText(source.displayType, 160),
      label: safeText(source.label, 160),
      action: safeText(source.action, 80),
      common: safeCommon(source.common),
    };
  }
  if (type === 'WebcastEmoteChatMessage' || type === 'WebcastBarrageMessage') {
    return {
      ...base,
      emotes: safeStickerList(source.emotes),
      emoteList: safeStickerList(source.emoteList),
      stickers: safeStickerList(source.stickers),
      stickerList: safeStickerList(source.stickerList),
      emote: safeStickerList(source.emote),
    };
  }
  return base;
}

function sanitizeRelayMessage(value) {
  const source = record(value);
  const type = safeText(source.type, 100).trim();
  if (!type) throw new RelayProtocolError('missing_type', 'El relay envió un mensaje sin tipo.');
  if (FORBIDDEN_REMOTE_TYPE.test(type)) {
    throw new RelayProtocolError('forbidden_remote_request', 'El relay intentó enviar una solicitud prohibida al cliente.');
  }
  if (!RELAY_MESSAGE_TYPES.has(type)) {
    throw new RelayProtocolError('unsupported_type', `Tipo de evento no permitido: ${type}`);
  }
  if (!source.data || typeof source.data !== 'object' || Array.isArray(source.data)) {
    throw new RelayProtocolError('invalid_data', 'El evento del relay no contiene un objeto data válido.');
  }
  if (IGNORED_RELAY_MESSAGE_TYPES.has(type)) return { type: 'lulu.ignored', data: {} };
  const canonicalType = type === 'superFan'
    ? 'WebcastBarrageMessage'
    : type === 'SyntheticJoinMessage'
      ? 'WebcastMemberMessage'
      : type;
  return { type: canonicalType, data: sanitizeRelayData(canonicalType, source.data) };
}

function parseRelayFrame(raw) {
  const bytes = Buffer.isBuffer(raw) ? raw.length : Buffer.byteLength(String(raw ?? ''), 'utf8');
  if (!bytes || bytes > MAX_RELAY_FRAME_BYTES) {
    throw new RelayProtocolError('frame_size', 'El relay envió un paquete vacío o demasiado grande.');
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
  } catch {
    throw new RelayProtocolError('invalid_json', 'El relay envió JSON inválido.');
  }
  const batch = Array.isArray(parsed)
    ? parsed
    : Array.isArray(record(parsed).messages)
      ? parsed.messages
      : [parsed];
  if (!batch.length || batch.length > MAX_RELAY_MESSAGES_PER_FRAME) {
    throw new RelayProtocolError('batch_size', 'El relay envió demasiados eventos juntos.');
  }
  return batch.map(sanitizeRelayMessage);
}

function sanitizeRelayUsage(value) {
  const source = record(value);
  if (source.ok !== true) throw new RelayProtocolError('invalid_usage', 'El servidor no entregó un contador válido.');
  const safeMeter = (meter) => {
    const item = record(meter);
    const limit = safeNumber(item.limit, 0, 1_000_000_000);
    const used = safeNumber(item.used, 0, 1_000_000_000);
    return {
      used,
      limit,
      remaining: safeNumber(item.remaining, Math.max(0, limit - used), 1_000_000_000),
      percent: safeNumber(item.percent, limit ? (used / limit) * 100 : 0, 100_000),
      resetAt: safeText(item.resetAt, 80),
    };
  };
  return {
    ok: true,
    ...safeMeter(source),
    perConnection: safeNumber(source.perConnection, 0, 1_000_000),
    estimatedConnections: safeInteger(source.estimatedConnections, 0, 1_000_000_000),
    user: source.user && typeof source.user === 'object' ? safeMeter(source.user) : null,
  };
}

module.exports = {
  MAX_RELAY_FRAME_BYTES,
  MAX_RELAY_MESSAGES_PER_FRAME,
  RELAY_MESSAGE_TYPES,
  IGNORED_RELAY_MESSAGE_TYPES,
  RelayProtocolError,
  parseRelayFrame,
  sanitizeRelayMessage,
  sanitizeRelayUsage,
};
