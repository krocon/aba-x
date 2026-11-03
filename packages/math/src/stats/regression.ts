/**
 * Regression models for two-variable statistics (prompt 037), pure.
 *
 * - Linear: centered formulas m = Sxy/Sxx, b = ȳ − m·x̄ (no Σx² − n·x̄² cancellation).
 * - Logarithmic, exponential, power, exponent and inverse are fitted as straight lines of the
 *   transformed data (calculator convention: least squares on ln y etc.). Points outside the
 *   domain of the transform are a 'domain' error – never silently dropped. `r` and `r2` of these
 *   models describe the linearized fit (as TI/HP calculators report them).
 * - Quadratic, cubic, quartic: Householder QR least squares on the Vandermonde matrix of the
 *   centered and scaled abscissa t = (x − c)/s (well conditioned even for x like 2000…2020); the
 *   monomial coefficients are expanded afterwards, `predict` keeps evaluating in t.
 * - Logistic y = L/(1 + a·e^(−bx)) and trigonometric y = a·sin(bx + c) + d (radians):
 *   Levenberg–Marquardt with analytic Jacobian from several data-driven start values; the best
 *   converged fit wins. A result is only returned when the final point is stationary
 *   (|Jᵀr| small relative to |J|·|r|), otherwise 'no-convergence'.
 * - `r2` = 1 − SSE/SST on the fitted scale (null when y is constant); `r` = Pearson r of the
 *   (transformed) data for the two-parameter linearizable models, null for the others.
 */
import { type Matrix, solveLinear } from '../linalg/linalg';
import { type MathResult, fail, ok } from '../result';

export type RegressionModel =
  | 'linear'
  | 'logarithmic'
  | 'exponential'
  | 'power'
  | 'exponent'
  | 'inverse'
  | 'quadratic'
  | 'cubic'
  | 'quartic'
  | 'logistic'
  | 'trigonometric';

export interface RegressionFit {
  readonly model: RegressionModel;
  /**
   * linear/logarithmic/inverse: m, b · exponential/power/exponent: b, m · quadratic: a, b, c
   * (y = ax² + bx + c) · cubic: a…d · quartic: a…e · logistic: L, a, b · trigonometric: a, b, c, d.
   */
  readonly coefficients: Readonly<Record<string, number>>;
  /** Human-readable form, e.g. `y = 2·x + 1` (coefficients rounded to 6 significant digits). */
  readonly equation: string;
  /** Model value; NaN outside the model's domain (for plotting). */
  readonly f: (x: number) => number;
  /** Model value as a result ('domain' outside the model's domain). */
  readonly predict: (x: number) => MathResult<number>;
  /** Inverse prediction x for a given y, where the model is invertible. */
  readonly predictX?: (y: number) => MathResult<number>;
  readonly r2: number | null;
  readonly r: number | null;
  readonly sse: number;
  readonly n: number;
  /** Levenberg–Marquardt iterations (nonlinear models only). */
  readonly iterations?: number;
}

const fmt = (v: number) => Number(v.toPrecision(6)).toString();
const maxOf = (v: readonly number[]) => v.reduce((m, a) => (a > m ? a : m), -Infinity);

function validatePairs(x: readonly number[], y: readonly number[], min: number): MathResult<null> {
  if (x.length !== y.length) return fail('domain', 'x and y lists differ in length');
  if (x.some((v) => !Number.isFinite(v)) || y.some((v) => !Number.isFinite(v)))
    return fail('domain', 'the data must be finite numbers');
  if (x.length < min) return fail('domain', `the model needs at least ${min} data points`);
  return ok(null);
}

function meanOf(v: readonly number[]): number {
  let s = 0;
  for (const a of v) s += a;
  const m = s / v.length;
  let c = 0;
  for (const a of v) c += a - m;
  return m + c / v.length;
}

