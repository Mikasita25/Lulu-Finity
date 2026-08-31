'use strict';

const MUSIC_RECOVERY_DELAYS_MS = Object.freeze([800, 1800, 4000, 9000, 18000]);

function musicRecoveryDelay(attempt) {
  const index = Math.min(MUSIC_RECOVERY_DELAYS_MS.length - 1, Math.max(0, Math.floor(Number(attempt || 0))));
  return MUSIC_RECOVERY_DELAYS_MS[index];
}

function shouldRecoverPlayback(state = {}, now = Date.now(), stallAfterMs = 12000) {
  if (!state.expectedPlaying || state.userPaused || state.visible || state.adActive) return false;
  if (state.destroyed) return true;
  const lastProgressAt = Number(state.lastProgressAt || 0);
  return !lastProgressAt || Number(now) - lastProgressAt > Math.max(1000, Number(stallAfterMs || 12000));
}

function isManualPlayerPause(state = {}, payload = {}) {
  return payload.paused === true && payload.userPaused === true && state.visible === true;
}

function shouldResumeUnexpectedPause(state = {}, payload = {}) {
  return payload.paused === true
    && state.expectedPlaying === true
    && state.userPaused !== true
    && state.adActive !== true
    && !isManualPlayerPause(state, payload);
}

module.exports = {
  MUSIC_RECOVERY_DELAYS_MS,
  musicRecoveryDelay,
  shouldRecoverPlayback,
  isManualPlayerPause,
  shouldResumeUnexpectedPause
};
