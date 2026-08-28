'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(process.argv[2] || 'app');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const ui = read('src/update3-ui.js');
const css = read('src/update3-ui.css');
const preview = read('src/preview-panel.js');
const packageJson = JSON.parse(read('package.json'));

test('Update 3.0 is a public label, not the internal build version', () => {
  assert.equal(packageJson.version, '1.1.2');
  assert.match(ui, /PUBLIC_UPDATE_LABEL\s*=\s*'3\.0'/);
  assert.match(ui, /Update \$\{PUBLIC_UPDATE_LABEL\} — Lulu Finity/);
  assert.doesNotMatch(JSON.stringify(packageJson), /"version"\s*:\s*"3\.0"/);
});

test('welcome uses existing settings layer and appears once per newer version', () => {
  assert.match(ui, /lastSeenVersion/);
  assert.match(ui, /api\.getState\(\)/);
  assert.match(ui, /api\.saveSettings\(/);
  assert.match(ui, /compareVersions/);
  assert.match(ui, /shouldShow/);
  assert.match(ui, /event\.target === backdrop/);
  assert.match(ui, /'Empezar'/);
  assert.match(ui, /'Ver todas las novedades'/);
});

test('welcome lists current real Lulu Finity areas', () => {
  for (const label of ['LIVE','TTS','Música','Comandos','Juegos','Rankings','Metas','Economía','Pantalla','Personalizar','Conexión y cuenta','Configuración','Vista previa']) {
    assert.ok(ui.includes(label), `Falta ${label}`);
  }
  assert.ok(ui.includes('Esto es lo nuevo y lo que ya puedes usar.'));
  assert.ok(ui.includes('Todo lo que ya incluye Lulu Finity'));
});

test('cute button system contains every mandatory state and three sizes', () => {
  for (const token of ['lf-cute-sm','lf-cute-md','lf-cute-lg','brightness(1.09)','scale(.97)','opacity:.45','aria-busy','lf-cute-spin','button.success','button.danger']) {
    assert.ok(css.includes(token), `Falta ${token}`);
  }
  assert.ok(css.includes('var(--accent)'));
  assert.ok(css.includes('var(--accent-2)'));
  assert.ok(css.includes('html[data-theme^="miku-"]'));
});

test('all twelve theme cards have button previews', () => {
  const ids = ['pink','blush','purple','red','blue','dark','studio-lavender','studio-pink','studio-mint','miku-classic','miku-soft','miku-dark'];
  for (const id of ids) assert.ok(css.includes(`data-theme-choice="${id}"`), `Falta preview de ${id}`);
  assert.match(css, /theme-choice:hover::after/);
});

test('Update 3 assets are loaded only by the desktop UI bootstrap', () => {
  assert.ok(preview.includes('loadUpdate3Assets'));
  assert.ok(preview.includes("style.href = 'update3-ui.css'"));
  assert.ok(preview.includes("script.src = 'update3-ui.js'"));
  assert.ok(preview.includes('loadUpdate3Assets();'));
});

test('browser script parses before packaging', () => {
  assert.doesNotThrow(() => new Function(ui));
});
