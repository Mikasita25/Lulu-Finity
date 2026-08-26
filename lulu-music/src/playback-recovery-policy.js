'use strict';

const YOUTUBE_STALL_MS = 10_000;
const YOUTUBE_MAX_RECOVERY_ATTEMPTS = 3;
const AUDIUS_STALL_MS = 7_000;
const AUDIUS_MAX_LOCAL_RECOVERY_ATTEMPTS = 2;
const AUDIUS_MAX_RESOLVE_RETRIES = 1;
const RECOVERY_DELAYS_MS = Object.freeze([700, 1400, 2600]);

function recoveryDelay(attempt = 1) {
  const index = Math.max(0, Math.min(RECOVERY_DELAYS_MS.length - 1, Math.trunc(Number(attempt) || 1) - 1));
  return RECOVERY_DELAYS_MS[index];
}

function shouldRecoverUnexpectedPause(input = {}) {
  return Boolean(input.paused)
    && !Boolean(input.ended)
    && !Boolean(input.userPaused)
    && !Boolean(input.ad);
}

function shouldReportStall(input = {}) {
  const stalledMs = Math.max(0, Number(input.stalledMs) || 0);
  return !Boolean(input.ended)
    && !Boolean(input.userPaused)
    && !Boolean(input.ad)
    && stalledMs >= Math.max(1000, Number(input.thresholdMs) || YOUTUBE_STALL_MS);
}

function canRetry(attempts, maximum) {
  return Math.max(0, Number(attempts) || 0) < Math.max(0, Number(maximum) || 0);
}

module.exports = {
  YOUTUBE_STALL_MS,
  YOUTUBE_MAX_RECOVERY_ATTEMPTS,
  AUDIUS_STALL_MS,
  AUDIUS_MAX_LOCAL_RECOVERY_ATTEMPTS,
  AUDIUS_MAX_RESOLVE_RETRIES,
  RECOVERY_DELAYS_MS,
  recoveryDelay,
  shouldRecoverUnexpectedPause,
  shouldReportStall,
  canRetry
};
