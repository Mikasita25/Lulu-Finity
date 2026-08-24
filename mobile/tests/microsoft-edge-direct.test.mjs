import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  generateSecMsGec,
  parseEdgeAudioFrame,
  sha256Hex,
  toMicrosoftVoiceName,
} from '../src/services/microsoftEdgeDirect.ts';

test('calcula SHA-256 sin depender de módulos nativos del teléfono', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('genera la firma que solicita Microsoft Edge TTS', () => {
  const now = Date.UTC(2026, 7, 24, 6, 0, 0);
  const token = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
  let ticks = now / 1000 + 11_644_473_600;
  ticks -= ticks % 300;
  ticks *= 10_000_000;
  const expected = createHash('sha256')
    .update(`${ticks.toFixed(0)}${token}`)
    .digest('hex')
    .toUpperCase();

  assert.equal(generateSecMsGec(now), expected);
});

test('convierte una voz corta al identificador SSML de Microsoft', () => {
  assert.equal(
    toMicrosoftVoiceName('es-MX-DaliaNeural'),
    'Microsoft Server Speech Text to Speech Voice (es-MX, DaliaNeural)',
  );
});

test('extrae el MP3 de una trama binaria de Microsoft', () => {
  const header = new TextEncoder().encode('Path:audio\r\nContent-Type:audio/mpeg\r\n');
  const mp3 = Uint8Array.from([0xff, 0xfb, 0x90, 0x64]);
  const frame = new Uint8Array(2 + header.length + mp3.length);
  frame[0] = (header.length >>> 8) & 0xff;
  frame[1] = header.length & 0xff;
  frame.set(header, 2);
  frame.set(mp3, 2 + header.length);

  assert.deepEqual(parseEdgeAudioFrame(frame), mp3);
});
