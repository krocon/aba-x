/**
 * Inference app (prompt 038), pure: the methods (tests, intervals, χ², regression), their input
 * fields, the call of the kernel and the result rows plus what the plot shows (distribution,
 * critical values, test statistic).
 */
import * as inf from '@aba/math/stats/inference';
import type { Alternative } from '@aba/math/stats/inference';
import { type MathResult, fail, ok } from '@aba/math/result';

export type MethodId =
  | 'z1mean'
  | 'z2mean'
  | 'z1prop'
  | 'z2prop'
  | 't1mean'
  | 't2mean'
  | 'zint1'
  | 'zint2'
  | 'zint1p'
  | 'zint2p'
  | 'tint1'
  | 'tint2'
  | 'chiGof'
  | 'chi2way'
  | 'linT'
  | 'linSlope'
  | 'linMean'
  | 'linPred';

export type Group = 'test' | 'interval' | 'chi' | 'regression';

export type InputKey =
  | 'mu0'
  | 'mean'
  | 'sigma'
  | 's'
  | 'n'
  | 'alpha'
  | 'level'
  | 'mean1'
  | 'sigma1'
  | 's1'
  | 'n1'
  | 'mean2'
  | 'sigma2'
  | 's2'
  | 'n2'
  | 'p0'
  | 'x'
  | 'x1'
  | 'x2'
  | 'obs'
  | 'exp'
  | 'xs'
  | 'ys'
  | 'beta0'
  | 'x0';

/** A numeric input (key, label) or a list/matrix slot chosen by number 0–9. */
export interface Field {
  key: InputKey;
  label: string;
  /** 'list' / 'matrix': the value is the slot digit (L1…L0 / M1…M0) */
  slot?: 'list' | 'matrix';
}

export interface Method {
  id: MethodId;
  group: Group;
  fields: Field[];
  /** alternative hypothesis applies */
  alternative?: boolean;
  /** pooled / Welch choice */
  pooled?: boolean;
  /** mean summary can be imported from a data column (1 or 2 samples) */
  imports?: 1 | 2;
}

const F = (key: InputKey, label: string = key): Field => ({ key, label });
const L = (key: InputKey, label: string): Field => ({ key, label, slot: 'list' });

