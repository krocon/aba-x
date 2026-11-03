/**
 * Numerical integration (prompt 013): trapezoid, Simpson, Gauss–Legendre and an adaptive
 * Gauss–Kronrod (7/15) rule with error estimate – the default. Infinite bounds are mapped to a
 * finite interval; undefined integrand values are reported, never smoothed over.
 */
import { type MathResult, fail, ok } from '../result';

export type Fn = (x: number) => number;

export interface Quadrature {
  readonly value: number;
  /** Estimated absolute error. */
  readonly error: number;
  readonly evaluations: number;
}

function checkInterval(a: number, b: number): MathResult<null> | null {
  if (Number.isNaN(a) || Number.isNaN(b)) return fail('domain', 'invalid integration bounds');
  return null;
}

export function trapezoid(f: Fn, a: number, b: number, n = 1000): number {
  const h = (b - a) / n;
  let s = (f(a) + f(b)) / 2;
  for (let k = 1; k < n; k++) s += f(a + k * h);
  return s * h;
}

export function simpson(f: Fn, a: number, b: number, n = 1000): number {
  const m = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let k = 1; k < m; k++) s += (k % 2 === 1 ? 4 : 2) * f(a + k * h);
  return (s * h) / 3;
}

/** Nodes and weights of the n-point Gauss–Legendre rule on [−1, 1] (Newton on P_n). */
export function legendreRule(n: number): { x: number[]; w: number[] } {
  const x: number[] = [];
  const w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let z = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1;
      let p1 = z;
      for (let k = 2; k <= n; k++) [p0, p1] = [p1, ((2 * k - 1) * z * p1 - (k - 1) * p0) / k];
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-16) break;
    }
    x.push(z);
    w.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}

export function gaussLegendre(f: Fn, a: number, b: number, n = 10): number {
  const { x, w } = legendreRule(n);
  const c = (a + b) / 2;
  const h = (b - a) / 2;
  let s = 0;
  for (let k = 0; k < n; k++) s += w[k] * f(c + h * x[k]);
  return s * h;
}

const XGK = [
  0.9914553711208126, 0.9491079123427585, 0.8648644233597691, 0.7415311855993945,
  0.5860872354676911, 0.4058451513773972, 0.20778495500789848, 0,
];
const WGK = [
  0.022935322010529224, 0.06309209262997856, 0.10479001032225019, 0.14065325971552592,
  0.1690047266392679, 0.19035057806478542, 0.20443294007529889, 0.20948214108472782,
];
const WG = [0.1294849661688697, 0.27970539148927664, 0.3818300505051189, 0.4179591836734694];

class Undefined extends Error {
  constructor(readonly at: number) {
    super();
  }
}

function kronrod(f: Fn, a: number, b: number): { k: number; g: number } {
  const c = (a + b) / 2;
  const h = (b - a) / 2;
  const at = (x: number) => {
    const v = f(x);
    if (!Number.isFinite(v)) throw new Undefined(x);
    return v;
  };
  const fc = at(c);
  let k = WGK[7] * fc;
  let g = WG[3] * fc;
  for (let j = 0; j < 7; j++) {
    const s = at(c - h * XGK[j]) + at(c + h * XGK[j]);
    k += WGK[j] * s;
    if (j % 2 === 1) g += WG[(j - 1) / 2] * s;
  }
  return { k: k * h, g: g * h };
}

/** Maps an integral with infinite bounds onto (−1, 1) or (0, 1). */
function finite(f: Fn, a: number, b: number): { f: Fn; a: number; b: number } {
  if (Number.isFinite(a) && Number.isFinite(b)) return { f, a, b };
  if (!Number.isFinite(a) && !Number.isFinite(b)) {
    // x = t / (1 − t²)
    return { f: (t) => f(t / (1 - t * t)) * ((1 + t * t) / (1 - t * t) ** 2), a: -1, b: 1 };
  }
  if (!Number.isFinite(b)) {
    // x = a + t / (1 − t)
    return { f: (t) => f(a + t / (1 - t)) / (1 - t) ** 2, a: 0, b: 1 };
  }
  // x = b − t / (1 − t)
  return { f: (t) => f(b - t / (1 - t)) / (1 - t) ** 2, a: 0, b: 1 };
}

export interface AdaptiveOptions {
  readonly absTol?: number;
  readonly relTol?: number;
  readonly maxIntervals?: number;
}

/** Adaptive Gauss–Kronrod 7/15 (global subdivision of the worst interval). */
export function integrateAdaptive(
  f0: Fn,
  a0: number,
  b0: number,
  opts: AdaptiveOptions = {},
): MathResult<Quadrature> {
  const bad = checkInterval(a0, b0);
  if (bad) return bad as MathResult<never>;
  if (a0 === b0) return ok({ value: 0, error: 0, evaluations: 0 });
  if (a0 > b0) {
    const r = integrateAdaptive(f0, b0, a0, opts);
    return r.ok ? ok({ ...r.value, value: -r.value.value }) : r;
  }
  const { f, a, b } = finite(f0, a0, b0);
  const absTol = opts.absTol ?? 1e-12;
  const relTol = opts.relTol ?? 1e-10;
  const max = opts.maxIntervals ?? 2000;
  try {
    interface Piece {
      a: number;
      b: number;
      v: number;
      e: number;
    }
    const eval1 = (x: number, y: number): Piece => {
      const { k, g } = kronrod(f, x, y);
      return { a: x, b: y, v: k, e: Math.abs(k - g) };
    };
    const pieces: Piece[] = [eval1(a, b)];
    let evaluations = 15;
    for (;;) {
      const value = pieces.reduce((s, p) => s + p.v, 0);
      const error = pieces.reduce((s, p) => s + p.e, 0);
      if (error <= Math.max(absTol, relTol * Math.abs(value))) {
        return ok({ value, error, evaluations });
      }
      if (pieces.length >= max) {
        return fail(
          'no-convergence',
          `the integral does not converge (estimated error ${error.toExponential(2)})`,
        );
      }
      let worst = 0;
      for (let i = 1; i < pieces.length; i++) if (pieces[i].e > pieces[worst].e) worst = i;
      const p = pieces[worst];
      const m = (p.a + p.b) / 2;
      if (m <= p.a || m >= p.b) {
        return fail('no-convergence', 'the integrand is too irregular (singularity?)');
      }
      pieces.splice(worst, 1, eval1(p.a, m), eval1(m, p.b));
      evaluations += 30;
    }
  } catch (e) {
    if (e instanceof Undefined) {
      return fail('domain', `the integrand is undefined near x = ${Number(e.at.toPrecision(6))}`);
    }
    throw e;
  }
}
