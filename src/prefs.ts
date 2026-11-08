import * as SecureStore from 'expo-secure-store';

import type { Lang } from './strings';

export type Prefs = {
  lockEnabled: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  /** the one-time "want a reminder / lock?" sheet was already shown */
  askedOnce: boolean;
  launches: number;
  /** the language the web app last showed; null until it says */
  lang: Lang | null;
};

export const DEFAULT_PREFS: Prefs = { lockEnabled: false, reminderEnabled: false, reminderTime: '21:00', askedOnce: false, launches: 0, lang: null };

const KEY = 'family-pocket-prefs-v1';

/** Pure: whatever is stored, come back with a complete, valid Prefs. */
export function normalizePrefs(raw: unknown): Prefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const time = typeof o.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(o.reminderTime) ? o.reminderTime : DEFAULT_PREFS.reminderTime;
  return {
    lockEnabled: o.lockEnabled === true,
    reminderEnabled: o.reminderEnabled === true,
    reminderTime: time,
    askedOnce: o.askedOnce === true,
    launches: typeof o.launches === 'number' && o.launches >= 0 ? Math.floor(o.launches) : 0,
    lang: o.lang === 'he' || o.lang === 'en' || o.lang === 'ar' ? o.lang : null,
  };
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return normalizePrefs(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(p: Prefs): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(p));
}

/** Pure: offer the settings sheet once, on the second launch (by then there is an account to protect). */
export function shouldOfferSetup(p: Prefs): boolean {
  return !p.askedOnce && p.launches >= 2 && !p.lockEnabled && !p.reminderEnabled;
}
