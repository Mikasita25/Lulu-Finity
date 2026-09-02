import { createAudioPlayer } from 'expo-audio';
import { useAppStore } from '@/store/useAppStore';
import type { SoundSetting } from '@/types/live';
import { setSoundEffectPlaybackActive } from './audioCoordinator';

const activePlayers = new Set<any>();

function releasePlayer(player: any) {
  if (!activePlayers.delete(player)) return;
  try {
    player.release();
  } catch {}
  setSoundEffectPlaybackActive(false);
}

export async function playSound(setting: SoundSetting) {
  if (!setting.enabled || !setting.uri) return;
  const mix = useAppStore.getState().soundMix;
  if (!mix.allowOverlap) {
    for (const active of [...activePlayers]) {
      try {
        active.pause();
      } catch {}
      releasePlayer(active);
    }
  }

  const player = createAudioPlayer(setting.uri);
  try {
    player.volume = Math.max(0, Math.min(1, setting.volume * mix.masterVolume));
    activePlayers.add(player);
    setSoundEffectPlaybackActive(true);
    const subscription = (player as any).addListener?.('playbackStatusUpdate', (status: any) => {
      if (status?.didJustFinish || (status?.isLoaded && status?.duration > 0 && status?.currentTime >= status?.duration)) {
        subscription?.remove?.();
        releasePlayer(player);
      }
    });
    player.play();
    setTimeout(() => {
      subscription?.remove?.();
      releasePlayer(player);
    }, 15_000);
  } catch {
    releasePlayer(player);
  }
}
