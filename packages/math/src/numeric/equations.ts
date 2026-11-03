/**
 * Equations of the T1 "Solve" app (prompt 039): an equation `left = right` (or a bare expression,
 * read as `expr = 0`) in any number of variables. The free names are the variables; the app keeps
 * a value for each, marks the unknowns and solves: one unknown with `solveFor` (honest outcome:
 * zero, sign change or extremum), several with `solveSystem` (n equations for n unknowns).
 */
import { freeSymbols } from '../ast/build';
import type { Expr } from '../ast/nodes';
import { type MathResult, fail, ok } from '../result';
import { type NumericScope, compile } from './evaluate';
import { type SolveOneOutcome, solveFor, solveSystem } from './solve-multi';

/** Names that are constants, not variables. */
export const CONSTANT_NAMES: ReadonlySet<string> = new Set(['pi', 'e', 'i', 'inf', 'Ans']);

/** Left and right side of an equation; a bare expression is `expr = 0`. Inequalities are refused. */
export function equationSides(e: Expr): MathResult<{ left: Expr; right: Expr }> {
  if (e.type === 'rel') {
    if (e.op !== '=') return fail('domain', 'an equation (=) is needed, not an inequality');
    if (e.left.type === 'rel' || e.right.type === 'rel') {
      return fail('syntax', 'only one = per equation');
    }
    return ok({ left: e.left, right: e.right });
  }
  return ok({ left: e, right: { type: 'num', value: '0' } });
}

/** The variables of the equations: free names without constants, sorted (A, B, …, then longer). */
export function equationVariables(eqs: readonly Expr[]): string[] {
  const names = new Set<string>();
  for (const e of eqs) for (const n of freeSymbols(e)) if (!CONSTANT_NAMES.has(n)) names.add(n);
  return [...names].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

/** left − right as a function of the values of `names` (NaN where undefined). */
export function residualFunction(
  e: Expr,
  names: readonly string[],
  scope: NumericScope = {},
): (values: readonly number[]) => number {
  const sides = equationSides(e);
  if (!sides.ok) return () => NaN;
  const vars = new Map(scope.variables);
  const s = { ...scope, variables: vars };
  const l = compile(sides.value.left, '\u0000', s);
  const r = compile(sides.value.right, '\u0000', s);
  return (values) => {
    names.forEach((n, k) => vars.set(n, values[k]));
    const d = l(0) - r(0);
    return Number.isFinite(d) ? d : NaN;
  };
}

export interface EquationSolution {
  /** All values, the unknowns replaced by the solution (or the closest point found). */
  readonly values: number[];
  /** True when the equations hold at `values`. */
  readonly solved: boolean;
  /** One unknown: what the scalar solver found (zero, sign change, extremum). */
  readonly outcome?: SolveOneOutcome;
  /** Several unknowns: max-norm of the residuals. */
  readonly residual?: number;
}

/**
 * Solves the equations for the unknowns (indices into `names`); the other variables keep their
 * values. Only equations that contain an unknown take part; their number must equal the number of
 * unknowns. The current values are the start values.
 */
export function solveEquations(
  eqs: readonly Expr[],
  names: readonly string[],
  values: readonly number[],
  unknowns: readonly number[],
  scope: NumericScope = {},
): MathResult<EquationSolution> {
  if (unknowns.length === 0) return fail('domain', 'choose the variable to solve for');
  if (names.length !== values.length) return fail('domain', 'every variable needs a value');
  for (const e of eqs) {
    const s = equationSides(e);
    if (!s.ok) return s;
  }
  const unknownNames = new Set(unknowns.map((k) => names[k]));
  const used = eqs.filter((e) => [...freeSymbols(e)].some((n) => unknownNames.has(n)));
  if (used.length === 0) return fail('domain', 'no equation contains the unknown');
  const fs = used.map((e) => residualFunction(e, names, scope));
  if (unknowns.length === 1) {
    if (used.length > 1) {
      return fail(
        'domain',
        `${used.length} equations contain ${names[unknowns[0]]} – switch all but one off or mark ${used.length} unknowns`,
      );
    }
    const r = solveFor(fs[0], values, unknowns[0]);
    if (!r.ok) return r;
    const v = [...values];
    v[unknowns[0]] = r.value.x;
    return ok({ values: v, solved: r.value.solved, outcome: r.value });
  }
  if (used.length !== unknowns.length) {
    return fail(
      'domain',
      `${used.length} equations for ${unknowns.length} unknowns – the numbers must be equal`,
    );
  }
  const full = [...values];
  const F = (x: number[]) => {
    unknowns.forEach((k, j) => (full[k] = x[j]));
    return fs.map((f) => f(full));
  };
  const r = solveSystem(
    F,
    unknowns.map((k) => values[k]),
  );
  if (!r.ok) return r;
  const v = [...values];
  unknowns.forEach((k, j) => (v[k] = r.value.x[j]));
  return ok({ values: v, solved: true, residual: r.value.residual });
}
