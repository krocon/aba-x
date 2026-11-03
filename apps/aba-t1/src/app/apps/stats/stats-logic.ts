/**
 * Statistics 1 Var and 2 Var (prompt 037), pure: app state, the data of an analysis (column with
 * an optional frequency column) and the geometry of every chart type – rectangles, lines, dots and
 * wedges in world coordinates plus the trace points. Drawing happens in the views.
 */
import { boxPlot, defaultHistogram, histogram, oneVar, twoVar } from '@aba/math/stats/descriptive';
import { normal } from '@aba/math/stats/distributions';
import {
  type RegressionFit,
  type RegressionModel,
  fitRegression,
} from '@aba/math/stats/regression';
import type { Viewport } from '@aba/math/graph/viewport';
import { type MathResult, fail, ok } from '@aba/math/result';
import { DEFAULT_PLOT, FN_COLORS, type PlotOptions } from '../function/function-logic';

export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export type Plot1 =
  | 'histogram'
  | 'box'
  | 'normal'
  | 'line'
  | 'bar'
  | 'pareto'
  | 'control'
  | 'dot'
  | 'stemleaf'
  | 'pie';

export const PLOTS_1: Plot1[] = [
  'histogram',
  'box',
  'normal',
  'line',
  'bar',
  'pareto',
  'control',
  'dot',
  'stemleaf',
  'pie',
];

export const FITS: RegressionModel[] = [
  'linear',
  'logarithmic',
  'exponential',
  'power',
  'exponent',
  'inverse',
  'logistic',
  'quadratic',
  'cubic',
  'quartic',
  'trigonometric',
];

export interface Analysis1 {
  /** data column 0–9 (D1…D0), −1 = off */
  data: number;
  /** frequency column 0–9, −1 = every value once */
  freq: number;
  plot: Plot1;
}

export interface Analysis2 {
  /** X column 0–9 (C1…C0), −1 = off */
  x: number;
  y: number;
  fit: RegressionModel;
}

export interface StatsState<A> {
  /** ten data columns (D1…D0 or C1…C0) */
  cols: number[][];
  analyses: A[];
  view: Viewport;
  /** histogram classes; null = automatic */
  hist: { start: number; width: number } | null;
  plot: PlotOptions;
  /** the plot view follows the data (Autoscale) until the user zooms or pans */
  auto?: boolean;
}

export type Stats1State = StatsState<Analysis1>;
export type Stats2State = StatsState<Analysis2>;

const emptyCols = () => DIGITS.map(() => [] as number[]);

export function initStats1(): Stats1State {
  return {
    cols: emptyCols(),
    analyses: [
      { data: 0, freq: -1, plot: 'histogram' },
      ...[1, 2, 3, 4].map((): Analysis1 => ({ data: -1, freq: -1, plot: 'box' })),
    ],
    view: { xmin: -1, xmax: 10, ymin: -1, ymax: 10 },
    hist: null,
    plot: DEFAULT_PLOT,
  };
}

export function initStats2(): Stats2State {
  return {
    cols: emptyCols(),
    analyses: [
      { x: 0, y: 1, fit: 'linear' },
      ...[1, 2, 3, 4].map(() => ({ x: -1, y: 1, fit: 'linear' as RegressionModel })),
    ],
    view: { xmin: -1, xmax: 10, ymin: -1, ymax: 10 },
    hist: null,
    plot: DEFAULT_PLOT,
  };
}

export const analysisColor = (i: number) => FN_COLORS[i];

/** Data of a 1-Var analysis: the column, cut to the frequency column's length if there is one. */
export function data1(s: Stats1State, a: Analysis1): MathResult<{ x: number[]; f?: number[] }> {
  if (a.data < 0) return fail('domain', 'no data column');
  const x = s.cols[a.data] ?? [];
  if (!x.length) return fail('domain', `D${DIGITS[a.data]} is empty`);
  if (a.freq < 0) return ok({ x });
  const f = s.cols[a.freq] ?? [];
  if (f.length !== x.length)
    return fail('domain', `D${DIGITS[a.data]} and D${DIGITS[a.freq]} differ in length`);
  return ok({ x, f });
}

/** Data of a 2-Var analysis: pairs of the two columns (the shorter length counts). */
export function data2(s: Stats2State, a: Analysis2): MathResult<{ x: number[]; y: number[] }> {
  if (a.x < 0 || a.y < 0) return fail('domain', 'no data columns');
  const xs = s.cols[a.x] ?? [];
  const ys = s.cols[a.y] ?? [];
  if (xs.length !== ys.length)
    return fail('domain', `C${DIGITS[a.x]} and C${DIGITS[a.y]} differ in length`);
  if (!xs.length) return fail('domain', `C${DIGITS[a.x]} is empty`);
  return ok({ x: xs, y: ys });
}

