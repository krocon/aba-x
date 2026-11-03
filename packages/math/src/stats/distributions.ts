/**
 * Probability distributions (prompt 038), pure: Normal, Student t, χ², F, Exponential, Uniform
 * (continuous) and Binomial, Poisson, Geometric (discrete).
 *
 * Every factory validates its parameters (`fail('domain')` otherwise) and returns an object whose
 * methods are total – each returns a `MathResult`. Conventions:
 * - `cdf(x) = P(X ≤ x)`, `sf(x) = P(X > x)`; both are computed directly (never `1 − cdf`), so small
 *   upper-tail probabilities (p-values) keep their relative accuracy.
 * - Continuous `inv(p)`: the x with cdf(x) = p, found by safeguarded Newton (bisection fallback,
 *   geometric bisection on wide brackets) on the cdf for p ≤ ½ and on the sf for p > ½. `invUpper(q)`
 *   solves sf(x) = q directly (critical values for small α).
 * - Discrete `inv(p)`: the smallest k with cdf(k) ≥ p (fuzz 64ε relative against round-off).
 * - Geometric(p) counts trials up to and including the first success: support 1, 2, 3, …
 *
 * Accuracy: ≥ 13 significant digits in the core range (moderate parameters, probabilities above
 * ~1e-300); the cdfs come from the incomplete gamma/beta functions of `special.ts`.
 */
import { type MathResult, fail, ok } from '../result';
import {
  bd0,
  betaTails,
  dbinomRaw,
  dpoisRaw,
  gammaTails,
  guard,
  guardResult,
  lnGamma,
  stirlerr,
} from './special';

const EPS = 2.220446049250313e-16;
const FUZZ = 64 * EPS;
const SQRT_2PI = 2.5066282746310002;

export interface ContinuousDistribution {
  readonly kind: 'continuous';
  readonly name: string;
  /** Closed hull of the support (may be infinite). */
  readonly support: readonly [number, number];
  readonly mean: number;
  readonly variance: number;
  pdf(x: number): MathResult<number>;
  cdf(x: number): MathResult<number>;
  sf(x: number): MathResult<number>;
  inv(p: number): MathResult<number>;
  invUpper(q: number): MathResult<number>;
}

export interface DiscreteDistribution {
  readonly kind: 'discrete';
  readonly name: string;
  readonly support: readonly [number, number];
  readonly mean: number;
  readonly variance: number;
  pmf(k: number): MathResult<number>;
  cdf(k: number): MathResult<number>;
  sf(k: number): MathResult<number>;
  inv(p: number): MathResult<number>;
}

export type Distribution = ContinuousDistribution | DiscreteDistribution;

interface RawContinuous {
  name: string;
  support: readonly [number, number];
  mean: number;
  variance: number;
  pdf(x: number): number;
  cdf(x: number): number;
  sf(x: number): number;
  /** Starting point for the inversion at probability p (lower tail). */
  guess(p: number): number;
  /** Closed-form inverse, if any (lower tail p, upper tail q = 1 − p given exactly). */
  inverse?(p: number, upper: boolean): number;
}

const isProb = (p: number) => p >= 0 && p <= 1;

function continuous(raw: RawContinuous): ContinuousDistribution {
  const arg = (x: number, f: (x: number) => number) =>
    Number.isNaN(x) ? fail<number>('domain', 'x is not a number') : guard(() => f(x));
  const invert = (t: number, upper: boolean): MathResult<number> => {
    if (!isProb(t)) return fail('domain', 'the probability must lie in [0, 1]');
    const [lo, hi] = raw.support;
    const atLow = upper ? t === 1 : t === 0;
    const atHigh = upper ? t === 0 : t === 1;
    if (atLow) return Number.isFinite(lo) ? ok(lo) : fail('domain', 'the quantile is −∞');
    if (atHigh) return Number.isFinite(hi) ? ok(hi) : fail('domain', 'the quantile is +∞');
    if (raw.inverse) return guard(() => raw.inverse!(t, upper));
    return invertContinuous(raw, t, upper);
  };
  return {
    kind: 'continuous',
    name: raw.name,
    support: raw.support,
    mean: raw.mean,
    variance: raw.variance,
    pdf: (x) => arg(x, raw.pdf),
    cdf: (x) => arg(x, raw.cdf),
    sf: (x) => arg(x, raw.sf),
    inv: (p) => (p > 0.5 && p <= 1 ? invert(1 - p, true) : invert(p, false)),
    invUpper: (q) => (q > 0.5 && q <= 1 ? invert(1 - q, false) : invert(q, true)),
  };
}

