/**
 * The spreadsheet model (prompt 041): sparse cells (`A1` → input and format), names, a dependency
 * graph and incremental recalculation. Every change returns the set of cells it recalculated – the
 * changed cells and their dependants, nothing else. Cycles give each cell of the cycle the error
 * `cycle` (never a hang); errors are cell values that propagate to the cells that read them.
 *
 * Copying shifts relative references; insert/delete of rows/columns rewrites all formulas and names
 * (references into deleted cells become `#REF!`). Sorting moves whole rows of the range and shifts
 * the relative references of moved formulas like a copy (Excel's behaviour): a formula that reads
 * its own row keeps doing so, one that reads other rows of the sorted range then reads other cells.
 * Pure TypeScript, no framework.
 */
import type { AngleMode } from '../numeric/evaluate';
import type { MathResult } from '../result';
import { type NumberFormat, STANDARD_FORMAT, formatValue } from '../value/format';
import { real } from '../value/value';
import { type CsvSeparator, parseCsv, writeCsv } from './csv';
import {
  type CellValue,
  EMPTY,
  type SheetError,
  type SheetErrorCode,
  errorLabel,
  errorValue,
  evaluateFormula,
  type EvalContext,
} from './evaluate';
import {
  type CompiledFormula,
  type DecimalMark,
  compileFormula,
  isValidName,
  parseInput,
  rewriteRefs,
  shiftFormula,
} from './formula';
import { DependencyGraph } from './graph';
import {
  type AxisMap,
  MAX_COLS,
  MAX_ROWS,
  type Rect,
  type Ref,
  cellKey,
  colIndex,
  deleteMap,
  formatRef,
  insertMap,
  parseKey,
  parseRef,
  refRect,
  remapRef,
} from './refs';

/** Presentation of a cell; the engine only stores and copies it. */
export interface CellFormat {
  readonly number?: NumberFormat;
  readonly align?: 'left' | 'center' | 'right';
  readonly color?: string;
  readonly background?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

export interface CellData {
  readonly input: string;
  readonly format?: CellFormat;
}

export interface SheetOptions {
  /** decimal mark of number inputs and formulas (`,` → `;` separates arguments) */
  readonly decimal?: DecimalMark;
  readonly angle?: AngleMode;
  readonly complexResults?: boolean;
}

export type SheetResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: SheetError };

const okR = <T>(value: T): SheetResult<T> => ({ ok: true, value });
const failR = <T>(code: SheetErrorCode, message: string): SheetResult<T> => ({
  ok: false,
  error: { code, message },
});

/** A copied block: cells row by row (null = empty) with their values at copy time. */
export interface Clip {
  readonly row: number;
  readonly col: number;
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly (CellData | null)[];
  readonly values: readonly CellValue[];
}

export type PasteMode = 'all' | 'formulas' | 'values' | 'formats';

export interface CsvOptions {
  readonly separator?: CsvSeparator;
  readonly decimal?: DecimalMark;
}

/** Serialised sheet (JSON-safe). */
export interface SheetJSON {
  readonly version: 1;
  readonly options: SheetOptions;
  readonly cells: Readonly<Record<string, CellData>>;
  /** name → reference text, or null when its cells were deleted */
  readonly names: Readonly<Record<string, string | null>>;
}

/** Text of a cell value for the grid: numbers in `format`, errors as `#DIV/0!` … */
export function cellText(v: CellValue, format: NumberFormat = STANDARD_FORMAT): string {
  switch (v.kind) {
    case 'empty':
      return '';
    case 'text':
      return v.text;
    case 'error':
      return errorLabel(v.error.code);
    case 'value':
      return formatValue(v.value, { format });
  }
}

const FULL: NumberFormat = { mode: 'standard', digits: 0, decimal: '.' };

/** Rectangle of a range text (`A1:B9`, `A1`); whole columns/rows are clipped to the sheet. */
function rectOf(range: string): Rect | null {
  const r = parseRef(range);
  return r && refRect(r);
}