// ---------------------------------------------------------------------------------------------
// chart geometry

export type Prim =
  | { kind: 'rect'; x0: number; y0: number; x1: number; y1: number; color: string }
  | { kind: 'line'; pts: [number, number][]; color: string; dash?: boolean }
  | { kind: 'dot'; x: number; y: number; color: string }
  | { kind: 'wedge'; a0: number; a1: number; color: string; label: string };

export interface TracePoint {
  x: number;
  y: number;
  label: string;
}

export interface Chart {
  prims: Prim[];
  trace: TracePoint[];
  /** extent of the chart in world coordinates (for the automatic view) */
  box: Viewport;
  /** stem-and-leaf lines (text chart) */
  text?: string[];
  /** pie chart: drawn in its own square, without axes */
  pie?: boolean;
}

const fmt = (v: number) => Number(v.toPrecision(6)).toString();

/** The values repeated by their frequencies (for charts that show single values). */
function expand(x: readonly number[], f?: readonly number[]): number[] {
  if (!f) return [...x];
  return x.flatMap((v, i) => Array<number>(Math.max(0, Math.round(f[i]))).fill(v));
}

function extent(prims: Prim[], trace: TracePoint[]): Viewport {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of prims) {
    if (p.kind === 'rect') {
      xs.push(p.x0, p.x1);
      ys.push(p.y0, p.y1);
    }
    if (p.kind === 'line')
      for (const [x, y] of p.pts) {
        xs.push(x);
        ys.push(y);
      }
    if (p.kind === 'dot') {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  for (const t of trace) {
    xs.push(t.x);
    ys.push(t.y);
  }
  const fin = (v: number[]) => v.filter(Number.isFinite);
  const [x, y] = [fin(xs), fin(ys)];
  if (!x.length) return { xmin: -1, xmax: 1, ymin: -1, ymax: 1 };
  return {
    xmin: Math.min(...x),
    xmax: Math.max(...x),
    ymin: Math.min(...y),
    ymax: Math.max(...y),
  };
}

/**
 * One 1-Var chart. `band` places box plots of several analyses one above the other; `hist` are
 * the histogram classes (null = automatic).
 */
export function chart1(
  type: Plot1,
  x: readonly number[],
  f: readonly number[] | undefined,
  color: string,
  band: number,
  hist: { start: number; width: number } | null,
): MathResult<Chart> {
  const prims: Prim[] = [];
  const trace: TracePoint[] = [];
  const values = expand(x, f);
  switch (type) {
    case 'histogram': {
      const cls = hist ? ok(hist) : defaultHistogram(x, f);
      if (!cls.ok) return cls;
      const h = histogram(x, cls.value.start, cls.value.width, f);
      if (!h.ok) return h;
      for (const k of h.value.classes) {
        prims.push({ kind: 'rect', x0: k.lower, y0: 0, x1: k.upper, y1: k.count, color });
        trace.push({
          x: (k.lower + k.upper) / 2,
          y: k.count,
          label: `[${fmt(k.lower)}, ${fmt(k.upper)}) n: ${fmt(k.count)}`,
        });
      }
      break;
    }
    case 'box': {
      const b = boxPlot(x, f);
      if (!b.ok) return b;
      const v = b.value;
      const y0 = band * 2 + 0.6;
      const y1 = y0 + 1;
      const mid = (y0 + y1) / 2;
      prims.push({ kind: 'rect', x0: v.q1, y0, x1: v.q3, y1, color });
      prims.push({
        kind: 'line',
        pts: [
          [v.median, y0],
          [v.median, y1],
        ],
        color: '#10201d',
      });
      prims.push({
        kind: 'line',
        pts: [
          [v.lowerWhisker, mid],
          [v.q1, mid],
        ],
        color: '#10201d',
      });
      prims.push({
        kind: 'line',
        pts: [
          [v.q3, mid],
          [v.upperWhisker, mid],
        ],
        color: '#10201d',
      });
      for (const o of v.outliers) prims.push({ kind: 'dot', x: o, y: mid, color });
      const names: [string, number][] = [
        ['Min', v.min],
        ['Q1', v.q1],
        ['Med', v.median],
        ['Q3', v.q3],
        ['Max', v.max],
      ];
      for (const [n, at] of names) trace.push({ x: at, y: mid, label: `${n}: ${fmt(at)}` });
      break;
    }
    case 'normal': {
      // normal probability plot: sorted data against Blom's normal scores
      const N = normal(0, 1);
      if (!N.ok) return N;
      const d = [...values].sort((a, b) => a - b);
      const n = d.length;
      d.forEach((v, i) => {
        const z = N.value.inv((i + 1 - 0.375) / (n + 0.25));
        if (!z.ok) return;
        prims.push({ kind: 'dot', x: v, y: z.value, color });
        trace.push({ x: v, y: z.value, label: `X: ${fmt(v)} Z: ${fmt(z.value)}` });
      });
      break;
    }
    case 'line':
    case 'control': {
      const pts = values.map((v, i) => [i + 1, v] as [number, number]);
      prims.push({ kind: 'line', pts, color });
      for (const [i, v] of pts) {
        prims.push({ kind: 'dot', x: i, y: v, color });
        trace.push({ x: i, y: v, label: `${i}: ${fmt(v)}` });
      }
      if (type === 'control') {
        const s = oneVar(values);
        if (!s.ok) return s;
        const { mean, sigma } = s.value;
        const n = values.length;
        const h = (y: number, dash: boolean): Prim => ({
          kind: 'line',
          pts: [
            [1, y],
            [n, y],
          ],
          color: '#5a6c67',
          dash,
        });
        prims.push(h(mean, false), h(mean + 3 * sigma, true), h(mean - 3 * sigma, true));
      }
      break;
    }
    case 'bar':
    case 'pareto': {
      let bars = values.map((v, i) => ({ k: i + 1, v }));
      if (type === 'pareto') {
        if (values.some((v) => v < 0)) return fail('domain', 'a Pareto chart needs values ≥ 0');
        const total = values.reduce((a, b) => a + b, 0);
        if (!(total > 0)) return fail('domain', 'a Pareto chart needs a positive total');
        bars = bars.sort((a, b) => b.v - a.v).map((b) => ({ k: b.k, v: (100 * b.v) / total }));
        const cum: [number, number][] = [];
        let acc = 0;
        bars.forEach((b, i) => cum.push([i + 1, (acc += b.v)]));
        prims.push({ kind: 'line', pts: cum, color: '#10201d' });
      }
      bars.forEach((b, i) => {
        const at = type === 'pareto' ? i + 1 : b.k;
        prims.push({ kind: 'rect', x0: at - 0.4, y0: 0, x1: at + 0.4, y1: b.v, color });
        const unit = type === 'pareto' ? ' %' : '';
        trace.push({ x: at, y: b.v, label: `${b.k}: ${fmt(b.v)}${unit}` });
      });
      break;
    }
    case 'dot': {
      const count = new Map<number, number>();
      for (const v of [...values].sort((a, b) => a - b)) {
        const c = (count.get(v) ?? 0) + 1;
        count.set(v, c);
        prims.push({ kind: 'dot', x: v, y: c, color });
      }
      for (const [v, c] of count) trace.push({ x: v, y: c, label: `${fmt(v)}: ${c}×` });
      break;
    }
    case 'stemleaf': {
      const text = stemLeaf(values);
      if (!text.ok) return text;
      return ok({ prims, trace, box: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, text: text.value });
    }
    case 'pie': {
      if (values.some((v) => v < 0)) return fail('domain', 'a pie chart needs values ≥ 0');
      const total = values.reduce((a, b) => a + b, 0);
      if (!(total > 0)) return fail('domain', 'a pie chart needs a positive total');
      let a = 0;
      values.forEach((v, i) => {
        const a1 = a + (2 * Math.PI * v) / total;
        const pct = (100 * v) / total;
        prims.push({
          kind: 'wedge',
          a0: a,
          a1,
          color: FN_COLORS[i % FN_COLORS.length],
          label: `${fmt(pct)} %`,
        });
        const mid = (a + a1) / 2;
        trace.push({
          x: 0.6 * Math.cos(mid),
          y: 0.6 * Math.sin(mid),
          label: `${i + 1}: ${fmt(v)} (${fmt(pct)} %)`,
        });
        a = a1;
      });
      return ok({ prims, trace, box: { xmin: -1.2, xmax: 1.2, ymin: -1.2, ymax: 1.2 }, pie: true });
    }
  }
  return ok({ prims, trace, box: extent(prims, trace) });
}

/**
 * Stem-and-leaf lines: the leaf is the last significant digit at the scale of the data (the
 * stem unit is chosen so there are at most about 20 stems).
 */
export function stemLeaf(values: readonly number[]): MathResult<string[]> {
  if (!values.length) return fail('domain', 'there are no data');
  const d = [...values].sort((a, b) => a - b);
  const span = d[d.length - 1] - d[0];
  // stem unit: a power of ten giving at most about 20 stems; leaves are its tenths
  const unit = Math.pow(10, Math.ceil(Math.log10(Math.max(span, 1e-9) / 20)));
  const leafUnit = unit / 10;
  const rows = new Map<number, number[]>();
  for (const v of d) {
    const scaled = Math.round(v / leafUnit);
    const stem = Math.floor(scaled / 10);
    const leaf = scaled - stem * 10;
    rows.set(stem, [...(rows.get(stem) ?? []), leaf]);
  }
  const stems = [...rows.keys()];
  const from = Math.min(...stems);
  const to = Math.max(...stems);
  if (to - from > 200) return fail('domain', 'too many stems');
  const out: string[] = [];
  for (let s = from; s <= to; s++) out.push(`${s} | ${(rows.get(s) ?? []).join(' ')}`);
  const first = Math.round(d[0] / leafUnit);
  const s0 = Math.floor(first / 10);
  out.push(`${s0} | ${first - s0 * 10} = ${fmt(first * leafUnit)}`);
  return ok(out);
}

/** Automatic view around charts with a margin. */
export function autoView(boxes: Viewport[], withZero = false): Viewport {
  if (!boxes.length) return { xmin: -1, xmax: 10, ymin: -1, ymax: 10 };
  let xmin = Math.min(...boxes.map((b) => b.xmin));
  let xmax = Math.max(...boxes.map((b) => b.xmax));
  let ymin = Math.min(...boxes.map((b) => b.ymin));
  let ymax = Math.max(...boxes.map((b) => b.ymax));
  if (withZero) ymin = Math.min(ymin, 0);
  if (xmax - xmin < 1e-9) {
    xmin -= 1;
    xmax += 1;
  }
  if (ymax - ymin < 1e-9) {
    ymin -= 1;
    ymax += 1;
  }
  const mx = (xmax - xmin) * 0.08;
  const my = (ymax - ymin) * 0.12;
  return { xmin: xmin - mx, xmax: xmax + mx, ymin: ymin - my, ymax: ymax + my };
}

// ---------------------------------------------------------------------------------------------
// statistics tables

export interface StatRow {
  name: string;
  value: number | null;
}

/** The 1-Var statistics of an analysis as named rows. */
export function stats1Rows(x: readonly number[], f?: readonly number[]): MathResult<StatRow[]> {
  const s = oneVar(x, f);
  if (!s.ok) return s;
  const v = s.value;
  return ok([
    { name: 'n', value: v.n },
    { name: 'Min', value: v.min },
    { name: 'Q1', value: v.q1 },
    { name: 'Med', value: v.median },
    { name: 'Q3', value: v.q3 },
    { name: 'Max', value: v.max },
    { name: 'ΣX', value: v.sum },
    { name: 'ΣX²', value: v.sumSquares },
    { name: 'x̄', value: v.mean },
    { name: 'sX', value: v.s },
    { name: 'σX', value: v.sigma },
    { name: 's²', value: v.variance },
    { name: 'σ²', value: v.populationVariance },
    { name: 'serr', value: v.serr },
  ]);
}

/** Fit and 2-Var statistics of an analysis. */
export function fit2(x: readonly number[], y: readonly number[], model: RegressionModel) {
  return fitRegression(model, x, y);
}

export function stats2Rows(
  x: readonly number[],
  y: readonly number[],
  fit: MathResult<RegressionFit>,
): MathResult<StatRow[]> {
  const s = twoVar(x, y);
  if (!s.ok) return s;
  const v = s.value;
  return ok([
    { name: 'n', value: v.n },
    { name: 'r', value: fit.ok && fit.value.r !== null ? fit.value.r : v.r },
    { name: 'R²', value: fit.ok ? fit.value.r2 : null },
    { name: 'sCov', value: v.covariance },
    { name: 'σCov', value: v.populationCovariance },
    { name: 'ΣXY', value: v.sumXY },
    { name: 'x̄', value: v.meanX },
    { name: 'ΣX', value: v.sumX },
    { name: 'ΣX²', value: v.sumX2 },
    { name: 'sX', value: v.sx },
    { name: 'σX', value: v.sigmaX },
    { name: 'ȳ', value: v.meanY },
    { name: 'ΣY', value: v.sumY },
    { name: 'ΣY²', value: v.sumY2 },
    { name: 'sY', value: v.sy },
    { name: 'σY', value: v.sigmaY },
  ]);
}

/** Samples a fitted curve across the view (gaps where it is undefined). */
export function fitCurve(fit: RegressionFit, view: Viewport, n = 240): [number, number][][] {
  const lines: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = view.xmin + ((view.xmax - view.xmin) * i) / n;
    const y = fit.f(x);
    if (Number.isFinite(y)) cur.push([x, y]);
    else if (cur.length) {
      lines.push(cur);
      cur = [];
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}
