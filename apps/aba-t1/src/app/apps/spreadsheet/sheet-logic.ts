/**
 * Spreadsheet app (prompt 041), pure helpers of the views: the stored state, cursor and selection,
 * the visible window of the grid, cell formats and the hand-over of sheet data to other views
 * (names → home variables, columns → lists). The formulas themselves live in `@aba/math/sheet`.
 */
import { type CellValue } from '@aba/math/sheet/evaluate';
import {
  MAX_COLS,
  MAX_ROWS,
  type Rect,
  colName,
  parseKey,
  parseRef,
  refRect,
} from '@aba/math/sheet/refs';
import { type CellFormat, Sheet, type SheetJSON } from '@aba/math/sheet/sheet';
import type { NumberFormat } from '@aba/math/value/format';
import { type Value, list } from '@aba/math/value/value';

export interface SheetState {
  sheet: SheetJSON;
  /** column letter → width in em (only columns that differ from `width`) */
  widths: Record<string, number>;
  /** default column width in em */
  width: number;
  /** CSV field separator (`;` writes and reads the decimal comma) */
  csvSep: ',' | ';';
  /** CSV export of values or of the inputs (formulas as typed) */
  csvContent: 'values' | 'inputs';
}

export const MIN_WIDTH = 2;
export const MAX_WIDTH = 20;

export function initSheetState(): SheetState {
  return { sheet: new Sheet().toJSON(), widths: {}, width: 5, csvSep: ',', csvContent: 'values' };
}

export interface Pos {
  readonly row: number;
  readonly col: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

/** One step (or `n`) in a direction, kept inside the sheet. */
export function move(p: Pos, d: Dir, n = 1): Pos {
  const clamp = (x: number, max: number) => Math.min(max - 1, Math.max(0, x));
  if (d === 'up' || d === 'down')
    return { row: clamp(p.row + (d === 'down' ? n : -n), MAX_ROWS), col: p.col };
  return { row: p.row, col: clamp(p.col + (d === 'right' ? n : -n), MAX_COLS) };
}

/** The selected rectangle: cursor alone or the block between anchor and cursor. */
export function selection(cursor: Pos, anchor: Pos | null): Rect {
  const a = anchor ?? cursor;
  return {
    r0: Math.min(a.row, cursor.row),
    c0: Math.min(a.col, cursor.col),
    r1: Math.max(a.row, cursor.row),
    c1: Math.max(a.col, cursor.col),
  };
}

export const inside = (q: Rect, row: number, col: number): boolean =>
  row >= q.r0 && row <= q.r1 && col >= q.c0 && col <= q.c1;

/** `A1`, `A1:B9`, whole columns `A:B` (all rows selected). */
export function rangeText(q: Rect): string {
  if (q.r0 === 0 && q.r1 === MAX_ROWS - 1) return `${colName(q.c0)}:${colName(q.c1)}`;
  const a = `${colName(q.c0)}${q.r0 + 1}`;
  const b = `${colName(q.c1)}${q.r1 + 1}`;
  return a === b ? a : `${a}:${b}`;
}

/** A Go To target (`B20`, `A1:C3`, `C:C` or a name) → its rectangle, or null. */
export function target(src: string, sheet: Sheet): Rect | null {
  const t = src.trim();
  const named = sheet.nameList().find(([n]) => n === t);
  const r = parseRef(named ? (named[1] ?? '') : t.toUpperCase());
  if (!r) return null;
  const q = refRect(r);
  return { r0: q.r0, c0: q.c0, r1: Math.min(q.r1, MAX_ROWS - 1), c1: Math.min(q.c1, MAX_COLS - 1) };
}

/** The rectangle clipped to the used area (at least its first cell): fill, sort, lists. */
export function clipToUsed(q: Rect, used: { rows: number; cols: number }): Rect {
  return {
    ...q,
    r1: Math.max(q.r0, Math.min(q.r1, used.rows - 1)),
    c1: Math.max(q.c0, Math.min(q.c1, used.cols - 1)),
  };
}

export function colWidth(s: SheetState, col: number): number {
  return s.widths[colName(col)] ?? s.width;
}

/** New widths after changing the columns `c0 … c1` by `delta` em. */
export function resize(s: SheetState, c0: number, c1: number, delta: number): SheetState['widths'] {
  const w = { ...s.widths };
  for (let c = c0; c <= c1; c++) {
    const x = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, colWidth(s, c) + delta));
    if (x === s.width) delete w[colName(c)];
    else w[colName(c)] = x;
  }
  return w;
}

