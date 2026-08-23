'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { isDirectedReply } = require('./chat-reading-policy');

test('detecta respuestas dirigidas que empiezan con @usuario', () => {
  for (const value of ['@alya hola', '  @alya: hola', '@alya.25 ¿cómo estás?', '@user_name, gracias', '@alguien']) {
    assert.equal(isDirectedReply(value), true, value);
  }
});

test('no bloquea menciones generales, correos ni comandos', () => {
  for (const value of ['Hola @alya', 'correo@ejemplo.com', '!saludo @alya', 'Mira esto', '@ usuario']) {
    assert.equal(isDirectedReply(value), false, value);
  }
});
