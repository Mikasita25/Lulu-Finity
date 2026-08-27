'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('./files/src/reward-wheel-policy');
const widgetPolicy = require('./files/src/widget-customization-policy');

const buildRoot = __dirname;
const repoRoot = path.resolve(buildRoot, '..');

function assertJavaScriptParses(file) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotThrow(() => new Function(source), `${path.basename(file)} debe tener JavaScript válido`);
  return source;
}

test('reward wheel supports configurable segment counts from 2 to 40', () => {
  assert.equal(policy.resizeSegments({}, 2).segments.length, 2);
  assert.equal(policy.resizeSegments({}, 12).segments.length, 12);
  assert.equal(policy.resizeSegments({}, 99).segments.length, 40);
});

test('weights determine deterministic selection and probabilities', () => {
  const config = policy.sanitizeConfig({ segments:[
    { label:'A', weight:1, rewardType:'none', color:'#111111' },
    { label:'B', weight:3, rewardType:'currency_add', amount:500, color:'#222222' }
  ]});
  const probabilities = policy.segmentProbabilities(config);
  assert.equal(probabilities[0].probability, .25);
  assert.equal(probabilities[1].probability, .75);
  assert.equal(policy.pickSegment(config, .10).segment.label, 'A');
  assert.equal(policy.pickSegment(config, .30).segment.label, 'B');
});

test('currency rewards and commands are sanitized', () => {
  const config = policy.sanitizeConfig({ command:' GIRAR ', cost:-10, cooldownSeconds:999999, segments:[
    { label:'Premio', weight:0, rewardType:'currency_add', amount:150.7, color:'red' },
    { label:'Nada', weight:2, rewardType:'unknown', amount:300, color:'#ABCDEF' }
  ]});
  assert.equal(config.command, '!girar');
  assert.equal(config.cost, 0);
  assert.equal(config.cooldownSeconds, 86400);
  assert.equal(config.segments[0].weight, 1);
  assert.equal(config.segments[0].amount, 151);
  assert.equal(config.segments[1].rewardType, 'none');
  assert.equal(config.segments[1].amount, 0);
  assert.equal(config.segments[1].color, '#abcdef');
});

test('custom reward labels stay visible and bounded', () => {
  const config = policy.sanitizeConfig({ segments:[
    { label:'  JACKPOT +5,000 Lunitas  ', weight:1, rewardType:'currency_add', amount:5000, color:'#123456' },
    { label:'Premio especial para el chat', weight:1, rewardType:'message', message:'Gana un premio especial', color:'#654321' }
  ]});
  assert.equal(config.segments[0].label, 'JACKPOT +5,000 Lunitas');
  assert.equal(config.segments[1].message, 'Gana un premio especial');
});

test('music starts with a compact now playing design', () => {
  const all = widgetPolicy.defaults();
  assert.equal(all.playlist.enabled, true);
  assert.equal(all.playlist.layout, 'compact');
  assert.equal(all.playlist.showArtwork, true);
  assert.equal(all.playlist.showQueue, false);
  assert.equal(all.playlist.backgroundColor, '#5b989c');
});

test('free customization excludes game widgets', () => {
  assert.equal(widgetPolicy.sanitizeWidget('game', { enabled:true }), null);
  assert.deepEqual(widgetPolicy.TYPES, ['playlist','wallet','alert','goal','gift']);
});

test('widget customization clamps unsafe visual values', () => {
  const config = widgetPolicy.sanitizeWidget('goal', {
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

test('customization studio browser scripts parse before packaging', () => {
  const files = [
    'widget-customizer-panel.js',
    'widget-customizer-panel-fix.js',
    'preview-panel.js'
  ].map((name) => path.join(buildRoot, 'files', 'src', name));
  for (const file of files) assertJavaScriptParses(file);
});

test('reconstructed now playing template contains the safe progress expression', () => {
  const mainPath = path.join(repoRoot, 'app', 'src', 'main.js');
  if (!fs.existsSync(mainPath)) return;
  const source = fs.readFileSync(mainPath, 'utf8');
  assert.match(source, /widgetCustomizationPolicy/);
  assert.match(source, /lf-progress-track/);
  assert.match(source, /preview\?0\.42:0/);
  assert.doesNotMatch(source, /preview\?\.42/);
  assert.match(source, /artworkUrl:playlistArtworkUrl/);
});
