import { createAudioPlayer } from 'expo-audio';
import { fetch as expoFetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import type { LiveEvent } from '@/types/live';
import { useTtsStore } from '@/store/useTtsStore';
import { MICROSOFT_VOICES, normalizeMicrosoftVoice } from './microsoftVoices';
import { setTtsPlaybackActive } from './audioCoordinator';
import {
  DEFAULT_RELAY_LIVE_URL,
  isMicrosoftMp3,
  microsoftTtsFailure,
  microsoftTtsHeaders,
  microsoftTtsUrl,
} from './microsoftRelay';

const MAX_QUEUE = 5;
const MAX_PENDING_AGE_MS = 10_000;
const MAX_SPEECH_CHARS = 240;
const SYNTHESIS_TIMEOUT_MS = 20_000;
const RELAY_LIVE_URL = process.env.EXPO_PUBLIC_LULU_RELAY_URL || DEFAULT_RELAY_LIVE_URL;
const RELAY_TTS_URL = microsoftTtsUrl(RELAY_LIVE_URL);
const CLIENT_TOKEN = process.env.EXPO_PUBLIC_LULU_RELAY_CLIENT_TOKEN || '';

type PendingSpeech = {
  text: string;
  queuedAt: number;
  resolve?: () => void;
  reject?: (error: Error) => void;
};
type Player = ReturnType<typeof createAudioPlayer>;
type Subscription = { remove: () => void };

const pending: PendingSpeech[] = [];
let speaking = false;
let generation = 0;
let synthesisController: AbortController | null = null;
let activePlayer: Player | null = null;
let activePlaybackFinish: (() => void) | null = null;

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

function safeDelete(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {}
}

async function synthesizeMicrosoftAudio(text: string, currentGeneration: number) {
  const settings = useTtsStore.getState();
  const controller = new AbortController();
  synthesisController = controller;
  const timeout = setTimeout(() => controller.abort(), SYNTHESIS_TIMEOUT_MS);

  try {
    const response = await expoFetch(RELAY_TTS_URL, {
      method: 'POST',
      headers: microsoftTtsHeaders(CLIENT_TOKEN),
      body: JSON.stringify({
        text,
        voice: normalizeMicrosoftVoice(settings.voice, settings.language),
        rate: Math.max(0.6, Math.min(1.5, settings.rate)),
        pitch: Math.max(0.7, Math.min(1.3, settings.pitch)),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        const payload = (await response.json()) as { error?: unknown };
        detail = typeof payload.error === 'string' ? payload.error : '';
      } catch {}
      throw microsoftTtsFailure(response.status, detail);
    }

    const bytes = await response.bytes();
    if (!isMicrosoftMp3(bytes)) throw new Error('El servidor no devolvió un MP3 válido de Microsoft.');
    if (currentGeneration !== generation) throw new Error('Audio TTS descartado');

    const file = new File(Paths.cache, `lulu-microsoft-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
    file.write(bytes);
    return file;
  } finally {
    clearTimeout(timeout);
    if (synthesisController === controller) synthesisController = null;
  }
}

function playAudioFile(file: File, volume: number, currentGeneration: number) {
  const player = createAudioPlayer(file.uri, {
    updateInterval: 200,
    preferredForwardBufferDuration: 2,
  });
  activePlayer = player;
  let subscription: Subscription | null = null;

  return new Promise<void>((resolve, reject) => {
    let finished = false;
    let started = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      if (watchdog) clearTimeout(watchdog);
      if (activePlaybackFinish === finish) activePlaybackFinish = null;
      if (error) reject(error);
      else resolve();
    };

    const start = () => {
      if (started || finished) return;
      started = true;
      try {
        player.volume = Math.max(0, Math.min(1, volume));
        player.play();
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Android interrumpió la reproducción de la voz.'));
      }
    };

    activePlaybackFinish = () => finish();
    subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (currentGeneration !== generation) return finish();
      if (status.error) return finish(new Error(`Android no pudo reproducir la voz: ${status.error}`));
      if (status.isLoaded) start();
      if (status.didJustFinish) finish();
    });
    if (player.isLoaded) start();
    watchdog = setTimeout(finish, 60_000);
  }).finally(() => {
    try {
      subscription?.remove();
      player.pause();
      player.release();
    } catch {}
    if (activePlayer === player) activePlayer = null;
    safeDelete(file);
  });
}

async function processNext(item: PendingSpeech) {
  const currentGeneration = generation;
  speaking = true;
  try {
    const file = await synthesizeMicrosoftAudio(item.text, currentGeneration);
    if (currentGeneration !== generation) {
      safeDelete(file);
      return;
    }
    const { volume } = useTtsStore.getState();
    setTtsPlaybackActive(true);
    await playAudioFile(file, volume, currentGeneration);
    item.resolve?.();
  } catch (error) {
    if (currentGeneration === generation) {
      console.warn('[LuluFinity] Microsoft TTS no pudo generar el audio', error);
    }
    item.reject?.(error instanceof Error ? error : new Error('Microsoft TTS no pudo generar el audio.'));
  } finally {
    setTtsPlaybackActive(false);
    if (currentGeneration === generation) {
      speaking = false;
      runNext();
    }
  }
}

function runNext() {
  if (speaking) return;
  let item = pending.shift();
  while (item && Date.now() - item.queuedAt > MAX_PENDING_AGE_MS) {
    item.reject?.(new Error('La prueba caducó antes de reproducirse.'));
    item = pending.shift();
  }
  if (item) void processNext(item);
}

function speak(text: string, completion?: Pick<PendingSpeech, 'resolve' | 'reject'>) {
  const value = text.slice(0, MAX_SPEECH_CHARS).trim();
  if (!value) return false;

  if (pending.length + (speaking ? 1 : 0) >= MAX_QUEUE) {
    // El chat nuevo reemplaza al pendiente más antiguo para que el audio nunca
    // quede varios minutos detrás del LIVE.
    if (!pending.length) return false;
    pending.shift()?.reject?.(new Error('La prueba fue reemplazada por un comentario más reciente.'));
  }
  pending.push({ text: value, queuedAt: Date.now(), ...completion });
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

  const maxChars = Math.max(40, Math.min(MAX_SPEECH_CHARS, Math.round(settings.maxChars)));
  const trimmed = comment.slice(0, maxChars);
  const name = cleanName(event.nickname || event.uniqueId || 'Usuario').slice(0, 50);
  const text = settings.announceUsername && name ? `${name} dice: ${trimmed}` : trimmed;
  return speak(text);
}

// Los comandos usan la misma voz configurada en TTS Bot, pero no necesitan tener
// activada la lectura global de comentarios.
export function speakTtsText(text: string) {
  return speak(cleanText(text));
}

export async function previewTts(text: string) {
  await stopTts();
  const value = cleanText(text);
  return new Promise<void>((resolve, reject) => {
    if (!speak(value, { resolve, reject })) {
      reject(new Error('Escribe un texto para probar la voz.'));
    }
  });
}

export async function stopTts() {
  generation += 1;
  for (const item of pending.splice(0)) {
    item.reject?.(new Error('La lectura TTS fue detenida.'));
  }
  speaking = false;
  synthesisController?.abort();
  synthesisController = null;
  activePlaybackFinish?.();
  activePlaybackFinish = null;
  setTtsPlaybackActive(false);
}

export async function getTtsVoices() {
  return [...MICROSOFT_VOICES];
}
