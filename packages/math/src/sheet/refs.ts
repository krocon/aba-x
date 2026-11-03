/**
 * Cell references of the spreadsheet (prompt 041): `A1` … `ZZ9999`, absolute and mixed (`$A$1`,
 * `A$1`, `$A1`), ranges `A1:B9` (corners normalised), whole columns/rows `A:C`, `3:5`. Coordinates
 * are 0-based internally; letters are case-insensitive and always formatted in upper case. Pure.
 */

/** Columns A … ZZ. */
export const MAX_COLS = 26 + 26 * 26;
/** Rows 1 … 9999. */
export const MAX_ROWS = 9999;

/** One cell; `absRow`/`absCol` = the `$` parts that stay when a formula is copied. */
export interface CellRef {
  readonly row: number;
  readonly col: number;
  readonly absRow: boolean;
  readonly absCol: boolean;
}

/** One coordinate of a whole-column (`A:C`) or whole-row (`3:5`) range. */
export interface LineRef {
  readonly index: number;
  readonly abs: boolean;
}

export type Ref =
  | { readonly kind: 'cell'; readonly cell: CellRef }
  /** `from` is the top-left, `to` the bottom-right corner. */
  | { readonly kind: 'range'; readonly from: CellRef; readonly to: CellRef }
  | { readonly kind: 'cols'; readonly from: LineRef; readonly to: LineRef }
  | { readonly kind: 'rows'; readonly from: LineRef; readonly to: LineRef };

/** A rectangle of cells, inclusive bounds (0-based). */
export interface Rect {
  readonly r0: number;
  readonly c0: number;
  readonly r1: number;
  readonly c1: number;
}

/** Column letters: 0 → A, 25 → Z, 26 → AA, 701 → ZZ. */
export function colName(col: number): string {
  if (col < 26) return String.fromCharCode(65 + col);
  const k = col - 26;
  return String.fromCharCode(65 + Math.floor(k / 26)) + String.fromCharCode(65 + (k % 26));
}

/** Column index of `A` … `ZZ` (case-insensitive), or null. */
export function colIndex(letters: string): number | null {
  const s = letters.toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(s)) return null;
  if (s.length === 1) return s.charCodeAt(0) - 65;
  return 26 + (s.charCodeAt(0) - 65) * 26 + (s.charCodeAt(1) - 65);
}

/** The key of a cell in the sheet map: `A1`. */
export const cellKey = (row: number, col: number): string => `${colName(col)}${row + 1}`;

/** Row and column of a key `A1` (null when it is no valid key). */
export function parseKey(key: string): { row: number; col: number } | null {
  const c = parseCellRef(key);
  return c && !c.absRow && !c.absCol ? { row: c.row, col: c.col } : null;
}

const CELL = /^(\$?)([A-Za-z]{1,2})(\$?)(\d{1,4})$/;

/** `B$3` → { row: 2, col: 1, absRow: true, absCol: false }; null outside A1 … ZZ9999. */
export function parseCellRef(src: string): CellRef | null {
  const m = CELL.exec(src.trim());
  if (!m) return null;
  const col = colIndex(m[2]);
  const row = Number(m[4]) - 1;
  if (col === null || row < 0 || row >= MAX_ROWS) return null;
  return { row, col, absRow: m[3] === '$', absCol: m[1] === '$' };
}

export function formatCellRef(c: CellRef): string {
  return `${c.absCol ? '$' : ''}${colName(c.col)}${c.absRow ? '$' : ''}${c.row + 1}`;
}

/** Range with sorted corners; each coordinate keeps the `$` of the corner it came from. */
export function normalizeRange(a: CellRef, b: CellRef): Ref {
  const [top, bottom] = a.row <= b.row ? [a, b] : [b, a];
  const [left, right] = a.col <= b.col ? [a, b] : [b, a];
  return {
    kind: 'range',
    from: { row: top.row, absRow: top.absRow, col: left.col, absCol: left.absCol },
    to: { row: bottom.row, absRow: bottom.absRow, col: right.col, absCol: right.absCol },
  };
}

function parseLine(src: string, cols: boolean): LineRef | null {
  const m = /^(\$?)(\w+)$/.exec(src);
  if (!m) return null;
  if (cols) {
    const index = colIndex(m[2]);
    return index === null ? null : { index, abs: m[1] === '$' };
  }
  if (!/^\d{1,4}$/.test(m[2])) return null;
  const index = Number(m[2]) - 1;
  return index < 0 || index >= MAX_ROWS ? null : { index, abs: m[1] === '$' };
}

/** Any reference: `A1`, `$A$1:B9`, `A:A`, `3:5`. Null when the text is no reference. */
export function parseRef(src: string): Ref | null {
  const s = src.trim();
  const parts = s.split(':');
  if (parts.length === 1) {
    const cell = parseCellRef(s);
    return cell ? { kind: 'cell', cell } : null;
  }
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  const ca = parseCellRef(a);
  const cb = parseCellRef(b);
  if (ca && cb) return normalizeRange(ca, cb);
  for (const cols of [true, false]) {
    const la = parseLine(a, cols);
    const lb = parseLine(b, cols);
    if (la && lb) {
      const [from, to] = la.index <= lb.index ? [la, lb] : [lb, la];
      return { kind: cols ? 'cols' : 'rows', from, to };
    }
  }
  return null;
}

