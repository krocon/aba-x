/**
 * Statistical inference (prompt 038), pure: Z and T tests and confidence intervals (one and two
 * samples, proportions), χ² goodness of fit and two-way tables, inference for the slope and the
 * mean/predicted response of a simple linear regression.
 *
 * Inputs are summary statistics; `summarize` turns a data list into (x̄, s, n). Alternatives:
 * '<', '>' and '≠' (two-sided p = 2·min(cdf, sf)). p-values come from the upper/lower tail that
 * is small, so they keep their relative accuracy (no `1 − cdf`). Decision: reject H₀ when
 * p < α. Critical values are quantiles of the null distribution of the statistic:
 * '<' → [q(α)], '>' → [q(1 − α)], '≠' → [q(α/2), q(1 − α/2)]; χ² tests are always right-tailed.
 * Welch's degrees of freedom are not rounded (as on TI/HP calculators).
 */
import { type MathResult, fail, ok } from '../result';
import { oneVar, twoVar } from './descriptive';
import { type ContinuousDistribution, chiSquare, normal, studentT } from './distributions';

export type Alternative = '<' | '>' | '≠';

export interface TestResult {
  /** Test statistic (z, t or χ²). */
  readonly statistic: number;
  readonly pValue: number;
  /** Degrees of freedom; null for z tests. */
  readonly df: number | null;
  /** Critical value(s) of the statistic at α (see the file header). */
  readonly critical: readonly number[];
  readonly alpha: number;
  readonly reject: boolean;
  readonly alternative: Alternative;
  /** Point estimate: x̄, x̄₁ − x̄₂, p̂, p̂₁ − p̂₂ or the slope. */
  readonly estimate: number;
  readonly standardError: number;
}

export interface IntervalResult {
  readonly lower: number;
  readonly upper: number;
  readonly estimate: number;
  /** Half width (critical value · standard error). */
  readonly margin: number;
  /** Critical value z* or t*. */
  readonly critical: number;
  readonly df: number | null;
  readonly level: number;
  readonly standardError: number;
}

export interface ChiSquareResult {
  readonly statistic: number;
  readonly pValue: number;
  readonly df: number;
  readonly critical: number;
  readonly alpha: number;
  readonly reject: boolean;
  /** Expected counts (vector for goodness of fit, matrix for two-way tables). */
  readonly expected: readonly number[] | readonly (readonly number[])[];
  /** Contributions (O − E)²/E in the same shape. */
  readonly contributions: readonly number[] | readonly (readonly number[])[];
}

// ---------------------------------------------------------------------------------------------
// validation helpers

const bad = (msg: string) => fail<never>('domain', msg);
const finite = (...v: number[]) => v.every(Number.isFinite);
const positive = (...v: number[]) => v.every((x) => x > 0 && Number.isFinite(x));
const count = (n: number, min: number) => Number.isInteger(n) && n >= min;

function checkAlpha(alpha: number): MathResult<null> {
  return alpha > 0 && alpha < 1 ? ok(null) : bad('α must lie strictly between 0 and 1');
}
function checkLevel(level: number): MathResult<null> {
  return level > 0 && level < 1
    ? ok(null)
    : bad('the confidence level must lie strictly between 0 and 1');
}
function checkAlt(a: Alternative): MathResult<null> {
  return a === '<' || a === '>' || a === '≠' ? ok(null) : bad(`unknown alternative ${String(a)}`);
}

/** p-value and critical values of a statistic with the (symmetric) null distribution `d`. */
function decide(
  d: ContinuousDistribution,
  statistic: number,
  alt: Alternative,
  alpha: number,
): MathResult<{ pValue: number; critical: number[]; reject: boolean }> {
  const lo = d.cdf(statistic);
  const hi = d.sf(statistic);
  if (!lo.ok) return lo;
  if (!hi.ok) return hi;
  const pValue =
    alt === '<' ? lo.value : alt === '>' ? hi.value : Math.min(1, 2 * Math.min(lo.value, hi.value));
  const qs =
    alt === '<'
      ? [d.inv(alpha)]
      : alt === '>'
        ? [d.invUpper(alpha)]
        : [d.inv(alpha / 2), d.invUpper(alpha / 2)];
  const critical: number[] = [];
  for (const q of qs) {
    if (!q.ok) return q;
    critical.push(q.value);
  }
  return ok({ pValue, critical, reject: pValue < alpha });
}

