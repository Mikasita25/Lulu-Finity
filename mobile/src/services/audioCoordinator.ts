type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
let ttsActive = false;

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
