'use strict';

// Autoriza únicamente la conexión LIVE. TTS y la edición de fuentes
// conservan sus comprobaciones de acceso independientes.
function isLiveAuthorized(headers, allowedTokens, publicLive = false) {
  if (publicLive) return true;
  if (!allowedTokens.size) return true;
  const authorization = String(headers?.authorization || '');
  const token = /^Bearer\s+/i.test(authorization)
    ? authorization.replace(/^Bearer\s+/i, '').trim()
    : String(headers?.['x-lulu-client-token'] || '').trim();
  return allowedTokens.has(token);
}

module.exports = { isLiveAuthorized };