export class Sheet {
  private readonly cells = new Map<string, CellData>();
  private readonly values = new Map<string, CellValue>();
  private readonly compiled = new Map<string, MathResult<CompiledFormula>>();
  private readonly names = new Map<string, Ref | null>();
  private readonly graph = new DependencyGraph();
  private usedArea: { rows: number; cols: number } | null = { rows: 0, cols: 0 };
  readonly options: SheetOptions;

  constructor(options: SheetOptions = {}) {
    this.options = { decimal: '.', ...options };
  }

  private get decimal(): DecimalMark {
    return this.options.decimal ?? '.';
  }

  // ---- reading -------------------------------------------------------------------------------

  /** Keys of all non-empty cells. */
  keys(): string[] {
    return [...this.cells.keys()];
  }

  input(key: string): string {
    return this.cells.get(norm(key))?.input ?? '';
  }

  data(key: string): CellData | undefined {
    return this.cells.get(norm(key));
  }

  value(key: string): CellValue {
    return this.values.get(norm(key)) ?? EMPTY;
  }

  /** Display text of a cell in its own number format. */
  text(key: string): string {
    const d = this.data(key);
    return cellText(
      this.value(key),
      d?.format?.number ?? { ...STANDARD_FORMAT, decimal: this.decimal },
    );
  }

  /** Rows and columns of the used area (the bounds of `A:A` and `3:3`). */
  used(): { readonly rows: number; readonly cols: number } {
    if (!this.usedArea) {
      let rows = 0;
      let cols = 0;
      for (const k of this.cells.keys()) {
        const p = parseKey(k)!;
        rows = Math.max(rows, p.row + 1);
        cols = Math.max(cols, p.col + 1);
      }
      this.usedArea = { rows, cols };
    }
    return this.usedArea;
  }

  /** Cells that the formula in `key` reads directly. */
  precedents(key: string): readonly Rect[] {
    return this.graph.precedentsOf(norm(key));
  }

  // ---- editing -------------------------------------------------------------------------------

  /** Sets the input of a cell ('' clears it, the format stays). Invalid keys change nothing. */
  setCell(key: string, input: string, format?: CellFormat): ReadonlySet<string> {
    const k = norm(key);
    if (!parseKey(k)) return new Set();
    const old = this.cells.get(k);
    return this.write(new Map([[k, { input, format: format ?? old?.format }]]));
  }

  /** Several inputs at once, recalculated together. */
  setCells(entries: Iterable<readonly [string, string]>): ReadonlySet<string> {
    const changes = new Map<string, CellData | undefined>();
    for (const [key, input] of entries) {
      const k = norm(key);
      if (parseKey(k)) changes.set(k, { input, format: this.cells.get(k)?.format });
    }
    return this.write(changes);
  }

  setFormat(key: string, format: CellFormat | undefined): void {
    const k = norm(key);
    const d = this.cells.get(k);
    if (!parseKey(k)) return;
    if (d) this.store(k, { input: d.input, format });
    else if (format) this.store(k, { input: '', format });
  }

  /** Clears inputs and formats of a range. */
  clear(range: string): ReadonlySet<string> {
    const q = rectOf(range);
    if (!q) return new Set();
    const changes = new Map<string, CellData | undefined>();
    for (const k of this.cells.keys()) {
      const p = parseKey(k)!;
      if (p.row >= q.r0 && p.row <= q.r1 && p.col >= q.c0 && p.col <= q.c1) {
        changes.set(k, undefined);
      }
    }
    return this.write(changes);
  }

  private store(k: string, d: CellData | undefined): void {
    if (!d || (d.input === '' && !d.format)) {
      if (this.cells.delete(k)) this.usedArea = null;
      return;
    }
    if (!this.cells.has(k) && this.usedArea) {
      const p = parseKey(k)!;
      this.usedArea = {
        rows: Math.max(this.usedArea.rows, p.row + 1),
        cols: Math.max(this.usedArea.cols, p.col + 1),
      };
    }
    this.cells.set(k, d.format ? { input: d.input, format: d.format } : { input: d.input });
  }

