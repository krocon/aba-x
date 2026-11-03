/**
 * Numerical solver of the T1 "Solve" app (prompt 039): one equation in a chosen unknown near a
 * start value, and systems of n equations in n unknowns (damped Newton, numerical Jacobian).
 *
 * Like a scientific calculator the one-variable solver says honestly what it found: a real zero,
 * a sign change at a discontinuity (1/x – no solution), or only a local minimum of |f| (an
 * "extremum" – no solution, but the closest x is reported). Only `zero` is a solution.
 */
import { solveLinear } from '../linalg/linalg';
import { type MathResult, fail, ok } from '../result';
import type { Fn } from './quadrature';
import { brent } from './roots';

/** Outcome kinds of the one-variable solver (HP/TI: "Zero", "Sign reversal", "Extremum"). */
export type SolveOneKind = 'zero' | 'sign-change' | 'extremum';

export interface SolveOneOutcome {
  readonly kind: SolveOneKind;
  /** True only for `zero`: x really solves f(x) = 0. */
  readonly solved: boolean;
  /** The root, the location of the sign change, or the x with the smallest |f| found. */
  readonly x: number;
  readonly fx: number;
  readonly message: string;
  /** Function evaluations used. */
  readonly evaluations: number;
}

export interface SolveOneOptions {
  /** |f(x)| up to this is a zero (default 1e-10). */
  readonly zeroTol?: number;
  /** Search interval; the bracket search never leaves it (default ±1e15). */
  readonly lo?: number;
  readonly hi?: number;
  /** Second start value: the first search step goes towards it. */
  readonly guess2?: number;
  /** Maximal outward steps on each side (default 120). */
  readonly maxSteps?: number;
}

const val = (f: Fn, x: number) => {
  const y = f(x);
  return Number.isFinite(y) ? y : NaN;
};

/**
 * Solves f(x) = 0 near `guess`: bracket search outward from the guess (growing steps on both
 * sides), then Brent on the nearest sign change; without a sign change the minimum of |f| is
 * refined and classified as a touching zero or an extremum. Errors only for unusable input.
 */
export function solveOne(
  f: Fn,
  guess: number,
  o: SolveOneOptions = {},
): MathResult<SolveOneOutcome> {
  const lo = o.lo ?? -1e15;
  const hi = o.hi ?? 1e15;
  const zeroTol = o.zeroTol ?? 1e-10;
  if (!Number.isFinite(guess)) return fail('domain', 'the start value must be a finite number');
  if (!(lo < hi)) return fail('domain', 'the search interval is empty');
  const x0 = Math.min(hi, Math.max(lo, guess));
  let evaluations = 0;
  const F: Fn = (x) => {
    evaluations++;
    return val(f, x);
  };
  const outcome = (kind: SolveOneKind, x: number, fx: number, message: string) =>
    ok<SolveOneOutcome>({ kind, solved: kind === 'zero', x, fx, message, evaluations });

  const f0 = F(x0);
  if (f0 === 0) return outcome('zero', x0, f0, 'zero');

  // two start values that already bracket a sign change
  if (o.guess2 !== undefined && Number.isFinite(o.guess2) && o.guess2 !== x0) {
    const g2 = Math.min(hi, Math.max(lo, o.guess2));
    const f2 = F(g2);
    if (f2 === 0) return outcome('zero', g2, f2, 'zero');
    if (f0 * f2 < 0) return refine(F, x0, g2, f0, f2, zeroTol, outcome);
  }

  const samples: { x: number; fx: number }[] = [{ x: x0, fx: f0 }];
  let h =
    o.guess2 !== undefined && Number.isFinite(o.guess2) && o.guess2 !== x0
      ? Math.abs(o.guess2 - x0)
      : Math.max(1e-3, Math.abs(x0) * 1e-3);
  const firstRight = o.guess2 === undefined || o.guess2 >= x0;
  const side = { left: { x: x0, fx: f0, open: x0 > lo }, right: { x: x0, fx: f0, open: x0 < hi } };
  const maxSteps = o.maxSteps ?? 120;
  const order = firstRight ? (['right', 'left'] as const) : (['left', 'right'] as const);

  for (let step = 0; step < maxSteps && (side.left.open || side.right.open); step++) {
    for (const s of order) {
      const cur = side[s];
      if (!cur.open) continue;
      let x = s === 'right' ? x0 + h : x0 - h;
      if (x >= hi || x <= lo) {
        x = s === 'right' ? hi : lo;
        cur.open = false;
      }
      const fx = F(x);
      if (fx === 0) return outcome('zero', x, fx, 'zero');
      if (Number.isNaN(fx) !== Number.isNaN(cur.fx)) {
        // crossed a domain edge: the defined point next to it may start a sign change
        const edge = domainEdge(F, cur.x, cur.fx, x, fx);
        if (edge.fx === 0) return outcome('zero', edge.x, 0, 'zero');
        samples.push(edge);
        const near = Number.isNaN(fx) ? cur : { x, fx };
        if (edge.fx * near.fx < 0) {
          return refine(F, near.x, edge.x, near.fx, edge.fx, zeroTol, outcome);
        }
      }
      samples.push({ x, fx });
      if (!Number.isNaN(fx) && !Number.isNaN(cur.fx) && fx * cur.fx < 0) {
        return refine(F, cur.x, x, cur.fx, fx, zeroTol, outcome);
      }
      cur.x = x;
      cur.fx = fx;
    }
    h *= 1.6;
  }
  return refineMinima(F, x0, samples, zeroTol, outcome);
}