function test(
  d: MathResult<ContinuousDistribution>,
  statistic: number,
  estimate: number,
  standardError: number,
  df: number | null,
  alt: Alternative,
  alpha: number,
): MathResult<TestResult> {
  const checks = [checkAlpha(alpha), checkAlt(alt)];
  for (const c of checks) if (!c.ok) return c;
  if (!d.ok) return d;
  if (!Number.isFinite(statistic)) return fail('not-evaluable', 'the test statistic is not finite');
  const r = decide(d.value, statistic, alt, alpha);
  if (!r.ok) return r;
  return ok({ statistic, df, alternative: alt, alpha, estimate, standardError, ...r.value });
}

function interval(
  d: MathResult<ContinuousDistribution>,
  estimate: number,
  standardError: number,
  df: number | null,
  level: number,
): MathResult<IntervalResult> {
  const c = checkLevel(level);
  if (!c.ok) return c;
  if (!d.ok) return d;
  const q = d.value.invUpper((1 - level) / 2);
  if (!q.ok) return q;
  const margin = q.value * standardError;
  return ok({
    lower: estimate - margin,
    upper: estimate + margin,
    estimate,
    margin,
    critical: q.value,
    df,
    level,
    standardError,
  });
}

// ---------------------------------------------------------------------------------------------
// summaries

export interface MeanSummary {
  readonly mean: number;
  readonly s: number;
  readonly n: number;
}

/** x̄, s and n of a data list (with optional frequencies); needs n ≥ 2. */
export function summarize(
  data: readonly number[],
  freq?: readonly number[],
): MathResult<MeanSummary> {
  const r = oneVar(data, freq);
  if (!r.ok) return r;
  if (r.value.s === null) return bad('at least two data values are needed');
  return ok({ mean: r.value.mean, s: r.value.s, n: r.value.n });
}

// ---------------------------------------------------------------------------------------------
// Z tests and intervals

export interface ZOneMean {
  readonly mean: number;
  readonly sigma: number;
  readonly n: number;
}
export interface ZTwoMeans {
  readonly mean1: number;
  readonly sigma1: number;
  readonly n1: number;
  readonly mean2: number;
  readonly sigma2: number;
  readonly n2: number;
}

function checkZ1(p: ZOneMean): MathResult<null> {
  return finite(p.mean) && positive(p.sigma) && count(p.n, 1)
    ? ok(null)
    : bad('Z needs a finite mean, σ > 0 and an integer n ≥ 1');
}
function checkZ2(p: ZTwoMeans): MathResult<null> {
  const a = checkZ1({ mean: p.mean1, sigma: p.sigma1, n: p.n1 });
  return a.ok ? checkZ1({ mean: p.mean2, sigma: p.sigma2, n: p.n2 }) : a;
}

/** One-sample Z test, H₀: μ = μ₀. */
export function zTestMean(
  p: ZOneMean & { mu0: number; alternative: Alternative; alpha: number },
): MathResult<TestResult> {
  const c = checkZ1(p);
  if (!c.ok) return c;
  if (!finite(p.mu0)) return bad('μ₀ must be finite');
  const se = p.sigma / Math.sqrt(p.n);
  return test(normal(), (p.mean - p.mu0) / se, p.mean, se, null, p.alternative, p.alpha);
}

/** Two-sample Z test, H₀: μ₁ − μ₂ = δ₀ (default 0). */
export function zTestTwoMeans(
  p: ZTwoMeans & { delta0?: number; alternative: Alternative; alpha: number },
): MathResult<TestResult> {
  const c = checkZ2(p);
  if (!c.ok) return c;
  const d0 = p.delta0 ?? 0;
  const se = Math.sqrt((p.sigma1 * p.sigma1) / p.n1 + (p.sigma2 * p.sigma2) / p.n2);
  const est = p.mean1 - p.mean2;
  return test(normal(), (est - d0) / se, est, se, null, p.alternative, p.alpha);
}

export interface Proportion {
  readonly x: number;
  readonly n: number;
}
function checkProp(p: Proportion): MathResult<null> {
  return count(p.n, 1) && count(p.x, 0) && p.x <= p.n
    ? ok(null)
    : bad('a proportion needs integers 0 ≤ x ≤ n, n ≥ 1');
}

/** One-proportion Z test, H₀: p = p₀ (standard error from p₀). */
export function zTestProportion(
  p: Proportion & { p0: number; alternative: Alternative; alpha: number },
): MathResult<TestResult> {
  const c = checkProp(p);
  if (!c.ok) return c;
  if (!(p.p0 > 0 && p.p0 < 1)) return bad('p₀ must lie strictly between 0 and 1');
  const ph = p.x / p.n;
  const se = Math.sqrt((p.p0 * (1 - p.p0)) / p.n);
  return test(normal(), (ph - p.p0) / se, ph, se, null, p.alternative, p.alpha);
}

