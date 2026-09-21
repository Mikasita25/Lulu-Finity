import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { defaultMicrosoftVoice, normalizeMicrosoftVoice } from '@/services/microsoftVoices';

export type TtsSettings = {
  enabled: boolean;
  readComments: boolean;
  readGifts: boolean;
  readWelcomes: boolean;
  announceUsername: boolean;
  skipCommands: boolean;
  language: string;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  maxChars: number;
  queueLimit: number;
  maxPendingAgeSeconds: number;
  giftVoice: string;
  giftVolume: number;
  giftTemplate: string;
  welcomeVoice: string;
  welcomeVolume: number;
  welcomeTemplate: string;
};

type TtsState = TtsSettings & {
  updateTts: (patch: Partial<TtsSettings>) => void;
  resetTts: () => void;
};

const defaults: TtsSettings = {
  enabled: true,
  readComments: true,
  readGifts: false,
  readWelcomes: false,
  announceUsername: true,
  skipCommands: true,
  language: 'es-MX',
  voice: defaultMicrosoftVoice('es-MX'),
  rate: 1,
  pitch: 1,
  volume: 1,
  maxChars: 180,
  queueLimit: 5,
  maxPendingAgeSeconds: 10,
  giftVoice: defaultMicrosoftVoice('es-MX'),
  giftVolume: 1,
  giftTemplate: 'Gracias {name} por enviar {gift} {count} veces',
  welcomeVoice: defaultMicrosoftVoice('es-MX'),
  welcomeVolume: 0.9,
  welcomeTemplate: 'Bienvenida {name}',
};

export const useTtsStore = create<TtsState>()(
  persist(
    (set) => ({
      ...defaults,
      updateTts: (patch) => {
        const sanitized = { ...patch };
        if (patch.queueLimit !== undefined) {
          sanitized.queueLimit = Math.max(1, Math.min(10, Math.round(patch.queueLimit)));
        }
        if (patch.maxPendingAgeSeconds !== undefined) {
          sanitized.maxPendingAgeSeconds = Math.max(
            3,
            Math.min(30, Math.round(patch.maxPendingAgeSeconds)),
          );
        }
        if (patch.giftVolume !== undefined) {
          sanitized.giftVolume = Math.max(0, Math.min(1, patch.giftVolume));
        }
        if (patch.welcomeVolume !== undefined) {
          sanitized.welcomeVolume = Math.max(0, Math.min(1, patch.welcomeVolume));
        }
        set(sanitized);
      },
      resetTts: () => set(defaults),
    }),
    {
      name: 'lulu-finity-mobile-tts-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        enabled: state.enabled,
        readComments: state.readComments,
        readGifts: state.readGifts,
        readWelcomes: state.readWelcomes,
        announceUsername: state.announceUsername,
        skipCommands: state.skipCommands,
        language: state.language,
        voice: state.voice,
        rate: state.rate,
        pitch: state.pitch,
        volume: state.volume,
        maxChars: state.maxChars,
        queueLimit: state.queueLimit,
        maxPendingAgeSeconds: state.maxPendingAgeSeconds,
        giftVoice: state.giftVoice,
        giftVolume: state.giftVolume,
        giftTemplate: state.giftTemplate,
        welcomeVoice: state.welcomeVoice,
        welcomeVolume: state.welcomeVolume,
        welcomeTemplate: state.welcomeTemplate,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<TtsSettings>;
        const language = saved.language || current.language;
        return {
          ...current,
          ...saved,
          language,
          voice: normalizeMicrosoftVoice(saved.voice, language),
          giftVoice: normalizeMicrosoftVoice(saved.giftVoice, language),
          welcomeVoice: normalizeMicrosoftVoice(saved.welcomeVoice, language),
        };
      },
    },
  ),
);
