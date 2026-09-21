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
import {
  claimTtsDelivery,
  transitionTtsDelivery,
} from './ttsDelivery';

const MAX_QUEUE = 5;
const MAX_PENDING_AGE_MS = 10_000;
const MAX_SPEECH_CHARS = 240;
const SYNTHESIS_TIMEOUT_MS = 9_000;
const SYNTHESIS_ATTEMPTS = 2;
const RETRY_DELAY_MS = 140;
const RELAY_LIVE_URL = process.env.EXPO_PUBLIC_LULU_RELAY_URL || DEFAULT_RELAY_LIVE_URL;
const RELAY_TTS_URL = microsoftTtsUrl(RELAY_LIVE_URL);
const CLIENT_TOKEN = process.env.EXPO_PUBLIC_LULU_RELAY_CLIENT_TOKEN || '';

type PendingSpeech = {
  text: string;
  queuedAt: number;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  prepared?: Promise<File>;
  preparedGeneration?: number;
  controllers?: Set<AbortController>;
  resolve?: () => void;
  reject?: (error: Error) => void;
  deliveryKey?: string;
};
type Player = ReturnType<typeof createAudioPlayer>;
type Subscription = { remove: () => void };

const pending: PendingSpeech[] = [];
const activeSynthesisControllers = new Set<AbortController>();
let speaking = false;
let playbackActive = false;
let generation = 0;
let activePlayer: Player | null = null;
let activeSpeech: PendingSpeech | null = null;
let activePlaybackFinish: ((error?: Error) => void) | null = null;
const welcomedUsers = new Set<string>();

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

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function queueLimit() {
  return Math.max(1, Math.min(10, Math.round(useTtsStore.getState().queueLimit || MAX_QUEUE)));
}

