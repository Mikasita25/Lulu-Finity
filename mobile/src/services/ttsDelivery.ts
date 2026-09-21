import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LiveEvent } from '@/types/live';
import {
  TtsDeliveryLedger,
  type TtsDeliveryRecord,
  type TtsDeliveryStatus,
} from './ttsDeliveryLedger';

const STORAGE_PREFIX = 'lulu-finity-mobile-tts-completed-v2';

let account = '';
let ledger = new TtsDeliveryLedger();
let hydration = Promise.resolve();

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function eventIdentity(event: LiveEvent) {
  const stable = String(event.id || '').trim();
  if (stable) return stable;
  const fallback = [
    Math.round(Number(event.timestamp) || Date.now()),
    event.uniqueId || event.nickname,
    event.comment || event.giftName || event.fanStickerId || event.type,
  ].join('|');
  return `fallback-${hashText(fallback)}`;
}

function storageKey(value = account) {
  return `${STORAGE_PREFIX}:${value}`;
}

export function setTtsDeliveryAccount(value: string) {
  const nextAccount = value.trim().replace(/^@/, '').toLowerCase();
  const nextLedger = new TtsDeliveryLedger();
  account = nextAccount;
  ledger = nextLedger;
  hydration = nextAccount
    ? AsyncStorage.getItem(storageKey(nextAccount))
        .then((raw) => {
          if (!raw) return;
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) nextLedger.hydrate(parsed as TtsDeliveryRecord[]);
        })
        .catch(() => undefined)
    : Promise.resolve();
}

export async function claimTtsDelivery(event: LiveEvent) {
  const targetAccount = account;
  const targetLedger = ledger;
  const targetHydration = hydration;
  if (!targetAccount) return undefined;
  await targetHydration;
  if (account !== targetAccount || ledger !== targetLedger) return undefined;
  return targetLedger.claim(targetAccount, eventIdentity(event));
}

export function transitionTtsDelivery(
  key: string | undefined,
  status: TtsDeliveryStatus,
  reason?: string,
) {
  if (!key) return;
  const record = ledger.transition(key, status, reason);
  if (record?.status === 'completed') {
    void AsyncStorage.setItem(storageKey(record.account), JSON.stringify(ledger.completed())).catch(
      () => undefined,
    );
  }
}

export function recentTtsDeliveries(limit = 40) {
  return ledger.recent(limit);
}
