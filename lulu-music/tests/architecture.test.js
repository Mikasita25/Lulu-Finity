'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = (name) => fs.readFileSync(path.join(root, 'src', name), 'utf8');

test('el paquete contiene una sola pantalla dedicada a música', () => {
  const html = source('index.html');
  assert.match(html, /<title>Lulu Music<\/title>/);
  assert.doesNotMatch(html, /data-page=|sidebar|nav-item/i);
  assert.match(html, /Cola musical/);
  assert.match(html, /Abrir reproductor/);
  assert.doesNotMatch(html, /widget|iframe/i);
});

test('el proceso principal descarta el chat antes de la interfaz', () => {
  const main = source('main.js');
  assert.match(main, /const parsed = parseMusicCommand/);
  assert.match(main, /if \(!parsed\) return;/);
  assert.doesNotMatch(main, /send\(['"]live:chat/);
  assert.doesNotMatch(source('preload.js'), /live:chat/);
});

test('no se empaquetan motores de voz ni categorías de Lulu Finity', () => {
  const packageJson = source('../package.json');
  const packageLock = source('../package-lock.json');
  const combined = [source('main.js'), source('preload.js'), source('renderer.js'), packageJson, packageLock].join('\n').toLowerCase();
  const forbidden = [
    'edge-tts', 'sherpa-onnx', 'speechsynthesis', 'local-voice', 'tiktok-tts',
    'live-games', 'automation-engine', 'economy:', 'gift:', 'ranking:'
  ];
  forbidden.forEach((token) => assert.equal(combined.includes(token), false, `No debe existir ${token}`));
});

test('las únicas dependencias de ejecución son musicales y de conexión', () => {
  const packageJson = JSON.parse(source('../package.json'));
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), [
    '@ghostery/adblocker-electron', 'tiktok-live-connector', 'ws'
  ]);
  assert.equal(packageJson.dependencies['electron-updater'], undefined);
  assert.match(packageJson.scripts['build:win'], /create-portable\.ps1/);
});

test('preload expone solo operaciones musicales y de conexión', () => {
  const preload = source('preload.js');
  ['getState','saveSettings','connectLive','disconnectLive','addSong','removeSong','moveSong','clearQueue','playerControl','showPlayer']
    .forEach((name) => assert.match(preload, new RegExp(`\\b${name}\\b`)));
  assert.doesNotMatch(preload, /tts|voice|game|gift|automation|economy/i);
});

test('no incluye widgets, servidor local, HTTPS ni Cloudflare', () => {
  const combined = [
    source('main.js'), source('preload.js'), source('renderer.js'), source('index.html'),
    source('../package.json')
  ].join('\n');
  [
    'widget:info', 'getWidgetInfo', 'startWidgetServer', 'cloudflared',
    'createServer(', '/widget', '<iframe', 'themePicker', 'backgroundPicker'
  ].forEach((token) => assert.equal(combined.includes(token), false, `No debe existir ${token}`));
});

test('todos los identificadores HTML son únicos', () => {
  const ids = [...source('index.html').matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length >= 40);
  assert.equal(new Set(ids).size, ids.length);
});

test('el renderer solo usa controles que existen en la pantalla', () => {
  const htmlIds = new Set([...source('index.html').matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  const rendererIds = [...source('renderer.js').matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]);
  const missing = [...new Set(rendererIds)].filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, []);
});
