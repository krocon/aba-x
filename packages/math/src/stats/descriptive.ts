/**
 * Descriptive statistics (prompt 037), pure.
 *
 * - Data are finite numbers; optional frequencies must be finite non-negative integers (a
 *   frequency of 0 drops the value). Anything else is a 'domain' error, never a silent skip.
 * - Mean and variance: corrected two-pass algorithm (mean first, then Σf(x − x̄)² minus the
 *   rounding correction (Σf(x − x̄))²/n), so constant or offset data (e.g. 1e9 + small) lose no
 *   digits. Σx and Σx² use Neumaier (compensated) summation.
 * - Quartiles: median of the lower and upper half, the median itself excluded for odd n
 *   ("Method 1" of the Wikipedia article on quartiles; TI-83/84 1-Var Stats, HP Prime). For n = 1
 *   all three quartiles equal the single value. Order statistics are read from the sorted
 *   (value, frequency) pairs without expanding the frequencies.
 * - Quantities that are undefined for the data (s for n = 1, r for constant data) are `null`.
 */
import { type MathResult, fail, ok } from '../result';

/** Neumaier summation. */
export function sum(values: readonly number[]): number {
  let s = 0;
  let c = 0;
  for (const v of values) {
    const t = s + v;
    c += Math.abs(s) >= Math.abs(v) ? s - t + v : v - t + s;
    s = t;
  }
  return s + c;
}

interface Weighted {
  readonly x: readonly number[];
  readonly f: readonly number[];
  readonly n: number;
}

function validate(x: readonly number[], freq?: readonly number[]): MathResult<Weighted> {
  if (x.some((v) => !Number.isFinite(v))) return fail('domain', 'the data must be finite numbers');
  if (freq) {
    if (freq.length !== x.length)
      return fail('domain', 'data and frequency lists differ in length');
    if (freq.some((f) => !Number.isInteger(f) || f < 0))
      return fail('domain', 'frequencies must be non-negative integers');
  }
  const f = freq ?? x.map(() => 1);
  const n = sum(f);
  if (n === 0) return fail('domain', 'there are no data');
  return ok({ x, f, n });
}

export interface OneVarStats {
  readonly n: number;
  readonly mean: number;
  readonly sum: number;
  readonly sumSquares: number;
  /** Sample standard deviation s (n − 1); null for n = 1. */
  readonly s: number | null;
  /** Population standard deviation σ (n). */
  readonly sigma: number;
  /** Sample variance s²; null for n = 1. */
  readonly variance: number | null;
  readonly populationVariance: number;
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
  readonly range: number;
  readonly iqr: number;
  /** Standard error of the mean s/√n; null for n = 1. */
  readonly serr: number | null;
}

/** Sorted (value, frequency) pairs with cumulative counts; zero frequencies are dropped. */
function sortedPairs(w: Weighted) {
  const idx = w.x.map((_, i) => i).filter((i) => w.f[i] > 0);
  idx.sort((a, b) => w.x[a] - w.x[b]);
  const values = idx.map((i) => w.x[i]);
  const cum: number[] = [];
  let c = 0;
  for (const i of idx) cum.push((c += w.f[i]));
  /** k-th order statistic, k = 1 … n. */
  const at = (k: number) => {
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] >= k) hi = mid;
      else lo = mid + 1;
    }
    return values[lo];
  };
  return at;
}

/** Median of the order statistics from..to (1-based, inclusive). */
function medianOf(at: (k: number) => number, from: number, to: number): number {
  const len = to - from + 1;
  const mid = from + Math.floor((len - 1) / 2);
  return len % 2 === 1 ? at(mid) : (at(mid) + at(mid + 1)) / 2;
}

/** Five quartile values with the documented method (median excluded from the halves for odd n). */
function quartiles(at: (k: number) => number, n: number) {
  const median = medianOf(at, 1, n);
  if (n === 1) return { min: at(1), q1: median, median, q3: median, max: at(1) };
  const half = Math.floor(n / 2);
  return {
    min: at(1),
    q1: medianOf(at, 1, half),
    median,
    q3: medianOf(at, n - half + 1, n),
    max: at(n),
  };
}

