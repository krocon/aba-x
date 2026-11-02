/**
 * Numerical derivative (prompt 013): Ridders' method – central differences with Richardson
 * extrapolation, returns an error estimate.
 */
import { type MathResult, fail, ok } from '../result';
import type { Fn } from './quadrature';

export interface Derivative {
  readonly value: number;
  readonly error: number;
}

export function derivative(f: Fn, x: number, h0?: number): MathResult<Derivative> {
  const NTAB = 10;
  const CON = 1.4;
  const CON2 = CON * CON;
  let h = h0 ?? 0.1 * Math.max(1, Math.abs(x));
  const a: number[][] = Array.from({ length: NTAB }, () => new Array<number>(NTAB).fill(0));
  const diff = (hh: number) => (f(x + hh) - f(x - hh)) / (2 * hh);
  a[0][0] = diff(h);
  if (!Number.isFinite(a[0][0])) return fail('domain', `the function is undefined near x = ${x}`);
  let err = Infinity;
  let ans = a[0][0];
  for (let i = 1; i < NTAB; i++) {
    h /= CON;
    a[0][i] = diff(h);
    if (!Number.isFinite(a[0][i])) break;
    let fac = CON2;
    for (let j = 1; j <= i; j++) {
      a[j][i] = (a[j - 1][i] * fac - a[j - 1][i - 1]) / (fac - 1);
      fac *= CON2;
      const errt = Math.max(Math.abs(a[j][i] - a[j - 1][i]), Math.abs(a[j][i] - a[j - 1][i - 1]));
      if (errt <= err) {
        err = errt;
        ans = a[j][i];
      }
    }
    if (Math.abs(a[i][i] - a[i - 1][i - 1]) >= 2 * err) break;
  }
  if (!Number.isFinite(ans)) return fail('domain', `no derivative at x = ${x}`);
  // central differences hide kinks (|x| at 0 gives 0): compare the one-sided slopes
  const s = 1e-6 * Math.max(1, Math.abs(x));
  const fx = f(x);
  const right = (f(x + s) - fx) / s;
  const left = (fx - f(x - s)) / s;
  if (
    !Number.isFinite(fx) ||
    Math.abs(right - left) > 1e-3 * (1 + Math.abs(right) + Math.abs(left))
  ) {
    return fail('domain', `not differentiable at x = ${x}`);
  }
  return ok({ value: ans, error: err });
}
