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
    'tiktok-live-connector', 'ws'
  ]);
  assert.equal(packageJson.dependencies['electron-updater'], undefined);
  assert.match(packageJson.scripts['build:win'], /create-portable\.ps1/);
});

test('YouTube usa una sola ventana ligera y nunca carga la página completa', () => {
  const main = source('main.js');
  const engine = source('youtube-light-engine.js');
  assert.match(main, /if \(youtubeWindow && !youtubeWindow\.isDestroyed\(\)\) return youtubeWindow/);
  assert.match(main, /youtubeEmbedUrl\(resolved\.videoId\)/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action:'deny' \}\)\)/);
  assert.match(engine, /https:\/\/www\.youtube\.com\/embed\//);
  assert.doesNotMatch(main, /youtube\.com\/results|youtube\.com\/watch|ytd-video-renderer|@ghostery/);
  assert.doesNotMatch(source('../package.json'), /@ghostery/);
});

test('Audius usa audio directo en el renderer existente y automático conserva fallback a YouTube', () => {
  const main = source('main.js');
  const renderer = source('renderer.js');
  const html = source('index.html');
  const engine = source('audius-light-engine.js');
  assert.match(html, /<audio id="audiusPlayer"/);
  assert.match(html, /media-src https:/);
  assert.match(main, /resolveAudiusRequest\(item\.query, \{ requireConfident:true \}\)/);
  assert.match(main, /item\.provider = 'youtube'/);
  assert.match(renderer, /api\.onAudiusLoad/);
  assert.match(renderer, /api\.reportAudiusState/);
  assert.match(engine, /https:\/\/api\.audius\.co\/v1/);
  assert.doesNotMatch(main, /createAudiusWindow|AUDIUS_PARTITION/);
});

test('la aplicación ofrece únicamente Automático, Audius y YouTube', () => {
  const combined = [source('main.js'), source('renderer.js'), source('index.html')].join('\n').toLowerCase();
  assert.match(source('main.js'), /new Set\(\['auto','audius','youtube'\]\)/);
  assert.match(source('index.html'), /value="auto"/);
  assert.match(source('index.html'), /value="audius"/);
  assert.match(source('index.html'), /value="youtube"/);
  assert.equal(combined.includes('spotify'), false);
});

test('preload expone solo operaciones musicales y de conexión', () => {
  const preload = source('preload.js');
  ['getState','rendererReady','saveSettings','connectLive','disconnectLive','addSong','removeSong','moveSong','clearQueue','playerControl','showPlayer','reportAudiusState','onAudiusLoad','onAudiusCommand']
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
