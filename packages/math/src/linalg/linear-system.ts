/**
 * Linear systems A·x = b of the T1 "Linear Solver" app (prompt 039): one unique solution, infinitely
 * many (a particular solution plus a basis of the null space) or none – decided by the ranks of A
 * and [A | b] from the reduced row echelon form (with the tolerance of `rref`).
 */
import { type MathResult, fail, ok } from '../result';
import { type Matrix, rref } from './linalg';

export type LinearSystemResult =
  | { readonly kind: 'unique'; readonly x: number[] }
  | {
      readonly kind: 'infinite';
      /** One solution (free variables 0). */
      readonly particular: number[];
      /** Indices of the free variables. */
      readonly free: number[];
      /** One null-space vector per free variable: x = particular + Σ t_k · basis[k]. */
      readonly basis: number[][];
      readonly rank: number;
    }
  | { readonly kind: 'none'; readonly rank: number };

export function analyzeLinearSystem(
  a: Matrix,
  b: readonly number[],
): MathResult<LinearSystemResult> {
  const rows = a.length;
  const cols = a[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return fail('domain', 'the system is empty');
  if (a.some((r) => r.length !== cols)) return fail('domain', 'the rows must have equal length');
  if (b.length !== rows) return fail('domain', 'the right side has the wrong length');
  if (![...a.flat(), ...b].every(Number.isFinite)) {
    return fail('domain', 'every coefficient must be a number');
  }
  const { rref: r, pivots } = rref(a.map((row, i) => [...row, b[i]]));
  if (pivots.includes(cols)) return ok({ kind: 'none', rank: pivots.length - 1 });
  const rank = pivots.length;
  const particular = new Array<number>(cols).fill(0);
  pivots.forEach((c, i) => (particular[c] = r[i][cols]));
  if (rank === cols) return ok({ kind: 'unique', x: particular.map((x) => x + 0) });
  const free: number[] = [];
  for (let c = 0; c < cols; c++) if (!pivots.includes(c)) free.push(c);
  const basis = free.map((f) => {
    const v = new Array<number>(cols).fill(0);
    v[f] = 1;
    pivots.forEach((c, i) => (v[c] = -r[i][f] + 0));
    return v;
  });
  return ok({ kind: 'infinite', particular, free, basis, rank });
}
