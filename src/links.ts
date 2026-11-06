import { INTERNAL_HOSTS } from './config';

/**
 * Pure: should a navigation leave the app?
 * Our own pages stay inside; other web pages (Instagram, a bank's site), mailto/tel/whatsapp
 * links and app-store links open outside, where the user's own apps handle them.
 * Frames and internal schemes (about:, blob:, data:) are never sent out.
 */
export function opensOutside(url: string, isTopFrame = true): boolean {
  if (!isTopFrame) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === 'about:' || u.protocol === 'blob:' || u.protocol === 'data:') return false;
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return true;
  return !INTERNAL_HOSTS.includes(u.hostname.toLowerCase());
}

/** Messages the web app sends to the shell (window.ReactNativeWebView.postMessage). */
export type WebMessage =
  | { type: 'openSettings' }
  | { type: 'signedIn' }
  | { type: 'share'; title?: string; text?: string; url?: string }
  | { type: 'file'; name: string; mime?: string; text: string };

/** Pure: parse and validate one message; anything unexpected is ignored. */
export function parseWebMessage(raw: string): WebMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  switch (o.type) {
    case 'openSettings':
      return { type: 'openSettings' };
    case 'signedIn':
      return { type: 'signedIn' };
    case 'share':
      return { type: 'share', title: str(o.title), text: str(o.text), url: str(o.url) };
    case 'file': {
      const name = safeFileName(str(o.name) ?? '');
      const text = str(o.text);
      if (!name || text === undefined) return null;
      return { type: 'file', name, mime: str(o.mime), text };
    }
    default:
      return null;
  }
}

/** Keeps a file name a plain name (no folders), with something left to call it. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim();
  return cleaned.slice(0, 120);
}

/**
 * Runs in the page before it loads: routes navigator.share to the phone's share sheet
 * (the web app already uses it for invite links).
 */
export const INJECTED_BEFORE_LOAD = `
(function(){
  try {
    window.__FAMILY_POCKET_APP__ = true;
    navigator.share = function(data){
      data = data || {};
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'share', title:data.title, text:data.text, url:data.url}));
      return Promise.resolve();
    };
  } catch (e) {}
  true;
})();
`;