function maxPendingAgeMs() {
  const seconds = useTtsStore.getState().maxPendingAgeSeconds || MAX_PENDING_AGE_MS / 1000;
  return Math.max(3_000, Math.min(30_000, Math.round(seconds * 1000)));
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function cancelSpeech(
  item: PendingSpeech,
  reason: Error,
  status: 'cancelled' | 'expired' | 'failed' = 'cancelled',
) {
  for (const controller of item.controllers ?? []) controller.abort();
  item.controllers?.clear();
  transitionTtsDelivery(item.deliveryKey, status, reason.message);
  item.reject?.(reason);
}

async function synthesizeMicrosoftAudio(item: PendingSpeech, currentGeneration: number) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < SYNTHESIS_ATTEMPTS; attempt += 1) {
    if (currentGeneration !== generation) throw new Error('Audio TTS descartado');

    const controller = new AbortController();
    item.controllers ??= new Set<AbortController>();
    item.controllers.add(controller);
    activeSynthesisControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), SYNTHESIS_TIMEOUT_MS);
    let retryable = true;

    try {
      const response = await expoFetch(RELAY_TTS_URL, {
        method: 'POST',
        headers: microsoftTtsHeaders(CLIENT_TOKEN),
        body: JSON.stringify({
          text: item.text,
          voice: item.voice,
          rate: item.rate,
          pitch: item.pitch,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = '';
        try {
          const payload = (await response.json()) as { error?: unknown };
          detail = typeof payload.error === 'string' ? payload.error : '';
        } catch {}
        retryable = shouldRetryStatus(response.status);
        throw microsoftTtsFailure(response.status, detail);
      }

      const bytes = await response.bytes();
      if (!isMicrosoftMp3(bytes)) {
        retryable = true;
        throw new Error('El servidor no devolvió un MP3 válido de Microsoft.');
      }
      if (currentGeneration !== generation) throw new Error('Audio TTS descartado');

      const file = new File(Paths.cache, `lulu-microsoft-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
      file.write(bytes);
      return file;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Microsoft TTS no pudo generar el audio.');
      if (currentGeneration !== generation) throw normalized;
      lastError = normalized;
      if (!retryable || attempt >= SYNTHESIS_ATTEMPTS - 1) throw normalized;
      await delay(RETRY_DELAY_MS * (attempt + 1));
    } finally {
      clearTimeout(timeout);
      item.controllers.delete(controller);
      activeSynthesisControllers.delete(controller);
    }
  }

  throw lastError ?? new Error('Microsoft TTS no pudo generar el audio.');
}

function prepareSpeech(item: PendingSpeech, currentGeneration: number) {
  if (item.prepared && item.preparedGeneration === currentGeneration) return item.prepared;
  item.preparedGeneration = currentGeneration;
  const prepared = synthesizeMicrosoftAudio(item, currentGeneration);
  // El catch adjunto evita una promesa no atendida si la preparación termina
  // antes de que la voz llegue al frente de la cola.
  void prepared.catch(() => undefined);
  item.prepared = prepared;
  return prepared;
}

function nextFreshPending() {
  return pending.find((item) => Date.now() - item.queuedAt <= maxPendingAgeMs());
}

function prefetchNext(currentGeneration: number) {
  if (!playbackActive || currentGeneration !== generation) return;
  const next = nextFreshPending();
  if (next && !next.prepared) void prepareSpeech(next, currentGeneration);
}

function playAudioFile(
  file: File,
  volume: number,
  currentGeneration: number,
  onStarted: () => void,
) {
  const player = createAudioPlayer(file.uri, {
    updateInterval: 200,
    preferredForwardBufferDuration: 0,
  });
  activePlayer = player;
  let subscription: Subscription | null = null;

  return new Promise<void>((resolve, reject) => {
    let finished = false;
    let started = false;
    let confirmedPlaying = false;
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

    activePlaybackFinish = (error) => finish(error);
    subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (currentGeneration !== generation) return finish();
      if (status.error) return finish(new Error(`Android no pudo reproducir la voz: ${status.error}`));
      if (status.isLoaded) start();
      if (!confirmedPlaying && (status as { playing?: boolean }).playing) {
        confirmedPlaying = true;
        onStarted();
      }
      if (status.didJustFinish) finish();
    });
    if (player.isLoaded) start();
    watchdog = setTimeout(
      () => finish(new Error('Android no confirmó el final del audio TTS.')),
      60_000,
    );
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
  activeSpeech = item;
  try {
    const file = await prepareSpeech(item, currentGeneration);
    if (currentGeneration !== generation) {
      safeDelete(file);
      return;
    }
    setTtsPlaybackActive(true);
    playbackActive = true;
    prefetchNext(currentGeneration);
    await playAudioFile(file, item.volume, currentGeneration, () => {
      transitionTtsDelivery(item.deliveryKey, 'playing');
    });
    if (currentGeneration !== generation) return;
    transitionTtsDelivery(item.deliveryKey, 'completed');
    item.resolve?.();
  } catch (error) {
    if (currentGeneration === generation) {
      console.warn('[LuluFinity] Microsoft TTS no pudo generar el audio', error);
    }
    const normalized = error instanceof Error ? error : new Error('Microsoft TTS no pudo generar el audio.');
    if (currentGeneration === generation) {
      transitionTtsDelivery(item.deliveryKey, 'failed', normalized.message);
      item.reject?.(normalized);
    }
  } finally {
    if (activeSpeech === item) activeSpeech = null;
    playbackActive = false;
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
  while (item && Date.now() - item.queuedAt > maxPendingAgeMs()) {
    cancelSpeech(item, new Error('El mensaje caducó antes de reproducirse.'), 'expired');
    item = pending.shift();
  }
  if (item) void processNext(item);
}

function speak(
  text: string,
  options?: Partial<
    Pick<PendingSpeech, 'resolve' | 'reject' | 'deliveryKey' | 'voice' | 'volume'>
  >,
) {
  const value = text.slice(0, MAX_SPEECH_CHARS).trim();
  if (!value) return false;

  if (pending.length + (speaking ? 1 : 0) >= queueLimit()) {
    // El chat nuevo reemplaza al pendiente más antiguo para que el audio nunca
    // quede varios minutos detrás del LIVE.
    if (!pending.length) return false;
    const replaced = pending.shift();
    if (replaced) cancelSpeech(replaced, new Error('La prueba fue reemplazada por un comentario más reciente.'));
  }

  const settings = useTtsStore.getState();
  const item: PendingSpeech = {
    text: value,
    queuedAt: Date.now(),
    rate: Math.max(0.6, Math.min(1.5, settings.rate)),
    pitch: Math.max(0.7, Math.min(1.3, settings.pitch)),
    volume: Math.max(0, Math.min(1, options?.volume ?? settings.volume)),
    ...options,
    voice: normalizeMicrosoftVoice(options?.voice ?? settings.voice, settings.language),
  };
  pending.push(item);
  runNext();
  prefetchNext(generation);
  return true;
}

export async function handleTtsEvent(event: LiveEvent) {
  const settings = useTtsStore.getState();
  if (!settings.enabled) return false;
  const name = cleanName(event.nickname || event.uniqueId || 'Usuario').slice(0, 50);
  let text = '';
  let voice = settings.voice;
  let volume = settings.volume;

  if (event.type === 'comment') {
    if (!settings.readComments) return false;
    const comment = cleanText(event.comment ?? '');
    if (!comment) return false;
    if (settings.skipCommands && comment.startsWith('!')) return false;
    const maxChars = Math.max(40, Math.min(MAX_SPEECH_CHARS, Math.round(settings.maxChars)));
    const trimmed = comment.slice(0, maxChars);
    text = settings.announceUsername && name ? `${name} dice: ${trimmed}` : trimmed;
  } else if (event.type === 'gift') {
    if (!settings.readGifts) return false;
    text = settings.giftTemplate
      .replace(/\{name\}/gi, name || 'Usuario')
      .replace(/\{gift\}/gi, cleanText(event.giftName || 'regalo'))
      .replace(/\{count\}/gi, String(event.repeatCount ?? 1));
    voice = settings.giftVoice;
    volume = settings.giftVolume;
  } else if (event.type === 'member') {
    if (!settings.readWelcomes) return false;
    const userKey = String(event.uniqueId || event.nickname || '').trim().toLowerCase();
    if (!userKey || welcomedUsers.has(userKey)) return false;
    text = settings.welcomeTemplate.replace(/\{name\}/gi, name || 'Usuario');
    voice = settings.welcomeVoice;
    volume = settings.welcomeVolume;
  } else {
    return false;
  }

  text = cleanText(text);
  if (!text) return false;
  const deliveryKey = await claimTtsDelivery(event);
  if (!deliveryKey) return false;
  if (!speak(text, { deliveryKey, voice, volume })) {
    transitionTtsDelivery(deliveryKey, 'failed', 'La cola TTS estaba llena.');
    return false;
  }
  if (event.type === 'member') {
    welcomedUsers.add(String(event.uniqueId || event.nickname).trim().toLowerCase());
  }
  return true;
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
  const stopped = new Error('La lectura TTS fue detenida.');
  for (const item of pending.splice(0)) {
    cancelSpeech(item, stopped);
  }
  for (const controller of activeSynthesisControllers) controller.abort();
  activeSynthesisControllers.clear();
  if (activeSpeech) {
    cancelSpeech(activeSpeech, stopped);
  }
  speaking = false;
  playbackActive = false;
  activePlaybackFinish?.(stopped);
  activePlaybackFinish = null;
  setTtsPlaybackActive(false);
}

export function resetTtsLiveSession() {
  welcomedUsers.clear();
}

export async function getTtsVoices() {
  return [...MICROSOFT_VOICES];
}
