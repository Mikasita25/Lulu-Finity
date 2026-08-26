import assert from 'node:assert/strict';
import {
  getTtsPlaybackActive,
  setTtsPlaybackActive,
  subscribeTtsPlayback,
} from '../src/services/audioCoordinator.ts';

const musicPauseStates = [];
const unsubscribe = subscribeTtsPlayback((active) => musicPauseStates.push(active));

assert.equal(getTtsPlaybackActive(), false, 'TTS debe iniciar inactivo');
assert.deepEqual(musicPauseStates, [false], 'La música debe iniciar sin pausa');

setTtsPlaybackActive(true);
assert.equal(getTtsPlaybackActive(), true, 'El coordinador debe conservar el estado real del TTS');
assert.equal(
  musicPauseStates.at(-1),
  false,
  'Al comenzar el TTS la música debe seguir reproduciéndose en la misma sesión',
);

setTtsPlaybackActive(false);
assert.equal(getTtsPlaybackActive(), false, 'El estado del TTS debe volver a inactivo');
assert.equal(
  musicPauseStates.at(-1),
  false,
  'Al terminar el TTS la música no debe necesitar una reanudación porque nunca se pausó',
);

assert.equal(
  musicPauseStates.some(Boolean),
  false,
  'Ningún cambio de TTS debe solicitar que MusicPlaybackHost pause YouTube o la MediaSession',
);

unsubscribe();
console.log('audio-session: TTS y música permanecen simultáneos');
