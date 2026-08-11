'use strict';

const LIVE_RECONNECT_DELAYS_MS = Object.freeze([
  1000,
  2500,
  5000,
  10_000,
  20_000,
  30_000,
  60_000,
  120_000
]);

const TERMINAL_CLOSE_CODES = new Set([1000, 1008, 4005, 4400, 4401, 4403, 4404, 4429]);

function cleanCloseReason(reason = '') {
  return String(reason || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 180);
}

function shouldReconnectLive({ code = 0, reason = '', manuallyStopped = false, streamEnded = false, shuttingDown = false } = {}) {
  if (manuallyStopped || streamEnded || shuttingDown) return false;
  const normalizedCode = Number(code) || 0;
  if (TERMINAL_CLOSE_CODES.has(normalizedCode)) return false;
  const text = cleanCloseReason(reason).toLowerCase();
  if (/offline|not live|live (?:has )?ended|el live termin|desconectada manual|protocolo.*rechaz|token.*inv[aá]lid|configuraci[oó]n.*inv[aá]lid|l[ií]mite diario/.test(text)) return false;
  return true;
}

function liveReconnectDelay(attemptNumber) {
  const index = Math.max(0, Math.min(LIVE_RECONNECT_DELAYS_MS.length - 1, Number(attemptNumber || 1) - 1));
  return LIVE_RECONNECT_DELAYS_MS[index];
}

module.exports = {
  LIVE_RECONNECT_DELAYS_MS,
  TERMINAL_CLOSE_CODES,
  cleanCloseReason,
  shouldReconnectLive,
  liveReconnectDelay
};
