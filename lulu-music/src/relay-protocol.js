'use strict';

const MAX_RELAY_FRAME_BYTES = 512 * 1024;
const MAX_RELAY_MESSAGES_PER_FRAME = 128;
const MUSIC_RELAY_TYPES = new Set([
  'lulu.relay.status', 'lulu.relay.error', 'workerInfo', 'tiktok.connect',
  'tiktok.disconnect', 'room.status', 'WebcastChatMessage',
  'WebcastRoomUserSeqMessage', 'WebcastControlMessage'
]);
const FORBIDDEN_REMOTE_TYPE = /(?:^|[.:_-])(?:request|command|rpc|invoke|execute|eval|read|get|export|upload|settings?|cookies?|session|credentials?|tokens?|files?|paths?|device|ipc)(?:$|[.:_-])/i;

class RelayProtocolError extends Error {
  constructor(code, message) { super(message); this.name = 'RelayProtocolError'; this.code = code; }
}

function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function text(value, length = 160) { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, length); }
function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value); return Number.isFinite(number) ? Math.round(Math.min(maximum, Math.max(minimum, number))) : minimum;
}
function bool(value) { return value === true || value === 1 || value === '1'; }
function httpsUrl(value) {
  try { const url = new URL(text(value, 2048)); return url.protocol === 'https:' && !url.username && !url.password ? url.href.slice(0, 2048) : ''; }
  catch { return ''; }
}
function image(value) {
  const source = record(value); const raw = Array.isArray(source.urlList) ? source.urlList : [];
  return { urlList:raw.slice(0, 4).map(httpsUrl).filter(Boolean) };
}
function badge(value) {
  const source = record(value); return { name:text(source.name,80), type:text(source.type,80), level:integer(source.level ?? source.badgeLevel,0,10_000) };
}
function user(value) {
  const source = record(value); const badges = Array.isArray(source.badgeList) ? source.badgeList : Array.isArray(source.badges) ? source.badges : [];
  return {
    uniqueId:text(source.uniqueId,100), displayId:text(source.displayId,100), userId:text(source.userId,100),
    nickname:text(source.nickname ?? source.displayName,120), profilePicture:image(source.profilePicture || source.avatarThumb),
    badgeList:badges.slice(0,8).map(badge), memberLevel:integer(source.memberLevel ?? source.teamMemberLevel,0,10_000),
    isFollower:bool(source.isFollower), isSubscriber:bool(source.isSubscriber ?? source.isSubscribing),
    followInfo:{ followStatus:integer(record(source.followInfo).followStatus,0,10) }
  };
}

function sanitizeData(type, raw) {
  const source = record(raw);
  if (type === 'lulu.relay.status') return { state:text(source.state,24), attempt:integer(source.attempt,0,100) };
  if (type === 'lulu.relay.error') return { message:text(source.message,280) };
  if (type === 'workerInfo') return { roomId:text(source.roomId ?? source.webSocketId,120) };
  if (type === 'tiktok.connect') return {};
  if (type === 'tiktok.disconnect') return { reason:text(source.reason,160) };
  if (type === 'room.status') return { state:text(source.state,24), roomId:text(source.roomId,120), message:text(source.message,280) };
  if (type === 'WebcastRoomUserSeqMessage') return { viewerCount:integer(source.viewerCount ?? source.total ?? source.totalUser,0,1_000_000_000) };
  if (type === 'WebcastControlMessage') return { action:integer(source.action ?? source.actionType,0,100), actionType:integer(source.actionType ?? source.action,0,100), status:text(source.status,80), displayType:text(source.displayType,160) };
  const sender = source.user || source.sender || source;
  return {
    msgId:text(source.msgId ?? source.messageId,120), comment:text(source.comment ?? source.content ?? source.text,500),
    user:user(sender), uniqueId:text(source.uniqueId,100), nickname:text(source.nickname,120),
    isFollower:bool(source.isFollower), isSubscriber:bool(source.isSubscriber), memberLevel:integer(source.memberLevel,0,10_000)
  };
}

function sanitizeRelayMessage(value) {
  const source = record(value); const type = text(source.type,100).trim();
  if (!type) throw new RelayProtocolError('missing_type','El relay envió un mensaje sin tipo.');
  if (FORBIDDEN_REMOTE_TYPE.test(type)) throw new RelayProtocolError('forbidden_remote_request','El relay intentó enviar una operación prohibida.');
  if (!source.data || typeof source.data !== 'object' || Array.isArray(source.data)) throw new RelayProtocolError('invalid_data','El evento no contiene datos estructurados.');
  if (MUSIC_RELAY_TYPES.has(type)) return { type, data:sanitizeData(type,source.data) };
  // TikTok produce muchos tipos de eventos. Se reconocen solo para descartarlos aquí;
  // sus datos nunca llegan al resto de la aplicación.
  if (/^Webcast[A-Za-z0-9]+Message$/.test(type) || ['roomInfo','decodeError','SyntheticJoinMessage','SyntheticLeaveMessage','superFan'].includes(type)) {
    return { type:'lulu.ignored', data:{} };
  }
  throw new RelayProtocolError('unsupported_type',`Tipo de evento no permitido: ${type}`);
}

function parseRelayFrame(raw) {
  const bytes = Buffer.isBuffer(raw) ? raw.length : Buffer.byteLength(String(raw ?? ''),'utf8');
  if (!bytes || bytes > MAX_RELAY_FRAME_BYTES) throw new RelayProtocolError('frame_size','El relay envió un paquete vacío o demasiado grande.');
  let parsed; try { parsed = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); }
  catch { throw new RelayProtocolError('invalid_json','El relay envió JSON inválido.'); }
  const source = record(parsed); const batch = Array.isArray(parsed) ? parsed : Array.isArray(source.messages) ? source.messages : [parsed];
  if (!batch.length || batch.length > MAX_RELAY_MESSAGES_PER_FRAME) throw new RelayProtocolError('batch_size','El relay envió demasiados eventos juntos.');
  return batch.map(sanitizeRelayMessage);
}

module.exports = { MAX_RELAY_FRAME_BYTES, MAX_RELAY_MESSAGES_PER_FRAME, MUSIC_RELAY_TYPES, RelayProtocolError, parseRelayFrame, sanitizeRelayMessage };
