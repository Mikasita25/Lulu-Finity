'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

test('cada widget tiene editor propio persistente', () => {
  const renderer = source('renderer.js');
  const main = source('main.js');
  for (const token of [
    'DEFAULT_STREAM_WIDGET_STYLES', 'normalizedStreamWidgetStyles',
    'data-widget-style-editor', 'primaryColor', 'secondaryColor',
    'textColor', 'backgroundColor', 'backgroundOpacity',
    'borderRadius', 'goalBarHeight', 'scheduleStreamWidgetStyleRefresh'
  ]) assert.match(renderer, new RegExp(token));
  for (const token of [
    'normalizeStreamWidgetStyles', 'streamWidgetCustomCss',
    'const style = { ...styles[name] }', 'style:styles[normalized]',
    'style: normalizeStreamWidgetStyles(runtimeResourceSettings?.streamWidgetStyles)[widgetType]'
  ]) assert.ok(main.includes(token), token);
});

test('los widgets locales quedan sin animaciones continuas', () => {
  const main = source('main.js');
  for (const token of ['widget-enter','disc-spin','alert-float','goal-flow','gift-float','game-win']) {
    assert.doesNotMatch(main, new RegExp(token), token);
  }
});

test('el widget musical sólo aparece durante solicitudes', () => {
  const renderer = source('renderer.js');
  const main = source('main.js');
  assert.match(renderer, /visible:requestedCurrent \|\| queue\.length > 0/);
  assert.match(renderer, /!current\.isRecommendation/);
  assert.match(main, /data\.visible===false\|\|\(!data\.current&&!items\.length\)/);
  assert.ok(main.includes("id:'playlist-empty', updatedAt:0, provider:'YouTube', visible:false"));
});

test('cada cambio de diseño guarda, refresca y confirma su HTTPS', () => {
  const renderer = source('renderer.js');
  const main = source('main.js');
  const preload = source('preload.js');
  assert.match(preload, /applyStreamWidgetDesign/);
  assert.match(main, /widget:apply-design/);
  assert.match(main, /ensureStableOverlaySource\('widget', type\)/);
  assert.match(renderer, /await persistSettings\(\)/);
  assert.match(renderer, /await api\.applyStreamWidgetDesign\(type\)/);
  assert.match(renderer, /await refreshStreamWidgetInfo\(type, true\)/);
});

test('el HTTPS se activa al abrir cada fuente y muestra el error real', () => {
  const main = source('main.js');
  assert.match(main, /if \(force \|\| !active\) return ensureStableOverlaySource/);
  assert.match(main, /function reportedOverlayTunnel\(stable, fallback\)/);
  assert.match(main, /setOverlayTunnelStatus\('error', `HTTPS fijo: \$\{message\}`/);
  for (const kind of ['widget', 'ranking', 'screen']) {
    assert.match(main, new RegExp(`stableOverlaySourceStatus\\('${kind}'`));
  }
});

test('los controles de ventana sobreviven a un fallo del renderer', () => {
  const preload = source('preload.js');
  const renderer = source('renderer.js');
  const styles = source('styles.css');
  for (const token of ['window:minimize', 'window:maximize', 'window:close', 'stopImmediatePropagation']) {
    assert.match(preload, new RegExp(token.replace(':', '\\:')));
  }
  assert.match(renderer, /try \{ await loadDefaultSounds\(\); \}/);
  assert.match(styles, /\.titlebar\{position:relative!important;z-index:500!important\}/);
  assert.match(styles, /\.release-notice-backdrop\{top:40px!important/);
});
