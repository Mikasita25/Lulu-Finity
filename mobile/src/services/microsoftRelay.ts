export const DEFAULT_RELAY_LIVE_URL =
  'wss://lulu-finity-production-6b8f.up.railway.app/v1/tiktok/live';

export function microsoftTtsUrl(liveUrl = DEFAULT_RELAY_LIVE_URL) {
  return `${liveUrl
    .replace(/^ws/i, 'http')
    .replace(/\/v1\/tiktok\/live.*$/i, '')}/v1/tts/microsoft`;
}

export function microsoftTtsHeaders(token: string) {
  const headers: Record<string, string> = {
    Accept: 'audio/mpeg',
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-lulu-client-token'] = token;
  }
  return headers;
}

export function isMicrosoftMp3(bytes: Uint8Array) {
  if (bytes.length < 512) return false;
  const hasId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const hasMpegFrame = bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
  return hasId3 || hasMpegFrame;
}

export function microsoftTtsFailure(status: number, detail = '') {
  if (status === 401 || status === 403) {
    return new Error('La app no está autorizada para usar las voces de Microsoft.');
  }
  if (status === 404) {
    return new Error('El servidor de voz todavía no tiene activa la ruta de Microsoft.');
  }
  if (status === 429) {
    return new Error('Hay demasiadas solicitudes de voz. Espera un momento e inténtalo otra vez.');
  }
  if (status >= 500) {
    return new Error('El servidor no pudo generar la voz Microsoft.');
  }
  return new Error(detail || `El servidor de voz respondió ${status}.`);
}