/** Mean and Σf(x − x̄)² by the corrected two-pass algorithm. */
function moments(x: readonly number[], f: readonly number[], n: number) {
  const mean = sum(x.map((v, i) => v * f[i])) / n;
  const d = x.map((v) => v - mean);
  const corr = sum(d.map((v, i) => v * f[i]));
  const ss = Math.max(0, sum(d.map((v, i) => v * v * f[i])) - (corr * corr) / n);
  return { mean, ss, d };
}

export function oneVar(data: readonly number[], freq?: readonly number[]): MathResult<OneVarStats> {
  const v = validate(data, freq);
  if (!v.ok) return v;
  const { x, f, n } = v.value;
  const { mean, ss } = moments(x, f, n);
  const q = quartiles(sortedPairs(v.value), n);
  const variance = n > 1 ? ss / (n - 1) : null;
  const s = variance === null ? null : Math.sqrt(variance);
  return ok({
    n,
    mean,
    sum: sum(x.map((xi, i) => xi * f[i])),
    sumSquares: sum(x.map((xi, i) => xi * xi * f[i])),
    s,
    sigma: Math.sqrt(ss / n),
    variance,
    populationVariance: ss / n,
    ...q,
    range: q.max - q.min,
    iqr: q.q3 - q.q1,
    serr: s === null ? null : s / Math.sqrt(n),
  });
}

export interface TwoVarStats {
  readonly n: number;
  readonly meanX: number;
  readonly meanY: number;
  readonly sumX: number;
  readonly sumY: number;
  readonly sumXY: number;
  readonly sumX2: number;
  readonly sumY2: number;
  /** Sample standard deviations; null for n = 1. */
  readonly sx: number | null;
  readonly sy: number | null;
  readonly sigmaX: number;
  readonly sigmaY: number;
  /** Sample covariance (n − 1); null for n = 1. */
  readonly covariance: number | null;
  /** Population covariance (n). */
  readonly populationCovariance: number;
  /** Pearson correlation; null when x or y is constant. */
  readonly r: number | null;
  /** Centered sums Sxx, Syy, Sxy (used by regression and inference). */
  readonly sxx: number;
  readonly syy: number;
  readonly sxy: number;
}

export function twoVar(
  xs: readonly number[],
  ys: readonly number[],
  freq?: readonly number[],
): MathResult<TwoVarStats> {
  if (xs.length !== ys.length) return fail('domain', 'x and y lists differ in length');
  const vx = validate(xs, freq);
  if (!vx.ok) return vx;
  const vy = validate(ys, freq);
  if (!vy.ok) return vy;
  const { f, n } = vx.value;
  const mx = moments(xs, f, n);
  const my = moments(ys, f, n);
  const cx = sum(mx.d.map((v, i) => v * f[i]));
  const cy = sum(my.d.map((v, i) => v * f[i]));
  const sxy = sum(mx.d.map((v, i) => v * my.d[i] * f[i])) - (cx * cy) / n;
  const { ss: sxx } = mx;
  const { ss: syy } = my;
  const r = sxx > 0 && syy > 0 ? Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy))) : null;
  return ok({
    n,
    meanX: mx.mean,
    meanY: my.mean,
    sumX: sum(xs.map((v, i) => v * f[i])),
    sumY: sum(ys.map((v, i) => v * f[i])),
    sumXY: sum(xs.map((v, i) => v * ys[i] * f[i])),
    sumX2: sum(xs.map((v, i) => v * v * f[i])),
    sumY2: sum(ys.map((v, i) => v * v * f[i])),
    sx: n > 1 ? Math.sqrt(sxx / (n - 1)) : null,
    sy: n > 1 ? Math.sqrt(syy / (n - 1)) : null,
    sigmaX: Math.sqrt(sxx / n),
    sigmaY: Math.sqrt(syy / n),
    covariance: n > 1 ? sxy / (n - 1) : null,
    populationCovariance: sxy / n,
    r,
    sxx,
    syy,
    sxy,
  });
}

