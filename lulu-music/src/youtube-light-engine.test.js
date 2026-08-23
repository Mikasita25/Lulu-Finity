'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  youtubeVideoId,
  youtubeEmbedUrl,
  isYoutubeEmbedUrl,
  youtubeSearchCandidates,
  resolveYoutubeRequest
} = require('./youtube-light-engine');

const FIRST_ID = 'dQw4w9WgXcQ';
const SECOND_ID = 'kJQP7kiw5Fk';

test('acepta los enlaces habituales de YouTube sin abrir una búsqueda', () => {
  assert.equal(youtubeVideoId(FIRST_ID), FIRST_ID);
  assert.equal(youtubeVideoId(`https://youtu.be/${FIRST_ID}?si=abc`), FIRST_ID);
  assert.equal(youtubeVideoId(`https://www.youtube.com/watch?v=${FIRST_ID}&list=xyz`), FIRST_ID);
  assert.equal(youtubeVideoId(`https://music.youtube.com/watch?v=${FIRST_ID}`), FIRST_ID);
  assert.equal(youtubeVideoId(`https://www.youtube.com/shorts/${FIRST_ID}`), FIRST_ID);
  assert.equal(youtubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), '');
});

test('genera únicamente el reproductor oficial incrustado', () => {
  const url = youtubeEmbedUrl(FIRST_ID);
  assert.equal(isYoutubeEmbedUrl(url), true);
  assert.match(url, /^https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ\?/);
  assert.match(url, /autoplay=1/);
  assert.throws(() => youtubeEmbedUrl('no-valido'));
  assert.equal(isYoutubeEmbedUrl(`https://www.youtube.com/watch?v=${FIRST_ID}`), false);
});

test('extrae resultados normales del HTML sin crear un renderer de navegador', () => {
  const initialData = {
    contents:{ rows:[
      { videoRenderer:{ videoId:FIRST_ID, title:{runs:[{text:'Primera canción'}]}, ownerText:{runs:[{text:'Artista uno'}]} } },
      { videoRenderer:{ videoId:SECOND_ID, title:{simpleText:'Segunda canción'}, longBylineText:{runs:[{text:'Artista dos'}]} } }
    ] }
  };
  const html = `<html><script>var ytInitialData = ${JSON.stringify(initialData)};</script></html>`;
  assert.deepEqual(youtubeSearchCandidates(html), [
    { videoId:FIRST_ID, title:'Primera canción', artist:'Artista uno' },
    { videoId:SECOND_ID, title:'Segunda canción', artist:'Artista dos' }
  ]);
});

test('la búsqueda ligera respeta exclusiones para continuar recomendado', async () => {
  let requestedUrl = '';
  const html = `<script>var ytInitialData = ${JSON.stringify({results:[
    {videoRenderer:{videoId:FIRST_ID,title:{simpleText:'Repetida'}}},
    {videoRenderer:{videoId:SECOND_ID,title:{simpleText:'Siguiente'},ownerText:{simpleText:'Canal'}}}
  ]})};</script>`;
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return { ok:true, status:200, headers:{ get:() => String(Buffer.byteLength(html)) }, text:async () => html };
  };
  const result = await resolveYoutubeRequest('música para el live', { fetchImpl, excludeVideoIds:[FIRST_ID] });
  assert.match(requestedUrl, /youtube\.com\/results\?search_query=m%C3%BAsica%20para%20el%20live/);
  assert.deepEqual(result, { videoId:SECOND_ID, title:'Siguiente', artist:'Canal', direct:false });
});

test('un enlace directo no realiza ninguna consulta de red', async () => {
  const result = await resolveYoutubeRequest(`https://youtu.be/${FIRST_ID}`, {
    fetchImpl:async () => { throw new Error('no debe ejecutarse'); }
  });
  assert.deepEqual(result, { videoId:FIRST_ID, title:'', artist:'', direct:true });
});
