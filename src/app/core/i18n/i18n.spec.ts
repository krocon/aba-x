import { TestBed } from '@angular/core/testing';
import { I18n, defaultLang } from './i18n';
import { DE, EN } from './texts';

describe('I18n', () => {
  it('has a German text for every key and the same placeholders', () => {
    for (const key of Object.keys(EN) as (keyof typeof EN)[]) {
      expect(DE[key], key).toBeTruthy();
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(DE[key])).toEqual(ph(EN[key]));
    }
  });

  it('switches at runtime and fills placeholders', () => {
    const i = TestBed.inject(I18n);
    i.setLang('en');
    expect(i.t('import.variables', { n: 3 })).toBe('3 variable(s)');
    i.setLang('de');
    expect(i.t('import.variables', { n: 3 })).toBe('3 Variable(n)');
    expect(document.documentElement.lang).toBe('de');
  });

  it('picks German for de-* browsers', () => {
    expect(defaultLang('de-DE')).toBe('de');
    expect(defaultLang('en-US')).toBe('en');
  });
});