/**
 * Solves cdf(x) = t (or sf(x) = t when `upper`): bracket by expansion from the guess, then
 * Newton steps that fall back to bisection whenever they leave the bracket.
 */
function invertContinuous(raw: RawContinuous, t: number, upper: boolean): MathResult<number> {
  return guardResult(() => {
    // g is increasing in x and has its root at the quantile
    const g = upper ? (x: number) => t - raw.sf(x) : (x: number) => raw.cdf(x) - t;
    const [sLo, sHi] = raw.support;
    let x = raw.guess(upper ? 1 - t : t);
    if (!Number.isFinite(x) || x <= sLo || x >= sHi)
      x =
        Number.isFinite(sLo) && Number.isFinite(sHi)
          ? (sLo + sHi) / 2
          : Number.isFinite(sLo)
            ? sLo + 1
            : 0;
    let gx = g(x);
    if (gx === 0) return ok(x);
    let lo = x;
    let hi = x;
    let step = Math.max(1, Math.abs(x));
    let n = 0;
    if (gx < 0) {
      do {
        lo = hi;
        hi = Number.isFinite(sHi) ? hi + (sHi - hi) / 2 : hi + step;
        step *= 2;
        if (++n > 3000) return fail('no-convergence', 'the quantile could not be bracketed');
      } while (g(hi) < 0);
    } else {
      do {
        hi = lo;
        lo = Number.isFinite(sLo) ? lo - (lo - sLo) / 2 : lo - step;
        step *= 2;
        if (++n > 3000) return fail('no-convergence', 'the quantile could not be bracketed');
      } while (g(lo) > 0);
    }
    x = (lo + hi) / 2;
    gx = g(x);
    for (let i = 0; i < 3000; i++) {
      if (gx === 0) return ok(x);
      if (gx < 0) lo = x;
      else hi = x;
      const d = raw.pdf(x);
      let next = d > 0 && Number.isFinite(d) ? x - gx / d : NaN;
      if (!(next > lo && next < hi)) {
        next =
          lo > 0 && hi / lo > 4
            ? Math.sqrt(lo * hi)
            : hi < 0 && lo / hi > 4
              ? -Math.sqrt(lo * hi)
              : lo + (hi - lo) / 2;
      }
      const tol = 2 * EPS * Math.abs(next) + 1e-300;
      if (Math.abs(next - x) <= tol || hi - lo <= tol) return ok(next);
      x = next;
      gx = g(x);
    }
    return fail('no-convergence', 'the quantile iteration did not converge');
  });
}

/** Rough normal quantile (Abramowitz–Stegun 26.2.23, |error| < 4.5e-4) – a starting value only. */
function normalGuess(p: number): number {
  if (p <= 0) return -40;
  if (p >= 1) return 40;
  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));
  const z =
    t -
    (2.515517 + 0.802853 * t + 0.010328 * t * t) /
      (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
  return p < 0.5 ? -z : z;
}

// ---------------------------------------------------------------------------------------------
// continuous

/** Standard normal Φ(z) and 1 − Φ(z), both tails accurate. */
function phiTails(z: number): { lower: number; upper: number } {
  if (z === Infinity) return { lower: 1, upper: 0 };
  if (z === -Infinity) return { lower: 0, upper: 1 };
  const t = gammaTails(0.5, (z * z) / 2);
  const small = t.upper / 2; // probability beyond |z|
  return z < 0 ? { lower: small, upper: 1 - small } : { lower: 1 - small, upper: small };
}

export function normal(mu = 0, sigma = 1): MathResult<ContinuousDistribution> {
  if (!Number.isFinite(mu) || !(sigma > 0) || !Number.isFinite(sigma))
    return fail('domain', 'Normal(μ, σ) needs a finite μ and σ > 0');
  const z = (x: number) => (x - mu) / sigma;
  return ok(
    continuous({
      name: 'normal',
      support: [-Infinity, Infinity],
      mean: mu,
      variance: sigma * sigma,
      pdf: (x) => Math.exp(-0.5 * z(x) * z(x)) / (sigma * SQRT_2PI),
      cdf: (x) => phiTails(z(x)).lower,
      sf: (x) => phiTails(z(x)).upper,
      guess: (p) => mu + sigma * normalGuess(p),
    }),
  );
}

