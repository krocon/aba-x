/**
 * Graph analysis (prompt 015): roots, extrema, intersections, tangent – numerical, refined with
 * Brent; values that are not reliable (poles, kinks) are dropped rather than shown.
 */
import { derivative } from '../numeric/derivative';
import { brent, rootsIn } from '../numeric/roots';
import { integrateAdaptive } from '../numeric/quadrature';
import type { MathResult } from '../result';

type Fn = (x: number) => number;

export interface PointOfInterest {
  readonly kind: 'root' | 'min' | 'max' | 'intersection';
  readonly x: number;
  readonly y: number;
}

const dedupe = (xs: number[], eps: number) =>
  xs.filter((x, i) => i === 0 || Math.abs(x - xs[i - 1]) > eps);

export function roots(f: Fn, a: number, b: number): PointOfInterest[] {
  return dedupe(rootsIn(f, a, b, 800), (b - a) * 1e-7).map((x) => ({ kind: 'root', x, y: 0 }));
}

/** Extrema: sign changes of f′ (central differences), refined with Brent on f′. */
export function extrema(f: Fn, a: number, b: number, n = 800): PointOfInterest[] {
  const h = (b - a) / n;
  const d = (x: number) => (f(x + h * 1e-3) - f(x - h * 1e-3)) / (2 * h * 1e-3);
  const out: PointOfInterest[] = [];
  let x0 = a;
  let d0 = d(x0);
  for (let i = 1; i <= n; i++) {
    const x1 = a + i * h;
    const d1 = d(x1);
    if (Number.isFinite(d0) && Number.isFinite(d1) && d0 * d1 <= 0 && (d0 !== 0 || d1 !== 0)) {
      const r =
        d1 === 0
          ? { ok: true as const, value: { root: x1, iterations: 0 } }
          : d0 === 0
            ? null
            : brent(d, x0, x1);
      if (r === null) {
        x0 = x1;
        d0 = d1;
        continue;
      }
      if (r.ok) {
        const x = r.value.root;
        const y = f(x);
        const yl = f(x - h);
        const yr = f(x + h);
        // a sign change of f′ over a pole (1/x²) is no extremum
        if ([y, yl, yr].every(Number.isFinite) && Math.abs(y - yl) < Math.abs(yl) + 1e3 * h) {
          const last = out.at(-1);
          const duplicate = !!last && Math.abs(last.x - x) < h;
          if (!duplicate && y <= yl && y <= yr) out.push({ kind: 'min', x, y });
          else if (!duplicate && y >= yl && y >= yr) out.push({ kind: 'max', x, y });
        }
      }
    }
    x0 = x1;
    d0 = d1;
  }
  return out;
}

export function intersections(f: Fn, g: Fn, a: number, b: number): PointOfInterest[] {
  return roots((x) => f(x) - g(x), a, b).map((p) => ({ kind: 'intersection', x: p.x, y: f(p.x) }));
}

/** Tangent at x: slope and value; fails at kinks and undefined points. */
export function tangent(f: Fn, x: number): MathResult<{ x: number; y: number; slope: number }> {
  const d = derivative(f, x);
  if (!d.ok) return d;
  const y = f(x);
  if (!Number.isFinite(y))
    return { ok: false, error: { code: 'domain', message: `f is undefined at x = ${x}` } };
  return { ok: true, value: { x, y, slope: d.value.value } };
}

/** Signed area ∫ₐᵇ f and its positive/negative parts. */
export function area(
  f: Fn,
  a: number,
  b: number,
): MathResult<{ value: number; positive: number; negative: number; error: number }> {
  const total = integrateAdaptive(f, a, b);
  if (!total.ok) return total;
  const pos = integrateAdaptive((x) => Math.max(0, f(x)), a, b);
  const neg = integrateAdaptive((x) => Math.min(0, f(x)), a, b);
  return {
    ok: true,
    value: {
      value: total.value.value,
      positive: pos.ok ? pos.value.value : NaN,
      negative: neg.ok ? neg.value.value : NaN,
      error: total.value.error,
    },
  };
}
