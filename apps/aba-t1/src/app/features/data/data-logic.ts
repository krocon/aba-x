/**
 * Lists and matrices as stored variables (prompt 032), pure: catalogue slots, sizes and the edit
 * operations of the table editor. Lists hold real numbers here (the evaluator also allows complex
 * items); matrices are real. Editing past the end grows the table, like on the device.
 */
import { type Value, list, matrix, real } from '@aba/math/value/value';

export type DataKind = 'list' | 'matrix';

export const SLOTS: Record<DataKind, string[]> = {
  list: Array.from({ length: 10 }, (_, i) => `L${i}`),
  matrix: Array.from({ length: 10 }, (_, i) => `M${i}`),
};

/** Table of numbers of a variable: a list is one column. */
export function cells(v: Value | undefined, kind: DataKind): number[][] {
  if (kind === 'list') {
    if (v?.kind !== 'list') return [];
    return v.items.map((x) => [x.kind === 'real' ? x.v : NaN]);
  }
  return v?.kind === 'matrix' ? v.rows.map((r) => [...r]) : [];
}

export function toValue(t: number[][], kind: DataKind): Value {
  return kind === 'list' ? list(t.map((r) => real(r[0]))) : matrix(t);
}

export function sizeText(v: Value | undefined): string {
  if (v?.kind === 'list') return `${v.items.length}`;
  if (v?.kind === 'matrix') return `${v.rows.length}×${v.rows[0]?.length ?? 0}`;
  return '';
}

/** Sets cell (r, c); the table grows with zeros to reach it. */
export function setCell(t: number[][], r: number, c: number, x: number): number[][] {
  const cols = Math.max(t[0]?.length ?? 0, c + 1);
  const out = t.map((row) => [...row, ...Array(cols - row.length).fill(0)]);
  while (out.length <= r) out.push(Array(cols).fill(0));
  out[r][c] = x;
  return out;
}

export function insertRow(t: number[][], r: number): number[][] {
  const cols = Math.max(1, t[0]?.length ?? 1);
  return [...t.slice(0, r), Array(cols).fill(0), ...t.slice(r)];
}

export function deleteRow(t: number[][], r: number): number[][] {
  return t.filter((_, i) => i !== r);
}

export function insertColumn(t: number[][], c: number): number[][] {
  return t.map((row) => [...row.slice(0, c), 0, ...row.slice(c)]);
}

export function deleteColumn(t: number[][], c: number): number[][] {
  const out = t.map((row) => row.filter((_, j) => j !== c));
  return out[0]?.length ? out : [];
}
