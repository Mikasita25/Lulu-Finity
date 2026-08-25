import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LiveEvent, LiveEventType } from '@/types/live';

export type RecentFilterMap = Record<LiveEventType, boolean>;

export type SongRequest = {
  id: string;
  query: string;
  requestedBy: string;
  requestedAt: number;
  source: 'chat' | 'manual';
};

export type EnqueueSongResult =
  | { ok: true; song: SongRequest }
  | { ok: false; reason: 'disabled' | 'empty' | 'queue_full' | 'user_limit' };

export type MusicSettings = {
  enabled: boolean;
  command: string;
  aliases: string[];
  maxQueue: number;
  perUserLimit: number;
  cooldownSeconds: number;
  volume: number;
};

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

type MobileControlState = {
  recentFilters: RecentFilterMap;
  recentMaxItems: number;
  music: MusicSettings;
  songQueue: SongRequest[];
  currentSong?: SongRequest;
  musicPaused: boolean;
  playbackPaused: boolean;
  playbackStatus: PlaybackStatus;
  playbackMessage: string;

  setRecentFilter: (type: LiveEventType, enabled: boolean) => void;
  setAllRecentFilters: (enabled: boolean) => void;
  setRecentMaxItems: (value: number) => void;
  updateMusic: (patch: Partial<MusicSettings>) => void;
  enqueueSong: (query: string, requestedBy: string, source?: SongRequest['source']) => EnqueueSongResult;
  playSong: (song: SongRequest) => void;
  playNextSong: () => SongRequest | undefined;
  skipCurrentSong: () => SongRequest | undefined;
  removeSong: (id: string) => void;
  clearSongQueue: () => void;
  setMusicPaused: (paused: boolean) => void;
  setPlaybackPaused: (paused: boolean) => void;
  setPlaybackStatus: (status: PlaybackStatus, message?: string) => void;
  retryCurrentSong: () => void;
};

const defaultRecentFilters: RecentFilterMap = {
  gift: true,
  comment: true,
  fanSticker: true,
  like: false,
  follow: true,
  share: true,
  member: false,
  subscribe: true,
};

const defaultMusic: MusicSettings = {
  enabled: true,
  command: '!cancion',
  aliases: ['!song', '!sr'],
  maxQueue: 30,
  perUserLimit: 3,
  cooldownSeconds: 20,
  volume: 0.75,
};

function normalizeCommand(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '!cancion';
  return trimmed.startsWith('!') ? trimmed : `!${trimmed}`;
}

