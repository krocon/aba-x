import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import { NavStore } from '../../core/nav/nav-store';
import { SETTING_ROWS, type SettingRow, cycle, valueOf, withValue } from './settings-logic';
import { SettingsStore } from './settings-store';

/**
 * Home settings (prompt 027, shift + Home): one row per setting. Rocker/arrows choose a row and
 * change it, a tap on a value cycles it, Esc or OK goes back to the home view.
 */
@Component({
  selector: 'app-settings-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings" role="list">
      @for (r of rows(); track r.id; let i = $index) {
        <div class="row" role="listitem" [class.cur]="cursor() === i">
          <label [for]="'set-' + r.id">{{ i18n.t(r.label) }}</label>
          <select
            [id]="'set-' + r.id"
            [value]="r.value"
            (focus)="cursor.set(i)"
            (change)="set(r.id, $any($event.target).value)"
          >
            @for (o of r.options; track o) {
              <option [value]="o" [selected]="o === r.value">{{ optionLabel(r.id, o) }}</option>
            }
          </select>
        </div>
      }
      <p class="hint">{{ i18n.t('settings.hint') }}</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }
    .settings {
      padding: 0.3em 0.5em;
      font-size: 4cqw;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5em;
      padding: 0.15em 0.3em;
      border-radius: 0.2em;
    }
    .row.cur {
      background: #ffe2d8;
    }
    select {
      font: inherit;
      min-width: 45%;
      color: inherit;
      background: #fff;
      border: 1px solid #c9d5d1;
      border-radius: 0.2em;
    }
    .hint {
      margin: 0.4em 0 0;
      color: #5a6c67;
      font-size: 0.8em;
    }
  `,
})
export class SettingsView implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly store = inject(SettingsStore);
  private readonly device = inject(DeviceStore);
  private readonly nav = inject(NavStore);
  protected readonly cursor = signal(0);
  protected readonly rows = computed(() => {
    const s = this.store.settings();
    return SETTING_ROWS.map((r) => ({
      ...r,
      label: `settings.${r.id}` as TextKey,
      value: valueOf(s, r.id),
    }));
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'homeSettings',
      title: () => this.i18n.t('settings.title'),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: this.i18n.t('settings.ok') },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (i === 5) this.close();
      },
      rocker: (d) => this.rocker(d),
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected optionLabel(id: SettingRow['id'], o: string): string {
    if (id === 'digits') return o;
    return this.i18n.t(`opt.${o}` as TextKey);
  }

  protected set(id: SettingRow['id'], v: string): void {
    this.store.update(withValue(this.store.settings(), id, v));
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'esc' || (p.id === 'home' && p.layer === 'main')) {
      this.close();
      return true;
    }
    if (p.id === 'enter') {
      this.change(1);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    const n = SETTING_ROWS.length;
    if (d === 'up') this.cursor.update((c) => (c + n - 1) % n);
    else if (d === 'down') this.cursor.update((c) => (c + 1) % n);
    else this.change(d === 'right' ? 1 : -1);
    return true;
  }

  private change(step: 1 | -1): void {
    const id = SETTING_ROWS[this.cursor()].id;
    this.store.update(cycle(this.store.settings(), id, step));
  }

  private close(): void {
    this.nav.go('home');
  }
}
