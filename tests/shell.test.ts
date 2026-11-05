import { opensOutside, parseWebMessage, safeFileName } from '../src/links';
import { shouldRelock } from '../src/lock';
import { DEFAULT_PREFS, normalizePrefs, shouldOfferSetup } from '../src/prefs';
import { parseTime } from '../src/reminders';

describe('links', () => {
  it('keeps the family pocket inside the app', () => {
    expect(opensOutside('https://thefamilypocket.com/')).toBe(false);
    expect(opensOutside('https://www.thefamilypocket.com/privacy/')).toBe(false);
    expect(opensOutside('about:blank')).toBe(false);
    expect(opensOutside('blob:https://thefamilypocket.com/x')).toBe(false);
  });
  it('sends other sites and app links outside', () => {
    expect(opensOutside('https://www.instagram.com/thefamilypocket.il')).toBe(true);
    expect(opensOutside('mailto:a@b.c')).toBe(true);
    expect(opensOutside('whatsapp://send?text=hi')).toBe(true);
    expect(opensOutside('https://evil.example/thefamilypocket.com')).toBe(true);
  });
  it('never sends a frame outside', () => {
    expect(opensOutside('https://www.youtube.com/embed/x', false)).toBe(false);
  });
});

describe('web messages', () => {
  it('accepts the three known messages', () => {
    expect(parseWebMessage('{"type":"openSettings"}')).toEqual({ type: 'openSettings' });
    expect(parseWebMessage('{"type":"share","title":"t","url":"https://thefamilypocket.com/join"}')).toEqual({
      type: 'share',
      title: 't',
      text: undefined,
      url: 'https://thefamilypocket.com/join',
    });
    expect(parseWebMessage('{"type":"file","name":"גיבוי.json","mime":"application/json","text":"{}"}')).toEqual({
      type: 'file',
      name: 'גיבוי.json',
      mime: 'application/json',
      text: '{}',
    });
  });
  it('ignores anything else', () => {
    expect(parseWebMessage('not json')).toBeNull();
    expect(parseWebMessage('{"type":"eval","code":"x"}')).toBeNull();
    expect(parseWebMessage('{"type":"file","name":"","text":"x"}')).toBeNull();
    expect(parseWebMessage('null')).toBeNull();
  });
  it('keeps file names inside the cache folder', () => {
    expect(safeFileName('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(safeFileName('הוצאות 2026-11.csv')).toBe('הוצאות 2026-11.csv');
  });
});

describe('lock', () => {
  it('relocks only after a minute in the background', () => {
    expect(shouldRelock(null, 100_000, 60_000)).toBe(false);
    expect(shouldRelock(0, 59_999, 60_000)).toBe(false);
    expect(shouldRelock(0, 60_000, 60_000)).toBe(true);
  });
});

describe('prefs', () => {
  it('repairs whatever was stored', () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ lockEnabled: 'yes', reminderTime: '9pm', launches: -3 })).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ reminderEnabled: true, reminderTime: '20:00', launches: 4 })).toMatchObject({
      reminderEnabled: true,
      reminderTime: '20:00',
      launches: 4,
    });
  });
  it('offers the setup sheet once, on the second launch', () => {
    expect(shouldOfferSetup({ ...DEFAULT_PREFS, launches: 1 })).toBe(false);
    expect(shouldOfferSetup({ ...DEFAULT_PREFS, launches: 2 })).toBe(true);
    expect(shouldOfferSetup({ ...DEFAULT_PREFS, launches: 5, askedOnce: true })).toBe(false);
    expect(shouldOfferSetup({ ...DEFAULT_PREFS, launches: 5, reminderEnabled: true })).toBe(false);
  });
  it('parses reminder times safely', () => {
    expect(parseTime('20:30')).toEqual({ hour: 20, minute: 30 });
    expect(parseTime('99:99')).toEqual({ hour: 23, minute: 59 });
  });
});
