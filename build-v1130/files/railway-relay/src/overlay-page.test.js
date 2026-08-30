'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { overlayPageCsp, renderOverlayPage } = require('./overlay-page');

test('el HTTPS refleja temas, fondos y el editor propio', () => {
  const html = renderOverlayPage('a'.repeat(32), 'widget', 'goal');
  for (const token of [
    'const themeMap=', 'hologram:', 'sakura:', 'vampire:',
    'const backgroundMap=', 'confetti:', 'midnight:',
    'style?.enabled===true', 'style.primaryColor', 'style.backgroundOpacity',
    "setProperty('--goal-height'", 'applyAppearance(data)'
  ]) assert.match(html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(overlayPageCsp(), /frame-ancestors \*/);
});

test('las fuentes HTTPS no incluyen animaciones visuales', () => {
  const html = renderOverlayPage('b'.repeat(32), 'widget', 'playlist');
  assert.doesNotMatch(html, /animation\s*:/i);
  assert.doesNotMatch(html, /@keyframes/i);
  assert.doesNotMatch(html, /transition\s*:/i);
});
