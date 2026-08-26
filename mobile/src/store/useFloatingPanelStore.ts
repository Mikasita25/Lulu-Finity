import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type FloatingPanelState = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

export const useFloatingPanelStore = create<FloatingPanelState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: 'lulu-finity-floating-panel-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
