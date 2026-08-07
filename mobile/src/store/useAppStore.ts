import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  AccentTheme,
  AppMode,
  Goal,
  LeaderboardEntry,
  LiveEvent,
  LiveStats,
  RelayState,
  SoundSettings,
} from '@/types/live';

const emptyStats: LiveStats = {
  viewers: 0,
  likes: 0,
  gifts: 0,
  diamonds: 0,
  followers: 0,
  shares: 0,
  comments: 0,
};

const defaultSounds: SoundSettings = {
  gift: { enabled: true, volume: 0.9 },
  follow: { enabled: false, volume: 0.75 },
  like: { enabled: false, volume: 0.45 },
  share: { enabled: false, volume: 0.7 },
  comment: { enabled: false, volume: 0.5 },
  member: { enabled: false, volume: 0.6 },
  subscribe: { enabled: true, volume: 0.9 },
  goal: { enabled: true, volume: 1 },
  rank: { enabled: false, volume: 0.8 },
};

type AppState = {
  hydrated: boolean;
  onboardingDone: boolean;
  username: string;
  displayName: string;
  mode: AppMode;
  relayState: RelayState;
  relayMessage: string;
  stats: LiveStats;
  events: LiveEvent[];
  leaderboard: Record<string, LeaderboardEntry>;
  goals: Goal[];
  accentTheme: AccentTheme;
  darkMode: boolean;
  hapticsEnabled: boolean;
  headsUpNotifications: boolean;
  soundSettings: SoundSettings;
  lastGoalCompletion?: { id: string; at: number };
  rankingRgb: boolean;
  rankingTextColor: string;
  rankingFont: 'default' | 'rounded' | 'mono';

  setHydrated: (value: boolean) => void;
  finishOnboarding: () => void;
  setIdentity: (username: string, displayName?: string) => void;
  setMode: (mode: AppMode) => void;
  setRelay: (state: RelayState, message?: string) => void;
  resetSession: () => void;
  setViewerCount: (viewers: number) => void;
  setTotalLikes: (likes: number) => void;
  ingestEvent: (event: LiveEvent) => void;
  clearHistory: () => void;
  addGoal: (goal: Omit<Goal, 'id' | 'startValue'>) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  resetGoal: (id: string) => void;
  setAccentTheme: (theme: AccentTheme) => void;
  setDarkMode: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setHeadsUpNotifications: (enabled: boolean) => void;
  setSound: (slot: keyof SoundSettings, patch: Partial<SoundSettings[keyof SoundSettings]>) => void;
  setRankingRgb: (enabled: boolean) => void;
  setRankingTextColor: (color: string) => void;
  setRankingFont: (font: 'default' | 'rounded' | 'mono') => void;
};

function currentForGoal(goal: Goal, stats: LiveStats) {
  const value =
    goal.kind === 'likes'
      ? stats.likes
      : goal.kind === 'diamonds'
        ? stats.diamonds
        : goal.kind === 'gifts'
          ? stats.gifts
          : goal.kind === 'followers'
            ? stats.followers
            : goal.kind === 'shares'
              ? stats.shares
              : stats.viewers;
  return Math.max(0, value - goal.startValue);
}

