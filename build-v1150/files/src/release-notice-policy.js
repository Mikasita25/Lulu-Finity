'use strict';

(function exposeReleaseNoticePolicy(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.releaseNoticePolicy = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function normalizeVersion(value) {
    return String(value || '').trim().replace(/^v/i, '');
  }

  function versionParts(value) {
    const match = normalizeVersion(value).match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    return match ? match.slice(1, 4).map((part) => Number(part || 0)) : null;
  }

  function compareVersions(left, right) {
    const a = versionParts(left);
    const b = versionParts(right);
    if (!a || !b) return normalizeVersion(left).localeCompare(normalizeVersion(right));
    for (let index = 0; index < 3; index += 1) {
      if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
    }
    return 0;
  }

  function firstInstalledVersionFor({ settingsExisted, currentVersion, lastSeenVersion } = {}) {
    if (!settingsExisted) return normalizeVersion(currentVersion);
    return normalizeVersion(lastSeenVersion) || 'legacy';
  }

  function releaseNoticeMode({ currentVersion, firstInstalledVersion, lastSeenVersion } = {}) {
    const current = normalizeVersion(currentVersion);
    const installed = normalizeVersion(firstInstalledVersion);
    const seen = normalizeVersion(lastSeenVersion);
    if (!current || seen === current) return 'none';
    if (!seen && installed === current) return 'install';
    if (seen && compareVersions(current, seen) <= 0) return 'none';
    return 'update';
  }

  return Object.freeze({ compareVersions, firstInstalledVersionFor, normalizeVersion, releaseNoticeMode });
}));
