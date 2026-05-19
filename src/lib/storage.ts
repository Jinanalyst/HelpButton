// LocalStorage-backed persistence. No login → all state is on-device.

import type {
  ContactsConsent,
  FamilyContact,
  HistoryItem,
  Settings,
  Subscription,
  UsageRecord,
} from './types';

const KEYS = {
  onboarded: 'hb.onboarded',
  family: 'hb.family',
  settings: 'hb.settings',
  history: 'hb.history',
  subscription: 'hb.subscription',
  contactsConsent: 'hb.contactsConsent',
  usage: 'hb.usage',
} as const;

// Free-plan cap. Centralized so UI and gate logic stay in sync.
export const FREE_DAILY_LIMIT = 5;

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — silently degrade */
  }
}

// ---- Onboarding ----
export function hasOnboarded(): boolean {
  return safeGet<boolean>(KEYS.onboarded, false);
}
export function markOnboarded(): void {
  safeSet(KEYS.onboarded, true);
}

// ---- Family contact ----
const DEFAULT_FAMILY: FamilyContact = {
  name: '',
  relation: '보호자',
  phone: '',
};
export function getFamily(): FamilyContact {
  return safeGet<FamilyContact>(KEYS.family, DEFAULT_FAMILY);
}
export function setFamily(contact: FamilyContact): void {
  safeSet(KEYS.family, contact);
}

// ---- Settings ----
const DEFAULT_SETTINGS: Settings = {
  fontScale: 'large',
  voiceVolume: 'normal',
  confirmBeforeCall: true,
};
export function getSettings(): Settings {
  return safeGet<Settings>(KEYS.settings, DEFAULT_SETTINGS);
}
export function setSettings(next: Settings): void {
  safeSet(KEYS.settings, next);
}

// ---- History ----
export function getHistory(): HistoryItem[] {
  return safeGet<HistoryItem[]>(KEYS.history, []);
}
export function addHistory(item: HistoryItem): void {
  const list = getHistory();
  list.unshift(item);
  // Cap at 100 entries to stay well under the 5MB localStorage budget.
  if (list.length > 100) list.length = 100;
  safeSet(KEYS.history, list);
}
// Insert or replace a history entry by id (used by chat sessions that grow turn-by-turn).
export function upsertHistory(item: HistoryItem): void {
  const list = getHistory();
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list.splice(idx, 1);
  list.unshift(item);
  if (list.length > 100) list.length = 100;
  safeSet(KEYS.history, list);
}
export function clearHistory(): void {
  safeSet(KEYS.history, []);
}

// ---- Contacts consent (app-level agreement before invoking the browser API) ----
const DEFAULT_CONSENT: ContactsConsent = { granted: false, grantedAt: null };
export function getContactsConsent(): ContactsConsent {
  return safeGet<ContactsConsent>(KEYS.contactsConsent, DEFAULT_CONSENT);
}
export function setContactsConsent(next: ContactsConsent): void {
  safeSet(KEYS.contactsConsent, next);
}
export function grantContactsConsent(): void {
  setContactsConsent({ granted: true, grantedAt: Date.now() });
}
export function revokeContactsConsent(): void {
  setContactsConsent({ granted: false, grantedAt: null });
}

// ---- Usage counter (free-plan daily cap) ----
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getUsageToday(): UsageRecord {
  const raw = safeGet<UsageRecord>(KEYS.usage, { day: todayKey(), count: 0 });
  const today = todayKey();
  if (raw.day !== today) return { day: today, count: 0 };
  return raw;
}

// Returns the new count after bumping.
export function incrementUsage(): number {
  const cur = getUsageToday();
  const next: UsageRecord = { day: cur.day, count: cur.count + 1 };
  safeSet(KEYS.usage, next);
  return next.count;
}

export function resetUsage(): void {
  safeSet(KEYS.usage, { day: todayKey(), count: 0 });
}

// Free plan callers must check this before billing-affecting calls.
export function isFreeLimitReached(): boolean {
  const sub = getSubscription();
  if (sub.plan !== 'free') return false;
  return getUsageToday().count >= FREE_DAILY_LIMIT;
}

// ---- Subscription ----
export function getSubscription(): Subscription {
  return safeGet<Subscription>(KEYS.subscription, { plan: 'free' });
}
export function setSubscription(sub: Subscription): void {
  safeSet(KEYS.subscription, sub);
}