export const useMobileControlStore = create<MobileControlState>()(
  persist(
    (set, get) => ({
      recentFilters: defaultRecentFilters,
      recentMaxItems: 25,
      music: defaultMusic,
      songQueue: [],
      currentSong: undefined,
      musicPaused: false,
      playbackPaused: false,
      playbackStatus: 'idle',
      playbackMessage: 'Agrega una canción para comenzar.',

      setRecentFilter: (type, enabled) =>
        set((state) => ({ recentFilters: { ...state.recentFilters, [type]: enabled } })),
      setAllRecentFilters: (enabled) =>
        set({
          recentFilters: {
            gift: enabled,
            comment: enabled,
            fanSticker: enabled,
            like: enabled,
            follow: enabled,
            share: enabled,
            member: enabled,
            subscribe: enabled,
          },
        }),
      setRecentMaxItems: (value) => set({ recentMaxItems: Math.max(5, Math.min(100, Math.round(value))) }),
      updateMusic: (patch) =>
        set((state) => ({
          music: {
            ...state.music,
            ...patch,
            command: patch.command === undefined ? state.music.command : normalizeCommand(patch.command),
            maxQueue:
              patch.maxQueue === undefined
                ? state.music.maxQueue
                : Math.max(5, Math.min(100, Math.round(patch.maxQueue))),
            perUserLimit:
              patch.perUserLimit === undefined
                ? state.music.perUserLimit
                : Math.max(1, Math.min(10, Math.round(patch.perUserLimit))),
            cooldownSeconds:
              patch.cooldownSeconds === undefined
                ? state.music.cooldownSeconds
                : Math.max(0, Math.min(300, Math.round(patch.cooldownSeconds))),
            volume:
              patch.volume === undefined ? state.music.volume : Math.max(0, Math.min(1, patch.volume)),
          },
        })),
      enqueueSong: (rawQuery, requestedBy, source = 'chat') => {
        const state = get();
        if (!state.music.enabled && source === 'chat') return { ok: false, reason: 'disabled' };
        const query = rawQuery.trim().replace(/\s+/g, ' ');
        if (!query) return { ok: false, reason: 'empty' };
        if (state.songQueue.length >= state.music.maxQueue) return { ok: false, reason: 'queue_full' };
        const normalizedUser = requestedBy.trim().replace(/^@/, '').toLowerCase() || 'manual';
        const activeForUser = state.songQueue.filter(
          (song) => song.requestedBy.toLowerCase() === normalizedUser,
        ).length + (state.currentSong?.requestedBy.toLowerCase() === normalizedUser ? 1 : 0);
        if (source === 'chat' && activeForUser >= state.music.perUserLimit) {
          return { ok: false, reason: 'user_limit' };
        }
        const song: SongRequest = {
          id: `song-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          query: query.slice(0, 180),
          requestedBy: normalizedUser,
          requestedAt: Date.now(),
          source,
        };
        set((current) => ({ songQueue: [...current.songQueue, song] }));
        return { ok: true, song };
      },
      playSong: (song) =>
        set((state) => ({
          currentSong: song,
          songQueue: state.songQueue.filter((item) => item.id !== song.id),
          musicPaused: false,
          playbackPaused: false,
          playbackStatus: 'loading',
          playbackMessage: 'Buscando la canción…',
        })),
      playNextSong: () => {
        const state = get();
        const next = state.songQueue[0];
        if (!next) {
          set({ currentSong: undefined, musicPaused: false, playbackPaused: false, playbackStatus: 'idle', playbackMessage: 'La cola terminó.' });
          return undefined;
        }
        set({
          currentSong: next,
          songQueue: state.songQueue.slice(1),
          musicPaused: false,
          playbackPaused: false,
          playbackStatus: 'loading',
          playbackMessage: 'Buscando la canción…',
        });
        return next;
      },
      skipCurrentSong: () => {
        const state = get();
        const next = state.songQueue[0];
        set({
          currentSong: next,
          songQueue: next ? state.songQueue.slice(1) : [],
          musicPaused: false,
          playbackPaused: false,
          playbackStatus: next ? 'loading' : 'idle',
          playbackMessage: next ? 'Buscando la canción…' : 'La cola terminó.',
        });
        return next;
      },
      removeSong: (id) => set((state) => ({ songQueue: state.songQueue.filter((song) => song.id !== id) })),
      clearSongQueue: () => set({ songQueue: [] }),
      setMusicPaused: (musicPaused) => set({ musicPaused }),
      setPlaybackPaused: (playbackPaused) => set({
        playbackPaused,
        playbackStatus: playbackPaused ? 'paused' : get().currentSong ? 'loading' : 'idle',
        playbackMessage: playbackPaused ? 'Música en pausa.' : get().currentSong ? 'Reanudando…' : 'Agrega una canción para comenzar.',
      }),
      setPlaybackStatus: (playbackStatus, playbackMessage) => set({
        playbackStatus,
        playbackMessage: playbackMessage ?? get().playbackMessage,
      }),
      retryCurrentSong: () => set((state) => state.currentSong ? ({
        currentSong: { ...state.currentSong, id: `${state.currentSong.id}-retry-${Date.now()}` },
        playbackPaused: false,
        playbackStatus: 'loading',
        playbackMessage: 'Volviendo a cargar la canción…',
      }) : state),
    }),
    {
      name: 'lulu-finity-mobile-controls-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recentFilters: state.recentFilters,
        recentMaxItems: state.recentMaxItems,
        music: state.music,
        songQueue: state.songQueue,
        currentSong: state.currentSong,
        musicPaused: state.musicPaused,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<MobileControlState>;
        return {
          ...current,
          ...saved,
          recentFilters: { ...defaultRecentFilters, ...(saved.recentFilters ?? {}) },
          music: { ...defaultMusic, ...(saved.music ?? {}) },
          songQueue: Array.isArray(saved.songQueue) ? saved.songQueue : [],
          playbackPaused: false,
          playbackStatus: saved.currentSong ? 'loading' : 'idle',
          playbackMessage: saved.currentSong ? 'Recuperando la canción…' : 'Agrega una canción para comenzar.',
        };
      },
    },
  ),
);

export function filterRecentEvents(
  events: LiveEvent[],
  filters: RecentFilterMap,
  maxItems: number,
) {
  return events.filter((event) => filters[event.type] !== false).slice(0, maxItems);
}
