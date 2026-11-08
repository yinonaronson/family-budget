import * as LocalAuthentication from 'expo-local-authentication';

import type { Strings } from './strings';

/** Pure: after this long in the background, the lock comes back. */
export function shouldRelock(backgroundedAt: number | null, now: number, afterMs: number): boolean {
  return backgroundedAt !== null && now - backgroundedAt >= afterMs;
}

/** Face ID / Touch ID / fingerprint is set up on this phone. */
export async function biometricsAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function unlock(s: Strings): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: s.unlockPrompt,
    cancelLabel: s.cancel,
    fallbackLabel: s.usePasscode,
  });
  return r.success;
}