/** Student t: P(|T| > |t|)/2 = ½ I_{ν/(ν+t²)}(ν/2, ½). */
function tTails(t: number, nu: number): { lower: number; upper: number } {
  if (t === Infinity) return { lower: 1, upper: 0 };
  if (t === -Infinity) return { lower: 0, upper: 1 };
  const t2 = t * t;
  const tail = Number.isFinite(t2)
    ? betaTails(nu / 2, 0.5, nu / (nu + t2), t2 / (nu + t2)).lower / 2
    : // t² overflows: the asymptotic tail C·|t|^(−ν) is exact to far below double precision
      Math.exp(
        lnGamma((nu + 1) / 2) -
          lnGamma(nu / 2) -
          0.5 * Math.log(nu * Math.PI) +
          ((nu - 1) / 2) * Math.log(nu) -
          nu * Math.log(Math.abs(t)),
      );
  return t < 0 ? { lower: tail, upper: 1 - tail } : { lower: 1 - tail, upper: tail };
}

/** t density in Loader's form (as R's `dt`), stable for large ν. */
function tPdf(x: number, n: number): number {
  if (!Number.isFinite(x)) return 0;
  const t = -bd0Half(n) + stirlerrHalf(n);
  const x2n = (x * x) / n;
  let lx2n: number;
  let u: number;
  const large = x2n > 1 / EPS;
  let ax = 0;
  if (large) {
    ax = Math.abs(x);
    lx2n = Math.log(ax) - Math.log(n) / 2;
    u = n * lx2n;
  } else if (x2n > 0.2) {
    lx2n = Math.log(1 + x2n) / 2;
    u = n * lx2n;
  } else {
    lx2n = Math.log1p(x2n) / 2;
    u = -bd0(n / 2, (n + x * x) / 2) + (x * x) / 2;
  }
  const isq = large ? Math.sqrt(n) / ax : Math.exp(-lx2n);
  return (Math.exp(t - u) * isq) / SQRT_2PI;
}
const bd0Half = (n: number) => bd0(n / 2, (n + 1) / 2);
const stirlerrHalf = (n: number) => stirlerr((n + 1) / 2) - stirlerr(n / 2);

export function studentT(nu: number): MathResult<ContinuousDistribution> {
  if (!(nu > 0) || nu === Infinity) return fail('domain', 't(ν) needs ν > 0');
  return ok(
    continuous({
      name: 'studentT',
      support: [-Infinity, Infinity],
      mean: nu > 1 ? 0 : NaN,
      variance: nu > 2 ? nu / (nu - 2) : nu > 1 ? Infinity : NaN,
      pdf: (x) => tPdf(x, nu),
      cdf: (x) => tTails(x, nu).lower,
      sf: (x) => tTails(x, nu).upper,
      guess: (p) => normalGuess(p),
    }),
  );
}

/** Gamma(shape k, scale s) density (Loader's form, as R's `dgamma`). */
function gammaPdf(x: number, k: number, s: number): number {
  if (x < 0) return 0;
  if (x === 0) return k < 1 ? Infinity : k > 1 ? 0 : 1 / s;
  if (!Number.isFinite(x)) return 0;
  if (k < 1) return (dpoisRaw(k, x / s) * k) / x;
  return dpoisRaw(k - 1, x / s) / s;
}

export function chiSquare(nu: number): MathResult<ContinuousDistribution> {
  if (!(nu > 0) || nu === Infinity) return fail('domain', 'χ²(ν) needs ν > 0');
  return ok(
    continuous({
      name: 'chiSquare',
      support: [0, Infinity],
      mean: nu,
      variance: 2 * nu,
      pdf: (x) => gammaPdf(x, nu / 2, 2),
      cdf: (x) => gammaTails(nu / 2, Math.max(0, x) / 2).lower,
      sf: (x) => gammaTails(nu / 2, Math.max(0, x) / 2).upper,
      guess: (p) => {
        // Wilson–Hilferty
        const c = 2 / (9 * nu);
        const w = 1 - c + normalGuess(p) * Math.sqrt(c);
        return w > 0 ? nu * w * w * w : nu * 0.01;
      },
    }),
  );
}

