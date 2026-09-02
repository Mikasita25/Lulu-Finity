type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
const soundEffectListeners = new Set<Listener>();
let ttsActive = false;
let activeSoundEffects = 0;

export function setTtsPlaybackActive(active: boolean) {
  if (ttsActive === active) return;
  ttsActive = active;
  for (const listener of listeners) listener(active);
}

export function getTtsPlaybackActive() {
  return ttsActive;
}

export function subscribeTtsPlayback(listener: Listener) {
  listeners.add(listener);
  listener(ttsActive);
  return () => {
    listeners.delete(listener);
  };
}

export function setSoundEffectPlaybackActive(active: boolean) {
  activeSoundEffects = Math.max(0, activeSoundEffects + (active ? 1 : -1));
  const isActive = activeSoundEffects > 0;
  for (const listener of soundEffectListeners) listener(isActive);
}

export function subscribeSoundEffectPlayback(listener: Listener) {
  soundEffectListeners.add(listener);
  listener(activeSoundEffects > 0);
  return () => {
    soundEffectListeners.delete(listener);
  };
}
