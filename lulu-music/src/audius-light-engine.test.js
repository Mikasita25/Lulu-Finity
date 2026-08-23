'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AudiusLookupError,
  isAudiusUrl,
  audiusStreamUrl,
  isAudiusStreamUrl,
  scoreCandidate,
  resolveAudiusRequest
} = require('./audius-light-engine');

const TRACK = {
  id:'D7KyD', title:'Bangarang', duration:215, is_available:true, is_streamable:true,
  play_count:900000, permalink:'/skrillex/bangarang', access:{ stream:true },
  user:{ name:'Skrillex', handle:'skrillex', is_verified:true }
};

function response(data) {
  const text = JSON.stringify(data);
  return { ok:true, status:200, headers:{ get:() => String(Buffer.byteLength(text)) }, text:async () => text };
}

test('reconoce enlaces oficiales y genera solo endpoints de streaming de Audius', () => {
  assert.equal(isAudiusUrl('https://audius.co/skrillex/bangarang'), true);
  assert.equal(isAudiusUrl('https://example.com/skrillex/bangarang'), false);
  const stream = audiusStreamUrl('D7KyD');
  assert.equal(isAudiusStreamUrl(stream), true);
  assert.match(stream, /^https:\/\/api\.audius\.co\/v1\/tracks\/D7KyD\/stream\?/);
  assert.equal(isAudiusStreamUrl('https://audius.co/skrillex/bangarang'), false);
});

test('el modo automático exige título y artista o un creador verificado', () => {
  const exact = scoreCandidate('Skrillex Bangarang', { title:'Bangarang', artist:'Skrillex', verified:true, playCount:100 });
  assert.equal(exact.confident, true);
  const cover = scoreCandidate('Despacito', { title:'Despacito', artist:'Lofi Beats', verified:false, playCount:1000 });
  assert.equal(cover.confident, false);
  const explicitCover = scoreCandidate('Lofi Beats Despacito', { title:'Despacito', artist:'Lofi Beats', verified:false, playCount:1000 });
  assert.equal(explicitCover.confident, true);
});

test('busca una canción sin cargar el sitio web de Audius', async () => {
  let requestedUrl = '';
  const result = await resolveAudiusRequest('Skrillex Bangarang', {
    requireConfident:true,
    fetchImpl:async (url) => { requestedUrl = url; return response({ data:[TRACK] }); }
  });
  assert.match(requestedUrl, /^https:\/\/api\.audius\.co\/v1\/tracks\/search\?/);
  assert.match(requestedUrl, /app_name=LuluMusic/);
  assert.equal(result.trackId, 'D7KyD');
  assert.equal(result.title, 'Bangarang');
  assert.equal(result.artist, 'Skrillex');
  assert.equal(result.confident, true);
  assert.equal(isAudiusStreamUrl(result.streamUrl), true);
});

test('un enlace de Audius usa resolve y no necesita heurística', async () => {
  let requestedUrl = '';
  const result = await resolveAudiusRequest('https://audius.co/skrillex/bangarang', {
    requireConfident:true,
    fetchImpl:async (url) => { requestedUrl = url; return response({ data:TRACK }); }
  });
  assert.match(requestedUrl, /^https:\/\/api\.audius\.co\/v1\/resolve\?/);
  assert.equal(result.direct, true);
  assert.equal(result.trackId, 'D7KyD');
});

test('rechaza en automático una coincidencia dudosa para permitir fallback a YouTube', async () => {
  const cover = { ...TRACK, id:'KzKV9', title:'Despacito', play_count:3000, user:{ name:'Lofi Beats', handle:'lofibeat', is_verified:false } };
  await assert.rejects(
    resolveAudiusRequest('Despacito', { requireConfident:true, fetchImpl:async () => response({ data:[cover] }) }),
    (error) => error instanceof AudiusLookupError && error.code === 'low-confidence'
  );
});

test('el modo solo Audius acepta la mejor pista reproducible disponible', async () => {
  const cover = { ...TRACK, id:'KzKV9', title:'Despacito', user:{ name:'Lofi Beats', handle:'lofibeat', is_verified:false } };
  const unavailable = { ...TRACK, id:'NOPE1', title:'Bloqueada', is_streamable:false };
  const result = await resolveAudiusRequest('Despacito', { fetchImpl:async () => response({ data:[unavailable, cover] }) });
  assert.equal(result.trackId, 'KzKV9');
});