  /** Stores the changes, rebinds their precedents and recalculates them and their dependants. */
  private write(changes: ReadonlyMap<string, CellData | undefined>): ReadonlySet<string> {
    for (const [k, d] of changes) {
      this.store(k, d);
      this.bind(k);
    }
    return this.recalc(changes.keys());
  }

  /** Compiles the cell's formula and records what it reads. */
  private bind(k: string): void {
    const input = parseInput(this.cells.get(k)?.input ?? '', this.decimal);
    if (input.kind !== 'formula') {
      this.compiled.delete(k);
      this.graph.delete(k);
      return;
    }
    const c = compileFormula(input.src, this.decimal);
    this.compiled.set(k, c);
    if (!c.ok) {
      this.graph.delete(k);
      return;
    }
    const rects: Rect[] = [];
    for (const r of c.value.refs) if (r) rects.push(refRect(r));
    for (const n of c.value.names) {
      const r = this.names.get(n);
      if (r) rects.push(refRect(r));
    }
    this.graph.set(k, rects);
  }

  private context(): EvalContext {
    return {
      cell: (row, col) => this.values.get(cellKey(row, col)) ?? EMPTY,
      name: (n) => this.names.get(n),
      used: () => this.used(),
      angle: this.options.angle,
      complexResults: this.options.complexResults,
    };
  }

  private evaluate(k: string, ctx: EvalContext): CellValue {
    const input = parseInput(this.cells.get(k)?.input ?? '', this.decimal);
    switch (input.kind) {
      case 'empty':
        return EMPTY;
      case 'text':
        return { kind: 'text', text: input.text };
      case 'number':
        return { kind: 'value', value: real(input.value) };
      case 'formula': {
        const c = this.compiled.get(k);
        if (!c) return errorValue('syntax', 'not compiled');
        return c.ok ? evaluateFormula(c.value, ctx) : errorValue(c.error.code, c.error.message);
      }
    }
  }

  /** Recalculates the given cells and everything that depends on them, in dependency order. */
  private recalc(keys: Iterable<string>): ReadonlySet<string> {
    const affected = this.graph.affected(keys);
    const ctx = this.context();
    for (const { key, cycle } of this.graph.order(affected)) {
      const v = cycle ? errorValue('cycle', `${key} depends on itself`) : this.evaluate(key, ctx);
      if (v.kind === 'empty') this.values.delete(key);
      else this.values.set(key, v);
    }
    return affected;
  }

  /** Recompiles and recalculates every cell (after structural changes or loading). */
  recalculateAll(): ReadonlySet<string> {
    this.graph.clear();
    this.compiled.clear();
    this.values.clear();
    this.usedArea = null;
    for (const k of this.cells.keys()) this.bind(k);
    return this.recalc(this.cells.keys());
  }

  // ---- names ---------------------------------------------------------------------------------

  /** Names a cell or range (`rate` → `$B$1`); formulas and the other views read it as a variable. */
  defineName(name: string, target: string): SheetResult<ReadonlySet<string>> {
    if (!isValidName(name)) return failR('name', `${name} cannot be a name`);
    const ref = parseRef(target);
    if (!ref) return failR('ref', `${target} is no reference`);
    this.names.set(name, ref);
    return okR(this.rebindUsers(name));
  }

  removeName(name: string): ReadonlySet<string> {
    if (!this.names.delete(name)) return new Set();
    return this.rebindUsers(name);
  }

  /** Defined names with their reference text (null = deleted cells). */
  nameList(): [string, string | null][] {
    return [...this.names].map(([n, r]) => [n, r && formatRef(r)]);
  }

  /** The value of a name: a cell's value, a range as list or matrix. */
  nameValue(name: string): CellValue {
    if (!this.names.has(name)) return errorValue('name', `unknown name ${name}`);
    const f: CompiledFormula = { expr: { type: 'sym', name }, refs: [], names: [name] };
    return evaluateFormula(f, this.context());
  }

