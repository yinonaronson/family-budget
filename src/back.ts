/**
 * Android's Back button. Without this, Back closes the whole app even when the
 * user is a few screens deep in the site. The settings sheet is a Modal and
 * handles Back on its own (onRequestClose), so it never reaches here.
 */
export type BackAction = 'webBack' | 'system';

export function backAction(s: { locked: boolean; canGoBack: boolean }): BackAction {
  if (s.locked) return 'system';
  return s.canGoBack ? 'webBack' : 'system';
}
