/**
 * Special functions for the statistics kernel (prompts 037/038), pure.
 *
 * - lnΓ: Lanczos (g = 7, 9 terms) with the reflection formula below 1/2; ~1e-15 absolute.
 * - Densities of the binomial/Poisson type use Loader's saddle-point form (`stirlerr`, `bd0`,
 *   C. Loader 2000, as in R's nmath): no cancellation of large logarithms, so the prefactors of the
 *   incomplete gamma/beta functions and the pmfs stay accurate (~1e-14 relative) for large
 *   parameters as well.
 * - Regularized incomplete gamma P/Q: series for x < a + 1, Lentz continued fraction otherwise;
 *   both tails are returned so the small one never comes from `1 − (almost 1)`.
 * - Regularized incomplete beta I_x(a, b): Lentz continued fraction with the symmetry
 *   I_x(a, b) = 1 − I_{1−x}(b, a); x and y = 1 − x are passed separately to avoid cancellation.
 * - erf/erfc from P/Q(1/2, x²) – ~1e-15 in the core range, erfc relative even far in the tail.
 *
 * Non-convergence (only possible for extreme parameters) is reported as 'no-convergence'; the
 * raw helpers throw an internal error that the exported functions turn into a `MathResult`.
 */
import { type MathResult, fail, ok } from '../result';

const EPS = 2.220446049250313e-16;
const FPMIN = 1e-300;
const MAX_ITER = 100000;
const LN_SQRT_2PI = 0.9189385332046727; // ln √(2π)
const TWO_PI = 6.283185307179586;

/** Internal signal for a series/continued fraction that did not converge. */
export class NoConvergence extends Error {}

/** Runs a raw computation; internal non-convergence becomes a `MathResult` error. */
export function guard(f: () => number): MathResult<number> {
  try {
    const v = f();
    return Number.isNaN(v) ? fail('not-evaluable', 'the value is not defined') : ok(v);
  } catch (e) {
    if (e instanceof NoConvergence) return fail('no-convergence', e.message);
    throw e;
  }
}

/** Runs a computation that already returns a `MathResult`, catching internal non-convergence. */
export function guardResult<T>(f: () => MathResult<T>): MathResult<T> {
  try {
    return f();
  } catch (e) {
    if (e instanceof NoConvergence) return fail('no-convergence', e.message);
    throw e;
  }
}

const LANCZOS = [
  0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
  12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
];

/** ln|Γ(x)|; +∞ at the poles (0, −1, −2, …). */
export function lnGamma(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === Infinity) return Infinity;
  if (x <= 0 && Number.isInteger(x)) return Infinity;
  if (x < 0.5) {
    // reflection: Γ(x) Γ(1 − x) = π / sin(πx)
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  }
  // exact for small integers (factorials are exact in doubles up to 22!)
  if (Number.isInteger(x) && x <= 23) {
    let f = 1;
    for (let i = 2; i < x; i++) f *= i;
    return Math.log(f);
  }
  const z = x - 1;
  let s = LANCZOS[0];
  for (let i = 1; i < 9; i++) s += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return LN_SQRT_2PI + (z + 0.5) * Math.log(t) - t + Math.log(s);
}

/** ln B(a, b). */
export function lnBeta(a: number, b: number): number {
  return lnGamma(a) + lnGamma(b) - lnGamma(a + b);
}

// stirlerr(n) = ln n! − ((n + ½) ln n − n + ln √(2π)) for n = 0, ½, 1, …, 15 (computed with
// mpmath at 40 digits).
const SFERR_HALVES = [
  0, 0.15342640972002736, 0.08106146679532726, 0.05481412105191765, 0.0413406959554093,
  0.03316287351993629, 0.02767792568499834, 0.023746163656297496, 0.020790672103765093,
  0.018488450532673187, 0.016644691189821193, 0.015134973221917378, 0.013876128823070748,
  0.012810465242920227, 0.01189670994589177, 0.011104559758206917, 0.010411265261972096,
  0.009799416126158804, 0.009255462182712733, 0.008768700134139386, 0.00833056343336287,
  0.00793411456431402, 0.007573675487951841, 0.007244554301320383, 0.00694284010720953,
  0.006665247032707682, 0.006408994188004207, 0.006171712263039458, 0.0059513701127588475,
  0.0057462165130101155, 0.005554733551962801,
];

/** Error of Stirling's formula for ln n! (Loader); n ≥ 0 real. */
export function stirlerr(n: number): number {
  const S0 = 1 / 12;
  const S1 = 1 / 360;
  const S2 = 1 / 1260;
  const S3 = 1 / 1680;
  const S4 = 1 / 1188;
  if (n <= 15) {
    const nn = n + n;
    if (Number.isInteger(nn)) return SFERR_HALVES[nn];
    return lnGamma(n + 1) - (n + 0.5) * Math.log(n) + n - LN_SQRT_2PI;
  }
  const nn = n * n;
  if (n > 500) return (S0 - S1 / nn) / n;
  if (n > 80) return (S0 - (S1 - S2 / nn) / nn) / n;
  if (n > 35) return (S0 - (S1 - (S2 - S3 / nn) / nn) / nn) / n;
  return (S0 - (S1 - (S2 - (S3 - S4 / nn) / nn) / nn) / nn) / n;
}

/** Deviance term x ln(x/np) + np − x, computed without cancellation (Loader). */
export function bd0(x: number, np: number): number {
  if (x === 0) return np;
  if (Math.abs(x - np) < 0.1 * (x + np)) {
    let v = (x - np) / (x + np);
    let s = (x - np) * v;
    if (Math.abs(s) < Number.MIN_VALUE) return s;
    let ej = 2 * x * v;
    v *= v;
    for (let j = 1; j < 1000; j++) {
      ej *= v;
      const s1 = s + ej / (2 * j + 1);
      if (s1 === s) return s1;
      s = s1;
    }
  }
  return x * Math.log(x / np) + np - x;
}