  private rebindUsers(name: string): ReadonlySet<string> {
    const users: string[] = [];
    for (const [k, c] of this.compiled) {
      if (c.ok && c.value.names.includes(name)) {
        this.bind(k);
        users.push(k);
      }
    }
    return this.recalc(users);
  }

  // ---- copy, paste, fill ---------------------------------------------------------------------

  copy(range: string): Clip | null {
    const q = rectOf(range);
    if (!q) return null;
    const r1 = Math.min(q.r1, Math.max(q.r0, this.used().rows - 1));
    const c1 = Math.min(q.c1, Math.max(q.c0, this.used().cols - 1));
    const cells: (CellData | null)[] = [];
    const values: CellValue[] = [];
    for (let r = q.r0; r <= r1; r++) {
      for (let c = q.c0; c <= c1; c++) {
        const k = cellKey(r, c);
        cells.push(this.cells.get(k) ?? null);
        values.push(this.values.get(k) ?? EMPTY);
      }
    }
    return { row: q.r0, col: q.c0, rows: r1 - q.r0 + 1, cols: c1 - q.c0 + 1, cells, values };
  }

  /** Pastes a block with its top-left corner at `at`; parts outside the sheet are dropped. */
  paste(clip: Clip, at: string, mode: PasteMode = 'all'): ReadonlySet<string> {
    const p = parseKey(norm(at));
    if (!p) return new Set();
    const changes = new Map<string, CellData | undefined>();
    for (let i = 0; i < clip.rows; i++) {
      for (let j = 0; j < clip.cols; j++) {
        const row = p.row + i;
        const col = p.col + j;
        if (row >= MAX_ROWS || col >= MAX_COLS) continue;
        const k = cellKey(row, col);
        const src = clip.cells[i * clip.cols + j];
        const old = this.cells.get(k);
        const dRow = row - (clip.row + i);
        const dCol = col - (clip.col + j);
        const shifted = src ? shiftFormula(src.input, dRow, dCol, this.decimal) : '';
        switch (mode) {
          case 'all':
            changes.set(k, src ? { input: shifted, format: src.format } : undefined);
            break;
          case 'formulas':
            changes.set(k, { input: shifted, format: old?.format });
            break;
          case 'values':
            changes.set(k, {
              input: this.valueInput(clip.values[i * clip.cols + j]),
              format: old?.format,
            });
            break;
          case 'formats':
            changes.set(k, { input: old?.input ?? '', format: src?.format });
            break;
        }
      }
    }
    return this.write(changes);
  }

  /** Copies the top row of the range into the rows below (references shifted). */
  fillDown(range: string): ReadonlySet<string> {
    return this.fill(range, true);
  }

  /** Copies the left column of the range into the columns to the right. */
  fillRight(range: string): ReadonlySet<string> {
    return this.fill(range, false);
  }

  private fill(range: string, down: boolean): ReadonlySet<string> {
    const q = rectOf(range);
    if (!q) return new Set();
    const changes = new Map<string, CellData | undefined>();
    for (let r = q.r0; r <= q.r1; r++) {
      for (let c = q.c0; c <= q.c1; c++) {
        if (down ? r === q.r0 : c === q.c0) continue;
        const src = this.cells.get(down ? cellKey(q.r0, c) : cellKey(r, q.c0));
        const d = down ? r - q.r0 : c - q.c0;
        changes.set(
          cellKey(r, c),
          src && {
            input: shiftFormula(src.input, down ? d : 0, down ? 0 : d, this.decimal),
            format: src.format,
          },
        );
      }
    }
    return this.write(changes);
  }