export function formatRef(r: Ref): string {
  const line = (l: LineRef, cols: boolean) =>
    `${l.abs ? '$' : ''}${cols ? colName(l.index) : l.index + 1}`;
  switch (r.kind) {
    case 'cell':
      return formatCellRef(r.cell);
    case 'range':
      return `${formatCellRef(r.from)}:${formatCellRef(r.to)}`;
    case 'cols':
      return `${line(r.from, true)}:${line(r.to, true)}`;
    case 'rows':
      return `${line(r.from, false)}:${line(r.to, false)}`;
  }
}

/** The cells a reference covers; whole columns/rows span the full sheet (callers clip them). */
export function refRect(r: Ref): Rect {
  switch (r.kind) {
    case 'cell':
      return { r0: r.cell.row, c0: r.cell.col, r1: r.cell.row, c1: r.cell.col };
    case 'range':
      return { r0: r.from.row, c0: r.from.col, r1: r.to.row, c1: r.to.col };
    case 'cols':
      return { r0: 0, c0: r.from.index, r1: MAX_ROWS - 1, c1: r.to.index };
    case 'rows':
      return { r0: r.from.index, c0: 0, r1: r.to.index, c1: MAX_COLS - 1 };
  }
}

export const inRect = (q: Rect, row: number, col: number): boolean =>
  row >= q.r0 && row <= q.r1 && col >= q.c0 && col <= q.c1;

/** The text of the reference error marker in formulas. */
export const REF_ERROR = '#REF!';

const rowOk = (r: number) => r >= 0 && r < MAX_ROWS;
const colOk = (c: number) => c >= 0 && c < MAX_COLS;

/**
 * The reference in a formula copied by (dRow, dCol): relative parts move, `$` parts stay.
 * Null = the reference leaves the sheet (the formula shows `#REF!` there).
 */
export function shiftRef(r: Ref, dRow: number, dCol: number): Ref | null {
  const cell = (c: CellRef): CellRef | null => {
    const row = c.absRow ? c.row : c.row + dRow;
    const col = c.absCol ? c.col : c.col + dCol;
    return rowOk(row) && colOk(col) ? { ...c, row, col } : null;
  };
  const line = (l: LineRef, d: number, ok: (i: number) => boolean): LineRef | null => {
    const index = l.abs ? l.index : l.index + d;
    return ok(index) ? { ...l, index } : null;
  };
  switch (r.kind) {
    case 'cell': {
      const c = cell(r.cell);
      return c && { kind: 'cell', cell: c };
    }
    case 'range': {
      const a = cell(r.from);
      const b = cell(r.to);
      return a && b && normalizeRange(a, b);
    }
    case 'cols': {
      const a = line(r.from, dCol, colOk);
      const b = line(r.to, dCol, colOk);
      return a && b && { kind: 'cols', from: a, to: b };
    }
    case 'rows': {
      const a = line(r.from, dRow, rowOk);
      const b = line(r.to, dRow, rowOk);
      return a && b && { kind: 'rows', from: a, to: b };
    }
  }
}

/**
 * Structural change of the sheet along one axis (insert/delete rows or columns): `map(i)` is the new
 * index of line `i`, or null when the line was deleted. Applies to absolute and relative parts alike.
 */
export interface AxisMap {
  readonly axis: 'row' | 'col';
  readonly map: (index: number) => number | null;
}

/** Inserting `count` lines before `at`. */
export const insertMap = (axis: 'row' | 'col', at: number, count: number): AxisMap => ({
  axis,
  map: (i) => (i >= at ? i + count : i),
});

/** Deleting lines `at` … `at + count − 1`. */
export const deleteMap = (axis: 'row' | 'col', at: number, count: number): AxisMap => ({
  axis,
  map: (i) => (i < at ? i : i >= at + count ? i - count : null),
});

/**
 * The reference after an insert/delete. A single cell that was deleted gives null (`#REF!`); a
 * range shrinks to its surviving part and is null only when all of it was deleted.
 */
export function remapRef(r: Ref, m: AxisMap): Ref | null {
  const limit = m.axis === 'row' ? MAX_ROWS : MAX_COLS;
  const ok = (i: number | null): i is number => i !== null && i >= 0 && i < limit;
  /** first surviving index ≥ i, last surviving index ≤ j */
  const span = (i: number, j: number): [number, number] | null => {
    let a: number | null = null;
    for (let k = i; k <= j && a === null; k++) a = m.map(k);
    let b: number | null = null;
    for (let k = j; k >= i && b === null; k--) b = m.map(k);
    if (a === null || b === null) return null;
    // lines pushed past the end are clipped (ranges); an empty rest is a reference error
    b = Math.min(b, limit - 1);
    return a <= b ? [a, b] : null;
  };
  switch (r.kind) {
    case 'cell': {
      const i = m.map(m.axis === 'row' ? r.cell.row : r.cell.col);
      if (!ok(i)) return null;
      const cell = m.axis === 'row' ? { ...r.cell, row: i } : { ...r.cell, col: i };
      return { kind: 'cell', cell };
    }
    case 'range': {
      const key = m.axis === 'row' ? 'row' : 'col';
      const s = span(r.from[key], r.to[key]);
      if (!s) return null;
      return { kind: 'range', from: { ...r.from, [key]: s[0] }, to: { ...r.to, [key]: s[1] } };
    }
    case 'cols':
    case 'rows': {
      if ((r.kind === 'cols') !== (m.axis === 'col')) return r;
      const s = span(r.from.index, r.to.index);
      if (!s) return null;
      return { ...r, from: { ...r.from, index: s[0] }, to: { ...r.to, index: s[1] } };
    }
  }
}
