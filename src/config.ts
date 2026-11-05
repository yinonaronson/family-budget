/** The web app this shell hosts. Everything the family sees comes from here. */
export const SITE_URL = 'https://thefamilypocket.com/';

/** Hosts that stay inside the app. Any other link opens in the phone's browser or app. */
export const INTERNAL_HOSTS = ['thefamilypocket.com', 'www.thefamilypocket.com'];

export const COLORS = {
  background: '#f4f4f1',
  primary: '#2a78d6',
  text: '#1d1d1f',
  muted: '#6b6b70',
  card: '#ffffff',
  border: '#e3e3de',
};

/** How long the app may sit in the background before the lock comes back. */
export const LOCK_AFTER_MS = 60_000;

export const REMINDER_TIMES = ['19:00', '20:00', '21:00', '22:00'] as const;
