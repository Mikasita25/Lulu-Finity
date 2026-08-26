import assert from 'node:assert/strict';
import {
  duckMusicVolume,
  getTtsPlaybackActive,
  setTtsPlaybackActive,
  subscribeTtsActivity,
} from '../src/services/audioCoordinator.ts';

const ttsStates = [];
const unsubscribe = subscribeTtsActivity((active) => ttsStates.push(active));
const baseVolume = 0.75;

assert.equal(getTtsPlaybackActive(), false, 'TTS debe iniciar inactivo');
assert.deepEqual(ttsStates, [false], 'El coordinador debe publicar el estado inicial del TTS');
assert.equal(duckMusicVolume(baseVolume, false), baseVolume, 'Sin TTS la música conserva su volumen configurado');

setTtsPlaybackActive(true);
assert.equal(getTtsPlaybackActive(), true, 'El coordinador debe conservar el estado real del TTS');
assert.equal(ttsStates.at(-1), true, 'Los consumidores deben saber cuándo Microsoft está hablando');
assert.equal(
  duckMusicVolume(baseVolume),
  baseVolume * 0.22,
  'Mientras habla el TTS la música debe seguir activa pero con ducking al 22 %',
);
assert.ok(
  duckMusicVolume(baseVolume) > 0,
  'El ducking no debe equivaler a pausar o silenciar por completo la música',
);

setTtsPlaybackActive(false);
assert.equal(getTtsPlaybackActive(), false, 'El estado del TTS debe volver a inactivo');
assert.equal(ttsStates.at(-1), false, 'Los consumidores deben recibir el fin de la voz');
assert.equal(
  duckMusicVolume(baseVolume),
  baseVolume,
  'Al terminar el TTS la música debe recuperar automáticamente su volumen original',
);

unsubscribe();
console.log('audio-session: TTS aplica ducking sin pausar la música');
