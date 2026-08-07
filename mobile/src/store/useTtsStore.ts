import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TtsSettings = {
  enabled: boolean;
  announceUsername: boolean;
  skipCommands: boolean;
  language: string;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  maxChars: number;
};

type TtsState = TtsSettings & {
  updateTts: (patch: Partial<TtsSettings>) => void;
  resetTts: () => void;
};

const defaults: TtsSettings = {
  enabled: true,
  announceUsername: true,
  skipCommands: true,
  language: 'es-MX',
  voice: '',
  rate: 1,
  pitch: 1,
  volume: 1,
  maxChars: 180,
};

export const useTtsStore = create<TtsState>()(
  persist(
    (set) => ({
      ...defaults,
      updateTts: (patch) => set(patch),
      resetTts: () => set(defaults),
    }),
    {
      name: 'lulu-finity-mobile-tts-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        enabled: state.enabled,
        announceUsername: state.announceUsername,
        skipCommands: state.skipCommands,
        language: state.language,
        voice: state.voice,
        rate: state.rate,
        pitch: state.pitch,
        volume: state.volume,
        maxChars: state.maxChars,
      }),
    },
  ),
);