  /** An input that reproduces the value (paste values, CSV). */
  private valueInput(v: CellValue): string {
    switch (v.kind) {
      case 'empty':
        return '';
      case 'error':
        return `'${errorLabel(v.error.code)}`;
      case 'text':
        return parseInput(v.text, this.decimal).kind === 'text' && !v.text.startsWith("'")
          ? v.text
          : `'${v.text}`;
      case 'value': {
        if (v.value.kind !== 'real') return `=${formatValue(v.value, { format: FULL })}`;
        const s = String(v.value.v);
        return this.decimal === ',' ? s.replace('.', ',') : s;
      }
    }
  }

  // ---- structure -----------------------------------------------------------------------------

  insertRows(at: number, count = 1): SheetResult<ReadonlySet<string>> {
    return this.restructure(insertMap('row', at, count), count);
  }

  deleteRows(at: number, count = 1): SheetResult<ReadonlySet<string>> {
    return this.restructure(deleteMap('row', at, count), 0);
  }

  insertCols(at: number, count = 1): SheetResult<ReadonlySet<string>> {
    return this.restructure(insertMap('col', at, count), count);
  }

  deleteCols(at: number, count = 1): SheetResult<ReadonlySet<string>> {
    return this.restructure(deleteMap('col', at, count), 0);
  }

  /** Moves cells, rewrites formulas and names, recalculates everything. */
  private restructure(m: AxisMap, inserted: number): SheetResult<ReadonlySet<string>> {
    const limit = m.axis === 'row' ? MAX_ROWS : MAX_COLS;
    if (inserted) {
      const used = m.axis === 'row' ? this.used().rows : this.used().cols;
      if (used + inserted > limit) return failR('ref', 'the sheet is full');
    }
    const moved = new Map<string, CellData>();
    for (const [k, d] of this.cells) {
      const p = parseKey(k)!;
      const i = m.map(m.axis === 'row' ? p.row : p.col);
      if (i === null) continue;
      const nk = m.axis === 'row' ? cellKey(i, p.col) : cellKey(p.row, i);
      const input = rewriteRefs(d.input, (r) => remapRef(r, m), this.decimal);
      moved.set(nk, d.format ? { input, format: d.format } : { input });
    }
    this.cells.clear();
    for (const [k, d] of moved) this.cells.set(k, d);
    for (const [n, r] of this.names) this.names.set(n, r && remapRef(r, m));
    return okR(this.recalculateAll());
  }