/** Straight line through the pairs (centered formulas) with Pearson r and r². */
function line(x: readonly number[], y: readonly number[]) {
  const mx = meanOf(x);
  const my = meanOf(y);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (!(sxx > 0)) return fail<never>('not-solvable', 'all x values are equal');
  const m = sxy / sxx;
  const b = my - m * mx;
  let sse = 0;
  for (let i = 0; i < x.length; i++) sse += (y[i] - (m * x[i] + b)) ** 2;
  const r = syy > 0 ? Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy))) : null;
  return ok({ m, b, r, r2: syy > 0 ? r! * r! : null, sse });
}

/**
 * Householder QR least squares: minimizes ‖A·c − y‖ (A is m × n, m ≥ n). Rank deficiency
 * (|R_kk| below 1e-10 of the largest) is reported as 'not-solvable'.
 */
export function leastSquares(a: Matrix, y: readonly number[]): MathResult<number[]> {
  const m = a.length;
  const n = a[0]?.length ?? 0;
  if (m < n || n === 0) return fail('not-solvable', 'too few data for the model');
  const r = a.map((row) => [...row]);
  const b = [...y];
  const diag: number[] = [];
  for (let k = 0; k < n; k++) {
    let norm = 0;
    for (let i = k; i < m; i++) norm = Math.hypot(norm, r[i][k]);
    const alpha = r[k][k] > 0 ? -norm : norm;
    diag.push(alpha);
    if (norm === 0) continue;
    const v = new Array<number>(m).fill(0);
    for (let i = k; i < m; i++) v[i] = r[i][k];
    v[k] -= alpha;
    let vv = 0;
    for (let i = k; i < m; i++) vv += v[i] * v[i];
    if (vv === 0) continue;
    for (let j = k; j < n; j++) {
      let s = 0;
      for (let i = k; i < m; i++) s += v[i] * r[i][j];
      const f = (2 * s) / vv;
      for (let i = k; i < m; i++) r[i][j] -= f * v[i];
    }
    let s = 0;
    for (let i = k; i < m; i++) s += v[i] * b[i];
    const f = (2 * s) / vv;
    for (let i = k; i < m; i++) b[i] -= f * v[i];
  }
  const big = maxOf(diag.map(Math.abs));
  if (!(big > 0) || diag.some((d) => Math.abs(d) <= 1e-10 * big))
    return fail('not-solvable', 'the data do not determine the model (too few distinct x values)');
  const c = new Array<number>(n).fill(0);
  for (let k = n - 1; k >= 0; k--) {
    let s = b[k];
    for (let j = k + 1; j < n; j++) s -= r[k][j] * c[j];
    c[k] = s / r[k][k];
  }
  return ok(c);
}

function r2Of(y: readonly number[], fitted: (i: number) => number) {
  const my = meanOf(y);
  let sse = 0;
  let sst = 0;
  for (let i = 0; i < y.length; i++) {
    sse += (y[i] - fitted(i)) ** 2;
    sst += (y[i] - my) ** 2;
  }
  return { sse, r2: sst > 0 ? 1 - sse / sst : null };
}

const asResult = (v: number): MathResult<number> =>
  Number.isFinite(v) ? ok(v) : fail('domain', 'the model is not defined there');

// ---------------------------------------------------------------------------------------------
// linearizable models

/** Line coefficients of a linearizable model (its own m and b, after back-transformation). */
interface MB {
  readonly m: number;
  readonly b: number;
}

interface Linearized {
  /** Transforms of x and y; NaN marks a point outside the domain. */
  tx: (x: number) => number;
  ty: (y: number) => number;
  domain: string;
  /** Model coefficients from the line Y = M·X + B. */
  coef: (m: number, b: number) => MB;
  f: (c: MB) => (x: number) => number;
  inv: (c: MB) => (y: number) => number;
  equation: (c: MB) => string;
}

