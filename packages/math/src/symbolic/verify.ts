/**
 * Numerical spot checks for CAS results (design 009 E3). Evaluates both sides at a few fixed
 * points; a disagreement anywhere rejects the result, points where either side is undefined are
 * skipped.
 */
import { freeSymbols, substitute } from '../ast/build';
import type { Expr } from '../ast/nodes';
import { derivative } from '../numeric/derivative';
import { compile, evaluateNumeric } from '../numeric/evaluate';

export type Check = 'ok' | 'mismatch' | 'unknown';

const SAMPLES = [0.37, 1.21, -0.83, 2.4, -1.7, 0.61, 3.1, -2.3, 0.93, 1.77];
const CONSTANTS = new Set(['pi', 'e', 'inf', 'i']);

function points(names: readonly string[], count = 6): Map<string, number>[] {
  return Array.from(
    { length: count },
    (_, k) =>
      new Map(names.map((n, j) => [n, SAMPLES[(k * 3 + j * 7) % SAMPLES.length] + j * 0.013])),
  );
}

function freeOf(...es: Expr[]): string[] {
  const s = new Set<string>();
  for (const e of es) for (const n of freeSymbols(e)) if (!CONSTANTS.has(n)) s.add(n);
  return [...s].sort();
}

export const close = (a: number, b: number, rel = 1e-7) =>
  Math.abs(a - b) <= rel * (1 + Math.abs(a) + Math.abs(b));

/** a ≡ b as functions of their free symbols? */
export function checkEqual(a: Expr, b: Expr): Check {
  let agreed = 0;
  for (const p of points(freeOf(a, b))) {
    const va = evaluateNumeric(a, { variables: p });
    const vb = evaluateNumeric(b, { variables: p });
    if (!va.ok || !vb.ok) continue;
    if (!close(va.value, vb.value)) return 'mismatch';
    agreed++;
  }
  return agreed > 0 ? 'ok' : 'unknown';
}

/** d/dv original ≡ result (numerical derivative)? */
export function checkDerivative(original: Expr, result: Expr, v: string): Check {
  const others = freeOf(original, result).filter((n) => n !== v);
  let agreed = 0;
  for (const p of points([v, ...others])) {
    const at = p.get(v)!;
    const vars = new Map([...p].filter(([k]) => k !== v));
    const f = compile(original, v, { variables: vars });
    const d = derivative(f, at);
    const r = evaluateNumeric(result, { variables: p });
    if (!d.ok || !r.ok) continue;
    if (!close(d.value.value, r.value, 1e-5)) return 'mismatch';
    agreed++;
  }
  return agreed > 0 ? 'ok' : 'unknown';
}

/** Is x = value a solution of left = right? Unknown when other symbols remain. */
export function checkSolution(equation: Expr, v: string, value: Expr): Check {
  const [left, right] =
    equation.type === 'rel' ? [equation.left, equation.right] : [equation, null];
  const sub = (e: Expr) => substitute(e, new Map([[v, value]]));
  if (freeOf(sub(left), ...(right ? [sub(right)] : [])).length > 0) return 'unknown';
  const l = evaluateNumeric(sub(left));
  const r = right ? evaluateNumeric(sub(right)) : ({ ok: true, value: 0 } as const);
  if (!l.ok || !r.ok) return 'unknown';
  return close(l.value, r.value, 1e-8) ? 'ok' : 'mismatch';
}
