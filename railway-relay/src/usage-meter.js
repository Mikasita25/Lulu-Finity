'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function utcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function nextUtcReset(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)).toISOString();
}

class DailyUsageMeter {
  constructor(options = {}) {
    this.limit = Math.round(positiveNumber(options.limit, 7500));
    this.perConnection = positiveNumber(options.perConnection, 2);
    this.userLimit = Math.round(positiveNumber(options.userLimit, 600));
    this.stateFile = String(options.stateFile || path.join(process.cwd(), '.lulu-usage.json')).trim();
    this.now = typeof options.now === 'function' ? options.now : () => new Date();
    this.state = { date: utcDayKey(this.now()), used: 0, users: {} };
    this.load();
  }

  load() {
    if (!this.stateFile) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        this.state = {
          date: String(parsed.date || this.state.date),
          used: Math.max(0, Number(parsed.used) || 0),
          users: parsed.users && typeof parsed.users === 'object' ? Object.fromEntries(Object.entries(parsed.users).filter(([key, value]) => /^[a-f0-9]{32}$/.test(key) && Number.isFinite(Number(value)) && Number(value) >= 0).map(([key, value]) => [key, Number(value)])) : {}
        };
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') console.warn('[usage] No se pudo leer el contador:', error?.message || error);
    }
    this.rollover();
  }

  rollover(date = this.now()) {
    const key = utcDayKey(date);
    if (this.state.date === key) return false;
    this.state = { date: key, used: 0, users: {} };
    this.persist();
    return true;
  }

  persist() {
    if (!this.stateFile) return;
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      const temporary = `${this.stateFile}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(this.state), 'utf8');
      fs.renameSync(temporary, this.stateFile);
    } catch (error) {
      console.warn('[usage] No se pudo guardar el contador:', error?.message || error);
    }
  }

  userKey(value) {
    const normalized = String(value || '').trim().replace(/^@/, '').toLowerCase();
    return normalized ? createHash('sha256').update(normalized).digest('hex').slice(0, 32) : '';
  }

  userSnapshot(user, date = this.now()) {
    this.rollover(date);
    const key = this.userKey(user);
    const used = key ? Math.max(0, Number(this.state.users?.[key]) || 0) : 0;
    const remaining = Math.max(0, this.userLimit - used);
    return {
      used,
      limit: this.userLimit,
      remaining,
      percent: Math.round((used / this.userLimit) * 1000) / 10,
      resetAt: nextUtcReset(date)
    };
  }

  recordConnection(count = 1, user = '') {
    this.rollover();
    const connections = Math.max(0, Number(count) || 0);
    this.state.used += connections * this.perConnection;
    const key = this.userKey(user);
    if (key && connections) this.state.users[key] = Math.max(0, Number(this.state.users[key]) || 0) + connections;
    this.persist();
    return { ...this.snapshot(), user: this.userSnapshot(user) };
  }

  snapshot(date = this.now()) {
    this.rollover(date);
    const used = Math.max(0, Number(this.state.used) || 0);
    const remaining = Math.max(0, this.limit - used);
    return {
      date: this.state.date,
      used,
      limit: this.limit,
      remaining,
      percent: Math.round((used / this.limit) * 1000) / 10,
      perConnection: this.perConnection,
      estimatedConnectionsUsed: Math.floor(used / this.perConnection),
      estimatedConnectionsRemaining: Math.floor(remaining / this.perConnection),
      resetAt: nextUtcReset(date)
    };
  }
}

module.exports = { DailyUsageMeter, utcDayKey, nextUtcReset };