const LINEARIZED: Partial<Record<RegressionModel, Linearized>> = {
  linear: {
    tx: (x) => x,
    ty: (y) => y,
    domain: '',
    coef: (m, b) => ({ m, b }),
    f: (c) => (x) => c.m * x + c.b,
    inv: (c) => (y) => (c.m === 0 ? NaN : (y - c.b) / c.m),
    equation: (c) => `y = ${fmt(c.m)}·x + ${fmt(c.b)}`,
  },
  logarithmic: {
    tx: (x) => (x > 0 ? Math.log(x) : NaN),
    ty: (y) => y,
    domain: 'the logarithmic model needs x > 0',
    coef: (m, b) => ({ m, b }),
    f: (c) => (x) => (x > 0 ? c.m * Math.log(x) + c.b : NaN),
    inv: (c) => (y) => (c.m === 0 ? NaN : Math.exp((y - c.b) / c.m)),
    equation: (c) => `y = ${fmt(c.m)}·ln(x) + ${fmt(c.b)}`,
  },
  exponential: {
    tx: (x) => x,
    ty: (y) => (y > 0 ? Math.log(y) : NaN),
    domain: 'the exponential model needs y > 0',
    coef: (m, b) => ({ b: Math.exp(b), m }),
    f: (c) => (x) => c.b * Math.exp(c.m * x),
    inv: (c) => (y) => (c.m === 0 || !(y / c.b > 0) ? NaN : Math.log(y / c.b) / c.m),
    equation: (c) => `y = ${fmt(c.b)}·e^(${fmt(c.m)}·x)`,
  },
  power: {
    tx: (x) => (x > 0 ? Math.log(x) : NaN),
    ty: (y) => (y > 0 ? Math.log(y) : NaN),
    domain: 'the power model needs x > 0 and y > 0',
    coef: (m, b) => ({ b: Math.exp(b), m }),
    f: (c) => (x) => (x > 0 ? c.b * Math.pow(x, c.m) : NaN),
    inv: (c) => (y) => (c.m === 0 || !(y / c.b > 0) ? NaN : Math.pow(y / c.b, 1 / c.m)),
    equation: (c) => `y = ${fmt(c.b)}·x^${fmt(c.m)}`,
  },
  exponent: {
    tx: (x) => x,
    ty: (y) => (y > 0 ? Math.log(y) : NaN),
    domain: 'the exponent model needs y > 0',
    coef: (m, b) => ({ b: Math.exp(b), m: Math.exp(m) }),
    f: (c) => (x) => c.b * Math.pow(c.m, x),
    inv: (c) => (y) => (c.m === 1 || !(y / c.b > 0) ? NaN : Math.log(y / c.b) / Math.log(c.m)),
    equation: (c) => `y = ${fmt(c.b)}·${fmt(c.m)}^x`,
  },
  inverse: {
    tx: (x) => (x !== 0 ? 1 / x : NaN),
    ty: (y) => y,
    domain: 'the inverse model needs x ≠ 0',
    coef: (m, b) => ({ m, b }),
    f: (c) => (x) => (x !== 0 ? c.m / x + c.b : NaN),
    inv: (c) => (y) => (y === c.b || c.m === 0 ? NaN : c.m / (y - c.b)),
    equation: (c) => `y = ${fmt(c.m)}/x + ${fmt(c.b)}`,
  },
};

function fitLinearized(
  model: RegressionModel,
  x: readonly number[],
  y: readonly number[],
): MathResult<RegressionFit> {
  const t = LINEARIZED[model]!;
  const X = x.map(t.tx);
  const Y = y.map(t.ty);
  if (X.some(Number.isNaN) || Y.some(Number.isNaN)) return fail('domain', t.domain);
  const l = line(X, Y);
  if (!l.ok) return l;
  const c = t.coef(l.value.m, l.value.b);
  const f = t.f(c);
  const inv = t.inv(c);
  return ok({
    model,
    coefficients: { ...c },
    equation: t.equation(c),
    f,
    predict: (v) => asResult(f(v)),
    predictX: (v) =>
      Number.isFinite(inv(v)) ? ok(inv(v)) : fail('not-solvable', 'no x gives this y'),
    r: l.value.r,
    r2: l.value.r2,
    sse: l.value.sse,
    n: x.length,
  });
}

// ---------------------------------------------------------------------------------------------
// polynomials

