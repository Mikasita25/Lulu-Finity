'use strict';
const { EventEmitter } = require('node:events');
const { hostCall } = require('./desktop-host.cjs');

const autoUpdater = new EventEmitter();
let updateFound = false;
const compareVersions = (left, right) => {
  const parse = value => {
    const [version, pre = ''] = value.split('-');
    return [...version.split('.').map(Number), pre ? Number(pre.split('.').at(-1)) : Infinity];
  };
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
};
autoUpdater.checkForUpdates = async () => {
  autoUpdater.emit('checking-for-update');
  const version = process.env.LULU_APP_VERSION;
  let info;
  if (process.env.LULU_UPDATE_FEED === 'signed') {
    info = await hostCall('update-check');
  } else {
    const response = await fetch('https://api.github.com/repos/Mikasita25/Lulu-Finity/releases?per_page=50', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lulu-Finity-Rust' },
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`GitHub devolvió HTTP ${response.status}.`);
    const candidates = (await response.json())
      .filter(release => !release.draft && /^rust-v\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(release.tag_name))
      .map(release => ({
        version: release.tag_name.slice(6),
        releaseUrl: release.html_url,
        releaseNotes: release.body
      }))
      .sort((a, b) => compareVersions(b.version, a.version));
    info = candidates[0];
  }
  updateFound = Boolean(info && compareVersions(info.version, version) > 0);
  if (!updateFound) info = { version };
  autoUpdater.emit(updateFound ? 'update-available' : 'update-not-available', info);
  return { updateInfo: info };
};
autoUpdater.downloadUpdate = async () => {
  if (!updateFound) throw new Error('No hay una actualización de Lulu Finity Rust disponible.');
  await hostCall('update-install');
};
autoUpdater.quitAndInstall = () => { void autoUpdater.downloadUpdate().catch(error => autoUpdater.emit('error', error)); };

module.exports = { autoUpdater, compareVersions };