/** Between a defined and an undefined point: the defined point closest to the domain edge. */
function domainEdge(
  F: Fn,
  a: number,
  fa: number,
  b: number,
  fb: number,
): { x: number; fx: number } {
  let [good, bad, fg] = Number.isNaN(fa) ? [b, a, fb] : [a, b, fa];
  for (let i = 0; i < 80 && Math.abs(good - bad) > 1e-15 * Math.max(1, Math.abs(good)); i++) {
    const m = (good + bad) / 2;
    const fm = F(m);
    if (Number.isNaN(fm)) bad = m;
    else [good, fg] = [m, fm];
  }
  return { x: good, fx: fg };
}

type Outcome = (
  kind: SolveOneKind,
  x: number,
  fx: number,
  m: string,
) => MathResult<SolveOneOutcome>;

/** Refines a sign change [a, b] and decides between a zero and a discontinuity. */
function refine(
  F: Fn,
  a: number,
  b: number,
  fa: number,
  fb: number,
  zeroTol: number,
  outcome: Outcome,
): MathResult<SolveOneOutcome> {
  const r = brent(F, Math.min(a, b), Math.max(a, b));
  let x: number;
  if (r.ok) x = r.value.root;
  else {
    // undefined inside the bracket (pole, gap): bisect, skipping undefined points
    let [l, u, fl] = a < b ? [a, b, fa] : [b, a, fb];
    for (let i = 0; i < 200 && u - l > 4e-16 * Math.max(1, Math.abs(l)); i++) {
      let m = (l + u) / 2;
      let fm = F(m);
      if (Number.isNaN(fm)) {
        m = l + (u - l) / 3;
        fm = F(m);
      }
      if (Number.isNaN(fm)) break;
      if (fm === 0) {
        l = u = m;
        break;
      }
      if (fm * fl < 0) u = m;
      else [l, fl] = [m, fm];
    }
    x = (l + u) / 2;
  }
  const fx = F(x);
  const scale = Math.abs(fa) + Math.abs(fb);
  if (!Number.isNaN(fx) && (Math.abs(fx) <= zeroTol || Math.abs(fx) <= 1e-6 * scale)) {
    return outcome('zero', x, fx, 'zero');
  }
  return outcome(
    'sign-change',
    x,
    fx,
    'sign change without a zero (discontinuity or pole) – not a solution',
  );
}

/**
 * No sign change found: refines the local minima of |f| among the samples (nearest to the start
 * value first) by golden-section search. A minimum at |f| ≤ zeroTol is a touching zero; a sign
 * change met on the way is refined as usual; otherwise the nearest minimum is an extremum.
 */
