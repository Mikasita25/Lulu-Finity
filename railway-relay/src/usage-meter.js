'use strict';

const fs = require('fs');
const path = require('path');

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
    this.stateFile = String(options.stateFile || path.join(process.cwd(), '.lulu-usage.json')).trim();
    this.now = typeof options.now === 'function' ? options.now : () => new Date();
    this.state = { date: utcDayKey(this.now()), used: 0 };
    this.load();
  }

  load() {
    if (!this.stateFile) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        this.state = {
          date: String(parsed.date || this.state.date),
          used: Math.max(0, Number(parsed.used) || 0)
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
    this.state = { date: key, used: 0 };
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

  recordConnection(count = 1) {
    this.rollover();
    const connections = Math.max(0, Number(count) || 0);
    this.state.used += connections * this.perConnection;
    this.persist();
    return this.snapshot();
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
