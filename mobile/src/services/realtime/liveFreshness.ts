import type { LiveEvent } from '@/types/live';

export const RECONNECT_DRAIN_MS = 2_500;
export const MAX_EVENT_AGE_MS = 20_000;

const INITIAL_EVENT_GRACE_MS = 12_000;
const RECONNECT_EVENT_GRACE_MS = 6_000;
const RECENT_EVENT_TTL_MS = 10 * 60_000;
const MAX_RECENT_EVENTS = 1_000;

/**
 * Prevents packets buffered by Android, the relay or TikTok from becoming new
 * LIVE activity after the app resumes or the socket reconnects.
 */
export class LiveFreshnessGate {
  private active = false;
  private eventFloor = 0;
  private drainUntil = 0;
  private reconnecting = false;
  private recentEvents = new Map<string, number>();

  startSession(now = Date.now()) {
    this.active = true;
    this.eventFloor = now - INITIAL_EVENT_GRACE_MS;
    this.drainUntil = 0;
    this.reconnecting = false;
    this.recentEvents.clear();
  }

  beginReconnect(now = Date.now()) {
    if (!this.active) this.startSession(now);
    this.reconnecting = true;
    this.eventFloor = Math.max(this.eventFloor, now - RECONNECT_EVENT_GRACE_MS);
    this.drainUntil = Math.max(this.drainUntil, now + RECONNECT_DRAIN_MS);
  }

  markConnected(now = Date.now(), reconnected = false) {
    if (!this.active) this.startSession(now);
    if (reconnected || this.reconnecting) {
      this.eventFloor = Math.max(this.eventFloor, now - RECONNECT_EVENT_GRACE_MS);
      // Euler can emit a short catch-up bundle immediately after reopening.
      // Draining it is preferable to reading several old comments as if new.
      this.drainUntil = Math.max(this.drainUntil, now + RECONNECT_DRAIN_MS);
    }
    this.reconnecting = false;
  }

  stop() {
    this.active = false;
    this.eventFloor = 0;
    this.drainUntil = 0;
    this.reconnecting = false;
    this.recentEvents.clear();
  }

  accept(event: LiveEvent, now = Date.now()) {
    if (!this.active || now < this.drainUntil) return false;

    const timestamp = Number(event.timestamp);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      if (timestamp < this.eventFloor) return false;
      if (now - timestamp > MAX_EVENT_AGE_MS) return false;
    }

    this.prune(now);
    const key = String(event.id || '').trim();
    if (key && this.recentEvents.has(key)) return false;
    if (key) this.recentEvents.set(key, now);
    return true;
  }

  private prune(now: number) {
    if (this.recentEvents.size < MAX_RECENT_EVENTS) return;
    const oldestAllowed = now - RECENT_EVENT_TTL_MS;
    for (const [key, seenAt] of this.recentEvents) {
      if (seenAt >= oldestAllowed && this.recentEvents.size <= MAX_RECENT_EVENTS) break;
      this.recentEvents.delete(key);
    }
  }
}
