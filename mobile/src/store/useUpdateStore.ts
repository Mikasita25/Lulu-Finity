import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { checkForMobileUpdate, type MobileUpdate } from '@/services/updates';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

type UpdateState = {
  autoCheckEnabled: boolean;
  lastCheckedAt: number;
  dismissedVersion?: string;
  loading: boolean;
  error: string;
  update?: MobileUpdate;
  setAutoCheckEnabled: (enabled: boolean) => void;
  dismissVersion: (version?: string) => void;
  check: (force?: boolean) => Promise<MobileUpdate | undefined>;
};

export const useUpdateStore = create<UpdateState>()(
  persist(
    (set, get) => ({
      autoCheckEnabled: true,
      lastCheckedAt: 0,
      loading: false,
      error: '',
      setAutoCheckEnabled: (autoCheckEnabled) => set({ autoCheckEnabled }),
      dismissVersion: (dismissedVersion) => set({ dismissedVersion }),
      check: async (force = false) => {
        const state = get();
        if (state.loading) return state.update;
        if (!force && (!state.autoCheckEnabled || Date.now() - state.lastCheckedAt < CHECK_INTERVAL_MS)) {
          return state.update;
        }
        set({ loading: true, error: '' });
        try {
          const update = await checkForMobileUpdate();
          set({ update, lastCheckedAt: Date.now(), loading: false, error: '' });
          return update;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          set({ loading: false, error: message, lastCheckedAt: Date.now() });
          return undefined;
        }
      },
    }),
    {
      name: 'lulu-finity-mobile-updates-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        autoCheckEnabled: state.autoCheckEnabled,
        lastCheckedAt: state.lastCheckedAt,
        dismissedVersion: state.dismissedVersion,
      }),
    },
  ),
);
