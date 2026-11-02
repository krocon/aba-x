import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { I18n } from '../../core/i18n/i18n';
import { StorageApi } from '../../core/storage/storage-api';
import { DEFAULT_SETTINGS, type Settings, sanitizeSettings, settingsDoc } from './settings-logic';

/** User settings (prompt 018), persisted in the document `settings`; applies theme and language. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(StorageApi);
  private readonly i18n = inject(I18n);
  private readonly doc = inject(DOCUMENT);
  private readOnly = false;

  readonly settings = signal<Settings>({ ...DEFAULT_SETTINGS, lang: this.i18n.lang() });
  readonly angle = computed(() => this.settings().angle);
  readonly approx = computed(() => this.settings().approx);
  readonly digits = computed(() => this.settings().digits);
  readonly timeoutMs = computed(() => this.settings().timeoutSec * 1000);
  readonly problem = signal<string | null>(null);

  constructor() {
    effect(() => {
      const s = this.settings();
      const root = this.doc.documentElement;
      if (s.theme === 'system') delete root.dataset['theme'];
      else root.dataset['theme'] = s.theme;
      this.i18n.setLang(s.lang);
    });
  }

  async restore(): Promise<void> {
    try {
      const raw = (await this.storage.load('settings')).value;
      if (raw === null) return;
      const r = sanitizeSettings(raw, this.settings());
      this.readOnly = r.readOnly;
      this.settings.set(r.settings);
    } catch {
      this.problem.set('Settings could not be loaded.');
    }
  }

  update(patch: Partial<Settings>): void {
    this.settings.update((s) => sanitizeSettings({ ...s, ...patch }, s).settings);
    if (this.readOnly) return;
    this.storage
      .save('settings', settingsDoc(this.settings()))
      .catch(() => this.problem.set('Settings could not be saved.'));
  }

  /** Settings from an imported backup (prompt 017). */
  importRaw(raw: unknown): void {
    this.update(sanitizeSettings(raw, this.settings()).settings);
  }
}
