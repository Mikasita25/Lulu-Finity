'use strict';

const { resolveAudiusRequest, isAudiusStreamUrl } = require('../src/audius-light-engine');

(async () => {
  const track = await resolveAudiusRequest('ODESZA Say My Name', { requireConfident:true });
  if (!track?.trackId || !isAudiusStreamUrl(track.streamUrl)) throw new Error('Audius no devolvió un stream oficial válido.');
  if (!/odesza/i.test(track.artist)) throw new Error(`Audius eligió un artista inesperado: ${track.artist || 'sin artista'}`);
  const response = await fetch(track.streamUrl, { method:'HEAD', redirect:'manual' });
  if (![200, 206, 301, 302, 307, 308].includes(response.status)) {
    throw new Error(`El stream de Audius respondió ${response.status}.`);
  }
  console.log(`LULU_MUSIC_AUDIUS_LIGHT_OK:${JSON.stringify({
    trackId:track.trackId,
    title:track.title,
    artist:track.artist,
    confident:track.confident,
    streamStatus:response.status
  })}`);
})().catch((error) => {
  console.error('LULU_MUSIC_AUDIUS_LIGHT_FAIL:', error?.message || error);
  process.exitCode = 1;
});
