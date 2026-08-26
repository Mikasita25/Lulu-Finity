type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
let ttsActive = false;

// Música y TTS comparten la sesión de audio de Lulú. El TTS sigue exponiendo su
// estado real para diagnóstico, pero ya no pide al reproductor musical que se
// pause mientras habla. Esto también evita apagar temporalmente el foreground
// MediaSession que mantiene la música viva cuando Android manda la app al fondo.
const MIX_TTS_WITH_MUSIC = true;

function musicPauseState() {
  return MIX_TTS_WITH_MUSIC ? false : ttsActive;
}

export function setTtsPlaybackActive(active: boolean) {
  if (ttsActive === active) return;
  ttsActive = active;
  const pauseMusic = musicPauseState();
  for (const listener of listeners) listener(pauseMusic);
}

export function getTtsPlaybackActive() {
  return ttsActive;
}

export function subscribeTtsPlayback(listener: Listener) {
  listeners.add(listener);
  listener(musicPauseState());
  return () => {
    listeners.delete(listener);
  };
}