/** Two-proportion Z test, H₀: p₁ = p₂ (pooled standard error). */
export function zTestTwoProportions(p: {
  x1: number;
  n1: number;
  x2: number;
  n2: number;
  alternative: Alternative;
  alpha: number;
}): MathResult<TestResult> {
  for (const c of [checkProp({ x: p.x1, n: p.n1 }), checkProp({ x: p.x2, n: p.n2 })])
    if (!c.ok) return c;
  const pooled = (p.x1 + p.x2) / (p.n1 + p.n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / p.n1 + 1 / p.n2));
  if (se === 0) return fail('not-evaluable', 'the pooled proportion is 0 or 1');
  const est = p.x1 / p.n1 - p.x2 / p.n2;
  return test(normal(), est / se, est, se, null, p.alternative, p.alpha);
}

export function zIntervalMean(p: ZOneMean & { level: number }): MathResult<IntervalResult> {
  const c = checkZ1(p);
  if (!c.ok) return c;
  return interval(normal(), p.mean, p.sigma / Math.sqrt(p.n), null, p.level);
}

export function zIntervalTwoMeans(p: ZTwoMeans & { level: number }): MathResult<IntervalResult> {
  const c = checkZ2(p);
  if (!c.ok) return c;
  const se = Math.sqrt((p.sigma1 * p.sigma1) / p.n1 + (p.sigma2 * p.sigma2) / p.n2);
  return interval(normal(), p.mean1 - p.mean2, se, null, p.level);
}

/** Wald interval p̂ ± z*·√(p̂(1 − p̂)/n). */
export function zIntervalProportion(p: Proportion & { level: number }): MathResult<IntervalResult> {
  const c = checkProp(p);
  if (!c.ok) return c;
  const ph = p.x / p.n;
  return interval(normal(), ph, Math.sqrt((ph * (1 - ph)) / p.n), null, p.level);
}

export function zIntervalTwoProportions(p: {
  x1: number;
  n1: number;
  x2: number;
  n2: number;
  level: number;
}): MathResult<IntervalResult> {
  for (const c of [checkProp({ x: p.x1, n: p.n1 }), checkProp({ x: p.x2, n: p.n2 })])
    if (!c.ok) return c;
  const p1 = p.x1 / p.n1;
  const p2 = p.x2 / p.n2;
  const se = Math.sqrt((p1 * (1 - p1)) / p.n1 + (p2 * (1 - p2)) / p.n2);
  return interval(normal(), p1 - p2, se, null, p.level);
}

// ---------------------------------------------------------------------------------------------
// T tests and intervals

export interface TTwoMeans {
  readonly mean1: number;
  readonly s1: number;
  readonly n1: number;
  readonly mean2: number;
  readonly s2: number;
  readonly n2: number;
  /** Pooled variance (equal variances assumed) instead of Welch. */
  readonly pooled: boolean;
}

function checkT1(p: MeanSummary): MathResult<null> {
  return finite(p.mean) && positive(p.s) && count(p.n, 2)
    ? ok(null)
    : bad('T needs a finite mean, s > 0 and an integer n ≥ 2');
}

function twoSampleSe(p: TTwoMeans): MathResult<{ se: number; df: number }> {
  for (const c of [
    checkT1({ mean: p.mean1, s: p.s1, n: p.n1 }),
    checkT1({ mean: p.mean2, s: p.s2, n: p.n2 }),
  ])
    if (!c.ok) return c;
  const v1 = (p.s1 * p.s1) / p.n1;
  const v2 = (p.s2 * p.s2) / p.n2;
  if (p.pooled) {
    const df = p.n1 + p.n2 - 2;
    const sp2 = ((p.n1 - 1) * p.s1 * p.s1 + (p.n2 - 1) * p.s2 * p.s2) / df;
    return ok({ se: Math.sqrt(sp2 * (1 / p.n1 + 1 / p.n2)), df });
  }
  const se2 = v1 + v2;
  const df = (se2 * se2) / ((v1 * v1) / (p.n1 - 1) + (v2 * v2) / (p.n2 - 1));
  return ok({ se: Math.sqrt(se2), df });
}

/** One-sample T test, H₀: μ = μ₀, df = n − 1. */
export function tTestMean(
  p: MeanSummary & { mu0: number; alternative: Alternative; alpha: number },
): MathResult<TestResult> {
  const c = checkT1(p);
  if (!c.ok) return c;
  if (!finite(p.mu0)) return bad('μ₀ must be finite');
  const se = p.s / Math.sqrt(p.n);
  const df = p.n - 1;
  return test(studentT(df), (p.mean - p.mu0) / se, p.mean, se, df, p.alternative, p.alpha);
}