/** F density (as R's `df`). */
function fPdf(x: number, m: number, n: number): number {
  if (x < 0) return 0;
  if (x === 0) return m > 2 ? 0 : m === 2 ? 1 : Infinity;
  if (!Number.isFinite(x)) return 0;
  let f = 1 / (n + x * m);
  const q = n * f;
  const p = x * m * f;
  if (m >= 2) {
    f = (m * q) / 2;
    return f * dbinomRaw((m - 2) / 2, (m + n - 2) / 2, p, q);
  }
  f = (m * m * q) / (2 * p * (m + n));
  return f * dbinomRaw(m / 2, (m + n) / 2, p, q);
}

function fTails(x: number, m: number, n: number): { lower: number; upper: number } {
  if (x <= 0) return { lower: 0, upper: 1 };
  if (x === Infinity) return { lower: 1, upper: 0 };
  const den = m * x + n;
  return betaTails(m / 2, n / 2, (m * x) / den, n / den);
}

export function fisherF(d1: number, d2: number): MathResult<ContinuousDistribution> {
  if (!(d1 > 0) || !(d2 > 0) || d1 === Infinity || d2 === Infinity)
    return fail('domain', 'F(ν₁, ν₂) needs ν₁, ν₂ > 0');
  return ok(
    continuous({
      name: 'fisherF',
      support: [0, Infinity],
      mean: d2 > 2 ? d2 / (d2 - 2) : NaN,
      variance:
        d2 > 4 ? (2 * d2 * d2 * (d1 + d2 - 2)) / (d1 * (d2 - 2) * (d2 - 2) * (d2 - 4)) : NaN,
      pdf: (x) => fPdf(x, d1, d2),
      cdf: (x) => fTails(x, d1, d2).lower,
      sf: (x) => fTails(x, d1, d2).upper,
      guess: () => 1,
    }),
  );
}

export function exponential(lambda: number): MathResult<ContinuousDistribution> {
  if (!(lambda > 0) || lambda === Infinity) return fail('domain', 'Exp(λ) needs λ > 0');
  return ok(
    continuous({
      name: 'exponential',
      support: [0, Infinity],
      mean: 1 / lambda,
      variance: 1 / (lambda * lambda),
      pdf: (x) => (x < 0 ? 0 : lambda * Math.exp(-lambda * x)),
      cdf: (x) => (x <= 0 ? 0 : -Math.expm1(-lambda * x)),
      sf: (x) => (x <= 0 ? 1 : Math.exp(-lambda * x)),
      guess: () => 1 / lambda,
      inverse: (t, upper) => (upper ? -Math.log(t) : -Math.log1p(-t)) / lambda,
    }),
  );
}

