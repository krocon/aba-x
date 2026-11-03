import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import { FilesApi } from '@aba/core/files/files-api';
import { errorLabel } from '@aba/math/sheet/evaluate';
import { MAX_COLS, MAX_ROWS, type Rect, cellKey, colName } from '@aba/math/sheet/refs';
import { type CellFormat, type Clip, type PasteMode, Sheet, cellText } from '@aba/math/sheet/sheet';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import { editFor } from '../../features/home/home-keys';
import { HomeStore } from '../../features/home/home-store';
import { SettingsStore } from '../../features/settings/settings-store';
import { AppStore } from '../app-store';
import { PlotMenu, type PlotMenuItem } from '../shared/plot-menu';
import { SetupForm, type SetupItem } from '../shared/setup-form';
import {
  COLORS,
  type Dir,
  type FormatOp,
  MAX_WIDTH,
  MIN_WIDTH,
  type Pos,
  type SheetState,
  applyFormat,
  clipToUsed,
  colWidth,
  columnsFrom,
  columnsToLists,
  follow,
  followCols,
  inside,
  move,
  namesToPublish,
  rangeText,
  resize,
  selection,
  target,
} from './sheet-logic';

/** The copied block survives switching views and apps (one clipboard for all sheets). */
let clipboard: Clip | null = null;

/** width of the row-number column in em */
const ROW_HEAD = 2.4;

interface CellView {
  row: number;
  col: number;
  text: string;
  width: number;
  align: 'left' | 'center' | 'right';
  cur: boolean;
  sel: boolean;
  error: boolean;
  bold: boolean;
  italic: boolean;
  color: string | null;
}

/**
 * The spreadsheet (prompt 041, Num view): a window of the grid that follows the cursor, the cell
 * input and an edit line. The rocker moves (with ⇧ it selects), dragging selects, Enter stores the
 * line (`=` starts a formula) and moves down. Menu: Edit, Format, Name, Go To, Select, More (copy,
 * paste, fill, sort, insert/delete, lists, CSV). Names are also stored as home variables; formulas
 * read home variables by name.
 */