  /**
   * Sorts the rows of a range by one of its columns (letter or index): numbers, then text
   * (case-insensitive), errors and empty cells last. Stable. See the module comment for formulas.
   */
  sort(range: string, by: string | number, descending = false): SheetResult<ReadonlySet<string>> {
    const q = rectOf(range);
    if (!q) return failR('ref', `${range} is no range`);
    const col = typeof by === 'number' ? by : colIndex(by);
    if (col === null || col < q.c0 || col > q.c1)
      return failR('ref', 'sort column outside the range');
    const r1 = Math.min(q.r1, this.used().rows - 1);
    const rank = (v: CellValue) =>
      v.kind === 'value'
        ? v.value.kind === 'real'
          ? 0
          : 1
        : v.kind === 'text'
          ? 1
          : v.kind === 'error'
            ? 2
            : 3;
    const keyText = (v: CellValue) => cellText(v, FULL).toLowerCase();
    const rows: number[] = [];
    for (let r = q.r0; r <= r1; r++) rows.push(r);
    const val = (r: number) => this.values.get(cellKey(r, col)) ?? EMPTY;
    rows.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const ra = rank(va);
      const rb = rank(vb);
      if (ra >= 2 || rb >= 2) return ra - rb || a - b;
      let d = ra - rb;
      if (!d && ra === 0)
        d = (va as { value: { v: number } }).value.v - (vb as { value: { v: number } }).value.v;
      if (!d) d = keyText(va).localeCompare(keyText(vb));
      return (descending ? -d : d) || a - b;
    });
    const changes = new Map<string, CellData | undefined>();
    rows.forEach((from, i) => {
      const to = q.r0 + i;
      for (let c = q.c0; c <= q.c1; c++) {
        const src = this.cells.get(cellKey(from, c));
        changes.set(
          cellKey(to, c),
          src && { input: shiftFormula(src.input, to - from, 0, this.decimal), format: src.format },
        );
      }
    });
    return okR(this.write(changes));
  }

  // ---- CSV and JSON --------------------------------------------------------------------------

  /** The used area as CSV: values (default) or inputs (formulas as typed). */
  toCsv(opts: CsvOptions & { readonly content?: 'values' | 'inputs' } = {}): string {
    const sep = opts.separator ?? ',';
    const dec = opts.decimal ?? '.';
    const { rows, cols } = this.used();
    const out: string[][] = [];
    for (let r = 0; r < rows; r++) {
      const line: string[] = [];
      for (let c = 0; c < cols; c++) {
        const k = cellKey(r, c);
        if (opts.content === 'inputs') {
          line.push(this.cells.get(k)?.input ?? '');
          continue;
        }
        const v = this.values.get(k) ?? EMPTY;
        if (v.kind === 'value' && v.value.kind === 'real') {
          const s = String(v.value.v);
          line.push(dec === ',' ? s.replace('.', ',') : s);
        } else line.push(cellText(v, { ...FULL, decimal: dec }));
      }
      out.push(line);
    }
    return writeCsv(out, sep);
  }

  /**
   * Reads CSV into the sheet from `at` (default A1). Numbers in the CSV's decimal mark become
   * numbers; other fields become text, unless `formulas` is set and they start with `=`.
   */
  importCsv(
    text: string,
    opts: CsvOptions & { readonly at?: string; readonly formulas?: boolean } = {},
  ): ReadonlySet<string> {
    const start = parseKey(norm(opts.at ?? 'A1'));
    if (!start) return new Set();
    const dec = opts.decimal ?? '.';
    const changes = new Map<string, CellData | undefined>();
    parseCsv(text, opts.separator ?? ',').forEach((line, i) =>
      line.forEach((field, j) => {
        const row = start.row + i;
        const col = start.col + j;
        if (row >= MAX_ROWS || col >= MAX_COLS) return;
        const k = cellKey(row, col);
        const fmt = this.cells.get(k)?.format;
        let input: string;
        const p = parseInput(field, dec);
        if (field === '') input = '';
        else if (opts.formulas && p.kind === 'formula') input = field;
        else if (p.kind === 'number') {
          const s = String(p.value);
          input = this.decimal === ',' ? s.replace('.', ',') : s;
        } else {
          input = this.valueInput({ kind: 'text', text: field });
        }
        changes.set(k, { input, format: fmt });
      }),
    );
    return this.write(changes);
  }

  toJSON(): SheetJSON {
    const cells: Record<string, CellData> = {};
    for (const [k, d] of this.cells) cells[k] = d;
    const names: Record<string, string | null> = {};
    for (const [n, r] of this.names) names[n] = r && formatRef(r);
    return { version: 1, options: this.options, cells, names };
  }

  /** A sheet from `toJSON` output; malformed data is reported, not thrown. */
  static fromJSON(data: unknown): SheetResult<Sheet> {
    const d = data as Partial<SheetJSON> | null;
    if (!d || typeof d !== 'object' || d.version !== 1 || typeof d.cells !== 'object' || !d.cells) {
      return failR('value', 'not a sheet');
    }
    const sheet = new Sheet(typeof d.options === 'object' && d.options ? d.options : {});
    for (const [k, c] of Object.entries(d.cells)) {
      const key = norm(k);
      if (!parseKey(key) || typeof c?.input !== 'string') return failR('ref', `bad cell ${k}`);
      sheet.store(key, c);
    }
    for (const [n, r] of Object.entries(d.names ?? {})) {
      const ref = r === null ? null : parseRef(r);
      if (!isValidName(n) || ref === undefined || (r !== null && !ref)) {
        return failR('name', `bad name ${n}`);
      }
      sheet.names.set(n, ref);
    }
    sheet.recalculateAll();
    return okR(sheet);
  }
}

const norm = (key: string) => key.trim().toUpperCase();
