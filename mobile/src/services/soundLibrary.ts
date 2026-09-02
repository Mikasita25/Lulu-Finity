import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppStore } from '@/store/useAppStore';
import type { SoundSlot } from '@/types/live';

export type BuiltinSound = {
  id: string;
  name: string;
  description: string;
  durationMs: number;
  tones: { startMs: number; durationMs: number; frequency: number; gain: number; shimmer?: number }[];
};

export const BUILTIN_SOUNDS: BuiltinSound[] = [
  {
    id: 'cute-bell',
    name: 'Campanita cute',
    description: 'Suave para follows y entradas.',
    durationMs: 760,
    tones: [
      { startMs: 0, durationMs: 520, frequency: 880, gain: 0.58, shimmer: 2 },
      { startMs: 150, durationMs: 560, frequency: 1318.5, gain: 0.42, shimmer: 2 },
    ],
  },
  {
    id: 'magic-sparkle',
    name: 'Brillo mágico',
    description: 'Destellos para regalos y stickers.',
    durationMs: 980,
    tones: [
      { startMs: 0, durationMs: 360, frequency: 659.25, gain: 0.42, shimmer: 3 },
      { startMs: 190, durationMs: 420, frequency: 987.77, gain: 0.5, shimmer: 3 },
      { startMs: 420, durationMs: 500, frequency: 1567.98, gain: 0.4, shimmer: 4 },
    ],
  },
  {
    id: 'soft-pop',
    name: 'Pop suave',
    description: 'Corto para comentarios o likes.',
    durationMs: 260,
    tones: [
      { startMs: 0, durationMs: 210, frequency: 520, gain: 0.7, shimmer: 1 },
      { startMs: 35, durationMs: 170, frequency: 780, gain: 0.35, shimmer: 2 },
    ],
  },
  {
    id: 'crystal',
    name: 'Cristal',
    description: 'Limpio y delicado.',
    durationMs: 820,
    tones: [
      { startMs: 0, durationMs: 760, frequency: 1174.66, gain: 0.48, shimmer: 3 },
      { startMs: 80, durationMs: 620, frequency: 1760, gain: 0.26, shimmer: 4 },
    ],
  },
  {
    id: 'level-up',
    name: 'Subida de nivel',
    description: 'Ideal para ranking y logros.',
    durationMs: 1080,
    tones: [
      { startMs: 0, durationMs: 280, frequency: 523.25, gain: 0.52, shimmer: 1 },
      { startMs: 250, durationMs: 300, frequency: 659.25, gain: 0.55, shimmer: 1 },
      { startMs: 520, durationMs: 480, frequency: 1046.5, gain: 0.62, shimmer: 2 },
    ],
  },
  {
    id: 'celebration',
    name: 'Celebración',
    description: 'Más brillante para metas y subs.',
    durationMs: 1320,
    tones: [
      { startMs: 0, durationMs: 440, frequency: 659.25, gain: 0.5, shimmer: 2 },
      { startMs: 230, durationMs: 500, frequency: 830.61, gain: 0.52, shimmer: 2 },
      { startMs: 480, durationMs: 760, frequency: 1318.51, gain: 0.56, shimmer: 3 },
    ],
  },
];

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80) || `sound-${Date.now()}.mp3`;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function bytesToBase64(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index] ?? 0;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const value = (a << 16) | (b << 8) | c;
    result += alphabet[(value >> 18) & 63];
    result += alphabet[(value >> 12) & 63];
    result += index + 1 < bytes.length ? alphabet[(value >> 6) & 63] : '=';
    result += index + 2 < bytes.length ? alphabet[value & 63] : '=';
  }
  return result;
}

function renderBuiltinSound(sound: BuiltinSound) {
  const sampleRate = 22_050;
  const samples = Math.ceil((sound.durationMs / 1000) * sampleRate);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeAscii(view, 8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples * 2, true);

  for (let index = 0; index < samples; index += 1) {
    const timeMs = (index / sampleRate) * 1000;
    let mixed = 0;
    for (const tone of sound.tones) {
      const localMs = timeMs - tone.startMs;
      if (localMs < 0 || localMs > tone.durationMs) continue;
      const progress = localMs / tone.durationMs;
      const attack = Math.min(1, localMs / 16);
      const decay = Math.pow(1 - progress, 2.2);
      const phase = 2 * Math.PI * tone.frequency * (localMs / 1000);
      const fundamental = Math.sin(phase);
      const shimmer = tone.shimmer ? Math.sin(phase * tone.shimmer) * 0.22 : 0;
      mixed += (fundamental + shimmer) * tone.gain * attack * decay;
    }
    const sample = Math.max(-1, Math.min(1, mixed * 0.74));
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }
  return bytesToBase64(bytes);
}

async function soundsDirectory() {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('Android no proporcionó un directorio privado para la app.');
  const directory = `${base}lulu-sounds/`;
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
}

export async function installBuiltinSound(sound: BuiltinSound) {
  const directory = await soundsDirectory();
  const target = `${directory}builtin-${sound.id}.wav`;
  const info = await FileSystem.getInfoAsync(target);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(target, renderBuiltinSound(sound), {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  return { uri: target, name: sound.name, presetId: sound.id };
}

const DEFAULT_PRESETS: Record<SoundSlot, string> = {
  gift: 'magic-sparkle',
  follow: 'cute-bell',
  like: 'soft-pop',
  share: 'crystal',
  comment: 'soft-pop',
  fanSticker: 'magic-sparkle',
  member: 'cute-bell',
  subscribe: 'celebration',
  goal: 'celebration',
  rank: 'level-up',
};

export async function initializeBuiltinSoundDefaults() {
  const state = useAppStore.getState();
  for (const [slot, presetId] of Object.entries(DEFAULT_PRESETS) as [SoundSlot, string][]) {
    const setting = useAppStore.getState().soundSettings[slot];
    if (setting.uri || setting.name) continue;
    const preset = BUILTIN_SOUNDS.find((item) => item.id === presetId);
    if (!preset) continue;
    const installed = await installBuiltinSound(preset);
    useAppStore.getState().setSound(slot, installed);
  }
}

export async function pickAndPersistSound() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const directory = await soundsDirectory();

  const target = `${directory}${Date.now()}-${safeName(asset.name)}`;
  await FileSystem.copyAsync({ from: asset.uri, to: target });
  return { uri: target, name: asset.name, presetId: undefined };
}