function refineMinima(
  F: Fn,
  x0: number,
  all: readonly { x: number; fx: number }[],
  zeroTol: number,
  outcome: Outcome,
): MathResult<SolveOneOutcome> {
  const s = all.filter((p) => !Number.isNaN(p.fx)).sort((p, q) => p.x - q.x);
  if (s.length === 0) {
    return fail('domain', 'the equation is undefined everywhere in the search range');
  }
  const minima: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const v = Math.abs(s[i].fx);
    if (
      (i === 0 || v <= Math.abs(s[i - 1].fx)) &&
      (i === s.length - 1 || v <= Math.abs(s[i + 1].fx))
    )
      minima.push(i);
  }
  minima.sort((i, j) => Math.abs(s[i].x - x0) - Math.abs(s[j].x - x0));
  let first: { x: number; fx: number } | null = null;
  const g = (Math.sqrt(5) - 1) / 2;
  for (const i of minima.slice(0, 8)) {
    const ref = s[i];
    let crossing: { x: number; fx: number } | null = null;
    const absF = (t: number) => {
      const v = F(t);
      if (Number.isNaN(v)) return Infinity;
      if (!crossing && v * ref.fx <= 0) crossing = { x: t, fx: v };
      return Math.abs(v);
    };
    let a = s[Math.max(0, i - 1)].x;
    let b = s[Math.min(s.length - 1, i + 1)].x;
    let c = b - g * (b - a);
    let d = a + g * (b - a);
    let fc = absF(c);
    let fd = absF(d);
    for (let k = 0; k < 300 && b - a > 1e-15 * Math.max(1, Math.abs(c)) && !crossing; k++) {
      if (fc < fd) {
        [b, d, fd] = [d, c, fc];
        c = b - g * (b - a);
        fc = absF(c);
      } else {
        [a, c, fc] = [c, d, fd];
        d = a + g * (b - a);
        fd = absF(d);
      }
    }
    const cr = crossing as { x: number; fx: number } | null;
    if (cr) {
      if (cr.fx === 0) return outcome('zero', cr.x, 0, 'zero');
      return refine(F, ref.x, cr.x, ref.fx, cr.fx, zeroTol, outcome);
    }
    let xm = fc < fd ? c : d;
    if (Math.abs(ref.fx) < Math.min(fc, fd)) xm = ref.x;
    const fm = F(xm);
    if (Math.abs(fm) <= zeroTol) return outcome('zero', xm, fm, 'zero (touching root)');
    first ??= { x: xm, fx: fm };
  }
  const m = first ?? s[minima[0]];
  return outcome(
    'extremum',
    m.x,
    m.fx,
    'no solution found – only a local minimum of |f| (extremum); x is the closest point',
  );
}

/** Solves one equation `f(vars) = 0` for `vars[index]`, the other variables held fixed. */
export function solveFor(
  f: (vars: number[]) => number,
  vars: readonly number[],
  index: number,
  o: SolveOneOptions = {},
): MathResult<SolveOneOutcome> {
  if (!Number.isInteger(index) || index < 0 || index >= vars.length) {
    return fail('domain', 'the unknown is not one of the variables');
  }
  const v = [...vars];
  return solveOne(
    (x) => {
      v[index] = x;
      return f(v);
    },
    vars[index],
    o,
  );
}

// ---------------------------------------------------------------------------------------------
// Systems

export type VectorFn = (vars: number[]) => number[];

export interface SystemOptions {
  /** Converged when the residual max-norm is at most this (default 1e-10). */
  readonly tol?: number;
  readonly maxIter?: number;
}

export interface SystemSolution {
  readonly x: number[];
  /** Max-norm of F at the solution. */
  readonly residual: number;
  readonly iterations: number;
}