function bumpLeaderboard(
  current: Record<string, LeaderboardEntry>,
  event: LiveEvent,
): Record<string, LeaderboardEntry> {
  if (!event.uniqueId) return current;
  const key = event.uniqueId.toLowerCase();
  const old = current[key] ?? {
    uniqueId: event.uniqueId,
    nickname: event.nickname || event.uniqueId,
    profilePictureUrl: event.profilePictureUrl,
    gifts: 0,
    diamonds: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    follows: 0,
    members: 0,
    subscribes: 0,
    score: 0,
    updatedAt: event.timestamp,
  };

  const next: LeaderboardEntry = {
    ...old,
    nickname: event.nickname || old.nickname,
    profilePictureUrl: event.profilePictureUrl || old.profilePictureUrl,
    gifts: old.gifts + (event.type === 'gift' ? Math.max(1, event.repeatCount ?? 1) : 0),
    diamonds: old.diamonds + (event.type === 'gift' ? Math.max(0, event.diamonds ?? 0) : 0),
    likes: old.likes + (event.type === 'like' ? Math.max(1, event.count ?? 1) : 0),
    comments: old.comments + (event.type === 'comment' ? 1 : 0),
    shares: old.shares + (event.type === 'share' ? 1 : 0),
    follows: old.follows + (event.type === 'follow' ? 1 : 0),
    members: old.members + (event.type === 'member' ? 1 : 0),
    subscribes: old.subscribes + (event.type === 'subscribe' ? 1 : 0),
    updatedAt: event.timestamp,
    score: 0,
  };
  next.score =
    next.diamonds * 10 +
    next.gifts * 25 +
    next.likes * 0.08 +
    next.comments * 5 +
    next.shares * 12 +
    next.follows * 18 +
    next.members * 4 +
    next.subscribes * 80;

  return { ...current, [key]: next };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      onboardingDone: false,
      username: '',
      displayName: '',
      mode: 'streamer',
      relayState: 'idle',
      relayMessage: '',
      stats: emptyStats,
      events: [],
      leaderboard: {},
      goals: [],
      accentTheme: 'lulu',
      darkMode: true,
      hapticsEnabled: true,
      headsUpNotifications: true,
      soundSettings: defaultSounds,
      rankingRgb: false,
      rankingTextColor: '#FFF7FC',
      rankingFont: 'default',

      setHydrated: (value) => set({ hydrated: value }),
      finishOnboarding: () => set({ onboardingDone: true }),
      setIdentity: (username, displayName = '') =>
        set({
          username: username.trim().replace(/^@/, ''),
          displayName: displayName.trim(),
        }),
      setMode: (mode) => set({ mode }),
      setRelay: (relayState, relayMessage = '') => set({ relayState, relayMessage }),
      resetSession: () =>
        set((state) => ({
          stats: { ...emptyStats },
          leaderboard: {},
          lastGoalCompletion: undefined,
          goals: state.goals.map((goal) => ({
            ...goal,
            startValue: 0,
            completedAt: undefined,
          })),
        })),
      setViewerCount: (viewers) =>
        set((state) => ({ stats: { ...state.stats, viewers: Math.max(0, Math.round(viewers)) } })),
      setTotalLikes: (likes) =>
        set((state) => ({ stats: { ...state.stats, likes: Math.max(state.stats.likes, Math.round(likes)) } })),

      ingestEvent: (event) => {
        const before = get();
        const nextStats = { ...before.stats };
        if (event.type === 'gift') {
          nextStats.gifts += Math.max(1, event.repeatCount ?? 1);
          nextStats.diamonds += Math.max(0, event.diamonds ?? 0);
        } else if (event.type === 'like') {
          const delta = Math.max(1, event.count ?? 1);
          nextStats.likes = event.total ? Math.max(nextStats.likes, event.total) : nextStats.likes + delta;
        } else if (event.type === 'follow') {
          nextStats.followers += 1;
        } else if (event.type === 'share') {
          nextStats.shares += 1;
        } else if (event.type === 'comment') {
          nextStats.comments += 1;
        } else if (event.type === 'member' && event.memberCount) {
          nextStats.viewers = Math.max(0, event.memberCount);
        }

        let completion: AppState['lastGoalCompletion'];
        const nextGoals = before.goals.map((goal) => {
          if (!goal.enabled || goal.completedAt) return goal;
          if (currentForGoal(goal, nextStats) >= goal.target) {
            completion = { id: goal.id, at: Date.now() };
            return { ...goal, completedAt: Date.now() };
          }
          return goal;
        });

        set({
          stats: nextStats,
          events: [event, ...before.events].slice(0, 500),
          leaderboard: bumpLeaderboard(before.leaderboard, event),
          goals: nextGoals,
          lastGoalCompletion: completion ?? before.lastGoalCompletion,
        });
      },

      clearHistory: () => set({ events: [] }),
      addGoal: (goal) =>
        set((state) => {
          const base =
            goal.kind === 'likes'
              ? state.stats.likes
              : goal.kind === 'diamonds'
                ? state.stats.diamonds
                : goal.kind === 'gifts'
                  ? state.stats.gifts
                  : goal.kind === 'followers'
                    ? state.stats.followers
                    : goal.kind === 'shares'
                      ? state.stats.shares
                      : state.stats.viewers;
          return {
            goals: [
              ...state.goals,
              {
                ...goal,
                id: `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                startValue: base,
              },
            ],
          };
        }),
      updateGoal: (id, patch) =>
        set((state) => ({
          goals: state.goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)),
        })),
      removeGoal: (id) =>
        set((state) => ({ goals: state.goals.filter((goal) => goal.id !== id) })),
      resetGoal: (id) =>
        set((state) => ({
          goals: state.goals.map((goal) => {
            if (goal.id !== id) return goal;
            const startValue =
              goal.kind === 'likes'
                ? state.stats.likes
                : goal.kind === 'diamonds'
                  ? state.stats.diamonds
                  : goal.kind === 'gifts'
                    ? state.stats.gifts
                    : goal.kind === 'followers'
                      ? state.stats.followers
                      : goal.kind === 'shares'
                        ? state.stats.shares
                        : state.stats.viewers;
            return { ...goal, startValue, completedAt: undefined };
          }),
        })),
      setAccentTheme: (accentTheme) => set({ accentTheme }),
      setDarkMode: (darkMode) => set({ darkMode }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setHeadsUpNotifications: (headsUpNotifications) => set({ headsUpNotifications }),
      setSound: (slot, patch) =>
        set((state) => ({
          soundSettings: {
            ...state.soundSettings,
            [slot]: { ...(state.soundSettings[slot] ?? defaultSounds[slot]), ...patch },
          },
        })),
      setRankingRgb: (rankingRgb) => set({ rankingRgb }),
      setRankingTextColor: (rankingTextColor) => set({ rankingTextColor }),
      setRankingFont: (rankingFont) => set({ rankingFont }),
    }),
    {
      name: 'lulu-finity-mobile-v1',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...saved,
          soundSettings: { ...defaultSounds, ...(saved.soundSettings ?? {}) },
        };
      },
      partialize: (state) => ({
        onboardingDone: state.onboardingDone,
        username: state.username,
        displayName: state.displayName,
        mode: state.mode,
        events: state.events,
        goals: state.goals,
        accentTheme: state.accentTheme,
        darkMode: state.darkMode,
        hapticsEnabled: state.hapticsEnabled,
        headsUpNotifications: state.headsUpNotifications,
        soundSettings: state.soundSettings,
        rankingRgb: state.rankingRgb,
        rankingTextColor: state.rankingTextColor,
        rankingFont: state.rankingFont,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export const getGoalProgress = (goal: Goal, stats: LiveStats) => {
  const current = currentForGoal(goal, stats);
  return {
    current,
    ratio: goal.target > 0 ? Math.min(1, current / goal.target) : 0,
  };
};
