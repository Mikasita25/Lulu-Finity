'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { musicRecoveryDelay, shouldRecoverPlayback } = require('./music-recovery-policy');

test('respeta una pausa manual con el reproductor visible', () => {
  assert.equal(shouldRecoverPlayback({ expectedPlaying:false, userPaused:true, visible:true, lastProgressAt:1 }, 20000), false);
  assert.equal(shouldRecoverPlayback({ expectedPlaying:true, userPaused:false, visible:false, adActive:true, lastProgressAt:1 }, 20000), false);
});

test('recupera reproducción oculta sin progreso o con proceso destruido', () => {
  assert.equal(shouldRecoverPlayback({ expectedPlaying:true, userPaused:false, visible:false, lastProgressAt:1000 }, 14001), true);
  assert.equal(shouldRecoverPlayback({ expectedPlaying:true, userPaused:false, visible:false, destroyed:true, lastProgressAt:14000 }, 14001), true);
});

test('usa retroceso limitado para evitar ciclos de recarga agresivos', () => {
  assert.equal(musicRecoveryDelay(0), 800);
  assert.equal(musicRecoveryDelay(2), 4000);
  assert.equal(musicRecoveryDelay(99), 18000);
});
