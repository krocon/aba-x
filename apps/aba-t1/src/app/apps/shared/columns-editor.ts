import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { parseText } from '@aba/math/parser/text-parser';
import { evaluateValue } from '@aba/math/value/evaluate-value';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import { editFor } from '../../features/home/home-keys';
import { HomeStore } from '../../features/home/home-store';
import { SettingsStore } from '../../features/settings/settings-store';

export interface ColumnsMenuItem {
  label: string;
  run: (col: number, row: number) => void;
}

/**
 * Data columns of an app (prompt 037: D1…D0, C1…C0): ten columns of different length. The rocker
 * moves the cursor, typing goes into the edit line, Enter stores the value (any expression) and
 * moves down – past the end the column grows. Menu: Edit, Insert, Delete, then the app's own
 * buttons (Sort, More, Stats …).
 */
@Component({
  selector: 'app-columns-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor">
      <div class="grid" #grid role="grid" tabindex="0" [attr.aria-label]="label()">
        <div class="row head" role="row">
          <span class="corner"></span>
          @for (n of names(); track n; let j = $index) {
            <span class="ch" role="columnheader" [class.cur]="col() === j">{{ n }}</span>
          }
        </div>
        @for (r of view(); track $index; let i = $index) {
          <div class="row" role="row">
            <span class="rh" role="rowheader">{{ i + 1 }}</span>
            @for (x of r; track $index; let j = $index) {
              <span
                class="cell"
                role="gridcell"
                tabindex="-1"
                [class.cur]="row() === i && col() === j"
                [attr.aria-selected]="row() === i && col() === j"
                (click)="go(i, j)"
                (keydown.enter)="go(i, j)"
                >{{ x }}</span
              >
            }
          </div>
        }
      </div>
      <input
        #edit
        class="line"
        type="text"
        spellcheck="false"
        autocomplete="off"
        [attr.aria-label]="names()[col()] + ' (' + (row() + 1) + ')'"
        (keydown)="lineKey($event)"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .editor {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100%;
      font-size: 3.8cqw;
    }
    .grid {
      overflow: auto;
      min-height: 0;
    }
    .row {
      display: flex;
    }
    .row > span {
      flex: 0 0 4.6em;
      padding: 0.1em 0.3em;
      border-right: 1px solid var(--lcd-line);
      border-bottom: 1px solid var(--lcd-line);
      text-align: right;
      overflow: hidden;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .row > .rh,
    .row > .corner {
      flex-basis: 1.8em;
      color: var(--lcd-muted);
      background: var(--lcd-head);
    }
    .head > span {
      background: var(--lcd-head);
      color: var(--lcd-muted);
      text-align: center;
      position: sticky;
      top: 0;
    }
    .head > .ch.cur {
      background: var(--lcd-cur);
    }
    .cell {
      cursor: pointer;
    }
    .cell.cur {
      background: var(--lcd-cur);
      outline: 1px solid var(--lcd-accent);
    }
    .line {
      border: 0;
      border-top: 2px solid var(--lcd-line-strong);
      padding: 0.2em 0.4em;
      font: inherit;
      font-family: var(--font-mono);
      background: var(--lcd-bg);
      outline: none;
    }
  `,
})
export class ColumnsEditor implements OnInit, OnDestroy {
  private readonly home = inject(HomeStore);
  private readonly settings = inject(SettingsStore);
  private readonly device = inject(DeviceStore);
  private readonly i18n = inject(I18n);
  private readonly editEl = viewChild<ElementRef<HTMLInputElement>>('edit');
  private readonly gridEl = viewChild<ElementRef<HTMLDivElement>>('grid');

  readonly cols = input.required<number[][]>();
  readonly names = input.required<string[]>();
  readonly label = input('');
  readonly help = input('stats');
  /** writes the columns back into the app state */
  readonly save = input.required<(cols: number[][]) => void>();
  /** the menu buttons 4–6 (app specific) */
  readonly extra = input<ColumnsMenuItem[]>([]);

  protected readonly row = signal(0);
  protected readonly col = signal(0);
  private readonly message = signal<string | null>(null);
  /** the columns plus one empty row to type into */
  protected readonly view = computed(() => {
    const c = this.cols();
    const f = this.settings.settings().format;
    const n = Math.max(0, ...c.map((x) => x.length)) + 1;
    return Array.from({ length: n }, (_, i) =>
      c.map((x) => (i < x.length ? formatReal(x[i], f) : '')),
    );
  });
  private pop: (() => void) | null = null;

  constructor() {
    effect(() => {
      this.cols();
      this.pending = null;
    });
    afterRenderEffect(() => {
      this.row();
      this.col();
      this.gridEl()
        ?.nativeElement.querySelector('.cell.cur')
        ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'columns',
      title: () => this.message() ?? `${this.names()[this.col()]}(${this.row() + 1})`,
      menu: () => {
        const extra = this.extra();
        return [
          { label: this.i18n.t('data.edit') },
          { label: this.i18n.t('data.insRow') },
          { label: this.i18n.t('data.delRow') },
          ...[0, 1, 2].map((k) => ({ label: extra[k]?.label ?? '' })),
        ];
      },
      key: (p) => this.key(p),
      menuPress: (i) => this.menu(i),
      rocker: (d) => this.rocker(d),
      insert: (_latex, text) => this.insertText(text),
      help: this.help(),
    });
    queueMicrotask(() => this.editEl()?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected go(i: number, j: number): void {
    this.row.set(i);
    this.col.set(j);
  }

  /** what was saved last – the input arrives only with the next change detection */
  private pending: number[][] | null = null;
  private current(): number[][] {
    return this.pending ?? this.cols();
  }

  private update(f: (c: number[]) => number[]): void {
    const j = this.col();
    const next = this.current().map((c, k) => (k === j ? f([...c]) : c));
    this.pending = next;
    this.save()(next);
  }

  private menu(i: number): void {
    const r = this.row();
    if (i === 0) {
      const v = this.current()[this.col()][r];
      const el = this.editEl()?.nativeElement;
      if (el && v !== undefined) {
        el.value = String(v);
        el.focus();
      }
    }
    if (i === 1) this.update((c) => (r <= c.length ? (c.splice(r, 0, 0), c) : c));
    if (i === 2) this.update((c) => (c.splice(r, 1), c));
    if (i >= 3) this.extra()[i - 3]?.run(this.col(), r);
  }

  private key(p: KeyPress): boolean {
    const el = this.editEl()?.nativeElement;
    if (p.id === 'esc') {
      if (el) el.value = '';
      this.message.set(null);
      return true;
    }
    if (p.id === 'enter') {
      this.commit();
      return true;
    }
    if (p.id === 'bksp') {
      if (el?.value) el.value = el.value.slice(0, -1);
      else this.update((c) => (c.splice(this.row(), 1), c));
      return true;
    }
    const a = editFor(p);
    if (a?.kind === 'insert') {
      this.insertText(a.text);
      return true;
    }
    return false;
  }

  private insertText(text: string): void {
    const el = this.editEl()?.nativeElement;
    if (!el) return;
    el.setRangeText(
      text,
      el.selectionStart ?? el.value.length,
      el.selectionEnd ?? el.value.length,
      'end',
    );
    el.focus();
  }

  /** Stores the edit line in the current cell and moves down. */
  private commit(): void {
    const el = this.editEl()?.nativeElement;
    const src = el?.value.trim() ?? '';
    if (!src) {
      this.rocker('down');
      return;
    }
    const p = parseText(src);
    const r = p.ok ? evaluateValue(p.value, this.home.scope()) : p;
    if (!r.ok || r.value.kind !== 'real') {
      this.message.set(r.ok ? 'a real number is needed' : r.error.message);
      return;
    }
    this.message.set(null);
    const v = r.value.v;
    const row = Math.min(this.row(), this.current()[this.col()].length);
    this.update((c) => ((c[row] = v), c));
    if (el) el.value = '';
    this.row.set(row + 1);
  }

  private rocker(d: RockerDir): boolean {
    const rows = this.view().length;
    if (d === 'up') this.row.update((r) => Math.max(0, r - 1));
    if (d === 'down') this.row.update((r) => Math.min(rows - 1, r + 1));
    if (d === 'left') this.col.update((c) => Math.max(0, c - 1));
    if (d === 'right') this.col.update((c) => Math.min(this.names().length - 1, c + 1));
    return true;
  }

  protected lineKey(e: KeyboardEvent): void {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const map: Record<string, () => void> = {
      Enter: () => this.commit(),
      Escape: () => this.key({ id: 'esc', layer: 'main' }),
      ArrowUp: () => this.rocker('up'),
      ArrowDown: () => this.rocker('down'),
    };
    const el = this.editEl()?.nativeElement;
    if (!el?.value) {
      map['ArrowLeft'] = () => this.rocker('left');
      map['ArrowRight'] = () => this.rocker('right');
    }
    const f = map[e.key];
    if (f) {
      e.preventDefault();
      e.stopPropagation();
      f();
    }
  }
}