/** Two-sample T test (pooled or Welch), H₀: μ₁ − μ₂ = δ₀ (default 0). */
export function tTestTwoMeans(
  p: TTwoMeans & { delta0?: number; alternative: Alternative; alpha: number },
): MathResult<TestResult> {
  const s = twoSampleSe(p);
  if (!s.ok) return s;
  const est = p.mean1 - p.mean2;
  const { se, df } = s.value;
  return test(studentT(df), (est - (p.delta0 ?? 0)) / se, est, se, df, p.alternative, p.alpha);
}

export function tIntervalMean(p: MeanSummary & { level: number }): MathResult<IntervalResult> {
  const c = checkT1(p);
  if (!c.ok) return c;
  return interval(studentT(p.n - 1), p.mean, p.s / Math.sqrt(p.n), p.n - 1, p.level);
}

export function tIntervalTwoMeans(p: TTwoMeans & { level: number }): MathResult<IntervalResult> {
  const s = twoSampleSe(p);
  if (!s.ok) return s;
  return interval(studentT(s.value.df), p.mean1 - p.mean2, s.value.se, s.value.df, p.level);
}

// ---------------------------------------------------------------------------------------------
// χ² tests

function chiDecision(statistic: number, df: number, alpha: number) {
  const d = chiSquare(df);
  if (!d.ok) return d;
  const p = d.value.sf(statistic);
  if (!p.ok) return p;
  const q = d.value.invUpper(alpha);
  if (!q.ok) return q;
  return ok({ pValue: p.value, critical: q.value, reject: p.value < alpha });
}

/**
 * χ² goodness of fit. Give either `expected` counts or `probabilities` (summing to 1; expected =
 * n·p). df = k − 1 unless given (e.g. reduced by estimated parameters).
 */
export function chiSquareGoodnessOfFit(p: {
  observed: readonly number[];
  expected?: readonly number[];
  probabilities?: readonly number[];
  df?: number;
  alpha: number;
}): MathResult<ChiSquareResult> {
  const a = checkAlpha(p.alpha);
  if (!a.ok) return a;
  const o = p.observed;
  const k = o.length;
  if (k < 2) return bad('at least two categories are needed');
  if (!o.every((v) => v >= 0 && Number.isFinite(v))) return bad('observed counts must be ≥ 0');
  let e: number[];
  if (p.expected && !p.probabilities) {
    e = [...p.expected];
  } else if (p.probabilities && !p.expected) {
    const total = p.probabilities.reduce((s, v) => s + v, 0);
    if (!p.probabilities.every((v) => v >= 0) || Math.abs(total - 1) > 1e-9)
      return bad('the probabilities must be ≥ 0 and sum to 1');
    const n = o.reduce((s, v) => s + v, 0);
    e = p.probabilities.map((v) => v * n);
  } else return bad('give either expected counts or probabilities');
  if (e.length !== k) return bad('observed and expected lists differ in length');
  if (!e.every((v) => v > 0 && Number.isFinite(v))) return bad('expected counts must be > 0');
  const df = p.df ?? k - 1;
  if (!count(df, 1)) return bad('the degrees of freedom must be a positive integer');
  const contributions = o.map((v, i) => ((v - e[i]) * (v - e[i])) / e[i]);
  const statistic = contributions.reduce((s, v) => s + v, 0);
  const d = chiDecision(statistic, df, p.alpha);
  if (!d.ok) return d;
  return ok({ statistic, df, alpha: p.alpha, expected: e, contributions, ...d.value });
}

