'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { DEFAULT_SOUND_DEFINITIONS, defaultSoundCatalog } = require('./default-sound-catalog');

test('la biblioteca predeterminada incluye 24 sonidos CC0 únicos', () => {
  const catalog = defaultSoundCatalog(path.join(__dirname, 'default-sounds'));
  assert.equal(DEFAULT_SOUND_DEFINITIONS.length, 24);
  assert.equal(catalog.length, 24);
  assert.equal(new Set(catalog.map((sound) => sound.id)).size, 24);
  assert.ok(catalog.every((sound) => sound.license === 'CC0'));
  assert.ok(catalog.every((sound) => sound.url.startsWith('file:')));
});

test('la biblioteca ofrece alertas, sonidos digitales y juegos', () => {
  const categories = new Set(DEFAULT_SOUND_DEFINITIONS.map((sound) => sound.category));
  assert.deepEqual(categories, new Set(['Alertas', 'Digital', 'Juegos']));
});