/** First index of a window of `count` items that shows `cursor` and moves as little as possible. */
export function follow(start: number, cursor: number, count: number): number {
  const n = Math.max(1, count);
  if (cursor < start) return cursor;
  if (cursor >= start + n) return cursor - n + 1;
  return start;
}

/** Columns from `left` that fit into `room` em (at least one). */
export function columnsFrom(left: number, room: number, width: (c: number) => number): number[] {
  const out: number[] = [];
  let used = 0;
  for (let c = left; c < MAX_COLS; c++) {
    used += width(c);
    if (out.length && used > room) break;
    out.push(c);
  }
  return out;
}

/** Leftmost column such that `cursor` is visible in `room` em, moving as little as possible. */
export function followCols(
  left: number,
  cursor: number,
  room: number,
  width: (c: number) => number,
): number {
  if (cursor < left) return cursor;
  let l = left;
  while (l < cursor && !columnsFrom(l, room, width).includes(cursor)) l++;
  return l;
}

/** Presets of the Format menu. */
export type FormatOp =
  | { kind: 'number'; format: NumberFormat | undefined }
  | { kind: 'align'; align: CellFormat['align'] }
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'color'; color: string | undefined };

/** Text colours of cells (contrast ≥ 4.5:1 on white and on the selection colour). */
export const COLORS = { red: '#b42318', blue: '#1f4fa3', green: '#1d6b3f' } as const;

/** The format of one cell after an operation; undefined = no format left. */
export function applyFormat(old: CellFormat | undefined, op: FormatOp): CellFormat | undefined {
  const f: { -readonly [K in keyof CellFormat]: CellFormat[K] } = { ...old };
  switch (op.kind) {
    case 'number':
      f.number = op.format;
      break;
    case 'align':
      f.align = op.align;
      break;
    case 'bold':
      f.bold = !old?.bold;
      break;
    case 'italic':
      f.italic = !old?.italic;
      break;
    case 'color':
      f.color = op.color;
      break;
  }
  for (const k of Object.keys(f) as (keyof CellFormat)[]) {
    if (f[k] === undefined || f[k] === false) delete f[k];
  }
  return Object.keys(f).length ? f : undefined;
}

/** The value of a sheet name as a home variable (numbers, lists, matrices), or null. */
export function exportable(v: CellValue): Value | null {
  return v.kind === 'value' ? v.value : null;
}

/** Names of the sheet whose value should be stored as home variables (unchanged ones left out). */
export function namesToPublish(sheet: Sheet, home: ReadonlyMap<string, Value>): [string, Value][] {
  const out: [string, Value][] = [];
  for (const [n] of sheet.nameList()) {
    const v = exportable(sheet.nameValue(n));
    if (v && JSON.stringify(home.get(n)) !== JSON.stringify(v)) out.push([n, v]);
  }
  return out;
}

/**
 * The columns of a rectangle as lists (for L1, L2 … and the statistics apps): numbers top to
 * bottom; empty cells are skipped, text and errors are refused (never invented values).
 */
export function columnsToLists(sheet: Sheet, q: Rect): Value[] | string {
  const out: Value[] = [];
  for (let c = q.c0; c <= q.c1; c++) {
    const items: Value[] = [];
    for (let r = q.r0; r <= q.r1; r++) {
      const key = `${colName(c)}${r + 1}`;
      const v = sheet.value(key);
      if (v.kind === 'empty') continue;
      if (v.kind !== 'value' || v.value.kind !== 'real') return `${key} is not a real number`;
      items.push(v.value);
    }
    out.push(list(items));
  }
  return out;
}

/** A cell key typed by the user (`b3`) → position, or null. */
export function keyPos(src: string): Pos | null {
  return parseKey(src.trim().toUpperCase());
}
