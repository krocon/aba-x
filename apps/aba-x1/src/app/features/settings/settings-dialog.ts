import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { I18n } from '../../core/i18n/i18n';
import { Modal } from '@aba/core/shared/modal';
import type { TextKey } from '../../core/i18n/texts';
import type { Theme } from './settings-logic';
import { SettingsStore } from './settings-store';

/** SETUP (prompt 018): every change applies and is saved immediately. */
@Component({
  selector: 'app-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    <app-modal [heading]="i18n.t('settings.title')" (closed)="closed.emit()">
      <form class="form" (submit)="$event.preventDefault()">
        <fieldset>
          <legend>{{ i18n.t('settings.angle') }}</legend>
          <label
            ><input
              type="radio"
              name="angle"
              [checked]="s().angle === 'rad'"
              (change)="store.update({ angle: 'rad' })"
            />
            {{ i18n.t('settings.rad') }}</label
          >
          <label
            ><input
              type="radio"
              name="angle"
              [checked]="s().angle === 'deg'"
              (change)="store.update({ angle: 'deg' })"
            />
            {{ i18n.t('settings.deg') }}</label
          >
        </fieldset>
        <fieldset>
          <legend>{{ i18n.t('settings.result') }}</legend>
          <label
            ><input
              type="radio"
              name="approx"
              [checked]="!s().approx"
              (change)="store.update({ approx: false })"
            />
            {{ i18n.t('settings.exact') }}</label
          >
          <label
            ><input
              type="radio"
              name="approx"
              [checked]="s().approx"
              (change)="store.update({ approx: true })"
            />
            {{ i18n.t('settings.approx') }}</label
          >
        </fieldset>
        <label class="row">
          {{ i18n.t('settings.digits') }}
          <input
            type="number"
            min="6"
            max="15"
            [value]="s().digits"
            (change)="num($event, 'digits')"
          />
        </label>
        <label class="row">
          {{ i18n.t('settings.timeout') }}
          <input
            type="number"
            min="1"
            max="60"
            [value]="s().timeoutSec"
            (change)="num($event, 'timeoutSec')"
          />
        </label>
        <fieldset>
          <legend>{{ i18n.t('settings.theme') }}</legend>
          @for (t of themes; track t) {
            <label
              ><input
                type="radio"
                name="theme"
                [checked]="s().theme === t"
                (change)="store.update({ theme: t })"
              />
              {{ i18n.t(themeKey[t]) }}</label
            >
          }
        </fieldset>
        <fieldset>
          <legend>{{ i18n.t('settings.layout') }}</legend>
          <label>
            <input
              type="checkbox"
              [checked]="s().fullSize"
              (change)="store.update({ fullSize: !s().fullSize })"
            />
            {{ i18n.t('settings.fullSize') }}
          </label>
        </fieldset>
        <fieldset>
          <legend>{{ i18n.t('settings.language') }}</legend>
          <label
            ><input
              type="radio"
              name="lang"
              [checked]="s().lang === 'en'"
              (change)="store.update({ lang: 'en' })"
            />
            English</label
          >
          <label
            ><input
              type="radio"
              name="lang"
              [checked]="s().lang === 'de'"
              (change)="store.update({ lang: 'de' })"
            />
            Deutsch</label
          >
        </fieldset>
      </form>
      <div class="dialog-actions">
        <button type="button" class="btn primary" (click)="closed.emit()">
          {{ i18n.t('dialog.close') }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .form {
      display: grid;
      gap: 0.75rem;
    }
    fieldset {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      margin: 0;
      padding: 0.4rem 0.75rem 0.6rem;
      border: 1px solid var(--color-border);
      border-radius: 6px;
    }
    legend {
      padding: 0 0.25rem;
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    input[type='number'] {
      width: 4.5rem;
      font: inherit;
      padding: 0.2rem 0.4rem;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-surface);
      color: var(--color-text);
    }
  `,
})
export class SettingsDialog {
  protected readonly i18n = inject(I18n);
  protected readonly store = inject(SettingsStore);
  protected readonly s = this.store.settings;
  protected readonly themes = ['system', 'light', 'dark'] as const;
  protected readonly themeKey: Record<Theme, TextKey> = {
    system: 'settings.system',
    light: 'settings.light',
    dark: 'settings.dark',
  };
  readonly closed = output<void>();

  protected num(e: Event, key: 'digits' | 'timeoutSec'): void {
    this.store.update({ [key]: Number((e.target as HTMLInputElement).value) });
  }
}
