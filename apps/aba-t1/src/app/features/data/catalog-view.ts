import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { formatValue } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import { NavStore } from '../../core/nav/nav-store';
import { displayOptions } from '../home/home-logic';
import { HomeStore } from '../home/home-store';
import { SettingsStore } from '../settings/settings-store';
import { type DataKind, SLOTS, sizeText } from './data-logic';

/**
 * List catalogue (⇧7) and matrix catalogue (⇧4) – prompt 032: the ten slots L0–L9 / M0–M9 with
 * their size. Enter or Edit opens the table editor, Delete clears a slot, Esc goes home.
 */
@Component({
  selector: 'app-data-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { tabindex: '0' },
  template: `
    <ul class="cat" role="listbox" [attr.aria-label]="title()">
      @for (r of rows(); track r.name; let i = $index) {
        <li
          role="option"
          tabindex="-1"
          [class.cur]="cursor() === i"
          [attr.aria-selected]="cursor() === i"
          (click)="cursor() === i ? edit() : cursor.set(i)"
          (keydown.enter)="edit()"
        >
          <span class="name">{{ r.name }}</span>
          <span class="size">{{ r.size }}</span>
          <span class="preview">{{ r.preview }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }
    .cat {
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 4.2cqw;
    }
    li {
      display: grid;
      grid-template-columns: 2.4em 3.6em 1fr;
      gap: 0.4em;
      padding: 0.15em 0.5em;
      border-bottom: 1px solid #dde4df;
      cursor: pointer;
    }
    li.cur {
      background: #ffe2d8;
    }
    .name {
      font-weight: 600;
    }
    .size {
      color: #5a6c67;
    }
    .preview {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-family: var(--font-mono);
      font-size: 0.85em;
    }
  `,
})
export class DataCatalog implements OnInit, OnDestroy {
  readonly kind = input<DataKind>('list');
  private readonly home = inject(HomeStore);
  private readonly settings = inject(SettingsStore);
  private readonly device = inject(DeviceStore);
  private readonly nav = inject(NavStore);
  private readonly i18n = inject(I18n);
  protected readonly cursor = signal(0);
  protected readonly title = computed(() =>
    this.kind() === 'list' ? this.i18n.t('data.lists') : this.i18n.t('data.matrices'),
  );
  protected readonly rows = computed(() => {
    const o = displayOptions(this.settings.settings());
    return SLOTS[this.kind()].map((name) => {
      const v = this.home.variables().get(name);
      return { name, size: sizeText(v), preview: v ? formatValue(v, o) : '' };
    });
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'catalog',
      title: () => this.title(),
      menu: () => [
        { label: this.i18n.t('data.edit') },
        { label: this.i18n.t('data.delete') },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (i === 0) this.edit();
        if (i === 1) this.home.remove(this.rows()[this.cursor()].name);
        if (i === 5) this.nav.go('home');
      },
      rocker: (d) => this.rocker(d),
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected edit(): void {
    this.nav.go('editor', this.rows()[this.cursor()].name);
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'esc') {
      this.nav.go('home');
      return true;
    }
    if (p.id === 'enter') {
      this.edit();
      return true;
    }
    if (p.layer === 'main' && /^d\d$/.test(p.id)) {
      this.cursor.set(Number(p.id.slice(1)));
      return true;
    }
    if (p.id === 'bksp') {
      this.home.remove(this.rows()[this.cursor()].name);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    const n = this.rows().length;
    if (d === 'up') this.cursor.update((c) => (c + n - 1) % n);
    if (d === 'down') this.cursor.update((c) => (c + 1) % n);
    if (d === 'right') this.edit();
    return true;
  }
}
