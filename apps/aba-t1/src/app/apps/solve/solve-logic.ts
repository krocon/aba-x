/**
 * Solve app (prompt 039), pure wiring: the enabled equations E1 … E0, their variables with values,
 * the unknowns and one solve step. The mathematics is `@aba/math/numeric/equations`.
 */
import type { Expr } from '@aba/math/ast/nodes';
import { freeSymbols } from '@aba/math/ast/build';
import { equationSides, equationVariables, solveEquations } from '@aba/math/numeric/equations';
import type { NumericScope } from '@aba/math/numeric/evaluate';
import { type CurveState, parseEquation } from '../curve/curve-logic';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export interface Equation {
  row: number;
  name: string;
  expr: Expr;
}

/** The enabled, valid equations. */
export function equations(s: CurveState): Equation[] {
  const out: Equation[] = [];
  s.rows.forEach((r, i) => {
    if (!r.on) return;
    const e = parseEquation(r.fields[0]);
    if (e && typeof e !== 'string') out.push({ row: i, name: `E${DIGITS[i]}`, expr: e });
  });
  return out;
}

/** Variables of the enabled equations with their values (missing values: home variable or 0). */
export function variables(
  s: CurveState,
  home: ReadonlyMap<string, number> = new Map(),
): { name: string; value: number }[] {
  return equationVariables(equations(s).map((e) => e.expr)).map((name) => ({
    name,
    value: s.values?.[name] ?? home.get(name) ?? 0,
  }));
}

export type SolveStatus =
  | { kind: 'zero' | 'sign-change' | 'extremum'; variable: string; x: number; fx: number }
  | { kind: 'system'; variables: string[]; residual: number }
  | { kind: 'error'; message: string };

export interface SolveStep {
  values: Record<string, number>;
  status: SolveStatus;
}

/**
 * Solves for the marked unknowns, or – when none is marked – for `cursorVar`. A sign change or an
 * extremum is reported as such (no solution); the value is still set to the closest point found
 * (like the model calculator), so the next solve starts there.
 */
export function solveStep(
  s: CurveState,
  cursorVar: string | null,
  scope: NumericScope,
  home: ReadonlyMap<string, number> = new Map(),
): SolveStep {
  const vars = variables(s, home);
  const names = vars.map((v) => v.name);
  const current = Object.fromEntries(vars.map((v) => [v.name, v.value]));
  const marked = (s.unknowns ?? []).filter((u) => names.includes(u));
  const unknownNames = marked.length ? marked : cursorVar ? [cursorVar] : [];
  const fail = (message: string): SolveStep => ({
    values: current,
    status: { kind: 'error', message },
  });
  if (!unknownNames.length || unknownNames.some((u) => !names.includes(u)))
    return fail('choose the variable to solve for');
  const r = solveEquations(
    equations(s).map((e) => e.expr),
    names,
    vars.map((v) => v.value),
    unknownNames.map((u) => names.indexOf(u)),
    scope,
  );
  if (!r.ok) return fail(r.error.message);
  const values = Object.fromEntries(names.map((n, k) => [n, r.value.values[k]]));
  const o = r.value.outcome;
  if (o) {
    return {
      values,
      status: { kind: o.kind, variable: unknownNames[0], x: o.x, fx: o.fx },
    };
  }
  return {
    values,
    status: { kind: 'system', variables: unknownNames, residual: r.value.residual ?? 0 },
  };
}

/** The equation that the plot shows for `variable`: the first enabled one containing it. */
export function plotEquation(
  s: CurveState,
  variable: string,
): { eq: Equation; left: Expr; right: Expr } | null {
  for (const eq of equations(s)) {
    if (!freeSymbols(eq.expr).has(variable)) continue;
    const sides = equationSides(eq.expr);
    if (sides.ok) return { eq, ...sides.value };
  }
  return null;
}
