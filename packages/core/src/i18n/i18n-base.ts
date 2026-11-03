import { DOCUMENT, inject, signal } from '@angular/core';

export type Lang = 'en' | 'de';

/** Text table of one language: every key of the app has a text. */
export type Texts<K extends string> = Record<K, string>;

/**
 * Runtime language switch (prompt 018). `t()` reads the language signal, so templates update.
 * Each app derives its injectable `I18n` and brings its own text tables (and thus its keys).
 */
export abstract class I18nBase<K extends string> {
  private readonly doc = inject(DOCUMENT);
  readonly lang = signal<Lang>(defaultLang(this.doc.defaultView?.navigator.language ?? 'en'));
  protected abstract readonly texts: Record<Lang, Texts<K>>;

  t(key: K, params: Record<string, string | number> = {}): string {
    const text: string = this.texts[this.lang()][key] ?? key;
    return text.replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m));
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    this.doc.documentElement.lang = lang;
  }
}

export function defaultLang(navigatorLanguage: string): Lang {
  return navigatorLanguage.toLowerCase().startsWith('de') ? 'de' : 'en';
}
