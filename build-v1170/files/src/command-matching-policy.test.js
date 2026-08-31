'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { cleanCommandText, commandKey, parseCommandText, matchCommand } = require('./command-matching-policy');

test('normaliza caracteres invisibles, espacios y signos alternativos', () => {
  const parsed = parseCommandText('\u200b！ Canción:\u00a0 Bad Bunny');
  assert.deepEqual(parsed, { key:'!cancion', remainder:'Bad Bunny', text:'!Canción: Bad Bunny' });
  assert.equal(cleanCommandText('  ¡saldo  '), '!saldo');
});

test('identifica comandos sin depender de mayúsculas ni acentos', () => {
  assert.equal(commandKey('!CANCIÓN'), '!cancion');
  assert.equal(matchCommand('!SALDO', '!saldo')?.remainder, '');
  assert.equal(matchCommand('!saldo?', '!saldo')?.remainder, '');
  assert.equal(matchCommand('!cancion; Selena', '!canción')?.remainder, 'Selena');
});

test('evita coincidencias parciales o comandos dentro de una oración', () => {
  assert.equal(matchCommand('hola !saldo', '!saldo'), null);
  assert.equal(matchCommand('!saldos', '!saldo'), null);
});
