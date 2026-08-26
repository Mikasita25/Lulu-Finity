import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import { useFloatingPanelStore } from '@/store/useFloatingPanelStore';
import { useMobileControlStore } from '@/store/useMobileControlStore';
import type { LiveEvent } from '@/types/live';
import {
  addFloatingPanelActionListener,
  canDrawFloatingPanel,
  startFloatingPanel,
  stopFloatingPanel,
  updateFloatingPanel,
} from '@/services/floatingPanel';

function clip(value: string, max = 118) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function eventUser(event: LiveEvent) {
  return clip(event.nickname || event.uniqueId || 'Usuario', 34);
}

function formatEvent(event: LiveEvent) {
  const user = eventUser(event);
  if (event.type === 'comment') return clip(`${user}: ${event.comment || ''}`);
  if (event.type === 'gift') {
    const count = Math.max(1, event.repeatCount ?? 1);
    return clip(`🎁 ${user} · ${event.giftName || 'regalo'}${count > 1 ? ` ×${count}` : ''}`);
  }
  if (event.type === 'like') return `♥ ${user} · +${Math.max(1, event.count ?? 1)} likes`;
  if (event.type === 'follow') return `＋ ${user} te siguió`;
  if (event.type === 'share') return `↗ ${user} compartió el LIVE`;
  if (event.type === 'subscribe') return `★ ${user} se suscribió`;
  if (event.type === 'fanSticker') return clip(`✦ ${user} · ${event.fanStickerName || 'sticker'}`);
  return `• ${user} entró al LIVE`;
}

export function FloatingPanelBridge() {
  const enabled = useFloatingPanelStore((state) => state.enabled);
  const setEnabled = useFloatingPanelStore((state) => state.setEnabled);
  const relayState = useAppStore((state) => state.relayState);
  const username = useAppStore((state) => state.username);
  const stats = useAppStore((state) => state.stats);
  const events = useAppStore((state) => state.events);
  const currentSong = useMobileControlStore((state) => state.currentSong);
  const playbackPaused = useMobileControlStore((state) => state.playbackPaused);
  const queueCount = useMobileControlStore((state) => state.songQueue.length);

  useEffect(() => {
    const subscription = addFloatingPanelActionListener(({ action }) => {
      const music = useMobileControlStore.getState();
      if (action === 'togglePause') {
        music.setPlaybackPaused(!music.playbackPaused);
      } else if (action === 'skip') {
        music.skipCurrentSong();
      } else if (action === 'close') {
        setEnabled(false);
      }
    });
    return () => subscription.remove();
  }, [setEnabled]);

  useEffect(() => {
    if (!enabled) {
      try {
        stopFloatingPanel();
      } catch {}
      return;
    }

    const ensureStarted = () => {
      try {
        if (canDrawFloatingPanel()) startFloatingPanel();
      } catch (error) {
        console.warn('[LuluFinity] floating panel could not start', error);
      }
    };

    ensureStarted();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') ensureStarted();
    });
    return () => subscription.remove();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (!canDrawFloatingPanel()) return;
      const recent = events.slice(0, 4);
      updateFloatingPanel(
        JSON.stringify({
          relayState,
          username,
          stats: {
            viewers: stats.viewers,
            likes: stats.likes,
            followers: stats.followers,
            gifts: stats.gifts,
          },
          events: recent.map(formatEvent),
          activityKey: recent[0] ? `${recent[0].id}:${recent[0].timestamp}` : '',
          song: currentSong?.query ?? '',
          paused: playbackPaused,
          queueCount,
        }),
      );
    } catch (error) {
      console.warn('[LuluFinity] floating panel update failed', error);
    }
  }, [currentSong?.id, currentSong?.query, enabled, events, playbackPaused, queueCount, relayState, stats, username]);

  return null;
}
