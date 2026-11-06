import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const DAILY_ID = 'daily-expenses';

let configured = false;
export function configureNotifications(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('reminders', { name: 'תזכורות', importance: Notifications.AndroidImportance.DEFAULT });
  }
}

/** Asked only when the user turns the reminder on. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (current.status === 'denied' && !current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

export function parseTime(time: string): { hour: number; minute: number } {
  const [h = '21', m = '0'] = time.split(':');
  return { hour: Math.min(23, Math.max(0, Number(h) || 0)), minute: Math.min(59, Math.max(0, Number(m) || 0)) };
}

export async function scheduleDailyReminder(time: string): Promise<void> {
  await cancelDailyReminder();
  const { hour, minute } = parseTime(time);
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: { title: 'רשמתם את ההוצאות של היום?', body: 'דקה אחת עכשיו חוסכת הפתעות בסוף החודש.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'reminders' },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => undefined);
}

/**
 * The phone's address for family pushes (new transactions, yesterday's summary).
 * Asks for permission the first time; null when the user said no or the phone can't get one.
 */
export async function getPushToken(): Promise<string | null> {
  try {
    if (!(await ensurePermission())) return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

/** JS handed to the web app with the token (JSON-quoted, so it can't break out of the string). */
export function pushTokenScript(token: string, platform: string): string {
  return `window.__fpPushToken && window.__fpPushToken(${JSON.stringify(token)}, ${JSON.stringify(platform)}); true;`;
}
