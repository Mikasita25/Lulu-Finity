export type TtsDeliveryStatus =
  | 'pending'
  | 'playing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type TtsDeliveryRecord = {
  key: string;
  eventId: string;
  account: string;
  status: TtsDeliveryStatus;
  updatedAt: number;
  reason?: string;
};

const ACTIVE_TTL_MS = 30 * 60_000;
const COMPLETED_TTL_MS = 24 * 60 * 60_000;

export class TtsDeliveryLedger {
  private records = new Map<string, TtsDeliveryRecord>();
  private readonly maxRecords: number;
  private readonly now: () => number;

  constructor(maxRecords = 500, now: () => number = Date.now) {
    this.maxRecords = maxRecords;
    this.now = now;
  }

  hydrate(records: TtsDeliveryRecord[]) {
    const now = this.now();
    for (const record of records) {
      if (record.status !== 'completed') continue;
      if (now - record.updatedAt > COMPLETED_TTL_MS) continue;
      this.records.set(record.key, { ...record });
    }
    this.prune();
  }

  claim(account: string, eventId: string) {
    const normalizedAccount = account.trim().replace(/^@/, '').toLowerCase();
    const normalizedEventId = eventId.trim();
    if (!normalizedAccount || !normalizedEventId) return undefined;

    this.prune();
    const key = `${normalizedAccount}:${normalizedEventId}`;
    if (this.records.has(key)) return undefined;

    const record: TtsDeliveryRecord = {
      key,
      account: normalizedAccount,
      eventId: normalizedEventId,
      status: 'pending',
      updatedAt: this.now(),
    };
    this.records.set(key, record);
    this.prune();
    return key;
  }

  transition(key: string, status: TtsDeliveryStatus, reason?: string) {
    const current = this.records.get(key);
    if (!current) return undefined;
    if (current.status === 'completed' && status !== 'completed') return current;

    const next: TtsDeliveryRecord = {
      ...current,
      status,
      updatedAt: this.now(),
      reason: reason?.trim() || undefined,
    };
    this.records.set(key, next);
    this.prune();
    return next;
  }

  get(key: string) {
    return this.records.get(key);
  }

  completed() {
    this.prune();
    return [...this.records.values()]
      .filter((record) => record.status === 'completed')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, this.maxRecords);
  }

  recent(limit = 40) {
    this.prune();
    return [...this.records.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, limit));
  }

  private prune() {
    const now = this.now();
    for (const [key, record] of this.records) {
      const ttl = record.status === 'completed' ? COMPLETED_TTL_MS : ACTIVE_TTL_MS;
      if (now - record.updatedAt > ttl) this.records.delete(key);
    }

    if (this.records.size <= this.maxRecords) return;
    const oldest = [...this.records.values()].sort((a, b) => a.updatedAt - b.updatedAt);
    for (const record of oldest.slice(0, this.records.size - this.maxRecords)) {
      this.records.delete(record.key);
    }
  }
}
