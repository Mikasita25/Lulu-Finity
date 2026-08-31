'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { compareVersions, firstInstalledVersionFor, releaseNoticeMode } = require('./release-notice-policy');

test('crea un marcador distinto para una instalación limpia y una configuración anterior', () => {
  assert.equal(firstInstalledVersionFor({ settingsExisted:false, currentVersion:'v1.1.2' }), '1.1.2');
  assert.equal(firstInstalledVersionFor({ settingsExisted:true, currentVersion:'1.1.2', lastSeenVersion:'' }), 'legacy');
  assert.equal(firstInstalledVersionFor({ settingsExisted:true, currentVersion:'1.1.2', lastSeenVersion:'1.1.1' }), '1.1.1');
});

test('separa una instalación nueva de una actualización', () => {
  assert.equal(releaseNoticeMode({ currentVersion:'1.1.2', firstInstalledVersion:'1.1.2', lastSeenVersion:'' }), 'install');
  assert.equal(releaseNoticeMode({ currentVersion:'1.1.2', firstInstalledVersion:'1.1.1', lastSeenVersion:'1.1.1' }), 'update');
});

test('trata una configuración anterior sin marcador como actualización', () => {
  assert.equal(releaseNoticeMode({ currentVersion:'1.1.2', firstInstalledVersion:'legacy', lastSeenVersion:'' }), 'update');
});

test('muestra cada aviso una sola vez y no presenta un downgrade como actualización', () => {
  assert.equal(releaseNoticeMode({ currentVersion:'1.1.2', firstInstalledVersion:'1.1.1', lastSeenVersion:'1.1.2' }), 'none');
  assert.equal(releaseNoticeMode({ currentVersion:'1.1.1', firstInstalledVersion:'1.1.1', lastSeenVersion:'1.1.2' }), 'none');
  assert.equal(compareVersions('1.1.10', '1.1.2'), 1);
});
