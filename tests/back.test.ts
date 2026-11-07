import { backAction } from '../src/back';

describe('android back button', () => {
  it('goes back inside the site when it can', () => {
    expect(backAction({ locked: false, canGoBack: true })).toBe('webBack');
  });
  it('lets Android close the app on the first page', () => {
    expect(backAction({ locked: false, canGoBack: false })).toBe('system');
  });
  it('never navigates the hidden site while the lock screen is up', () => {
    expect(backAction({ locked: true, canGoBack: true })).toBe('system');
  });
});
