// LocalStorage-backed persistence. No login → all state is on-device.

import type { FamilyContact, HistoryItem, Settings, Subscription } from './types';

const KEYS = {
  onboarded: 'hb.onboarded',
  family: 'hb.family',
  settings: 'hb.settings',
  history: 'hb.history',
  subscription: 'hb.subscription',
} as const;

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
  autoFamilyAlert: true,
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
export function clearHistory(): void {
  safeSet(KEYS.history, []);
}

// ---- Subscription ----
export function getSubscription(): Subscription {
  return safeGet<Subscription>(KEYS.subscription, { plan: 'free' });
}
export function setSubscription(sub: Subscription): void {
  safeSet(KEYS.subscription, sub);
}
