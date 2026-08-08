'use strict';

const { isTikTokVoiceId } = require('./tiktok-voice-catalog');

const TIKTOK_TTS_ENDPOINTS = Object.freeze([
  'https://api16-normal-v6.tiktokv.com/media/api/text/speech/invoke/',
  'https://api16-normal-useast5.us.tiktokv.com/media/api/text/speech/invoke/'
]);

function friendlyTikTokStatus(payload) {
  const status = Number(payload?.status_code ?? payload?.statusCode ?? -1);
  if (status === 0) return '';
  if (status === 1 || status === 5) return 'La sesión de TikTok venció. Abre Cuenta → TikTok e inicia sesión nuevamente.';
  if (status === 2) return 'El texto es demasiado largo para las voces de TikTok.';
  if (status === 4) return 'TikTok retiró temporalmente esta voz. Elige otra.';
  return String(payload?.status_msg || payload?.message || `TikTok rechazó el audio (${status}).`);
}

async function requestTikTokSpeech({ text, voice, cookie, fetchImpl = globalThis.fetch, endpoints = TIKTOK_TTS_ENDPOINTS, timeoutMs = 20_000 } = {}) {
  const cleanText = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  const cleanVoice = String(voice || '').trim();
  if (!cleanText) throw new Error('No hay texto para leer.');
  if (!isTikTokVoiceId(cleanVoice)) throw new Error('La voz de TikTok seleccionada no es válida.');
  if (!String(cookie || '').includes('sessionid=')) throw new Error('Falta una sesión de TikTok válida.');
  if (typeof fetchImpl !== 'function') throw new Error('El cliente HTTP de TikTok no está disponible.');
  const params = new URLSearchParams({ text_speaker: cleanVoice, req_text: cleanText, speaker_map_type: '0', aid: '1233' });
  let lastError = null;
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${endpoint}?${params}`, {
        method: 'POST',
        headers: {
          'User-Agent': 'com.zhiliaoapp.musically/2022600030 (Linux; U; Android 7.1.2; es_ES; Build/NRD90M)',
          Cookie: String(cookie),
          Accept: 'application/json'
        },
        signal: controller.signal
      });
      if (!response?.ok) throw new Error(`TikTok respondió ${response?.status || 'sin estado'}.`);
      const payload = await response.json();
      const statusMessage = friendlyTikTokStatus(payload);
      if (statusMessage) throw new Error(statusMessage);
      const encoded = String(payload?.data?.v_str || '');
      if (!encoded || !/^[A-Za-z0-9+/=\s]+$/.test(encoded)) throw new Error('TikTok no devolvió audio válido.');
      const buffer = Buffer.from(encoded, 'base64');
      if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new Error('TikTok devolvió un audio vacío o demasiado grande.');
      return { mimeType: 'audio/mpeg', data: buffer.toString('base64'), bytes: buffer.length, provider: 'tiktok', voice: cleanVoice };
    } catch (error) {
      lastError = error;
      if (/sesión|demasiado largo|retiró temporalmente/i.test(String(error?.message || ''))) break;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (lastError?.name === 'AbortError') throw new Error('TikTok tardó demasiado en generar la voz.');
  throw lastError || new Error('No se pudo generar la voz de TikTok.');
}

module.exports = { TIKTOK_TTS_ENDPOINTS, friendlyTikTokStatus, requestTikTokSpeech };