/** Coefficients (ascending) of p(x) = q((x − c)/s) for q given ascending in t. */
function expandCentered(q: readonly number[], c: number, s: number): number[] {
  let res = [0];
  for (let k = q.length - 1; k >= 0; k--) {
    // res = res · (x − c)/s + q_k
    const next = new Array<number>(res.length + 1).fill(0);
    for (let i = 0; i < res.length; i++) {
      next[i + 1] += res[i] / s;
      next[i] -= (res[i] * c) / s;
    }
    next[0] += q[k];
    res = next;
  }
  return res.slice(0, q.length);
}

function fitPolynomial(
  model: RegressionModel,
  degree: number,
  x: readonly number[],
  y: readonly number[],
): MathResult<RegressionFit> {
  const c = meanOf(x);
  const s = maxOf(x.map((v) => Math.abs(v - c))) || 1;
  const t = x.map((v) => (v - c) / s);
  const A = t.map((v) => Array.from({ length: degree + 1 }, (_, k) => v ** k));
  const sol = leastSquares(A, y);
  if (!sol.ok) return sol;
  const q = sol.value;
  const f = (v: number) => {
    const tt = (v - c) / s;
    let acc = 0;
    for (let k = degree; k >= 0; k--) acc = acc * tt + q[k];
    return acc;
  };
  const asc = expandCentered(q, c, s);
  const names = ['a', 'b', 'c', 'd', 'e'].slice(0, degree + 1);
  const coefficients: Record<string, number> = {};
  names.forEach((nm, i) => (coefficients[nm] = asc[degree - i]));
  const terms = names.map((nm, i) => {
    const p = degree - i;
    return `${fmt(coefficients[nm])}${p === 0 ? '' : p === 1 ? '·x' : `·x^${p}`}`;
  });
  const { sse, r2 } = r2Of(y, (i) => f(x[i]));
  return ok({
    model,
    coefficients,
    equation: `y = ${terms.join(' + ')}`,
    f,
    predict: (v) => asResult(f(v)),
    r: null,
    r2,
    sse,
    n: x.length,
  });
}

// ---------------------------------------------------------------------------------------------
// Levenberg–Marquardt

interface NonlinearModel {
  f(p: readonly number[], x: number): number;
  grad(p: readonly number[], x: number): number[];
}

interface LmResult {
  readonly p: number[];
  readonly sse: number;
  readonly iterations: number;
}

function sseOf(
  m: NonlinearModel,
  p: readonly number[],
  x: readonly number[],
  y: readonly number[],
) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (y[i] - m.f(p, x[i])) ** 2;
  return s;
}

/** Normal equations JᵀJ and gradient Jᵀr at p. */
function normalEquations(
  m: NonlinearModel,
  p: readonly number[],
  x: readonly number[],
  y: readonly number[],
) {
  const k = p.length;
  const jtj = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const g = new Array<number>(k).fill(0);
  for (let i = 0; i < x.length; i++) {
    const j = m.grad(p, x[i]);
    const r = y[i] - m.f(p, x[i]);
    for (let a = 0; a < k; a++) {
      g[a] += j[a] * r;
      for (let b = 0; b < k; b++) jtj[a][b] += j[a] * j[b];
    }
  }
  return { jtj, g };
}

/**
 * Stationarity: every Jacobian column is (nearly) orthogonal to the residual vector – up to the
 * rounding noise of residuals that are already at the level of ε·|y| (exact fits).
 */
function stationary(jtj: number[][], g: number[], sse: number, yy: number): boolean {
  const tol = 1e-6 * Math.sqrt(sse) + 1e-13 * Math.sqrt(yy);
  return g.every((gi, i) => Math.abs(gi) <= Math.sqrt(jtj[i][i]) * tol);
}

