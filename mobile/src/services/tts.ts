import * as Speech from 'expo-speech';
import type { LiveEvent } from '@/types/live';
import { useTtsStore } from '@/store/useTtsStore';

const MAX_QUEUE = 8;
let queued = 0;

function cleanText(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, ' enlace ')
    .replace(/www\.\S+/gi, ' enlace ')
    .replace(/\s+/g, ' ')
    .trim();
}

function finishOne() {
  queued = Math.max(0, queued - 1);
}

function speak(text: string) {
  const settings = useTtsStore.getState();
  if (!text || queued >= MAX_QUEUE) return false;

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    finishOne();
  };

  queued += 1;
  Speech.speak(text, {
    language: settings.language || undefined,
    voice: settings.voice || undefined,
    rate: Math.max(0.5, Math.min(2, settings.rate)),
    pitch: Math.max(0.5, Math.min(2, settings.pitch)),
    volume: Math.max(0, Math.min(1, settings.volume)),
    onDone: settle,
    onStopped: settle,
    onError: settle,
  });
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
  const name = cleanText(event.nickname || event.uniqueId || 'Usuario').slice(0, 50);
  const text = settings.announceUsername && name ? `${name} dice: ${trimmed}` : trimmed;
  return speak(text);
}

export async function previewTts(text: string) {
  await stopTts();
  return speak(cleanText(text).slice(0, 400));
}

export async function stopTts() {
  queued = 0;
  await Speech.stop();
}

export async function getTtsVoices() {
  return Speech.getAvailableVoicesAsync();
}