@Component({
  selector: 'app-sheet-num',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotMenu],
  template: `
    <div class="sheet">
      <div
        class="grid"
        #grid
        role="grid"
        [attr.aria-label]="i18n.t('sheet.title')"
        [attr.aria-rowcount]="maxRows"
        [attr.aria-colcount]="maxCols"
        (wheel)="wheel($event)"
      >
        <div class="row head" role="row">
          <span class="corner" role="columnheader">{{ cursorKey() }}</span>
          @for (c of cols(); track c) {
            <span
              class="ch"
              role="columnheader"
              tabindex="-1"
              [style.width.em]="width(c)"
              [class.sel]="c >= sel().c0 && c <= sel().c1"
              (pointerdown)="$event.preventDefault()"
              (click)="selectColumn(c)"
              (keydown.enter)="selectColumn(c)"
              >{{ colName(c) }}</span
            >
          }
        </div>
        @for (r of rowsView(); track r.row) {
          <div class="row" role="row" [attr.aria-rowindex]="r.row + 2">
            <span
              class="rh"
              role="rowheader"
              [class.sel]="r.row >= sel().r0 && r.row <= sel().r1"
              >{{ r.row + 1 }}</span
            >
            @for (x of r.cells; track x.col) {
              <span
                class="cell"
                role="gridcell"
                tabindex="-1"
                [attr.data-r]="x.row"
                [attr.data-c]="x.col"
                [attr.aria-selected]="x.sel"
                [style.width.em]="x.width"
                [style.text-align]="x.align"
                [style.color]="x.color"
                [class.cur]="x.cur"
                [class.sel]="x.sel"
                [class.err]="x.error"
                [class.bold]="x.bold"
                [class.italic]="x.italic"
                (pointerdown)="$event.preventDefault()"
                (click)="go(x.row, x.col)"
                (keydown.enter)="go(x.row, x.col)"
                >{{ x.text }}</span
              >
            }
          </div>
        }
      </div>
      <div class="status" aria-live="polite">{{ status() }}</div>
      <input
        #edit
        class="line"
        type="text"
        spellcheck="false"
        autocomplete="off"
        [attr.aria-label]="i18n.t('sheet.title') + ' ' + cursorKey()"
        (keydown)="lineKey($event)"
      />
      @if (popup(); as m) {
        <app-plot-menu
          [title]="popupTitle()"
          [items]="items()"
          [cursor]="m - 1"
          (pick)="pickMenu($event)"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .sheet {
      position: relative;
      display: grid;
      grid-template-rows: 1fr auto auto;
      height: 100%;
      font-size: 3.6cqw;
    }
    .grid {
      overflow: hidden;
      min-height: 0;
      touch-action: none;
      user-select: none;
    }
    .row {
      display: flex;
    }
    .row > span {
      flex: 0 0 auto;
      box-sizing: border-box;
      height: 1.5em;
      line-height: 1.5em;
      padding: 0 0.25em;
      border-right: 1px solid var(--lcd-line);
      border-bottom: 1px solid var(--lcd-line);
      overflow: hidden;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .row > .rh,
    .row > .corner {
      width: ${ROW_HEAD}em;
      color: var(--lcd-muted);
      background: var(--lcd-head);
      text-align: right;
    }
    .row > .corner {
      font-size: 0.8em;
      width: ${ROW_HEAD / 0.8}em;
      height: 1.875em;
      line-height: 1.875em;
      text-align: left;
    }
    .head > .ch {
      background: var(--lcd-head);
      color: var(--lcd-muted);
      text-align: center;
      cursor: pointer;
    }
    .rh.sel,
    .ch.sel {
      background: var(--lcd-bg-2);
      color: var(--lcd-text);
    }
    .cell {
      cursor: cell;
    }
    .cell.sel {
      background: var(--lcd-head);
    }
    .cell.cur {
      background: var(--lcd-cur);
      outline: 1px solid var(--lcd-accent);
      outline-offset: -1px;
    }
    .cell.err {
      color: var(--lcd-error);
    }
    .cell.bold {
      font-weight: 700;
    }
    .cell.italic {
      font-style: italic;
    }
    .status {
      padding: 0.05em 0.4em;
      font-size: 0.9em;
      background: var(--lcd-head);
      border-top: 1px solid var(--lcd-line);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-height: 1.3em;
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
export class SheetNum implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  private readonly device = inject(DeviceStore);
  private readonly home = inject(HomeStore);
  private readonly settings = inject(SettingsStore);
  private readonly files = inject(FilesApi);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly editEl = viewChild<ElementRef<HTMLInputElement>>('edit');
  private readonly gridEl = viewChild<ElementRef<HTMLDivElement>>('grid');
  protected readonly colName = colName;
  protected readonly maxRows = MAX_ROWS;
  protected readonly maxCols = MAX_COLS;

  private readonly state = computed(() => this.apps.current().state as SheetState);
  private sheet: Sheet = new Sheet();
  private loadedFor: string | null = null;
  /** bumped after every change of the sheet (the grid re-renders) */
  private readonly rev = signal(0);
  protected readonly cursor = signal<Pos>({ row: 0, col: 0 });
  private readonly anchor = signal<Pos | null>(null);
  private readonly top = signal(0);
  private readonly left = signal(0);
  /** visible rows and the room for columns (em), measured */
  private readonly size = signal({ rows: 10, room: 22 });
  private readonly message = signal<string | null>(null);
  protected readonly popup = signal<number | null>(null);
  private readonly popupKind = signal<'format' | 'more' | 'names'>('more');
  private resizeObs: ResizeObserver | null = null;
  private pop: (() => void) | null = null;

  protected readonly sel = computed(() => selection(this.cursor(), this.anchor()));
  protected readonly cursorKey = computed(() => cellKey(this.cursor().row, this.cursor().col));

  protected readonly cols = computed(() =>
    columnsFrom(this.left(), this.size().room, (c) => colWidth(this.state(), c)),
  );

  protected readonly rowsView = computed(() => {
    this.rev();
    const st = this.state();
    const fmt = this.settings.settings().format;
    const cur = this.cursor();
    const q = this.sel();
    const cols = this.cols();
    const rows: { row: number; cells: CellView[] }[] = [];
    const last = Math.min(MAX_ROWS, this.top() + this.size().rows);
    for (let r = this.top(); r < last; r++) {
      rows.push({
        row: r,
        cells: cols.map((c) => {
          const key = cellKey(r, c);
          const v = this.sheet.value(key);
          const f = this.sheet.data(key)?.format;
          return {
            row: r,
            col: c,
            text: cellText(v, f?.number ?? fmt),
            width: colWidth(st, c),
            align:
              f?.align ?? (v.kind === 'value' ? 'right' : v.kind === 'error' ? 'center' : 'left'),
            cur: r === cur.row && c === cur.col,
            sel: inside(q, r, c) && this.anchor() !== null,
            error: v.kind === 'error',
            bold: !!f?.bold,
            italic: !!f?.italic,
            color: f?.color ?? null,
          };
        }),
      });
    }
    return rows;
  });

  /** status line: message, or the cell's input and – for errors – what went wrong */
  protected readonly status = computed(() => {
    this.rev();
    const m = this.message();
    if (m) return m;
    const key = this.cursorKey();
    const v = this.sheet.value(key);
    const input = this.sheet.input(key);
    const err = v.kind === 'error' ? `  ${errorLabel(v.error.code)} ${v.error.message}` : '';
    return `${key}: ${input}${err}`;
  });

  protected readonly popupTitle = computed(() =>
    this.i18n.t(
      this.popupKind() === 'format'
        ? 'sheet.format'
        : this.popupKind() === 'names'
          ? 'sheet.name'
          : 'sheet.more',
    ),
  );

  protected readonly items = computed<PlotMenuItem[]>(() => {
    const t = (k: TextKey) => this.i18n.t(k);
    const it = (k: TextKey, run: () => void): PlotMenuItem => ({ label: t(k), run });
    switch (this.popupKind()) {
      case 'format': {
        const dec = this.settings.settings().format.decimal;
        const f = (op: FormatOp) => () => this.format(op);
        return [
          it('sheet.fmtStandard', f({ kind: 'number', format: undefined })),
          it(
            'sheet.fmtFixed',
            f({ kind: 'number', format: { mode: 'fixed', digits: 2, decimal: dec } }),
          ),
          it(
            'sheet.fmtSci',
            f({ kind: 'number', format: { mode: 'sci', digits: 3, decimal: dec } }),
          ),
          it('sheet.alignLeft', f({ kind: 'align', align: 'left' })),
          it('sheet.alignCenter', f({ kind: 'align', align: 'center' })),
          it('sheet.alignRight', f({ kind: 'align', align: 'right' })),
          it('sheet.bold', f({ kind: 'bold' })),
          it('sheet.italic', f({ kind: 'italic' })),
          it('sheet.red', f({ kind: 'color', color: COLORS.red })),
          it('sheet.blue', f({ kind: 'color', color: COLORS.blue })),
          it('sheet.green', f({ kind: 'color', color: COLORS.green })),
          it('sheet.black', f({ kind: 'color', color: undefined })),
          it('sheet.noFormat', () => this.format(null)),
          it('sheet.wider', () => this.widen(1)),
          it('sheet.narrower', () => this.widen(-1)),
        ];
      }
      case 'names': {
        this.rev();
        return this.sheet.nameList().flatMap(([n, ref]) => [
          { label: `${t('sheet.goName')} ${n} (${ref ?? '#REF!'})`, run: () => this.goTo(n) },
          { label: `${t('sheet.delName')} ${n}`, run: () => this.removeName(n) },
        ]);
      }
      case 'more':
        return [
          it('sheet.copy', () => this.copy()),
          it('sheet.paste', () => this.paste('all')),
          it('sheet.pasteValues', () => this.paste('values')),
          it('sheet.pasteFormulas', () => this.paste('formulas')),
          it('sheet.pasteFormats', () => this.paste('formats')),
          it('sheet.fillDown', () => this.fill(true)),
          it('sheet.fillRight', () => this.fill(false)),
          it('sheet.clear', () => this.clearSelection()),
          it('sheet.sortAsc', () => this.sort(false)),
          it('sheet.sortDesc', () => this.sort(true)),
          it('sheet.insRows', () => this.structure('insRows')),
          it('sheet.delRows', () => this.structure('delRows')),
          it('sheet.insCols', () => this.structure('insCols')),
          it('sheet.delCols', () => this.structure('delCols')),
          it('sheet.toLists', () => this.toLists()),
          it('sheet.importCsv', () => void this.importCsv()),
          it('sheet.exportCsv', () => void this.exportCsv()),
        ];
    }
  });

  constructor() {
    // (re)load the sheet when another spreadsheet instance becomes current
    effect(() => {
      const id = this.apps.current().id;
      untracked(() => {
        if (id !== this.loadedFor) this.load(id);
      });
    });
    // formulas read home variables by name
    effect(() => {
      const vars = this.home.variables();
      untracked(() => {
        if (this.sheet.setVariables(vars).size) {
          this.rev.update((x) => x + 1);
          this.publish();
        }
      });
    });
    afterNextRender(() => this.observe());
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'sheet',
      title: () => {
        const q = this.sel();
        return `${this.i18n.t('sheet.title')} ${this.anchor() ? rangeText(q) : ''}`.trim();
      },
      menu: () => [
        { label: this.i18n.t('sheet.edit') },
        { label: this.i18n.t('sheet.format') },
        { label: this.i18n.t('sheet.name') },
        { label: this.i18n.t('sheet.goto') },
        { label: this.i18n.t('sheet.select'), active: this.anchor() !== null },
        { label: this.i18n.t('sheet.more') },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => this.menuPress(i),
      rocker: (d, shift) => this.rocker(d, shift),
      gesture: (g) => this.gesture(g),
      insert: (_latex, text) => this.insertText(text),
      help: 'spreadsheet',
    });
    queueMicrotask(() => this.focusLine());
  }

  ngOnDestroy(): void {
    this.pop?.();
    this.resizeObs?.disconnect();
  }

  // ---- loading, saving ------------------------------------------------------------------------

  private load(id: string): void {
    this.loadedFor = id;
    const st = this.state();
    const angle = this.settings.settings().angle;
    const r = Sheet.fromJSON(st?.sheet && { ...st.sheet, options: { ...st.sheet.options, angle } });
    this.sheet = r.ok ? r.value : new Sheet({ angle });
    if (!r.ok) this.message.set(r.error.message);
    this.sheet.setVariables(this.home.variables());
    this.cursor.set({ row: 0, col: 0 });
    this.anchor.set(null);
    this.top.set(0);
    this.left.set(0);
    this.rev.update((x) => x + 1);
  }

  /** After a change: re-render, store the sheet in the app state, export the names. */
  private changed(): void {
    this.rev.update((x) => x + 1);
    const json = this.sheet.toJSON();
    this.apps.update<SheetState>((s) => ({ ...s, sheet: json }));
    this.publish();
  }

  /** Sheet names → home variables (only changed values are written). */
  private publish(): void {
    for (const [n, v] of namesToPublish(this.sheet, this.home.variables())) this.home.store(n, v);
  }

  // ---- layout ---------------------------------------------------------------------------------

  private observe(): void {
    const el = this.gridEl()?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.resizeObs = new ResizeObserver(() => this.measure());
    this.resizeObs.observe(el);
    this.measure();
  }

  private measure(): void {
    const el = this.gridEl()?.nativeElement;
    if (!el) return;
    const font = parseFloat(getComputedStyle(el).fontSize) || 14;
    const rows = Math.max(1, Math.floor(el.clientHeight / (1.5 * font)) - 1);
    const room = Math.max(4, el.clientWidth / font - ROW_HEAD);
    const s = this.size();
    if (s.rows !== rows || Math.abs(s.room - room) > 0.01) {
      this.size.set({ rows, room });
      this.reveal();
    }
  }

  protected width(c: number): number {
    return colWidth(this.state(), c);
  }

  /** Scrolls the window so that the cursor is visible. */
  private reveal(): void {
    const c = this.cursor();
    this.top.set(follow(this.top(), c.row, this.size().rows));
    this.left.set(followCols(this.left(), c.col, this.size().room, (k) => this.width(k)));
  }

  private moveTo(p: Pos, extend = false): void {
    if (extend && !this.anchor()) this.anchor.set(this.cursor());
    if (!extend) this.anchor.set(null);
    this.cursor.set(p);
    this.message.set(null);
    this.reveal();
  }

  protected go(row: number, col: number): void {
    this.popup.set(null);
    this.moveTo({ row, col });
    this.focusLine();
  }

  /** Header click: the whole column (formulas, fill, format work on its used part). */
  protected selectColumn(c: number): void {
    this.anchor.set({ row: MAX_ROWS - 1, col: c });
    this.cursor.set({ row: 0, col: c });
    this.top.set(0);
    this.focusLine();
  }

  protected wheel(e: WheelEvent): void {
    e.preventDefault();
    const n = Math.sign(e.deltaY || e.deltaX) * 3;
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))
      this.left.update((l) => Math.min(MAX_COLS - 1, Math.max(0, l + Math.sign(n))));
    else this.top.update((t) => Math.min(MAX_ROWS - 1, Math.max(0, t + n)));
  }

  /** The cell under a display point (gesture coordinates are relative to the display content). */
  private cellAt(x: number, y: number): Pos | null {
    const content = (this.host.nativeElement as HTMLElement).closest('.content');
    const r = content?.getBoundingClientRect();
    const doc = (this.host.nativeElement as HTMLElement).ownerDocument;
    if (!r || !doc.elementFromPoint) return null;
    const el = doc.elementFromPoint(r.left + x, r.top + y)?.closest('[data-r]');
    if (!el) return null;
    return { row: Number(el.getAttribute('data-r')), col: Number(el.getAttribute('data-c')) };
  }

  private gesture(g: Gesture): void {
    if (g.kind === 'drag') {
      const p = this.cellAt(g.x, g.y);
      if (!p) return;
      if (g.phase === 'start') {
        this.cursor.set(p);
        this.anchor.set(p);
      } else if (g.phase === 'move') {
        this.cursor.set(p);
        this.reveal();
      }
    } else if (g.kind === 'doubleTap') {
      const p = this.cellAt(g.x, g.y);
      if (p) this.moveTo(p);
      this.editCell();
    }
  }

  // ---- input ----------------------------------------------------------------------------------

  private line(): HTMLInputElement | null {
    return this.editEl()?.nativeElement ?? null;
  }

  private focusLine(): void {
    this.line()?.focus();
  }

  private insertText(text: string): void {
    const el = this.line();
    if (!el) return;
    el.setRangeText(
      text,
      el.selectionStart ?? el.value.length,
      el.selectionEnd ?? el.value.length,
      'end',
    );
    el.focus();
  }

  /** Edit: the cell's input into the line. */
  private editCell(): void {
    const el = this.line();
    if (!el) return;
    el.value = this.sheet.input(this.cursorKey());
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

  /** Stores the line in the current cell and moves on (an empty line only moves). */
  private commit(dir: Dir = 'down'): void {
    const el = this.line();
    const src = el?.value ?? '';
    if (src !== '') {
      this.sheet.setCell(this.cursorKey(), src);
      if (el) el.value = '';
      this.changed();
    }
    this.moveTo(move(this.cursor(), dir));
  }

  private key(p: KeyPress): boolean {
    const m = this.popup();
    if (m !== null) {
      if (p.id === 'enter') this.pickMenu(m - 1);
      else if (p.id === 'esc') this.popup.set(null);
      else return false;
      return true;
    }
    const el = this.line();
    if (p.id === 'view' && p.layer === 'shift') {
      this.copy();
      return true;
    }
    if (p.id === 'menu' && p.layer === 'shift') {
      this.paste('all');
      return true;
    }
    if (p.id === 'esc' && p.layer !== 'alpha') {
      if (el?.value) el.value = '';
      else if (this.anchor()) this.anchor.set(null);
      this.message.set(null);
      return true;
    }
    if (p.id === 'enter') {
      this.commit();
      return true;
    }
    if (p.id === 'bksp') {
      if (el?.value && p.layer !== 'shift') el.value = el.value.slice(0, -1);
      else this.clearSelection();
      return true;
    }
    const a = editFor(p);
    if (a?.kind === 'insert') {
      this.insertText(a.text);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir, shift: boolean): boolean {
    const m = this.popup();
    if (m !== null) {
      const n = this.items().length;
      if (d === 'up' || d === 'down')
        this.popup.set(((m - 1 + (d === 'down' ? 1 : n - 1)) % n) + 1);
      if (d === 'left') this.popup.set(null);
      return true;
    }
    if (this.line()?.value) {
      this.commit(d);
      return true;
    }
    // with Select active the rocker extends the selection like ⇧ + rocker
    this.moveTo(move(this.cursor(), d), shift || this.anchor() !== null);
    return true;
  }

  protected lineKey(e: KeyboardEvent): void {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const el = this.line();
    const empty = !el?.value;
    const arrows: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    let run: (() => void) | null = null;
    if (this.popup() !== null) {
      if (e.key === 'Enter') run = () => this.key({ id: 'enter', layer: 'main' });
      if (e.key === 'Escape') run = () => this.popup.set(null);
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
        run = () => this.rocker(arrows[e.key], false);
    } else if (e.key === 'Enter') run = () => this.commit(e.shiftKey ? 'up' : 'down');
    else if (e.key === 'Tab') run = () => this.commit(e.shiftKey ? 'left' : 'right');
    else if (e.key === 'Escape') run = () => this.key({ id: 'esc', layer: 'main' });
    else if ((e.key === 'Delete' || e.key === 'Backspace') && empty)
      run = () => this.clearSelection();
    else if (e.key in arrows && (empty || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const d = arrows[e.key];
      run = () => (empty ? this.moveTo(move(this.cursor(), d), e.shiftKey) : this.commit(d));
    }
    if (run) {
      e.preventDefault();
      e.stopPropagation();
      run();
    }
  }

  // ---- menu -----------------------------------------------------------------------------------

  private menuPress(i: number): void {
    this.message.set(null);
    if (i === 0) this.editCell();
    if (i === 1) this.openPopup('format');
    if (i === 2) this.name();
    if (i === 3) this.goTo(this.line()?.value ?? '');
    if (i === 4) this.anchor.set(this.anchor() ? null : this.cursor());
    if (i === 5) this.openPopup('more');
  }

  private openPopup(kind: 'format' | 'more' | 'names'): void {
    this.popupKind.set(kind);
    this.popup.set(1);
  }

  protected pickMenu(i: number): void {
    const item = this.items()[i];
    this.popup.set(null);
    item?.run();
    this.focusLine();
  }

  private say(k: TextKey, extra = ''): void {
    this.message.set(`${this.i18n.t(k)}${extra ? ` ${extra}` : ''}`);
  }

  /** The selection, whole columns clipped to the used rows (never 9999 empty cells). */
  private bounded(): Rect {
    const q = this.sel();
    const used = this.sheet.used();
    return q.r1 === MAX_ROWS - 1 ? { ...q, r1: Math.max(q.r0, used.rows - 1) } : q;
  }

  /** Name: the line text names the selection (empty line: list of the names). */
  private name(): void {
    const el = this.line();
    const n = el?.value.trim() ?? '';
    if (!n) {
      if (this.sheet.nameList().length) this.openPopup('names');
      else this.say('sheet.noNames');
      return;
    }
    const q = this.sel();
    const ref = rangeText(q)
      .replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')
      .replace(/^([A-Z]+):([A-Z]+)$/, '$$$1:$$$2');
    const r = this.sheet.defineName(n, ref);
    if (!r.ok) {
      this.message.set(r.error.message);
      return;
    }
    if (el) el.value = '';
    this.changed();
    this.say('sheet.named', `${n} = ${ref}`);
  }

  private removeName(n: string): void {
    this.sheet.removeName(n);
    this.changed();
  }

  /** Go To: a cell, a range (selected) or a name. */
  private goTo(src: string): void {
    if (!src.trim()) return this.say('sheet.needTarget');
    const q = target(src, this.sheet);
    if (!q) return this.say('sheet.noTarget');
    const el = this.line();
    if (el) el.value = '';
    this.anchor.set(null);
    this.cursor.set({ row: q.r0, col: q.c0 });
    if (q.r1 !== q.r0 || q.c1 !== q.c0) this.anchor.set({ row: q.r1, col: q.c1 });
    this.reveal();
  }

  private format(op: FormatOp | null): void {
    const q = this.bounded();
    for (let r = q.r0; r <= q.r1; r++) {
      for (let c = q.c0; c <= q.c1; c++) {
        const key = cellKey(r, c);
        const old: CellFormat | undefined = this.sheet.data(key)?.format;
        this.sheet.setFormat(key, op ? applyFormat(old, op) : undefined);
      }
    }
    this.changed();
  }

  private widen(delta: number): void {
    const q = this.sel();
    const w = resize(this.state(), q.c0, q.c1, delta);
    this.apps.update<SheetState>((s) => ({ ...s, widths: w }));
    this.reveal();
  }

  private copy(): void {
    clipboard = this.sheet.copy(rangeText(this.bounded()));
    this.say('sheet.copied', rangeText(this.bounded()));
  }

  private paste(mode: PasteMode): void {
    if (!clipboard) return this.say('sheet.noClip');
    const q = this.sel();
    this.sheet.paste(clipboard, cellKey(q.r0, q.c0), mode);
    this.changed();
  }

  private fill(down: boolean): void {
    const q = this.bounded();
    if (down ? q.r1 === q.r0 : q.c1 === q.c0) return this.say('sheet.needRange');
    if (down) this.sheet.fillDown(rangeText(q));
    else this.sheet.fillRight(rangeText(q));
    this.changed();
  }

  private clearSelection(): void {
    this.sheet.clear(rangeText(this.bounded()));
    this.changed();
  }

  /** Sorts the selected rows by the cursor column; without a selection the whole table. */
  private sort(descending: boolean): void {
    const used = this.sheet.used();
    if (!used.rows) return;
    const q = this.anchor()
      ? clipToUsed(this.bounded(), used)
      : { r0: 0, c0: 0, r1: used.rows - 1, c1: Math.max(0, used.cols - 1) };
    const r = this.sheet.sort(rangeText(q), this.cursor().col, descending);
    if (!r.ok) return void this.message.set(r.error.message);
    this.changed();
  }

  private structure(op: 'insRows' | 'delRows' | 'insCols' | 'delCols'): void {
    const q = this.bounded();
    const rows = q.r1 - q.r0 + 1;
    const cols = q.c1 - q.c0 + 1;
    const r =
      op === 'insRows'
        ? this.sheet.insertRows(q.r0, rows)
        : op === 'delRows'
          ? this.sheet.deleteRows(q.r0, rows)
          : op === 'insCols'
            ? this.sheet.insertCols(q.c0, cols)
            : this.sheet.deleteCols(q.c0, cols);
    if (!r.ok) return void this.message.set(r.error.message);
    this.anchor.set(null);
    this.changed();
  }

  /** The selected columns as lists L1, L2 … (statistics, list catalogue). */
  private toLists(): void {
    const q = clipToUsed(this.anchor() ? this.bounded() : this.sel(), this.sheet.used());
    const r = columnsToLists(this.sheet, q);
    if (typeof r === 'string') return void this.message.set(r);
    const names = r.slice(0, 9).map((v, i) => {
      this.home.store(`L${i + 1}`, v);
      return `L${i + 1}`;
    });
    this.say('sheet.stored', names.join(', '));
  }

  private csvOptions() {
    const sep = this.state().csvSep ?? ',';
    return { separator: sep, decimal: sep === ';' ? (',' as const) : ('.' as const) };
  }

  private async exportCsv(): Promise<void> {
    const text = this.sheet.toCsv({ ...this.csvOptions(), content: this.state().csvContent });
    const base = this.apps.current().name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'spreadsheet';
    try {
      const name = await this.files.saveText(`${base}.csv`, text, {
        name: 'CSV',
        extensions: ['csv'],
      });
      if (name) this.say('sheet.saved', name);
    } catch (e) {
      this.message.set(String((e as Error)?.message ?? e));
    }
  }

  private async importCsv(): Promise<void> {
    try {
      const f = await this.files.openText({ name: 'CSV', extensions: ['csv', 'txt'] });
      if (!f) return;
      this.sheet.importCsv(f.text, {
        ...this.csvOptions(),
        at: this.cursorKey(),
        formulas: this.state().csvContent === 'inputs',
      });
      this.changed();
      this.say('sheet.imported', f.name);
    } catch (e) {
      this.message.set(String((e as Error)?.message ?? e));
    }
  }
}

/** Num setup: default column width and the CSV format. */
@Component({
  selector: 'app-sheet-num-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form
    [title]="i18n.t('sheet.setup')"
    [fields]="fields()"
    [close]="close"
  />`,
})
export class SheetNumSetup {
  protected readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  protected readonly close = () => this.apps.show('num');
  private readonly state = computed(() => this.apps.current().state as SheetState);
  protected readonly fields = computed<SetupItem[]>(() => [
    {
      label: this.i18n.t('sheet.width'),
      value: () => this.state().width,
      set: (x: number) => {
        if (x < MIN_WIDTH || x > MAX_WIDTH) return `${MIN_WIDTH} … ${MAX_WIDTH}`;
        this.apps.update<SheetState>((s) => ({ ...s, width: x }));
        return null;
      },
    },
    {
      label: this.i18n.t('sheet.csvSep'),
      choices: [
        { value: ',', label: this.i18n.t('sheet.comma') },
        { value: ';', label: this.i18n.t('sheet.semicolon') },
      ],
      value: () => this.state().csvSep,
      set: (v: string) =>
        this.apps.update<SheetState>((s) => ({ ...s, csvSep: v === ';' ? ';' : ',' })),
    },
    {
      label: this.i18n.t('sheet.csvContent'),
      choices: [
        { value: 'values', label: this.i18n.t('sheet.values') },
        { value: 'inputs', label: this.i18n.t('sheet.inputs') },
      ],
      value: () => this.state().csvContent,
      set: (v: string) =>
        this.apps.update<SheetState>((s) => ({
          ...s,
          csvContent: v === 'inputs' ? 'inputs' : 'values',
        })),
    },
  ]);
}
