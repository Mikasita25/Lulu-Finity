import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  MOBILE_UPDATES_ENABLED,
  checkForMobileUpdate,
  currentMobileBuild,
  currentMobileVersion,
  type MobileUpdate,
} from '@/services/updates';

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
      autoCheckEnabled: MOBILE_UPDATES_ENABLED,
      lastCheckedAt: 0,
      lastAttemptAt: 0,
      loading: false,
      error: '',
      setAutoCheckEnabled: (autoCheckEnabled) => {
        if (!MOBILE_UPDATES_ENABLED) {
          set({ autoCheckEnabled: false, update: undefined, loading: false, error: '' });
          return;
        }
        set({ autoCheckEnabled });
        if (autoCheckEnabled) void get().check(true);
      },
      dismissVersion: (dismissedVersion) => set({ dismissedVersion }),
      check: async (force = false) => {
        if (!MOBILE_UPDATES_ENABLED) {
          set({
            autoCheckEnabled: false,
            lastCheckedAt: 0,
            lastAttemptAt: 0,
            dismissedVersion: undefined,
            loading: false,
            error: '',
            update: undefined,
          });
          return undefined;
        }

        let state = get();
        if (state.loading) return state.update;
        if (!force && !state.autoCheckEnabled) return state.update;

        const installedVersion = currentMobileVersion();
        const installedBuild = currentMobileBuild();
        const staleSnapshot = Boolean(
          state.update &&
          (state.update.currentVersion !== installedVersion || state.update.currentBuild !== installedBuild),
        );
        if (staleSnapshot) {
          set({ update: undefined, lastCheckedAt: 0, dismissedVersion: undefined, error: '' });
          state = get();
        }

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
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<UpdateState>;
        return {
          ...current,
          ...saved,
          autoCheckEnabled: MOBILE_UPDATES_ENABLED && Boolean(saved.autoCheckEnabled),
          update: MOBILE_UPDATES_ENABLED ? saved.update : undefined,
          dismissedVersion: MOBILE_UPDATES_ENABLED ? saved.dismissedVersion : undefined,
        };
      },
    },
  ),
);
