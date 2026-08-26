type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
let ttsActive = false;

export function setTtsPlaybackActive(active: boolean) {
  if (ttsActive === active) return;
  ttsActive = active;
  for (const listener of listeners) listener(ttsActive);
}

export function getTtsPlaybackActive() {
  return ttsActive;
}

export function subscribeTtsActivity(listener: Listener) {
  listeners.add(listener);
  listener(ttsActive);
  return () => {
    listeners.delete(listener);
  };
}

// Alias mantenido para no romper consumidores antiguos mientras migramos a la
// semántica correcta: este callback informa si el TTS está hablando; ya no es una
// orden para pausar música.
export const subscribeTtsPlayback = subscribeTtsActivity;

export function duckMusicVolume(volume: number, active = ttsActive) {
  const base = Math.max(0, Math.min(1, volume));
  if (!active) return base;
  // La canción sigue sonando, pero a ~22 % de su nivel mientras habla Microsoft.
  // Es suficiente para conservar ambiente sin tapar el comentario.
  return Math.max(0, Math.min(base, base * 0.22));
}
