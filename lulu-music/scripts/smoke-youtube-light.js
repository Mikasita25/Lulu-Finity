'use strict';

const assert = require('node:assert/strict');
const { resolveYoutubeRequest } = require('../src/youtube-light-engine');

(async () => {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await resolveYoutubeRequest('YouTube IFrame Player API demo');
      assert.match(result.videoId, /^[A-Za-z0-9_-]{11}$/);
      console.log(`YOUTUBE_LIGHT_SEARCH_OK:${JSON.stringify({ videoId:result.videoId, title:result.title })}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    }
  }
  throw lastError || new Error('La búsqueda ligera de YouTube no devolvió un resultado.');
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