export const METHODS: Method[] = [
  {
    id: 'z1mean',
    group: 'test',
    fields: [F('mu0', 'μ₀'), F('mean', 'x̄'), F('sigma', 'σ'), F('n'), F('alpha', 'α')],
    alternative: true,
    imports: 1,
  },
  {
    id: 'z2mean',
    group: 'test',
    fields: [
      F('mean1', 'x̄₁'),
      F('sigma1', 'σ₁'),
      F('n1', 'n₁'),
      F('mean2', 'x̄₂'),
      F('sigma2', 'σ₂'),
      F('n2', 'n₂'),
      F('alpha', 'α'),
    ],
    alternative: true,
    imports: 2,
  },
  {
    id: 'z1prop',
    group: 'test',
    fields: [F('p0', 'p₀'), F('x'), F('n'), F('alpha', 'α')],
    alternative: true,
  },
  {
    id: 'z2prop',
    group: 'test',
    fields: [F('x1', 'x₁'), F('n1', 'n₁'), F('x2', 'x₂'), F('n2', 'n₂'), F('alpha', 'α')],
    alternative: true,
  },
  {
    id: 't1mean',
    group: 'test',
    fields: [F('mu0', 'μ₀'), F('mean', 'x̄'), F('s'), F('n'), F('alpha', 'α')],
    alternative: true,
    imports: 1,
  },
  {
    id: 't2mean',
    group: 'test',
    fields: [
      F('mean1', 'x̄₁'),
      F('s1', 's₁'),
      F('n1', 'n₁'),
      F('mean2', 'x̄₂'),
      F('s2', 's₂'),
      F('n2', 'n₂'),
      F('alpha', 'α'),
    ],
    alternative: true,
    pooled: true,
    imports: 2,
  },
  {
    id: 'zint1',
    group: 'interval',
    fields: [F('mean', 'x̄'), F('sigma', 'σ'), F('n'), F('level', 'C')],
    imports: 1,
  },
  {
    id: 'zint2',
    group: 'interval',
    fields: [
      F('mean1', 'x̄₁'),
      F('sigma1', 'σ₁'),
      F('n1', 'n₁'),
      F('mean2', 'x̄₂'),
      F('sigma2', 'σ₂'),
      F('n2', 'n₂'),
      F('level', 'C'),
    ],
    imports: 2,
  },
  { id: 'zint1p', group: 'interval', fields: [F('x'), F('n'), F('level', 'C')] },
  {
    id: 'zint2p',
    group: 'interval',
    fields: [F('x1', 'x₁'), F('n1', 'n₁'), F('x2', 'x₂'), F('n2', 'n₂'), F('level', 'C')],
  },
  {
    id: 'tint1',
    group: 'interval',
    fields: [F('mean', 'x̄'), F('s'), F('n'), F('level', 'C')],
    imports: 1,
  },
  {
    id: 'tint2',
    group: 'interval',
    fields: [
      F('mean1', 'x̄₁'),
      F('s1', 's₁'),
      F('n1', 'n₁'),
      F('mean2', 'x̄₂'),
      F('s2', 's₂'),
      F('n2', 'n₂'),
      F('level', 'C'),
    ],
    pooled: true,
    imports: 2,
  },
  {
    id: 'chiGof',
    group: 'chi',
    fields: [L('obs', 'observed'), L('exp', 'expected / probabilities'), F('alpha', 'α')],
  },
  {
    id: 'chi2way',
    group: 'chi',
    fields: [{ key: 'obs', label: 'observed', slot: 'matrix' }, F('alpha', 'α')],
  },
  {
    id: 'linT',
    group: 'regression',
    fields: [L('xs', 'X'), L('ys', 'Y'), F('beta0', 'β₀'), F('alpha', 'α')],
    alternative: true,
  },
  {
    id: 'linSlope',
    group: 'regression',
    fields: [L('xs', 'X'), L('ys', 'Y'), F('level', 'C')],
  },
  {
    id: 'linMean',
    group: 'regression',
    fields: [L('xs', 'X'), L('ys', 'Y'), F('x0', 'X₀'), F('level', 'C')],
  },
  {
    id: 'linPred',
    group: 'regression',
    fields: [L('xs', 'X'), L('ys', 'Y'), F('x0', 'X₀'), F('level', 'C')],
  },
];

export const methodOf = (id: MethodId) => METHODS.find((m) => m.id === id) ?? METHODS[0];

export interface InferenceState {
  method: MethodId;
  alternative: Alternative;
  pooled: boolean;
  /** inputs by key (shared between methods, e.g. α, n) */
  inputs: Record<InputKey, number>;
}

export function initInference(): InferenceState {
  return {
    method: 't1mean',
    alternative: '≠',
    pooled: false,
    inputs: {
      mu0: 0,
      mean: 0,
      sigma: 1,
      s: 1,
      n: 10,
      alpha: 0.05,
      level: 0.95,
      mean1: 0,
      sigma1: 1,
      s1: 1,
      n1: 10,
      mean2: 0,
      sigma2: 1,
      s2: 1,
      n2: 10,
      p0: 0.5,
      x: 5,
      x1: 5,
      x2: 5,
      obs: 1,
      exp: 2,
      xs: 1,
      ys: 2,
      beta0: 0,
      x0: 0,
    },
  };
}

/** Data the app gets from the home view: lists L0–L9 and matrices M0–M9 by slot digit. */
export interface DataSource {
  list(slot: number): number[] | null;
  matrix(slot: number): number[][] | null;
}

export const slotName = (kind: 'list' | 'matrix', d: number) =>
  `${kind === 'list' ? 'L' : 'M'}${d}`;

export interface ResultRow {
  name: string;
  value: number | string | null;
}

