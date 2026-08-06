'use strict';

const { createHash } = require('crypto');

function fingerprint(secret) {
  return createHash('sha256').update(String(secret)).digest('hex').slice(0, 10);
}

function parseList(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return raw.split(/[\n,;]+/g).map((item) => item.trim()).filter(Boolean);
}

class KeyPool {
  constructor(keys, options = {}) {
    const unique = [...new Set((keys || []).map((key) => String(key || '').trim()).filter(Boolean))];
    this.cooldownMs = Math.max(1000, Number(options.cooldownMs || 30 * 60 * 1000));
    this.quotaCooldownMs = Math.max(this.cooldownMs, Number(options.quotaCooldownMs || 24 * 60 * 60 * 1000));
    this.maxConnectionsPerKey = Math.max(1, Number(options.maxConnectionsPerKey || 1));
    this.keys = unique.map((secret, index) => ({
      id: `key-${index + 1}-${fingerprint(secret)}`,
      secret,
      active: 0,
      lastUsedAt: 0,
      cooldownUntil: 0,
      disabled: false,
      failures: 0,
      lastReason: ''
    }));
  }

  get size() {
    return this.keys.length;
  }

  acquire(excluded = new Set(), now = Date.now()) {
    const candidates = this.keys
      .filter((item) => !item.disabled)
      .filter((item) => !excluded.has(item.id))
      .filter((item) => item.cooldownUntil <= now)
      .filter((item) => item.active < this.maxConnectionsPerKey)
      .sort((a, b) => a.active - b.active || a.lastUsedAt - b.lastUsedAt || a.id.localeCompare(b.id));
    const selected = candidates[0];
    if (!selected) return null;
    selected.active += 1;
    selected.lastUsedAt = now;
    return selected;
  }

  release(id) {
    const item = this.keys.find((entry) => entry.id === id);
    if (item) item.active = Math.max(0, item.active - 1);
  }

  markSuccess(id) {
    const item = this.keys.find((entry) => entry.id === id);
    if (!item) return;
    item.failures = 0;
    item.lastReason = '';
  }

  markTemporaryLimit(id, reason = '', now = Date.now()) {
    const item = this.keys.find((entry) => entry.id === id);
    if (!item) return;
    item.failures += 1;
    item.cooldownUntil = Math.max(item.cooldownUntil, now + this.cooldownMs);
    item.lastReason = String(reason || '').slice(0, 180);
  }

  markQuotaLimit(id, reason = '', now = Date.now()) {
    const item = this.keys.find((entry) => entry.id === id);
    if (!item) return;
    item.failures += 1;
    item.cooldownUntil = Math.max(item.cooldownUntil, now + this.quotaCooldownMs);
    item.lastReason = String(reason || '').slice(0, 180);
  }

  markInvalid(id, reason = '') {
    const item = this.keys.find((entry) => entry.id === id);
    if (!item) return;
    item.disabled = true;
    item.lastReason = String(reason || '').slice(0, 180);
  }

  nextAvailability(now = Date.now()) {
    const future = this.keys
      .filter((item) => !item.disabled && item.active < this.maxConnectionsPerKey)
      .map((item) => item.cooldownUntil)
      .filter((time) => time > now)
      .sort((a, b) => a - b);
    return future[0] || null;
  }

  snapshot(now = Date.now()) {
    const items = this.keys.map((item) => ({
      id: item.id,
      active: item.active,
      available: !item.disabled && item.cooldownUntil <= now && item.active < this.maxConnectionsPerKey,
      disabled: item.disabled,
      cooldownRemainingMs: Math.max(0, item.cooldownUntil - now),
      failures: item.failures,
      lastReason: item.lastReason
    }));
    return {
      total: items.length,
      available: items.filter((item) => item.available).length,
      activeConnections: items.reduce((sum, item) => sum + item.active, 0),
      items
    };
  }
}

module.exports = { KeyPool, parseList, fingerprint };
