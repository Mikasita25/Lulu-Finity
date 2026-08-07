import { createAudioPlayer } from 'expo-audio';
import type { SoundSetting } from '@/types/live';

export async function playSound(setting: SoundSetting) {
  if (!setting.enabled || !setting.uri) return;
  const player = createAudioPlayer(setting.uri);
  try {
    player.volume = Math.max(0, Math.min(1, setting.volume));
    player.play();
    // Los clips de alertas deberían ser cortos. Liberamos el reproductor después
    // de un margen amplio para evitar mantener recursos nativos sin necesidad.
    setTimeout(() => {
      try {
        player.release();
      } catch {}
    }, 12_000);
  } catch {
    try {
      player.release();
    } catch {}
  }
}