/** What the plot shows: a density, shaded critical region(s) or the central interval. */
export interface InferencePlot {
  dist: 'normal' | 't' | 'chi2';
  df: number | null;
  statistic: number | null;
  /** test: critical values of the statistic; interval: ±critical (standardised) */
  critical: readonly number[];
  alternative: Alternative | 'chi' | 'central';
}

export interface InferenceResult {
  rows: ResultRow[];
  plot: InferencePlot;
}

const testRows = (r: inf.TestResult, name: string): ResultRow[] => [
  { name: 'Result', value: r.reject ? '@reject' : '@keep' },
  { name, value: r.statistic },
  { name: 'P', value: r.pValue },
  ...(r.df !== null ? [{ name: 'df', value: r.df }] : []),
  ...r.critical.map((c, k) => ({
    name: r.critical.length > 1 ? `crit ${k + 1}` : 'crit',
    value: c,
  })),
  { name: 'estimate', value: r.estimate },
  { name: 'SE', value: r.standardError },
];

const intervalRows = (r: inf.IntervalResult): ResultRow[] => [
  { name: 'lower', value: r.lower },
  { name: 'upper', value: r.upper },
  { name: 'estimate', value: r.estimate },
  { name: 'margin', value: r.margin },
  { name: 'crit', value: r.critical },
  ...(r.df !== null ? [{ name: 'df', value: r.df }] : []),
  { name: 'SE', value: r.standardError },
];

const testPlot = (r: inf.TestResult, dist: 'normal' | 't'): InferencePlot => ({
  dist,
  df: r.df,
  statistic: r.statistic,
  critical: r.critical,
  alternative: r.alternative,
});

const intervalPlot = (r: inf.IntervalResult, dist: 'normal' | 't'): InferencePlot => ({
  dist,
  df: r.df,
  statistic: null,
  critical: [-r.critical, r.critical],
  alternative: 'central',
});

