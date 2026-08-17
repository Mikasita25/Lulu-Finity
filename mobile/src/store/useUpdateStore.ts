import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { checkForMobileUpdate, type MobileUpdate } from '@/services/updates';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 15 * 60 * 1000;

type UpdateState = {
  autoCheckEnabled: boolean;
  lastCheckedAt: number;
  lastAttemptAt: number;
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
      lastAttemptAt: 0,
      loading: false,
      error: '',
      setAutoCheckEnabled: (autoCheckEnabled) => {
        set({ autoCheckEnabled });
        if (autoCheckEnabled) void get().check(true);
      },
      dismissVersion: (dismissedVersion) => set({ dismissedVersion }),
      check: async (force = false) => {
        const state = get();
        if (state.loading) return state.update;
        if (!force && !state.autoCheckEnabled) return state.update;

        const now = Date.now();
        const checkedRecently = now - state.lastCheckedAt < CHECK_INTERVAL_MS;
        const failedRecently = Boolean(state.error) && now - state.lastAttemptAt < FAILURE_RETRY_MS;
        if (!force && (checkedRecently || failedRecently)) return state.update;

        set({ loading: true, error: '', lastAttemptAt: now });
        try {
          const update = await checkForMobileUpdate();
          const checkedAt = Date.now();
          set({
            update,
            lastCheckedAt: checkedAt,
            lastAttemptAt: checkedAt,
            loading: false,
            error: '',
            dismissedVersion:
              update.available && get().dismissedVersion === update.latestVersion
                ? get().dismissedVersion
                : undefined,
          });
          return update;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // Un fallo temporal de red/GitHub no cuenta como una revisión exitosa.
          // Se puede reintentar automáticamente después de 15 minutos, no 24 horas.
          set({ loading: false, error: message, lastAttemptAt: Date.now() });
          return undefined;
        }
      },
    }),
    {
      name: 'lulu-finity-mobile-updates-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        autoCheckEnabled: state.autoCheckEnabled,
        lastCheckedAt: state.lastCheckedAt,
        lastAttemptAt: state.lastAttemptAt,
        dismissedVersion: state.dismissedVersion,
        update: state.update,
      }),
    },
  ),
);