export function uniform(a: number, b: number): MathResult<ContinuousDistribution> {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !(a < b))
    return fail('domain', 'U(a, b) needs finite a < b');
  const w = b - a;
  return ok(
    continuous({
      name: 'uniform',
      support: [a, b],
      mean: (a + b) / 2,
      variance: (w * w) / 12,
      pdf: (x) => (x >= a && x <= b ? 1 / w : 0),
      cdf: (x) => (x <= a ? 0 : x >= b ? 1 : (x - a) / w),
      sf: (x) => (x <= a ? 1 : x >= b ? 0 : (b - x) / w),
      guess: () => (a + b) / 2,
      inverse: (t, upper) => (upper ? b - t * w : a + t * w),
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// discrete

interface RawDiscrete {
  name: string;
  support: readonly [number, number];
  mean: number;
  variance: number;
  pmf(k: number): number;
  cdf(k: number): number;
  sf(k: number): number;
}

function discrete(raw: RawDiscrete): DiscreteDistribution {
  const [sLo, sHi] = raw.support;
  const arg = (k: number, f: (k: number) => number) =>
    Number.isNaN(k) ? fail<number>('domain', 'k is not a number') : guard(() => f(k));
  return {
    kind: 'discrete',
    name: raw.name,
    support: raw.support,
    mean: raw.mean,
    variance: raw.variance,
    pmf: (k) => arg(k, (k) => (Number.isInteger(k) && k >= sLo && k <= sHi ? raw.pmf(k) : 0)),
    cdf: (k) => arg(k, (k) => (k < sLo ? 0 : k >= sHi ? 1 : raw.cdf(Math.floor(k)))),
    sf: (k) => arg(k, (k) => (k < sLo ? 1 : k >= sHi ? 0 : raw.sf(Math.floor(k)))),
    inv: (p) => {
      if (!isProb(p)) return fail('domain', 'the probability must lie in [0, 1]');
      if (p === 0) return ok(sLo);
      if (p === 1) return Number.isFinite(sHi) ? ok(sHi) : fail('domain', 'the quantile is +∞');
      return guardResult(() => ok(invertDiscrete(raw, p)));
    },
  };
}

/** Smallest k in the support with cdf(k) ≥ p (0 < p < 1). */
function invertDiscrete(raw: RawDiscrete, p: number): number {
  const [sLo, sHi] = raw.support;
  const q = 1 - p;
  // cdf(k) ≥ p, evaluated on the more accurate tail
  const reached =
    p <= 0.5
      ? (k: number) => raw.cdf(k) >= p * (1 - FUZZ)
      : (k: number) => raw.sf(k) <= q * (1 + FUZZ);
  const sd = Math.sqrt(raw.variance);
  let k = Math.round(raw.mean + sd * normalGuess(p));
  if (!Number.isFinite(k)) k = sLo;
  k = Math.min(Math.max(k, sLo), sHi);
  let lo: number; // largest known k with !reached (or sLo − 1)
  let hi: number; // smallest known k with reached
  let step = 1;
  if (reached(k)) {
    hi = k;
    lo = k - 1;
    while (lo >= sLo && reached(lo)) {
      hi = lo;
      step *= 2;
      lo = Math.max(sLo - 1, hi - step);
    }
  } else {
    lo = k;
    hi = k + 1;
    while (hi < sHi && !reached(hi)) {
      lo = hi;
      step *= 2;
      hi = Math.min(sHi, lo + step);
    }
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (reached(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function binomial(n: number, p: number): MathResult<DiscreteDistribution> {
  if (!Number.isInteger(n) || n < 0 || !isProb(p))
    return fail('domain', 'Binomial(n, p) needs an integer n ≥ 0 and 0 ≤ p ≤ 1');
  const q = 1 - p;
  // P(X ≤ k) = I_q(n − k, k + 1) for 0 ≤ k < n
  const tails = (k: number) =>
    p === 0
      ? { lower: 1, upper: 0 }
      : p === 1
        ? { lower: 0, upper: 1 }
        : betaTails(n - k, k + 1, q, p);
  return ok(
    discrete({
      name: 'binomial',
      support: [0, n],
      mean: n * p,
      variance: n * p * q,
      pmf: (k) => dbinomRaw(k, n, p, q),
      cdf: (k) => tails(k).lower,
      sf: (k) => tails(k).upper,
    }),
  );
}

export function poisson(lambda: number): MathResult<DiscreteDistribution> {
  if (!(lambda > 0) || lambda === Infinity) return fail('domain', 'Poisson(λ) needs λ > 0');
  // P(X ≤ k) = Q(k + 1, λ)
  return ok(
    discrete({
      name: 'poisson',
      support: [0, Infinity],
      mean: lambda,
      variance: lambda,
      pmf: (k) => dpoisRaw(k, lambda),
      cdf: (k) => gammaTails(k + 1, lambda).upper,
      sf: (k) => gammaTails(k + 1, lambda).lower,
    }),
  );
}

export function geometric(p: number): MathResult<DiscreteDistribution> {
  if (!(p > 0 && p <= 1)) return fail('domain', 'Geometric(p) needs 0 < p ≤ 1');
  const l = Math.log1p(-p); // −∞ for p = 1
  return ok(
    discrete({
      name: 'geometric',
      support: [1, p === 1 ? 1 : Infinity],
      mean: 1 / p,
      variance: (1 - p) / (p * p),
      pmf: (k) => (k === 1 ? p : p * Math.exp((k - 1) * l)),
      cdf: (k) => -Math.expm1(k * l),
      sf: (k) => Math.exp(k * l),
    }),
  );
}
