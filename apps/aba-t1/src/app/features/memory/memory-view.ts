import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AppStore } from '../../apps/app-store';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import { NavStore } from '../../core/nav/nav-store';
import { CasStore } from '../cas/cas-store';
import { HomeStore } from '../home/home-store';
import { NotesStore } from '../notes/notes-store';
import { RpnStore } from '../rpn/rpn-store';

interface Category {
  id: string;
  label: TextKey;
  count: number;
  bytes: number;
  clear: () => void;
}

const size = (x: unknown) => new Blob([JSON.stringify(x ?? null)]).size;

/**
 * Memory manager (prompt 045, ⇧Toolbox): what is stored, how much, and clearing a category after
 * a second confirmation.
 */
@Component({
  selector: 'app-memory-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { tabindex: '0', role: 'region', '[attr.aria-label]': 'i18n.t("mem.title")' },
  template: `
    <table class="mem">
      <tbody>
        @for (c of categories(); track c.id; let i = $index) {
          <tr [class.cur]="cursor() === i" (click)="cursor.set(i)">
            <th scope="row">{{ i18n.t(c.label) }}</th>
            <td>{{ c.count }}</td>
            <td>{{ kb(c.bytes) }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
      font-size: 4cqw;
    }
    .mem {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 0.2em 0.5em;
      border-bottom: 1px solid #dde4df;
      text-align: right;
    }
    th {
      text-align: left;
      font-weight: 400;
    }
    tr.cur {
      background: #ffe2d8;
    }
  `,
})
export class MemoryView implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly device = inject(DeviceStore);
  private readonly nav = inject(NavStore);
  private readonly home = inject(HomeStore);
  private readonly rpn = inject(RpnStore);
  private readonly cas = inject(CasStore);
  private readonly apps = inject(AppStore);
  private readonly notes = inject(NotesStore);
  protected readonly cursor = signal(0);
  private readonly confirm = signal(false);
  protected readonly categories = computed<Category[]>(() => {
    const vars = [...this.home.variables()];
    const lists = vars.filter(([, v]) => v.kind === 'list');
    const mats = vars.filter(([, v]) => v.kind === 'matrix');
    const others = vars.filter(([, v]) => v.kind !== 'list' && v.kind !== 'matrix');
    const keep = (pred: (v: (typeof vars)[number]) => boolean) => () => {
      for (const v of vars) if (pred(v)) this.home.remove(v[0]);
    };
    return [
      {
        id: 'history',
        label: 'mem.history',
        count: this.home.entries().length,
        bytes: size(this.home.entries()),
        clear: () => this.home.clearHistory(),
      },
      {
        id: 'vars',
        label: 'mem.vars',
        count: others.length + this.home.functions().size,
        bytes: size(others),
        clear: keep(([, v]) => v.kind !== 'list' && v.kind !== 'matrix'),
      },
      {
        id: 'lists',
        label: 'mem.lists',
        count: lists.length,
        bytes: size(lists),
        clear: keep(([, v]) => v.kind === 'list'),
      },
      {
        id: 'matrices',
        label: 'mem.matrices',
        count: mats.length,
        bytes: size(mats),
        clear: keep(([, v]) => v.kind === 'matrix'),
      },
      {
        id: 'rpn',
        label: 'mem.rpn',
        count: this.rpn.stack().length,
        bytes: size(this.rpn.stack()),
        clear: () => this.rpn.clear(),
      },
      {
        id: 'cas',
        label: 'mem.cas',
        count: this.cas.entries().length,
        bytes: size(this.cas.entries()),
        clear: () => this.cas.clearHistory(),
      },
      {
        id: 'apps',
        label: 'mem.apps',
        count: this.apps.instances().length,
        bytes: size(this.apps.instances()),
        clear: () => {
          for (const i of this.apps.instances()) {
            if (i.copy) this.apps.remove(i.id);
            else this.apps.reset(i.id);
          }
        },
      },
      {
        id: 'notes',
        label: 'mem.notes',
        count: this.notes.notes().length,
        bytes: size(this.notes.notes()),
        clear: () => this.notes.clear(),
      },
    ];
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'memory',
      title: () => (this.confirm() ? this.i18n.t('mem.ask') : this.i18n.t('mem.title')),
      menu: () =>
        this.confirm()
          ? [
              { label: '' },
              { label: '' },
              { label: '' },
              { label: '' },
              { label: this.i18n.t('home.no') },
              { label: this.i18n.t('home.yes') },
            ]
          : [
              { label: this.i18n.t('mem.clear') },
              { label: '' },
              { label: '' },
              { label: '' },
              { label: '' },
              { label: 'OK' },
            ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (this.confirm()) {
          if (i === 5) this.categories()[this.cursor()].clear();
          if (i >= 4) this.confirm.set(false);
          return;
        }
        if (i === 0) this.confirm.set(true);
        if (i === 5) this.nav.go('home');
      },
      rocker: (d) => this.rocker(d),
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected kb(b: number): string {
    return b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} kB`;
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'esc') {
      if (this.confirm()) this.confirm.set(false);
      else this.nav.go('home');
      return true;
    }
    if (p.id === 'bksp') {
      this.confirm.set(true);
      return true;
    }
    return p.id === 'enter';
  }

  private rocker(d: RockerDir): boolean {
    const n = this.categories().length;
    if (d === 'up') this.cursor.update((c) => (c + n - 1) % n);
    if (d === 'down') this.cursor.update((c) => (c + 1) % n);
    return true;
  }
}
