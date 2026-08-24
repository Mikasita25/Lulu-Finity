'use strict';

const { createHash } = require('node:crypto');

const MAX_TEXT_LENGTH = 240;
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ITEMS = 48;

const MICROSOFT_VOICES = Object.freeze([
  { identifier: 'es-MX-DaliaNeural', name: 'Dalia', language: 'es-MX' },
  { identifier: 'es-MX-JorgeNeural', name: 'Jorge', language: 'es-MX' },
  { identifier: 'es-MX-CandelaNeural', name: 'Candela', language: 'es-MX' },
  { identifier: 'es-MX-GerardoNeural', name: 'Gerardo', language: 'es-MX' },
  { identifier: 'es-MX-MarinaNeural', name: 'Marina', language: 'es-MX' },
  { identifier: 'es-ES-ElviraNeural', name: 'Elvira', language: 'es-ES' },
  { identifier: 'es-ES-AlvaroNeural', name: 'Álvaro', language: 'es-ES' },
  { identifier: 'es-US-PalomaNeural', name: 'Paloma', language: 'es-US' },
  { identifier: 'es-US-AlonsoNeural', name: 'Alonso', language: 'es-US' },
  { identifier: 'es-AR-ElenaNeural', name: 'Elena', language: 'es-AR' },
  { identifier: 'es-AR-TomasNeural', name: 'Tomás', language: 'es-AR' },
  { identifier: 'en-US-AriaNeural', name: 'Aria', language: 'en-US' },
  { identifier: 'en-US-GuyNeural', name: 'Guy', language: 'en-US' }
]);

const voiceIds = new Set(MICROSOFT_VOICES.map((voice) => voice.identifier));
const audioCache = new Map();
let edgeModulePromise = null;

function requestError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function finiteBetween(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? parsed : fallback));
}

function signed(value, suffix) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}${suffix}`;
}

function normalizeMicrosoftTtsRequest(input = {}) {
  const rawText = String(input.text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!rawText) throw requestError(400, 'Escribe un texto para generar la voz.');
  if ([...rawText].length > MAX_TEXT_LENGTH) {
    throw requestError(413, `El texto supera el máximo de ${MAX_TEXT_LENGTH} caracteres.`);
  }

  const requestedVoice = String(input.voice || '');
  const voice = voiceIds.has(requestedVoice) ? requestedVoice : 'es-MX-DaliaNeural';
  const rate = finiteBetween(input.rate, 1, 0.6, 1.5);
  const pitch = finiteBetween(input.pitch, 1, 0.7, 1.3);
  return {
    text: rawText,
    voice,
    rate,
    pitch,
    edgeOptions: {
      rate: signed((rate - 1) * 100, '%'),
      volume: '+0%',
      pitch: signed((pitch - 1) * 50, 'Hz')
    }
  };
}

function pruneCache(now = Date.now()) {
  for (const [key, item] of audioCache) {
    if (now - item.createdAt > CACHE_TTL_MS) audioCache.delete(key);
  }
  while (audioCache.size > MAX_CACHE_ITEMS) audioCache.delete(audioCache.keys().next().value);
}

async function edgeTtsClass() {
  edgeModulePromise ||= import('edge-tts-universal');
  const loaded = await edgeModulePromise;
  const EdgeTTS = loaded.EdgeTTS || loaded.default?.EdgeTTS || loaded.default;
  if (typeof EdgeTTS !== 'function') throw new Error('El proveedor Microsoft TTS no está disponible.');
  return EdgeTTS;
}

async function synthesizeMicrosoftSpeech(input) {
  const normalized = normalizeMicrosoftTtsRequest(input);
  const cacheKey = createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
  const cached = audioCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt <= CACHE_TTL_MS) {
    return { audio: Buffer.from(cached.audio), voice: normalized.voice, cacheHit: true };
  }

  const EdgeTTS = await edgeTtsClass();
  const synthesizer = new EdgeTTS(normalized.text, normalized.voice, normalized.edgeOptions);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(requestError(504, 'Microsoft TTS tardó demasiado en responder.')), 12_000);
    timer.unref?.();
  });

  let result;
  try {
    result = await Promise.race([synthesizer.synthesize(), timeout]);
  } finally {
    clearTimeout(timer);
  }

  const arrayBuffer = await result.audio.arrayBuffer();
  const audio = Buffer.from(arrayBuffer);
  if (!audio.length) throw new Error('Microsoft TTS devolvió audio vacío.');
  if (audio.length > 3 * 1024 * 1024) throw requestError(502, 'Microsoft TTS devolvió un audio demasiado grande.');

  audioCache.set(cacheKey, { audio, createdAt: Date.now() });
  pruneCache();
  return { audio: Buffer.from(audio), voice: normalized.voice, cacheHit: false };
}

module.exports = {
  MAX_TEXT_LENGTH,
  MICROSOFT_VOICES,
  normalizeMicrosoftTtsRequest,
  synthesizeMicrosoftSpeech
};
