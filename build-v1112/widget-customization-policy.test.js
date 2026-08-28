'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('./files/src/widget-customization-policy');

test('music defaults to compact customizable now playing', () => {
  const all = policy.defaults();
  assert.equal(all.playlist.enabled, true);
  assert.equal(all.playlist.layout, 'compact');
  assert.equal(all.playlist.showArtwork, true);
  assert.equal(all.playlist.showQueue, false);
  assert.equal(all.playlist.backgroundColor, '#5b989c');
});

test('games are intentionally excluded from free customization', () => {
  assert.equal(policy.sanitizeWidget('game', { enabled:true }), null);
  assert.deepEqual(policy.TYPES, ['playlist','wallet','alert','goal','gift']);
});

test('unsafe values are clamped and colors sanitized', () => {
  const config = policy.sanitizeWidget('goal', {
    enabled:true,
    primaryColor:'red',
    secondaryColor:'#ABCDEF',
    backgroundOpacity:999,
    borderRadius:-20,
    blur:90,
    scale:12,
    goalBarHeight:100
  });
  assert.equal(config.primaryColor, '#ff70b5');
  assert.equal(config.secondaryColor, '#abcdef');
  assert.equal(config.backgroundOpacity, 100);
  assert.equal(config.borderRadius, 0);
  assert.equal(config.blur, 32);
  assert.equal(config.scale, 60);
  assert.equal(config.goalBarHeight, 30);
});

test('playlist controls are constrained to supported layouts', () => {
  const config = policy.sanitizeWidget('playlist', {
    layout:'unknown',
    progressHeight:30,
    showArtwork:false,
    showQueue:true,
    showProvider:true
  });
  assert.equal(config.layout, 'compact');
  assert.equal(config.progressHeight, 12);
  assert.equal(config.showArtwork, false);
  assert.equal(config.showQueue, true);
  assert.equal(config.showProvider, true);
});
