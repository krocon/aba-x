import { Injectable } from '@angular/core';
import { I18nBase } from '@aba/core/i18n/i18n-base';
import { DE, EN, type TextKey } from './texts';

export { defaultLang, type Lang } from '@aba/core/i18n/i18n-base';

/** The texts of ABA-X1 (EN/DE) on the shared language switch of `@aba/core`. */
@Injectable({ providedIn: 'root' })
export class I18n extends I18nBase<TextKey> {
  protected readonly texts = { en: EN, de: DE };
}