/** χ² test of independence for an r × c table of counts, df = (r − 1)(c − 1). */
export function chiSquareTwoWay(p: {
  observed: readonly (readonly number[])[];
  alpha: number;
}): MathResult<ChiSquareResult> {
  const a = checkAlpha(p.alpha);
  if (!a.ok) return a;
  const t = p.observed;
  const r = t.length;
  const c = t[0]?.length ?? 0;
  if (r < 2 || c < 2 || t.some((row) => row.length !== c))
    return bad('the table must be rectangular with at least 2 × 2 cells');
  if (!t.flat().every((v) => v >= 0 && Number.isFinite(v))) return bad('counts must be ≥ 0');
  const rows = t.map((row) => row.reduce((s, v) => s + v, 0));
  const cols = Array.from({ length: c }, (_, j) => t.reduce((s, row) => s + row[j], 0));
  const n = rows.reduce((s, v) => s + v, 0);
  if (rows.some((v) => v === 0) || cols.some((v) => v === 0))
    return bad('every row and column needs a positive total');
  const expected = rows.map((ri) => cols.map((cj) => (ri * cj) / n));
  const contributions = t.map((row, i) =>
    row.map((v, j) => ((v - expected[i][j]) * (v - expected[i][j])) / expected[i][j]),
  );
  const statistic = contributions.flat().reduce((s, v) => s + v, 0);
  const df = (r - 1) * (c - 1);
  const d = chiDecision(statistic, df, p.alpha);
  if (!d.ok) return d;
  return ok({ statistic, df, alpha: p.alpha, expected, contributions, ...d.value });
}

// ---------------------------------------------------------------------------------------------
// linear regression inference

export interface LinRegSummary {
  readonly n: number;
  readonly slope: number;
  readonly intercept: number;
  /** Residual standard error s = √(SSE/(n − 2)). */
  readonly s: number;
  readonly seSlope: number;
  readonly seIntercept: number;
  readonly r: number | null;
  readonly r2: number | null;
  readonly meanX: number;
  readonly sxx: number;
}

/** Least-squares line with the standard errors used by all regression inference. */
export function linRegSummary(
  x: readonly number[],
  y: readonly number[],
): MathResult<LinRegSummary> {
  const t = twoVar(x, y);
  if (!t.ok) return t;
  const { n, sxx, sxy, meanX, meanY, r } = t.value;
  if (n < 3) return bad('regression inference needs at least 3 points');
  if (!(sxx > 0)) return fail('not-solvable', 'all x values are equal');
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  let sse = 0;
  for (let i = 0; i < x.length; i++) sse += (y[i] - (intercept + slope * x[i])) ** 2;
  const s = Math.sqrt(sse / (n - 2));
  return ok({
    n,
    slope,
    intercept,
    s,
    seSlope: s / Math.sqrt(sxx),
    seIntercept: s * Math.sqrt(1 / n + (meanX * meanX) / sxx),
    r,
    r2: r === null ? null : r * r,
    meanX,
    sxx,
  });
}

/** T test for the slope, H₀: β = β₀ (default 0), df = n − 2. */
export function linRegTTest(p: {
  x: readonly number[];
  y: readonly number[];
  beta0?: number;
  alternative: Alternative;
  alpha: number;
}): MathResult<TestResult & { regression: LinRegSummary }> {
  const l = linRegSummary(p.x, p.y);
  if (!l.ok) return l;
  const { slope, seSlope, n } = l.value;
  if (seSlope === 0) return fail('not-evaluable', 'the points lie exactly on a line');
  const r = test(
    studentT(n - 2),
    (slope - (p.beta0 ?? 0)) / seSlope,
    slope,
    seSlope,
    n - 2,
    p.alternative,
    p.alpha,
  );
  return r.ok ? ok({ ...r.value, regression: l.value }) : r;
}

/** Confidence interval for the slope β. */
export function linRegSlopeInterval(p: {
  x: readonly number[];
  y: readonly number[];
  level: number;
}): MathResult<IntervalResult> {
  const l = linRegSummary(p.x, p.y);
  if (!l.ok) return l;
  return interval(studentT(l.value.n - 2), l.value.slope, l.value.seSlope, l.value.n - 2, p.level);
}

/** Confidence interval for the mean response at x₀. */
export function linRegMeanInterval(p: {
  x: readonly number[];
  y: readonly number[];
  x0: number;
  level: number;
}): MathResult<IntervalResult> {
  return responseInterval(p, 0);
}

/** Prediction interval for a single new observation at x₀. */
export function linRegPredictionInterval(p: {
  x: readonly number[];
  y: readonly number[];
  x0: number;
  level: number;
}): MathResult<IntervalResult> {
  return responseInterval(p, 1);
}

function responseInterval(
  p: { x: readonly number[]; y: readonly number[]; x0: number; level: number },
  extra: 0 | 1,
): MathResult<IntervalResult> {
  if (!finite(p.x0)) return bad('x₀ must be finite');
  const l = linRegSummary(p.x, p.y);
  if (!l.ok) return l;
  const { n, s, meanX, sxx, slope, intercept } = l.value;
  const se = s * Math.sqrt(extra + 1 / n + ((p.x0 - meanX) * (p.x0 - meanX)) / sxx);
  return interval(studentT(n - 2), intercept + slope * p.x0, se, n - 2, p.level);
}
