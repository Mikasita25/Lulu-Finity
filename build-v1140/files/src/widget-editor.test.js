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
    'style: styles[name]', 'style:styles[normalized]',
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