/** Runs the method on the inputs. */
export function runInference(s: InferenceState, data: DataSource): MathResult<InferenceResult> {
  const m = methodOf(s.method);
  const v = s.inputs;
  const alt = s.alternative;
  const list = (key: InputKey): MathResult<number[]> => {
    const l = data.list(v[key]);
    return l && l.length ? ok(l) : fail('domain', `${slotName('list', v[key])} is empty`);
  };
  const test = (r: MathResult<inf.TestResult>, name: string, dist: 'normal' | 't') =>
    r.ok ? ok({ rows: testRows(r.value, name), plot: testPlot(r.value, dist) }) : r;
  const interval = (r: MathResult<inf.IntervalResult>, dist: 'normal' | 't') =>
    r.ok ? ok({ rows: intervalRows(r.value), plot: intervalPlot(r.value, dist) }) : r;
  switch (m.id) {
    case 'z1mean':
      return test(
        inf.zTestMean({
          mean: v.mean,
          sigma: v.sigma,
          n: v.n,
          mu0: v.mu0,
          alternative: alt,
          alpha: v.alpha,
        }),
        'Z',
        'normal',
      );
    case 'z2mean':
      return test(
        inf.zTestTwoMeans({
          mean1: v.mean1,
          sigma1: v.sigma1,
          n1: v.n1,
          mean2: v.mean2,
          sigma2: v.sigma2,
          n2: v.n2,
          alternative: alt,
          alpha: v.alpha,
        }),
        'Z',
        'normal',
      );
    case 'z1prop':
      return test(
        inf.zTestProportion({ x: v.x, n: v.n, p0: v.p0, alternative: alt, alpha: v.alpha }),
        'Z',
        'normal',
      );
    case 'z2prop':
      return test(
        inf.zTestTwoProportions({
          x1: v.x1,
          n1: v.n1,
          x2: v.x2,
          n2: v.n2,
          alternative: alt,
          alpha: v.alpha,
        }),
        'Z',
        'normal',
      );
    case 't1mean':
      return test(
        inf.tTestMean({
          mean: v.mean,
          s: v.s,
          n: v.n,
          mu0: v.mu0,
          alternative: alt,
          alpha: v.alpha,
        }),
        'T',
        't',
      );
    case 't2mean':
      return test(
        inf.tTestTwoMeans({
          mean1: v.mean1,
          s1: v.s1,
          n1: v.n1,
          mean2: v.mean2,
          s2: v.s2,
          n2: v.n2,
          pooled: s.pooled,
          alternative: alt,
          alpha: v.alpha,
        }),
        'T',
        't',
      );
    case 'zint1':
      return interval(
        inf.zIntervalMean({ mean: v.mean, sigma: v.sigma, n: v.n, level: v.level }),
        'normal',
      );
    case 'zint2':
      return interval(
        inf.zIntervalTwoMeans({
          mean1: v.mean1,
          sigma1: v.sigma1,
          n1: v.n1,
          mean2: v.mean2,
          sigma2: v.sigma2,
          n2: v.n2,
          level: v.level,
        }),
        'normal',
      );
    case 'zint1p':
      return interval(inf.zIntervalProportion({ x: v.x, n: v.n, level: v.level }), 'normal');
    case 'zint2p':
      return interval(
        inf.zIntervalTwoProportions({ x1: v.x1, n1: v.n1, x2: v.x2, n2: v.n2, level: v.level }),
        'normal',
      );
    case 'tint1':
      return interval(inf.tIntervalMean({ mean: v.mean, s: v.s, n: v.n, level: v.level }), 't');
    case 'tint2':
      return interval(
        inf.tIntervalTwoMeans({
          mean1: v.mean1,
          s1: v.s1,
          n1: v.n1,
          mean2: v.mean2,
          s2: v.s2,
          n2: v.n2,
          pooled: s.pooled,
          level: v.level,
        }),
        't',
      );
    case 'chiGof':
    case 'chi2way': {
      let r: MathResult<inf.ChiSquareResult>;
      if (m.id === 'chiGof') {
        const o = list('obs');
        if (!o.ok) return o;
        const e = list('exp');
        if (!e.ok) return e;
        // expected counts, or probabilities when they add up to 1
        const sum = e.value.reduce((a, b) => a + b, 0);
        r = inf.chiSquareGoodnessOfFit({
          observed: o.value,
          ...(Math.abs(sum - 1) < 1e-9 ? { probabilities: e.value } : { expected: e.value }),
          alpha: v.alpha,
        });
      } else {
        const mtx = data.matrix(v.obs);
        if (!mtx) return fail('domain', `${slotName('matrix', v.obs)} is empty`);
        r = inf.chiSquareTwoWay({ observed: mtx, alpha: v.alpha });
      }
      if (!r.ok) return r;
      const c = r.value;
      return ok({
        rows: [
          { name: 'Result', value: c.reject ? '@reject' : '@keep' },
          { name: 'χ²', value: c.statistic },
          { name: 'P', value: c.pValue },
          { name: 'df', value: c.df },
          { name: 'crit', value: c.critical },
        ],
        plot: {
          dist: 'chi2',
          df: c.df,
          statistic: c.statistic,
          critical: [c.critical],
          alternative: 'chi',
        },
      });
    }
    case 'linT':
    case 'linSlope':
    case 'linMean':
    case 'linPred': {
      const x = list('xs');
      if (!x.ok) return x;
      const y = list('ys');
      if (!y.ok) return y;
      if (m.id === 'linT') {
        const r = inf.linRegTTest({
          x: x.value,
          y: y.value,
          beta0: v.beta0,
          alternative: alt,
          alpha: v.alpha,
        });
        return test(r, 'T', 't');
      }
      const p = { x: x.value, y: y.value, level: v.level };
      const r =
        m.id === 'linSlope'
          ? inf.linRegSlopeInterval(p)
          : m.id === 'linMean'
            ? inf.linRegMeanInterval({ ...p, x0: v.x0 })
            : inf.linRegPredictionInterval({ ...p, x0: v.x0 });
      return interval(r, 't');
    }
  }
}

/** x̄, s and n of a data column (the import from Statistics 1Var). */
export function importSummary(data: readonly number[]): MathResult<inf.MeanSummary> {
  return inf.summarize(data);
}
