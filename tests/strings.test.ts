import { parseWebMessage } from '../src/links';
import { normalizePrefs } from '../src/prefs';
import { asLang, layoutFor, STRINGS } from '../src/strings';

describe('language', () => {
  it('maps phone and web language codes to ours', () => {
    expect(asLang('en-US')).toBe('en');
    expect(asLang('ar')).toBe('ar');
    expect(asLang('iw')).toBe('he');
    expect(asLang('fr')).toBe('he');
    expect(asLang(undefined)).toBe('he');
  });
  it('every language has every text', () => {
    const keys = Object.keys(STRINGS.he).sort();
    for (const l of ['en', 'ar'] as const) {
      expect(Object.keys(STRINGS[l]).sort()).toEqual(keys);
      for (const k of keys) expect(STRINGS[l][k as keyof typeof STRINGS.he].length).toBeGreaterThan(0);
    }
  });
  it('english text reads left-to-right inside the right-to-left app', () => {
    expect(layoutFor('en', true)).toEqual({ textAlign: 'right', rowDirection: 'row-reverse', writingDirection: 'ltr' });
    expect(layoutFor('he', true)).toEqual({ textAlign: 'left', rowDirection: 'row', writingDirection: 'rtl' });
    expect(layoutFor('ar', true).rowDirection).toBe('row');
  });
  it('the web app reports its language', () => {
    expect(parseWebMessage('{"type":"lang","lang":"ar"}')).toEqual({ type: 'lang', lang: 'ar' });
    expect(parseWebMessage('{"type":"lang","lang":"xx"}')).toEqual({ type: 'lang', lang: 'he' });
  });
  it('the chosen language is remembered, and junk is dropped', () => {
    expect(normalizePrefs({ lang: 'en' }).lang).toBe('en');
    expect(normalizePrefs({ lang: 'de' }).lang).toBe(null);
    expect(normalizePrefs(null).lang).toBe(null);
  });
});