const norm2 = (v: readonly number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const normInf = (v: readonly number[]) => v.reduce((s, x) => Math.max(s, Math.abs(x)), 0);
const allFinite = (v: readonly number[]) => v.every(Number.isFinite);

/** Numerical Jacobian J[i][j] = ∂F_i/∂x_j by central differences; null where F is undefined. */
export function jacobian(F: VectorFn, x: readonly number[]): number[][] | null {
  const n = x.length;
  const J: number[][] = Array.from({ length: F([...x]).length }, () => new Array<number>(n));
  for (let j = 0; j < n; j++) {
    const h = 6e-6 * Math.max(1, Math.abs(x[j]));
    const xp = [...x];
    const xm = [...x];
    xp[j] += h;
    xm[j] -= h;
    let fp = F(xp);
    let fm = F(xm);
    let width = 2 * h;
    if (!allFinite(fp) || !allFinite(fm)) {
      // one-sided difference at a domain edge
      const f0 = F([...x]);
      if (allFinite(fp)) [fm, width] = [f0, h];
      else if (allFinite(fm)) [fp, width] = [f0, h];
      else return null;
      if (!allFinite(f0)) return null;
    }
    for (let i = 0; i < J.length; i++) J[i][j] = (fp[i] - fm[i]) / width;
  }
  return J;
}

/**
 * Solves F(x) = 0 (n equations, n unknowns) from `x0` with damped Newton: Jacobian by finite
 * differences, step halving until the residual decreases; a singular Jacobian falls back to a
 * Levenberg–Marquardt step. Stalling at a residual minimum is `not-solvable`, never a solution.
 */
export function solveSystem(
  F: VectorFn,
  x0: readonly number[],
  o: SystemOptions = {},
): MathResult<SystemSolution> {
  const tol = o.tol ?? 1e-10;
  const n = x0.length;
  if (n === 0) return fail('domain', 'no unknowns');
  if (!allFinite(x0)) return fail('domain', 'the start values must be finite numbers');
  let x = [...x0];
  let fx = F([...x]);
  if (fx.length !== n) {
    return fail('domain', `${fx.length} equations for ${n} unknowns – the system must be square`);
  }
  if (!allFinite(fx)) return fail('domain', 'the equations are undefined at the start values');
  for (let it = 0; it <= (o.maxIter ?? 100); it++) {
    if (normInf(fx) <= tol) return ok({ x, residual: normInf(fx), iterations: it });
    const J = jacobian(F, x);
    if (!J) return fail('domain', 'the equations are undefined near the current point');
    const step = newtonStep(J, fx);
    if (!step) return fail('not-solvable', 'the Jacobian is singular – no Newton step possible');
    const r0 = norm2(fx);
    let t = 1;
    let accepted = false;
    for (; t > 1e-12; t /= 2) {
      const xn = x.map((xi, i) => xi + t * step[i]);
      const fn = F([...xn]);
      if (allFinite(fn) && norm2(fn) < (1 - 1e-4 * t) * r0) {
        x = xn;
        fx = fn;
        accepted = true;
        break;
      }
    }
    if (!accepted) {
      return normInf(fx) <= Math.sqrt(tol)
        ? ok({ x, residual: normInf(fx), iterations: it })
        : fail(
            'not-solvable',
            `no solution found – the residual stalls at ${normInf(fx).toPrecision(3)} near x = [${x
              .map((v) => v.toPrecision(6))
              .join(', ')}] (local minimum)`,
          );
    }
  }
  return normInf(fx) <= tol
    ? ok({ x, residual: normInf(fx), iterations: o.maxIter ?? 100 })
    : fail('no-convergence', 'Newton did not converge for the system');
}

/** Newton step −J⁻¹F; on a singular J a Levenberg–Marquardt step (JᵀJ + λI)⁻¹(−JᵀF). */
function newtonStep(J: number[][], fx: number[]): number[] | null {
  const n = fx.length;
  const neg = fx.map((v) => -v);
  const s = solveLinear(J, neg);
  if (s.ok && allFinite(s.value)) return s.value;
  const JtJ = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => J.reduce((sum, row) => sum + row[i] * row[j], 0)),
  );
  const g = Array.from({ length: n }, (_, i) =>
    J.reduce((sum, row, k) => sum + row[i] * neg[k], 0),
  );
  const scale = Math.max(...JtJ.map((r, i) => Math.abs(r[i])), 1e-12);
  if (normInf(g) === 0) return null;
  for (let lambda = 1e-6 * scale; lambda < 1e12 * scale; lambda *= 10) {
    const A = JtJ.map((r, i) => r.map((v, j) => (i === j ? v + lambda : v)));
    const l = solveLinear(A, g);
    if (l.ok && allFinite(l.value)) return l.value;
  }
  return null;
}
