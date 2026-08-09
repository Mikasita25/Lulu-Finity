'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { requestTikTokSpeech } = require('./tiktok-tts-client');

test('solicita un código TikTok y devuelve MP3 base64', async () => {
  let request = null;
  const audio = Buffer.from('ID3-audio-tiktok');
  const result = await requestTikTokSpeech({
    text: 'Hola desde Lulu',
    voice: 'es_mx_002',
    cookie: 'sessionid=solo-prueba',
    endpoints: ['https://api16-normal-v6.tiktokv.com/media/api/text/speech/invoke/'],
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ status_code: 0, data: { v_str: audio.toString('base64') } }) };
    }
  });
  assert.match(request.url, /text_speaker=es_mx_002/);
  assert.match(request.url, /req_text=Hola/);
  assert.equal(request.options.headers.Cookie, 'sessionid=solo-prueba');
  assert.equal(result.data, audio.toString('base64'));
  assert.equal(result.provider, 'tiktok');
});

test('rechaza voces Microsoft y sesiones vencidas', async () => {
  await assert.rejects(() => requestTikTokSpeech({ text: 'Hola', voice: 'es-MX-DaliaNeural', cookie: 'sessionid=x' }), /no es válida/);
  await assert.rejects(() => requestTikTokSpeech({
    text: 'Hola', voice: 'en_us_002', cookie: 'sessionid=x', endpoints: ['https://api16-normal-v6.tiktokv.com/'],
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ status_code: 1 }) })
  }), /sesión de TikTok venció/);
});
