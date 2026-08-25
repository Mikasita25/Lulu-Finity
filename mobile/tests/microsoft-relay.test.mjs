import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isMicrosoftMp3,
  microsoftTtsFailure,
  microsoftTtsHeaders,
  microsoftTtsUrl,
} from '../src/services/microsoftRelay.ts';

test('convierte la dirección LIVE en la ruta HTTPS de Microsoft TTS', () => {
  assert.equal(
    microsoftTtsUrl('wss://lulu-finity-production.up.railway.app/v1/tiktok/live'),
    'https://lulu-finity-production.up.railway.app/v1/tts/microsoft',
  );
});

test('envía el token oficial sin dejar de solicitar MP3', () => {
  const headers = microsoftTtsHeaders('token-prueba');
  assert.equal(headers.Accept, 'audio/mpeg');
  assert.equal(headers.Authorization, 'Bearer token-prueba');
  assert.equal(headers['x-lulu-client-token'], 'token-prueba');
});

test('acepta encabezados MP3 y rechaza respuestas JSON o vacías', () => {
  assert.equal(isMicrosoftMp3(Uint8Array.from([0x49, 0x44, 0x33, ...new Array(509).fill(0)])), true);
  assert.equal(isMicrosoftMp3(Uint8Array.from([0xff, 0xfb, ...new Array(510).fill(0)])), true);
  assert.equal(isMicrosoftMp3(Uint8Array.from([0x7b, 0x22, 0x6f, ...new Array(509).fill(0)])), false);
  assert.equal(isMicrosoftMp3(new Uint8Array()), false);
});

test('explica por separado un relay antiguo y un token incorrecto', () => {
  assert.match(microsoftTtsFailure(404).message, /todavía no tiene activa/);
  assert.match(microsoftTtsFailure(401).message, /no está autorizada/);
});
