'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = (name) => fs.readFileSync(path.join(root, 'src', name), 'utf8');

test('el paquete contiene una sola pantalla dedicada a música', () => {
  const html = source('index.html');
  assert.match(html, /<title>Lulu Music<\/title>/);
  assert.match(html, /class="brand-mark"[^>]*><span>LM<\/span>/);
  assert.doesNotMatch(html, /data-page=|sidebar|nav-item/i);
  assert.match(html, /Cola musical/);
  assert.match(html, /Abrir reproductor/);
  assert.doesNotMatch(html, /widget|iframe/i);
});

test('la interfaz usa textos directos y no conserva la presentación promocional', () => {
  const html = source('index.html');
  assert.match(html, /<h2>Conecta tu LIVE<\/h2>/);
  assert.match(html, /<h2>Ajustes<\/h2>/);
  [
    'Solo solicitudes musicales del LIVE',
    'Solo entra a la app',
    'Tu chat elige. Lulu pone la música.',
    'Un solo comando, bajo tu control',
    'Una app, una función: música.'
  ].forEach((copy) => assert.equal(html.includes(copy), false, `No debe aparecer: ${copy}`));
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

test('la barra de Lulu conserva el control del volumen de YouTube y Audius', () => {
  const main = source('main.js');
  const renderer = source('renderer.js');
  assert.match(main, /window\.__luluMusicVolume=desired/);
  assert.match(main, /const applyVolume=\(\)=>/);
  assert.match(main, /if\(Math\.abs\(video\.volume-desired\)>\.001\)video\.volume=desired/);
  assert.match(main, /win\.webContents\.setAudioMuted\(false\)/);
  assert.doesNotMatch(main, /video\.volume=\$\{JSON\.stringify\(settings\.volume\)\};video\.muted=false/);
  assert.doesNotMatch(main, /action === 'volume'\) \{ await setPlayerVolume\(value\); await writeSettings\(\)/);
  assert.match(renderer, /function volumePercent\(value\)/);
  assert.doesNotMatch(renderer, /Number\(settings\.volume\) \|\| 0\.8/);
});

test('el ahorro de Electron reduce trabajo visual sin suspender LIVE ni audio', () => {
  const main = source('main.js');
  const renderer = source('renderer.js');
  const html = source('index.html');
  const css = source('styles.css');
  assert.equal((main.match(/backgroundThrottling:false/g) || []).length, 1);
  assert.equal((main.match(/backgroundThrottling:true/g) || []).length, 1);
  assert.doesNotMatch(main, /paintWhenInitiallyHidden:false/);
  assert.match(main, /YOUTUBE_BACKGROUND_SIZE = Object\.freeze\(\{ width:320, height:180 \}\)/);
  assert.match(main, /Menu\.setApplicationMenu\(null\)/);
  assert.match(main, /powerSaveBlocker\.start\('prevent-app-suspension'\)/);
  assert.match(main, /pauseYoutubePlayback\(\{ release:!next \}\)/);
  assert.match(main, /const YOUTUBE_REPORT_INTERVAL_MS = 1_500/);
  assert.match(main, /const ensureStarted=\(\)=>/);
  assert.match(main, /video\.addEventListener\('playing',onPlaying\)/);
  assert.match(renderer, /lastQueueSignature/);
  assert.match(renderer, /lastAudiusProgressAt < 1_000/);
  assert.doesNotMatch(html, /class="ambient/);
  assert.match(css, /backdrop-filter:none!important/);
  assert.doesNotMatch([main, renderer].join('\n'), /visibilitychange[^\n]*(?:disconnectLive|disconnect\()/);
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
  assert.match(preload, /invoke\('app:renderer-ready'\)/);
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

test('los scripts del renderer pueden convivir en el mismo ámbito global', () => {
  assert.doesNotThrow(() => new vm.Script(`${source('music-command-policy.js')}\n${source('renderer.js')}`));
});
