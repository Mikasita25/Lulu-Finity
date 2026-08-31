'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mainSource = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const rendererSource = fs.readFileSync(path.join(__dirname, 'renderer.js'), 'utf8');

test('YouTube conserva recursos en segundo plano y vigila la ventana correcta', () => {
  const playerFactory = mainSource.slice(mainSource.indexOf('function createYoutubeWindow()'), mainSource.indexOf('async function openYoutube('));
  const resolverFactory = mainSource.slice(mainSource.indexOf('function createYoutubeResolverWindow()'), mainSource.indexOf('async function findFirstOrganicYoutubeResult'));
  assert.match(playerFactory, /backgroundThrottling:\s*false/);
  assert.match(playerFactory, /attachMusicWindowRecovery\('youtube', youtubeWindow\)/);
  assert.doesNotMatch(resolverFactory, /attachMusicWindowRecovery/);
  assert.match(mainSource, /scheduleMusicPlayerRecovery\(provider, 'pausa inesperada', false\)/);
});

test('los comandos con costo nunca se convierten silenciosamente en gratuitos', () => {
  const chargeFunction = rendererSource.slice(rendererSource.indexOf('async function chargeCommand'), rendererSource.indexOf('async function refundCharge'));
  assert.match(chargeFunction, /if \(amount <= 0\)/);
  assert.match(chargeFunction, /economía desactivada/);
  assert.doesNotMatch(chargeFunction, /!state\.settings\?\.economyEnabled \|\| amount <= 0/);
  assert.match(rendererSource, /commandCostsEnforcedV117/);
  assert.match(rendererSource, /state\.settings\.economyEnabled = true/);
});

test('incluye controles musicales true y stop con los estados solicitados', () => {
  assert.match(mainSource, /trigger: '!true', action: 'resume',[^\n]+enabled: true/);
  assert.match(mainSource, /trigger: '!stop', action: 'pause',[^\n]+enabled: false/);
  assert.match(rendererSource, /musicControlCommandsMigratedV117/);
  assert.match(rendererSource, /command\.action === 'resume' \|\| command\.action === 'pause'/);
  assert.match(rendererSource, /setActiveMusicPaused\(paused\)/);
});

test('los widgets de actividad se publican con visibilidad y caducidad', () => {
  assert.match(rendererSource, /updateStreamWidget\('wallet',[\s\S]*?visible:true, expiresAt/);
  assert.match(rendererSource, /widgetExpiresAt:Date\.now\(\)\+12000/);
  assert.match(rendererSource, /publishStreamWidget\('alert',[\s\S]*?visible:true/);
  assert.match(mainSource, /visible:true,[\s\n]*expiresAt:Date\.now\(\) \+ \(pending \? 95_000 : 12_000\)/);
});
