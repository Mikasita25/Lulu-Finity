'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const text = require('./text-processor');

test('convierte letras decorativas a latinas normales', () => {
  assert.equal(text.prepare('𝓗𝓸𝓵𝓪 Ⓗⓞⓛⓐ Ｌｕｌｕ').text, 'Hola Hola Lulu');
});

test('elimina emojis y decoración de nombres', () => {
  assert.equal(text.prepareUsername('🌸𝓜𝓲𝓴𝓾_Queen💖').text, 'Miku Queen');
});

test('bloquea chino, japonés y coreano cuando está activado', () => {
  assert.equal(text.prepare('hola 你好', { blockCjk: true }).reason, 'alfabeto CJK bloqueado');
  assert.equal(text.prepare('こんにちは', { blockCjk: true }).allowed, false);
  assert.equal(text.prepare('안녕하세요', { blockCjk: true }).allowed, false);
});

test('bloquea mezclas latinas con caracteres confundibles', () => {
  assert.equal(text.prepare('hоla', { blockMixedScripts: true }).reason, 'mezcla de alfabetos');
});

test('reduce ruido, enlaces y repeticiones', () => {
  assert.equal(text.prepare('holaaaaaaaa 😂😂 https://example.com!!!!!').text, 'holaaa');
});

test('crea una frase sin leer emojis del nombre', () => {
  const result = text.speechForMessage({ nickname: '💖Lulú🌸', comment: '𝓗𝓸𝓵𝓪 😂' }, { includeUsername: true });
  assert.equal(result.text, 'Lulú dice: Hola');
});
