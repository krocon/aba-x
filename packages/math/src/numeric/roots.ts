/**
 * Root finding (prompt 013): bisection, Newton, secant and Brent (default: bracketed, fast and
 * safe). Every result reports iterations; failure is an error, never a stale guess.
 */
import { type MathResult, fail, ok } from '../result';
import type { Fn } from './quadrature';
import { derivative } from './derivative';

export interface Root {
  readonly root: number;
  readonly iterations: number;
}

export interface RootOptions {
  readonly tol?: number;
  readonly maxIter?: number;
}

const finiteAt = (f: Fn, x: number) => {
  const v = f(x);
  return Number.isFinite(v) ? v : NaN;
};

function bracketCheck(fa: number, fb: number): MathResult<never> | null {
  if (Number.isNaN(fa) || Number.isNaN(fb))
    return fail('domain', 'the function is undefined at an interval end');
  if (fa * fb > 0) return fail('not-solvable', 'no sign change in the interval');
  return null;
}

export function bisection(f: Fn, a: number, b: number, o: RootOptions = {}): MathResult<Root> {
  const tol = o.tol ?? 1e-13;
  let fa = finiteAt(f, a);
  const fb = finiteAt(f, b);
  const bad = bracketCheck(fa, fb);
  if (bad) return bad;
  if (fa === 0) return ok({ root: a, iterations: 0 });
  if (fb === 0) return ok({ root: b, iterations: 0 });
  for (let i = 1; i <= (o.maxIter ?? 200); i++) {
    const m = (a + b) / 2;
    const fm = finiteAt(f, m);
    if (Number.isNaN(fm)) return fail('domain', `the function is undefined at x = ${m}`);
    if (fm === 0 || (b - a) / 2 < tol * Math.max(1, Math.abs(m)))
      return ok({ root: m, iterations: i });
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return fail('no-convergence', 'bisection did not converge');
}

export function newton(f: Fn, x0: number, o: RootOptions & { df?: Fn } = {}): MathResult<Root> {
  const tol = o.tol ?? 1e-13;
  const df =
    o.df ??
    ((x: number) => {
      const d = derivative(f, x);
      return d.ok ? d.value.value : NaN;
    });
  let x = x0;
  for (let i = 1; i <= (o.maxIter ?? 100); i++) {
    const fx = finiteAt(f, x);
    const d = df(x);
    if (Number.isNaN(fx) || !Number.isFinite(d)) return fail('domain', `undefined at x = ${x}`);
    if (d === 0) return fail('no-convergence', 'Newton: the derivative is zero');
    const next = x - fx / d;
    if (Math.abs(next - x) < tol * Math.max(1, Math.abs(next)))
      return ok({ root: next, iterations: i });
    x = next;
  }
  return fail('no-convergence', 'Newton did not converge');
}

export function secant(f: Fn, x0: number, x1: number, o: RootOptions = {}): MathResult<Root> {
  const tol = o.tol ?? 1e-13;
  let f0 = finiteAt(f, x0);
  let f1 = finiteAt(f, x1);
  for (let i = 1; i <= (o.maxIter ?? 100); i++) {
    if (Number.isNaN(f0) || Number.isNaN(f1)) return fail('domain', 'the function is undefined');
    if (f1 === f0) return fail('no-convergence', 'secant: flat function');
    const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
    if (Math.abs(x2 - x1) < tol * Math.max(1, Math.abs(x2))) return ok({ root: x2, iterations: i });
    [x0, f0, x1, f1] = [x1, f1, x2, finiteAt(f, x2)];
  }
  return fail('no-convergence', 'the secant method did not converge');
}

/** Brent's method (inverse quadratic interpolation with bisection safeguard). */
export function brent(f: Fn, a: number, b: number, o: RootOptions = {}): MathResult<Root> {
  const tol = o.tol ?? 1e-14;
  let fa = finiteAt(f, a);
  let fb = finiteAt(f, b);
  const bad = bracketCheck(fa, fb);
  if (bad) return bad;
  if (Math.abs(fa) < Math.abs(fb)) [a, b, fa, fb] = [b, a, fb, fa];
  let c = a;
  let fc = fa;
  let d = b - a;
  let mflag = true;
  for (let i = 1; i <= (o.maxIter ?? 200); i++) {
    if (fb === 0 || Math.abs(b - a) < tol * Math.max(1, Math.abs(b)))
      return ok({ root: b, iterations: i });
    let s: number;
    if (fa !== fc && fb !== fc) {
      s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      s = b - (fb * (b - a)) / (fb - fa);
    }
    const lo = (3 * a + b) / 4;
    const cond =
      !(s > Math.min(lo, b) && s < Math.max(lo, b)) ||
      (mflag && Math.abs(s - b) >= Math.abs(b - c) / 2) ||
      (!mflag && Math.abs(s - b) >= Math.abs(c - d) / 2);
    if (cond) {
      s = (a + b) / 2;
      mflag = true;
    } else mflag = false;
    const fs = finiteAt(f, s);
    if (Number.isNaN(fs)) return fail('domain', `the function is undefined at x = ${s}`);
    d = c;
    c = b;
    fc = fb;
    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }
    if (Math.abs(fa) < Math.abs(fb)) [a, b, fa, fb] = [b, a, fb, fa];
  }
  return fail('no-convergence', "Brent's method did not converge");
}

/**
 * All roots in [a, b]: scan for sign changes on a grid, refine each with Brent; touching roots
 * (no sign change) are found as minima of |f| close to zero.
 */
export function rootsIn(f: Fn, a: number, b: number, samples = 1000): number[] {
  const roots: number[] = [];
  const h = (b - a) / samples;
  let x0 = a;
  let f0 = finiteAt(f, x0);
  for (let i = 1; i <= samples; i++) {
    const x1 = a + i * h;
    const f1 = finiteAt(f, x1);
    if (f0 === 0) roots.push(x0);
    else if (!Number.isNaN(f0) && !Number.isNaN(f1) && f0 * f1 < 0) {
      // a sign change over a pole (1/x) is not a root: check |f| at the result
      const r = brent(f, x0, x1);
      if (r.ok && Math.abs(f(r.value.root)) < 1e-6 * (1 + Math.abs(f0) + Math.abs(f1)))
        roots.push(r.value.root);
    } else if (i > 1 && !Number.isNaN(f0) && !Number.isNaN(f1)) {
      // touching root: local minimum of |f| near zero
      const fm = finiteAt(f, x0 - h);
      if (
        !Number.isNaN(fm) &&
        Math.abs(f0) < Math.abs(fm) &&
        Math.abs(f0) < Math.abs(f1) &&
        Math.abs(f0) < 1e-3
      ) {
        roots.push(x0);
      }
    }
    x0 = x1;
    f0 = f1;
  }
  if (f0 === 0 && roots.at(-1) !== x0) roots.push(x0);
  return roots.map((r) => (Object.is(r, -0) ? 0 : r));
}
