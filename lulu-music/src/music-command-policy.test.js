'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMusicCommand, normalizeMusicCommand, requesterAllowed, blockedRequest } = require('./music-command-policy');

test('normaliza el comando configurable', () => {
  assert.equal(normalizeMusicCommand('Canción'), '!canción');
  assert.equal(normalizeMusicCommand('/SONG'), '/song');
});

test('solo acepta el comando exacto con una canción', () => {
  assert.deepEqual(parseMusicCommand('!cancion  Luna de Zoé'), { command:'!cancion', query:'Luna de Zoé' });
  assert.equal(parseMusicCommand('hola @usuario ¿cómo estás?'), null);
  assert.equal(parseMusicCommand('@usuario !cancion Luna'), null);
  assert.equal(parseMusicCommand('!canciones Luna'), null);
  assert.equal(parseMusicCommand('!cancion'), null);
  assert.equal(parseMusicCommand('!juego ruleta'), null);
});

test('limita la consulta y permite un comando personalizado', () => {
  const result = parseMusicCommand('/song ' + 'a'.repeat(300), '/song');
  assert.equal(result.query.length, 180);
  assert.equal(parseMusicCommand('/song Numb', '!cancion'), null);
});

test('aplica permisos de solicitudes', () => {
  assert.equal(requesterAllowed({ uniqueId:'Ana' }, { permission:'all' }), true);
  assert.equal(requesterAllowed({ isFollower:true }, { permission:'followers' }), true);
  assert.equal(requesterAllowed({}, { permission:'followers' }), false);
  assert.equal(requesterAllowed({ isSubscriber:true }, { permission:'subscribers' }), true);
  assert.equal(requesterAllowed({ uniqueId:'@ANA' }, { permission:'selected', selectedUsers:['ana','lulu'] }), true);
  assert.equal(requesterAllowed({ uniqueId:'otro' }, { permission:'selected', selectedUsers:['ana'] }), false);
});

test('bloquea términos sin distinguir mayúsculas', () => {
  assert.equal(blockedRequest('Una canción Prohibida', ['prohibida']), true);
  assert.equal(blockedRequest('Canción permitida', ['prohibida']), false);
});
