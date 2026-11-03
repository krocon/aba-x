import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { KeyPress } from '../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../core/device/device-store';
import { I18n } from '../core/i18n/i18n';
import { NavStore } from '../core/nav/nav-store';
import type { MenuButton } from '../features/device/t1-device';
import { editFor } from '../features/home/home-keys';
import { AppStore } from './app-store';

const COLS = 4;

/**
 * App library (prompt 033, Apps key): tiles with own icons. Rocker or touch choose, Enter or Start
 * opens the app. Save stores a copy under a new name, Reset restores the app, Sort switches between
 * alphabetical and last used, Delete removes a copy.
 */
@Component({
  selector: 'app-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lib">
      <div class="tiles" role="listbox" [attr.aria-label]="i18n.t('app.library')">
        @for (a of tiles(); track a.id; let i = $index) {
          <button
            type="button"
            role="option"
            class="tile"
            [class.cur]="cursor() === i"
            [attr.aria-selected]="cursor() === i"
            (pointerdown)="$event.preventDefault()"
            (click)="cursor() === i ? start() : cursor.set(i)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="a.icon" /></svg>
            <span>{{ a.name }}</span>
          </button>
        }
      </div>
      @if (naming()) {
        <div class="name">
          <label for="app-copy-name">{{ i18n.t('app.copyName') }}</label>
          <input
            id="app-copy-name"
            #name
            type="text"
            spellcheck="false"
            (keydown.enter)="saveCopy()"
            (keydown.escape)="naming.set(false)"
          />
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .lib {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100%;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.2cqw;
      padding: 1.5cqw;
      align-content: start;
      overflow-y: auto;
    }
    .tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6cqw;
      padding: 1cqw 0.5cqw;
      border: 0;
      border-radius: 1.5cqw;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 3.2cqw;
      cursor: pointer;
    }
    .tile.cur {
      background: #ffe2d8;
    }
    svg {
      width: 11cqw;
      height: 11cqw;
      padding: 1cqw;
      border-radius: 2cqw;
      background: #1b3533;
      fill: none;
      stroke: #b9dc6e;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .name {
      display: flex;
      gap: 0.4em;
      padding: 0.2em 0.5em;
      border-top: 2px solid #1b3533;
      font-size: 4cqw;
      background: #fff;
    }
    .name input {
      flex: 1;
      font: inherit;
    }
  `,
})
export class LibraryView implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  private readonly device = inject(DeviceStore);
  private readonly nav = inject(NavStore);
  private readonly nameEl = viewChild<ElementRef<HTMLInputElement>>('name');
  protected readonly cursor = signal(0);
  protected readonly naming = signal(false);
  private readonly message = signal<string | null>(null);
  protected readonly tiles = computed(() =>
    this.apps.library().map((i) => ({
      id: i.id,
      name: i.name,
      icon: this.apps.defs.find((d) => d.id === i.app)?.icon ?? '',
    })),
  );
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    const cur = this.tiles().findIndex((t) => t.id === this.apps.currentId());
    this.cursor.set(Math.max(0, cur));
    this.pop = this.device.push({
      id: 'library',
      title: () => this.message() ?? this.i18n.t('app.library'),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d) => this.rocker(d),
      insert: (_l, text) => {
        const el = this.nameEl()?.nativeElement;
        if (el) el.value += text;
      },
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private selected() {
    return this.apps.instances().find((i) => i.id === this.tiles()[this.cursor()]?.id);
  }

  private menu(): MenuButton[] {
    const t = (k: Parameters<I18n['t']>[0]) => this.i18n.t(k);
    const sel = this.selected();
    return [
      { label: t('app.save') },
      { label: t('app.reset') },
      { label: t('app.sort') },
      { label: sel?.copy ? t('data.delete') : '' },
      { label: '' },
      { label: t('app.start') },
    ];
  }

  private menuPress(i: number): void {
    const sel = this.selected();
    if (!sel) return;
    this.message.set(null);
    if (i === 0) {
      this.naming.set(true);
      queueMicrotask(() => this.nameEl()?.nativeElement.focus());
    }
    if (i === 1) this.apps.reset(sel.id);
    if (i === 2) this.apps.toggleSort();
    if (i === 3 && sel.copy) this.apps.remove(sel.id);
    if (i === 5) this.start();
  }

  protected start(): void {
    const sel = this.selected();
    if (!sel) return;
    this.apps.start(sel.id);
    this.nav.go('app');
  }

  protected saveCopy(): void {
    const sel = this.selected();
    const name = this.nameEl()?.nativeElement.value ?? '';
    if (!sel) return;
    const err = this.apps.saveCopy(sel.id, name);
    this.message.set(err);
    if (!err) this.naming.set(false);
  }

  private key(p: KeyPress): boolean {
    if (this.naming()) {
      if (p.id === 'enter') this.saveCopy();
      else if (p.id === 'esc') this.naming.set(false);
      else if (p.layer === 'alpha' && p.char) {
        const el = this.nameEl()?.nativeElement;
        if (el) el.value += p.char;
      } else {
        const a = editFor(p);
        const el = this.nameEl()?.nativeElement;
        if (a?.kind === 'insert' && el) el.value += a.text;
      }
      return true;
    }
    if (p.id === 'enter') {
      this.start();
      return true;
    }
    if (p.id === 'esc') {
      this.nav.go('home');
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    const n = this.tiles().length;
    const step: Record<RockerDir, number> = { left: -1, right: 1, up: -COLS, down: COLS };
    this.cursor.update((c) => Math.min(n - 1, Math.max(0, c + step[d])));
    return true;
  }
}
