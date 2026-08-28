'use strict';

// Modo público para launchers ya distribuidos: no exige un token estático para
// recibir eventos públicos de TikTok. TTS y publicación de overlays sí conservan
// el token de las compilaciones oficiales.
process.env.TTS_CLIENT_TOKENS =
  process.env.TTS_CLIENT_TOKENS || process.env.CLIENT_TOKENS || process.env.CLIENT_TOKEN || '';
process.env.OVERLAY_CLIENT_TOKENS =
  process.env.OVERLAY_CLIENT_TOKENS || process.env.TTS_CLIENT_TOKENS || process.env.CLIENT_TOKENS || process.env.CLIENT_TOKEN || '';
process.env.CLIENT_TOKENS = '';
process.env.CLIENT_TOKEN = '';

console.warn('[startup] Relay público Lulu Finity con Microsoft TTS y overlays estables ejecutándose en Node.');
require('./server-v112-loader');