export function levenbergMarquardt(
  m: NonlinearModel,
  p0: readonly number[],
  x: readonly number[],
  y: readonly number[],
  maxIter = 2000,
): MathResult<LmResult> {
  let p = [...p0];
  let sse = sseOf(m, p, x, y);
  if (!Number.isFinite(sse)) return fail('no-convergence', 'the start values are not usable');
  const yy = y.reduce((acc, v) => acc + v * v, 0);
  let lambda = 1e-3;
  for (let it = 1; it <= maxIter; it++) {
    const { jtj, g } = normalEquations(m, p, x, y);
    if (!jtj.flat().every(Number.isFinite)) return fail('no-convergence', 'the fit diverged');
    const maxDiag = maxOf(jtj.map((r, i) => r[i]));
    let accepted = false;
    let small = false;
    while (lambda < 1e20) {
      const a = jtj.map((r, i) =>
        r.map((v, j) => (i === j ? v + lambda * Math.max(v, 1e-12 * maxDiag) : v)),
      );
      const d = solveLinear(a, g);
      if (d.ok) {
        const pn = p.map((v, i) => v + d.value[i]);
        const sn = sseOf(m, pn, x, y);
        if (Number.isFinite(sn) && sn < sse) {
          small = d.value.every((di, i) => Math.abs(di) <= 1e-12 * (Math.abs(pn[i]) + 1e-12));
          p = pn;
          sse = sn;
          lambda = Math.max(lambda / 10, 1e-15);
          accepted = true;
          break;
        }
      }
      lambda *= 10;
    }
    if (p.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e150))
      return fail('no-convergence', 'the fit diverged');
    if (!accepted || small) {
      // no further decrease possible: accept only a stationary point
      const ne = normalEquations(m, p, x, y);
      if (stationary(ne.jtj, ne.g, sse, yy)) return ok({ p, sse, iterations: it });
      if (!accepted) return fail('no-convergence', 'the fit is stuck away from a minimum');
      lambda = 1e-3;
    }
  }
  return fail('no-convergence', 'the fit did not converge within the iteration limit');
}

// ---------------------------------------------------------------------------------------------
// logistic and trigonometric

const LOGISTIC: NonlinearModel = {
  f: ([L, a, b], x) => L / (1 + a * Math.exp(-b * x)),
  grad: ([L, a, b], x) => {
    const e = Math.exp(-b * x);
    const d = 1 + a * e;
    return [1 / d, (-L * e) / (d * d), (L * a * x * e) / (d * d)];
  },
};

const TRIG: NonlinearModel = {
  f: ([a, b, c, d], x) => a * Math.sin(b * x + c) + d,
  grad: ([a, b, c], x) => {
    const cs = Math.cos(b * x + c);
    return [Math.sin(b * x + c), a * x * cs, a * cs, 1];
  },
};

function bestOf(
  model: NonlinearModel,
  starts: number[][],
  x: readonly number[],
  y: readonly number[],
): MathResult<LmResult> {
  let best: LmResult | null = null;
  let last: MathResult<LmResult> = fail('no-convergence', 'no usable start values');
  for (const s of starts) {
    if (!s.every(Number.isFinite)) continue;
    const r = levenbergMarquardt(model, s, x, y);
    if (r.ok && (!best || r.value.sse < best.sse)) best = r.value;
    if (!r.ok) last = r;
  }
  return best ? ok(best) : last;
}

function fitLogistic(x: readonly number[], y: readonly number[]): MathResult<RegressionFit> {
  const ymax = maxOf(y);
  if (!(ymax > 0)) return fail('domain', 'the logistic model needs positive y values');
  const starts: number[][] = [];
  for (const factor of [1.01, 1.05, 1.2, 1.5, 2, 4]) {
    const L = ymax * factor;
    const X: number[] = [];
    const Z: number[] = [];
    x.forEach((xi, i) => {
      if (y[i] > 0 && y[i] < L) {
        X.push(xi);
        Z.push(Math.log(L / y[i] - 1));
      }
    });
    if (X.length < 2) continue;
    const l = line(X, Z);
    if (l.ok) starts.push([L, Math.exp(l.value.b), -l.value.m]);
  }
  const r = bestOf(LOGISTIC, starts, x, y);
  if (!r.ok) return r;
  const [L, a, b] = r.value.p;
  const f = (v: number) => L / (1 + a * Math.exp(-b * v));
  const { sse, r2 } = r2Of(y, (i) => f(x[i]));
  return ok({
    model: 'logistic',
    coefficients: { L, a, b },
    equation: `y = ${fmt(L)}/(1 + ${fmt(a)}·e^(−${fmt(b)}·x))`,
    f,
    predict: (v) => asResult(f(v)),
    predictX: (v) => {
      // x = −ln((L/y − 1)/a)/b
      const u = (L / v - 1) / a;
      return u > 0 && b !== 0 ? ok(-Math.log(u) / b) : fail('not-solvable', 'no x gives this y');
    },
    r: null,
    r2,
    sse,
    n: x.length,
    iterations: r.value.iterations,
  });
}