/** e^(−λ)·λ^x / Γ(x + 1) for real x ≥ 0 (the Poisson "density" at real x). */
export function dpoisRaw(x: number, lambda: number): number {
  if (lambda === 0) return x === 0 ? 1 : 0;
  if (!Number.isFinite(lambda) || x < 0) return 0;
  if (x === 0) return Math.exp(-lambda);
  return Math.exp(-stirlerr(x) - bd0(x, lambda)) / Math.sqrt(TWO_PI * x);
}

/** Γ(n+1)/(Γ(x+1)Γ(n−x+1)) · pˣ · q^(n−x) for real 0 ≤ x ≤ n, with q = 1 − p given exactly. */
export function dbinomRaw(x: number, n: number, p: number, q: number): number {
  if (p === 0) return x === 0 ? 1 : 0;
  if (q === 0) return x === n ? 1 : 0;
  if (x === 0) {
    if (n === 0) return 1;
    return Math.exp(p < 0.1 ? -bd0(n, n * q) - n * p : n * Math.log(q));
  }
  if (x === n) return Math.exp(q < 0.1 ? -bd0(n, n * p) - n * q : n * Math.log(p));
  if (x < 0 || x > n) return 0;
  const lc = stirlerr(n) - stirlerr(x) - stirlerr(n - x) - bd0(x, n * p) - bd0(n - x, n * q);
  const lf = Math.log(TWO_PI) + Math.log(x) + Math.log1p(-x / n);
  return Math.exp(lc - 0.5 * lf);
}

/** Both tails of a probability: `lower + upper = 1`, each computed with full relative accuracy. */
export interface Tails {
  readonly lower: number;
  readonly upper: number;
}

/** Regularized incomplete gamma P(a, x) and Q(a, x); a > 0, x ≥ 0 (raw, may throw internally). */
export function gammaTails(a: number, x: number): Tails {
  if (x <= 0) return { lower: 0, upper: 1 };
  if (x === Infinity) return { lower: 1, upper: 0 };
  // xᵃ e^(−x) / Γ(a) = a · dpois_raw(a, x)
  const pre = a * dpoisRaw(a, x);
  if (x < a + 1) {
    let ap = a;
    let del = 1 / a;
    let sum = del;
    for (let i = 0; i < MAX_ITER; i++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) {
        const lower = Math.min(1, sum * pre);
        return { lower, upper: 1 - lower };
      }
    }
    throw new NoConvergence('the incomplete gamma series did not converge');
  }
  // continued fraction for Q (modified Lentz)
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < MAX_ITER; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) {
      const upper = Math.min(1, pre * h);
      return { lower: 1 - upper, upper };
    }
  }
  throw new NoConvergence('the incomplete gamma continued fraction did not converge');
}

function betaCf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) return h;
  }
  throw new NoConvergence('the incomplete beta continued fraction did not converge');
}

/**
 * Regularized incomplete beta I_x(a, b) (lower) and 1 − I_x(a, b) (upper); a, b > 0,
 * 0 ≤ x ≤ 1, y = 1 − x passed exactly by the caller (raw, may throw internally).
 */
export function betaTails(a: number, b: number, x: number, y: number = 1 - x): Tails {
  if (x <= 0) return { lower: 0, upper: 1 };
  if (y <= 0) return { lower: 1, upper: 0 };
  // xᵃ yᵇ / B(a, b) = ab/(a+b) · dbinom_raw(a, a+b, x, y)
  const front = ((a * b) / (a + b)) * dbinomRaw(a, a + b, x, y);
  if (x < (a + 1) / (a + b + 2)) {
    const lower = Math.min(1, (front * betaCf(a, b, x)) / a);
    return { lower, upper: 1 - lower };
  }
  const upper = Math.min(1, (front * betaCf(b, a, y)) / b);
  return { lower: 1 - upper, upper };
}

/** P(a, x) – regularized lower incomplete gamma function. */
export function regularizedGammaP(a: number, x: number): MathResult<number> {
  if (!(a > 0) || !(x >= 0) || a === Infinity)
    return fail('domain', 'P(a, x) needs a > 0 and x ≥ 0');
  return guard(() => gammaTails(a, x).lower);
}

/** Q(a, x) = 1 − P(a, x). */
export function regularizedGammaQ(a: number, x: number): MathResult<number> {
  if (!(a > 0) || !(x >= 0) || a === Infinity)
    return fail('domain', 'Q(a, x) needs a > 0 and x ≥ 0');
  return guard(() => gammaTails(a, x).upper);
}

/** I_x(a, b) – regularized incomplete beta function. */
export function regularizedBeta(x: number, a: number, b: number): MathResult<number> {
  if (!(a > 0) || !(b > 0) || !(x >= 0 && x <= 1) || a === Infinity || b === Infinity)
    return fail('domain', 'I_x(a, b) needs a, b > 0 and 0 ≤ x ≤ 1');
  return guard(() => betaTails(a, b, x).lower);
}

/** erf(x) = sign(x) · P(½, x²). */
export function erf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === 0) return x;
  const p = gammaTails(0.5, x * x);
  // P(½, x²) carries both branches (series / 1 − continued fraction) at full absolute accuracy
  return x > 0 ? p.lower : -p.lower;
}

/** erfc(x) = 1 − erf(x), relative accuracy also far in the right tail. */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const t = gammaTails(0.5, x * x);
  return x >= 0 ? t.upper : 1 + t.lower;
}