export interface HistogramClass {
  /** Class [lower, upper); the last class also contains its upper bound. */
  readonly lower: number;
  readonly upper: number;
  readonly count: number;
}

export interface Histogram {
  readonly classes: readonly HistogramClass[];
  /** Weighted number of values below `start` (not in any class). */
  readonly below: number;
}

const MAX_CLASSES = 10000;

/**
 * Counts the data in classes [start + i·width, start + (i+1)·width) up to the class that
 * contains the maximum. Values below `start` are reported in `below`.
 */
export function histogram(
  data: readonly number[],
  start: number,
  width: number,
  freq?: readonly number[],
): MathResult<Histogram> {
  if (!Number.isFinite(start) || !(width > 0) || !Number.isFinite(width))
    return fail('domain', 'the histogram needs a finite start and a width > 0');
  const v = validate(data, freq);
  if (!v.ok) return v;
  const { x, f } = v.value;
  const max = x.reduce((m, xi, i) => (f[i] > 0 && xi > m ? xi : m), -Infinity);
  const k = max < start ? 0 : Math.floor((max - start) / width) + 1;
  if (k > MAX_CLASSES)
    return fail('domain', `more than ${MAX_CLASSES} classes – increase the width`);
  const counts = new Array<number>(k).fill(0);
  let below = 0;
  x.forEach((xi, i) => {
    if (f[i] === 0) return;
    if (xi < start) {
      below += f[i];
      return;
    }
    counts[Math.min(k - 1, Math.floor((xi - start) / width))] += f[i];
  });
  return ok({
    classes: counts.map((count, i) => ({
      lower: start + i * width,
      upper: start + (i + 1) * width,
      count,
    })),
    below,
  });
}

/**
 * Default classes: start at the minimum, Sturges' number of classes ⌈log₂ n⌉ + 1, width rounded
 * up to a 1-2-5 step so the class bounds are readable.
 */
export function defaultHistogram(
  data: readonly number[],
  freq?: readonly number[],
): MathResult<{ start: number; width: number }> {
  const s = oneVar(data, freq);
  if (!s.ok) return s;
  const { min, max, n } = s.value;
  const k = Math.ceil(Math.log2(n)) + 1;
  const raw = (max - min) / k;
  if (raw === 0) return ok({ start: min - 0.5, width: 1 });
  const e = Math.pow(10, Math.floor(Math.log10(raw)));
  const width = [1, 2, 5, 10].map((m) => m * e).find((w) => w >= raw * (1 - 1e-12))!;
  return ok({ start: Math.floor(min / width) * width, width });
}

export interface BoxPlot {
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
  /** Fences Q1 − 1.5·IQR and Q3 + 1.5·IQR. */
  readonly lowerFence: number;
  readonly upperFence: number;
  /** Whisker ends: the most extreme data inside the fences. */
  readonly lowerWhisker: number;
  readonly upperWhisker: number;
  /** Distinct values outside the fences, ascending. */
  readonly outliers: readonly number[];
}

/** Five-number summary (same quartiles as `oneVar`) with Tukey's 1.5·IQR outlier fences. */
export function boxPlot(data: readonly number[], freq?: readonly number[]): MathResult<BoxPlot> {
  const s = oneVar(data, freq);
  if (!s.ok) return s;
  const { min, q1, median, q3, max, iqr } = s.value;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const present = data.filter((_, i) => (freq ? freq[i] > 0 : true));
  const inside = present.filter((v) => v >= lowerFence && v <= upperFence);
  const outliers = [...new Set(present.filter((v) => v < lowerFence || v > upperFence))].sort(
    (a, b) => a - b,
  );
  return ok({
    min,
    q1,
    median,
    q3,
    max,
    lowerFence,
    upperFence,
    lowerWhisker: inside.reduce((m, v) => Math.min(m, v), Infinity),
    upperWhisker: inside.reduce((m, v) => Math.max(m, v), -Infinity),
    outliers,
  });
}
