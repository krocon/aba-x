import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { DE, EN, type TextKey } from './texts';

export type Lang = 'en' | 'de';

/** Runtime language switch (prompt 018). `t()` reads the language signal, so templates update. */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly doc = inject(DOCUMENT);
  readonly lang = signal<Lang>(defaultLang(this.doc.defaultView?.navigator.language ?? 'en'));

  t(key: TextKey, params: Record<string, string | number> = {}): string {
    const text: string = (this.lang() === 'de' ? DE : EN)[key] ?? key;
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