function fitTrig(x: readonly number[], y: readonly number[]): MathResult<RegressionFit> {
  const order = x.map((_, i) => i).sort((i, j) => x[i] - x[j]);
  const d0 = meanOf(y);
  const span = x[order[order.length - 1]] - x[order[0]];
  if (!(span > 0)) return fail('not-solvable', 'all x values are equal');
  let crossings = 0;
  let prev = 0;
  for (const i of order) {
    const s = Math.sign(y[i] - d0);
    if (s !== 0) {
      if (prev !== 0 && s !== prev) crossings++;
      prev = s;
    }
  }
  const b0 = (Math.PI * Math.max(1, crossings)) / span;
  const starts: number[][] = [];
  for (const factor of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
    const b = b0 * factor;
    // for fixed b the model is linear: A·sin(bx) + B·cos(bx) + d
    const sol = leastSquares(
      x.map((v) => [Math.sin(b * v), Math.cos(b * v), 1]),
      y,
    );
    if (!sol.ok) continue;
    const [A, B, d] = sol.value;
    starts.push([Math.hypot(A, B), b, Math.atan2(B, A), d]);
  }
  const r = bestOf(TRIG, starts, x, y);
  if (!r.ok) return r;
  let [a, b, c] = r.value.p;
  const d = r.value.p[3];
  // canonical form: a > 0, b > 0, −π < c ≤ π
  if (b < 0) {
    b = -b;
    c = Math.PI - c; // a·sin(−bx + c) = a·sin(bx + π − c)
  }
  if (a < 0) {
    a = -a;
    c += Math.PI;
  }
  c -= 2 * Math.PI * Math.ceil((c - Math.PI) / (2 * Math.PI));
  const f = (v: number) => a * Math.sin(b * v + c) + d;
  const { sse, r2 } = r2Of(y, (i) => f(x[i]));
  return ok({
    model: 'trigonometric',
    coefficients: { a, b, c, d },
    equation: `y = ${fmt(a)}·sin(${fmt(b)}·x + ${fmt(c)}) + ${fmt(d)}`,
    f,
    predict: (v) => asResult(f(v)),
    r: null,
    r2,
    sse,
    n: x.length,
    iterations: r.value.iterations,
  });
}

// ---------------------------------------------------------------------------------------------

const MIN_POINTS: Record<RegressionModel, number> = {
  linear: 2,
  logarithmic: 2,
  exponential: 2,
  power: 2,
  exponent: 2,
  inverse: 2,
  quadratic: 3,
  cubic: 4,
  quartic: 5,
  logistic: 3,
  trigonometric: 4,
};

/** Fits `model` to the pairs (x[i], y[i]). */
export function fitRegression(
  model: RegressionModel,
  x: readonly number[],
  y: readonly number[],
): MathResult<RegressionFit> {
  const v = validatePairs(x, y, MIN_POINTS[model]);
  if (!v.ok) return v;
  switch (model) {
    case 'quadratic':
      return fitPolynomial(model, 2, x, y);
    case 'cubic':
      return fitPolynomial(model, 3, x, y);
    case 'quartic':
      return fitPolynomial(model, 4, x, y);
    case 'logistic':
      return fitLogistic(x, y);
    case 'trigonometric':
      return fitTrig(x, y);
    default:
      return fitLinearized(model, x, y);
  }
}
