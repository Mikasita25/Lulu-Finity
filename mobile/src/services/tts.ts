import * as Speech from 'expo-speech';
import type { LiveEvent } from '@/types/live';
import { useTtsStore } from '@/store/useTtsStore';

const MAX_QUEUE = 8;
const MAX_PENDING_AGE_MS = 15_000;
type PendingSpeech = { text: string; queuedAt: number };
const pending: PendingSpeech[] = [];
let speaking = false;
let generation = 0;
let watchdog: ReturnType<typeof setTimeout> | null = null;

function cleanText(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, ' enlace ')
    .replace(/www\.\S+/gi, ' enlace ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(value: string) {
  return cleanText(value)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clearWatchdog() {
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
}

function runNext() {
  if (speaking) return;
  let item = pending.shift();
  while (item && Date.now() - item.queuedAt > MAX_PENDING_AGE_MS) item = pending.shift();
  if (!item) return;
  const { text } = item;

  const settings = useTtsStore.getState();
  const currentGeneration = generation;
  speaking = true;
  let finished = false;
  let triedSystemVoice = false;
  let attempt = 0;

  const finish = () => {
    if (finished || currentGeneration !== generation) return;
    finished = true;
    speaking = false;
    clearWatchdog();
    runNext();
  };

  const start = (voice?: string): void => {
    const attemptId = ++attempt;
    try {
      Speech.speak(text, {
        language: settings.language || undefined,
        voice: voice || undefined,
        rate: Math.max(0.5, Math.min(2, settings.rate)),
        pitch: Math.max(0.5, Math.min(2, settings.pitch)),
        volume: Math.max(0, Math.min(1, settings.volume)),
        onDone: () => {
          if (attemptId === attempt) finish();
        },
        onStopped: () => {
          if (attemptId === attempt) finish();
        },
        onError: () => {
          if (attemptId !== attempt) return;
          // Una voz instalada puede desaparecer tras una actualización de Android.
          // Reintentamos una sola vez con la voz del sistema en vez de silenciar la cola.
          if (voice && !triedSystemVoice && currentGeneration === generation) {
            triedSystemVoice = true;
            start(undefined);
            return;
          }
          finish();
        },
      });
    } catch {
      if (voice && !triedSystemVoice && currentGeneration === generation) {
        triedSystemVoice = true;
        start(undefined);
        return;
      }
      finish();
    }
  };

  const expectedMs = Math.max(12_000, Math.min(60_000, text.length * 135));
  watchdog = setTimeout(finish, expectedMs);
  start(settings.voice || undefined);
}

function speak(text: string) {
  const limit = Math.max(1, Math.min(400, Speech.maxSpeechInputLength || 400));
  const value = text.slice(0, limit).trim();
  if (!value) return false;

  if (pending.length + (speaking ? 1 : 0) >= MAX_QUEUE) {
    // Conservamos el comentario que está hablando y reemplazamos el pendiente más
    // antiguo para que la voz no se quede varios minutos detrás del LIVE.
    if (!pending.length) return false;
    pending.shift();
  }
  pending.push({ text: value, queuedAt: Date.now() });
  runNext();
  return true;
}

export function handleTtsEvent(event: LiveEvent) {
  if (event.type !== 'comment') return false;
  const settings = useTtsStore.getState();
  if (!settings.enabled) return false;

  const comment = cleanText(event.comment ?? '');
  if (!comment) return false;
  if (settings.skipCommands && comment.startsWith('!')) return false;

  const maxChars = Math.max(40, Math.min(400, Math.round(settings.maxChars)));
  const trimmed = comment.slice(0, maxChars);
  const name = cleanName(event.nickname || event.uniqueId || 'Usuario').slice(0, 50);
  const text = settings.announceUsername && name ? `${name} dice: ${trimmed}` : trimmed;
  return speak(text);
}

// Los comandos usan la misma voz configurada en TTS Bot, pero no necesitan tener
// activada la lectura global de comentarios. Así un sticker puede hablar aunque el
// chat normal esté silenciado.
export function speakTtsText(text: string) {
  return speak(cleanText(text).slice(0, 400));
}

export async function previewTts(text: string) {
  await stopTts();
  return speakTtsText(text);
}

export async function stopTts() {
  generation += 1;
  pending.length = 0;
  speaking = false;
  clearWatchdog();
  await Speech.stop();
}

export async function getTtsVoices() {
  return Speech.getAvailableVoicesAsync();
}
