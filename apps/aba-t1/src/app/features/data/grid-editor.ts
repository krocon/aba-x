import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { parseText } from '@aba/math/parser/text-parser';
import { evaluateValue } from '@aba/math/value/evaluate-value';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import { NavStore } from '../../core/nav/nav-store';
import { editFor } from '../home/home-keys';
import { HomeStore } from '../home/home-store';
import { SettingsStore } from '../settings/settings-store';
import {
  type DataKind,
  cells,
  deleteColumn,
  deleteRow,
  insertColumn,
  insertRow,
  setCell,
  toValue,
} from './data-logic';

/**
 * Table editor for a list (one column) or a matrix (prompt 032). The rocker moves the cursor;
 * typing goes into the edit line, Enter stores the value (any expression of the home view) and
 * moves on – past the end the table grows. Menu: Edit, Insert row, Delete row, +Column, −Column, OK.
 */
@Component({
  selector: 'app-grid-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor">
      <div class="grid" #grid role="grid" [attr.aria-label]="name()">
        <div class="row head" role="row">
          <span class="corner"></span>
          @for (c of colIndex(); track c) {
            <span class="ch" role="columnheader">{{ c + 1 }}</span>
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
        [attr.aria-label]="name() + ' (' + (row() + 1) + ', ' + (col() + 1) + ')'"
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
      font-size: 4cqw;
    }
    .grid {
      overflow: auto;
      min-height: 0;
    }
    .row {
      display: flex;
    }
    .row > span {
      flex: 0 0 5.2em;
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
export class GridEditor implements OnInit, OnDestroy {
  private readonly home = inject(HomeStore);
  private readonly settings = inject(SettingsStore);
  private readonly device = inject(DeviceStore);
  private readonly nav = inject(NavStore);
  private readonly i18n = inject(I18n);
  private readonly editEl = viewChild<ElementRef<HTMLInputElement>>('edit');
  private readonly gridEl = viewChild<ElementRef<HTMLDivElement>>('grid');

  protected readonly name = computed(() => this.nav.param() || 'L1');
  private readonly kind = computed<DataKind>(() =>
    this.name().startsWith('M') ? 'matrix' : 'list',
  );
  protected readonly row = signal(0);
  protected readonly col = signal(0);
  private readonly message = signal<string | null>(null);
  private readonly table = computed(() =>
    cells(this.home.variables().get(this.name()), this.kind()),
  );
  /** the table plus one empty row/column to type into */
  protected readonly view = computed(() => {
    const t = this.table();
    const f = this.settings.settings().format;
    const cols = Math.max(1, t[0]?.length ?? 1) + (this.kind() === 'matrix' && t.length ? 1 : 0);
    const shown = t.map((r) =>
      Array.from({ length: cols }, (_, j) => (j < r.length ? formatReal(r[j], f) : '')),
    );
    shown.push(Array(cols).fill(''));
    return shown;
  });
  protected readonly colIndex = computed(() => this.view()[0].map((_, j) => j));
  private pop: (() => void) | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.row();
      this.col();
      this.gridEl()
        ?.nativeElement.querySelector('.cur')
        ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'editor',
      title: () => this.message() ?? `${this.name()} (${this.row() + 1}, ${this.col() + 1})`,
      menu: () => {
        const m = this.kind() === 'matrix';
        return [
          { label: this.i18n.t('data.edit') },
          { label: this.i18n.t('data.insRow') },
          { label: this.i18n.t('data.delRow') },
          { label: m ? this.i18n.t('data.insCol') : '' },
          { label: m ? this.i18n.t('data.delCol') : '' },
          { label: 'OK' },
        ];
      },
      key: (p) => this.key(p),
      menuPress: (i) => this.menu(i),
      rocker: (d) => this.rocker(d),
      insert: (_latex, text) => this.insertText(text),
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

  private save(t: number[][]): void {
    if (t.length) this.home.store(this.name(), toValue(t, this.kind()));
    else this.home.remove(this.name());
  }

  private menu(i: number): void {
    const t = this.table();
    if (i === 0) this.editCell();
    if (i === 1) this.save(insertRow(t, this.row()));
    if (i === 2 && this.row() < t.length) this.save(deleteRow(t, this.row()));
    if (i === 3 && this.kind() === 'matrix') this.save(insertColumn(t, this.col()));
    if (i === 4 && this.kind() === 'matrix' && t.length) this.save(deleteColumn(t, this.col()));
    if (i === 5) this.close();
  }

  private close(): void {
    this.nav.go(this.kind() === 'list' ? 'lists' : 'matrices');
  }

  /** Edit: the current value into the edit line. */
  private editCell(): void {
    const v = this.table()[this.row()]?.[this.col()];
    const el = this.editEl()?.nativeElement;
    if (el && v !== undefined) {
      el.value = String(v);
      el.focus();
    }
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'esc') {
      const el = this.editEl()?.nativeElement;
      if (el?.value) el.value = '';
      else this.close();
      return true;
    }
    if (p.id === 'enter') {
      this.commit();
      return true;
    }
    if (p.id === 'bksp') {
      const el = this.editEl()?.nativeElement;
      if (el?.value) el.value = el.value.slice(0, -1);
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

  /** Stores the edit line in the current cell and moves on. */
  private commit(): void {
    const el = this.editEl()?.nativeElement;
    const src = el?.value.trim() ?? '';
    if (!src) {
      this.rocker(this.kind() === 'list' ? 'down' : 'right');
      return;
    }
    const p = parseText(src);
    const r = p.ok ? evaluateValue(p.value, this.home.scope()) : p;
    if (!r.ok || r.value.kind !== 'real') {
      this.message.set(r.ok ? 'a real number is needed' : r.error.message);
      return;
    }
    this.message.set(null);
    this.save(setCell(this.table(), this.row(), this.col(), r.value.v));
    if (el) el.value = '';
    if (this.kind() === 'list') this.row.update((x) => x + 1);
    else this.col.update((x) => x + 1);
  }

  private rocker(d: RockerDir): boolean {
    const rows = this.view().length;
    const cols = this.view()[0].length;
    if (d === 'up') this.row.update((r) => Math.max(0, r - 1));
    if (d === 'down') this.row.update((r) => Math.min(rows - 1, r + 1));
    if (d === 'left') this.col.update((c) => Math.max(0, c - 1));
    if (d === 'right') {
      if (this.col() + 1 < cols) this.col.update((c) => c + 1);
      else if (this.row() + 1 < rows) this.go(this.row() + 1, 0);
    }
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
