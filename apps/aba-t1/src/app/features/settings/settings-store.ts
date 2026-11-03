import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { StorageApi } from '@aba/core/storage/storage-api';
import { I18n } from '../../core/i18n/i18n';
import { SETTINGS_VERSION, type T1Settings, defaultSettings, readSettings } from './settings-logic';

/** Settings of ABA-T1 (prompt 027): loaded once, saved on change, language and font applied. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(StorageApi);
  private readonly i18n = inject(I18n);
  private readonly doc = inject(DOCUMENT);
  readonly settings = signal<T1Settings>(defaultSettings(this.i18n.lang()));
  private loaded = false;

  constructor() {
    effect(() => {
      const s = this.settings();
      this.i18n.setLang(s.language);
      this.doc.documentElement.dataset['fontSize'] = s.fontSize;
      if (this.loaded) {
        void this.storage
          .save('settings', { version: SETTINGS_VERSION, ...s })
          .catch((e) => console.error(e));
      }
    });
  }

  async load(): Promise<void> {
    try {
      const doc = await this.storage.load<unknown>('settings');
      this.settings.set(readSettings(doc.value, this.i18n.lang()));
    } catch (e) {
      console.error(e);
    }
    this.loaded = true;
  }

  update(next: T1Settings): void {
    this.settings.set(next);
  }
}
