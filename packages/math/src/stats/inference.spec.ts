import { describe, expect, it } from 'vitest';
import type { MathResult } from '../result';
import {
  chiSquareGoodnessOfFit,
  chiSquareTwoWay,
  linRegMeanInterval,
  linRegPredictionInterval,
  linRegSlopeInterval,
  linRegTTest,
  summarize,
  tIntervalMean,
  tIntervalTwoMeans,
  tTestMean,
  tTestTwoMeans,
  zIntervalMean,
  zIntervalProportion,
  zIntervalTwoMeans,
  zIntervalTwoProportions,
  zTestMean,
  zTestProportion,
  zTestTwoMeans,
  zTestTwoProportions,
} from './inference';

const val = <T>(r: MathResult<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
};
const rel = (got: number, want: number) => Math.abs(got - want) / Math.abs(want);

// Expected values: hand formulas evaluated in 40-digit arithmetic (mpmath), cross-checked with
// printed tables (z* = 1.96, t*(15) = 2.131, χ²(3; 0.05) = 7.815) and published examples
// (Mendel's peas χ² = 0.470, p = 0.925; Anscombe I slope t = 4.24, p = 0.00217).
const ANS_X = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
const ANS_Y = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];

describe('Z procedures', () => {
  it('one mean: z = 2, two-sided p = 2(1 − Φ(2))', () => {
    const r = val(
      zTestMean({ mean: 105, sigma: 15, n: 36, mu0: 100, alternative: '≠', alpha: 0.05 }),
    );
    expect(r.statistic).toBeCloseTo(2, 14);
    expect(rel(r.pValue, 0.04550026389635842)).toBeLessThan(1e-12);
    expect(r.critical[0]).toBeCloseTo(-1.9599639845400543, 12);
    expect(r.critical[1]).toBeCloseTo(1.9599639845400543, 12);
    expect(r.reject).toBe(true);
    expect(r.df).toBeNull();
    const less = val(
      zTestMean({ mean: 105, sigma: 15, n: 36, mu0: 100, alternative: '<', alpha: 0.05 }),
    );
    expect(less.pValue).toBeCloseTo(0.9772498680518208, 14);
    expect(less.critical[0]).toBeCloseTo(-1.6448536269514726, 12);
    expect(less.reject).toBe(false);
  });
  it('two means', () => {
    // se = √(4²/16 + 3²/9) = √2, z = (12 − 10)/√2
    const r = val(
      zTestTwoMeans({
        mean1: 12,
        sigma1: 4,
        n1: 16,
        mean2: 10,
        sigma2: 3,
        n2: 9,
        alternative: '>',
        alpha: 0.05,
      }),
    );
    expect(r.statistic).toBeCloseTo(Math.SQRT2, 14);
    expect(r.standardError).toBeCloseTo(Math.SQRT2, 14);
    expect(rel(r.pValue, 0.078649603525142)).toBeLessThan(1e-11);
  });
  it('one proportion: 520 of 1000 against p₀ = 0.5', () => {
    const r = val(zTestProportion({ x: 520, n: 1000, p0: 0.5, alternative: '≠', alpha: 0.05 }));
    expect(rel(r.statistic, 1.2649110640673518)).toBeLessThan(1e-13);
    expect(rel(r.pValue, 0.2059032107320683)).toBeLessThan(1e-12);
    expect(r.reject).toBe(false);
  });
  it('two proportions (pooled)', () => {
    const r = val(
      zTestTwoProportions({ x1: 45, n1: 100, x2: 30, n2: 90, alternative: '>', alpha: 0.05 }),
    );
    expect(rel(r.statistic, 1.6427266128719291)).toBeLessThan(1e-13);
    expect(rel(r.pValue, 0.05021975498981775)).toBeLessThan(1e-12);
    expect(r.reject).toBe(false);
  });
  it('intervals', () => {
    const z = 1.9599639845400543;
    const m = val(zIntervalMean({ mean: 50, sigma: 10, n: 25, level: 0.95 }));
    expect(m.lower).toBeCloseTo(50 - 2 * z, 12);
    expect(m.upper).toBeCloseTo(50 + 2 * z, 12);
    expect(m.critical).toBeCloseTo(z, 13);
    const p = val(zIntervalProportion({ x: 520, n: 1000, level: 0.95 }));
    const se = Math.sqrt((0.52 * 0.48) / 1000);
    expect(p.lower).toBeCloseTo(0.52 - z * se, 13);
    expect(p.upper).toBeCloseTo(0.52 + z * se, 13);
    const d = val(
      zIntervalTwoMeans({ mean1: 12, sigma1: 4, n1: 16, mean2: 10, sigma2: 3, n2: 9, level: 0.9 }),
    );
    expect(d.margin).toBeCloseTo(1.6448536269514726 * Math.SQRT2, 12);
    const q = val(zIntervalTwoProportions({ x1: 45, n1: 100, x2: 30, n2: 90, level: 0.95 }));
    const se2 = Math.sqrt((0.45 * 0.55) / 100 + ((1 / 3) * (2 / 3)) / 90);
    expect(q.estimate).toBeCloseTo(0.45 - 1 / 3, 14);
    expect(q.margin).toBeCloseTo(z * se2, 13);
  });
});

describe('T procedures', () => {
  it('one mean (right-tailed)', () => {
    const r = val(tTestMean({ mean: 5.2, s: 1.1, n: 16, mu0: 4.8, alternative: '>', alpha: 0.05 }));
    expect(rel(r.statistic, 1.4545454545454546)).toBeLessThan(1e-13);
    expect(r.df).toBe(15);
    expect(rel(r.pValue, 0.0832002181201671)).toBeLessThan(1e-11);
    expect(r.critical[0]).toBeCloseTo(1.7530503556925734, 11);
    expect(r.reject).toBe(false);
  });
  it('two means – Welch and pooled', () => {
    const base = { mean1: 20.1, s1: 3.2, n1: 12, mean2: 17.4, s2: 5.9, n2: 9 };
    const w = val(tTestTwoMeans({ ...base, pooled: false, alternative: '≠', alpha: 0.05 }));
    expect(rel(w.statistic, 1.2426294822370565)).toBeLessThan(1e-13);
    expect(rel(w.df!, 11.511898548653473)).toBeLessThan(1e-13);
    expect(rel(w.pValue, 0.23872070565085932)).toBeLessThan(1e-11);
    const p = val(tTestTwoMeans({ ...base, pooled: true, alternative: '≠', alpha: 0.05 }));
    expect(rel(p.statistic, 1.3495462814680175)).toBeLessThan(1e-13);
    expect(p.df).toBe(19);
    expect(rel(p.pValue, 0.19302352648015605)).toBeLessThan(1e-11);
    expect(rel(p.standardError, 2.000672401588909)).toBeLessThan(1e-13);
    const ci = val(tIntervalTwoMeans({ ...base, pooled: false, level: 0.99 }));
    expect(ci.critical).toBeCloseTo(3.0782701445559435, 10);
  });
  it('one-mean interval with t*(15) = 2.1314', () => {
    const r = val(tIntervalMean({ mean: 20, s: 4, n: 16, level: 0.95 }));
    expect(r.critical).toBeCloseTo(2.1314495455597755, 11);
    expect(r.lower).toBeCloseTo(20 - 2.1314495455597755, 11);
    expect(r.upper).toBeCloseTo(20 + 2.1314495455597755, 11);
    expect(r.df).toBe(15);
  });
  it('summaries from data feed the tests', () => {
    const s = val(summarize([2, 4, 4, 4, 5, 5, 7, 9]));
    expect(s).toEqual({ mean: 5, s: Math.sqrt(32 / 7), n: 8 });
    expect(val(tTestMean({ ...s, mu0: 5, alternative: '≠', alpha: 0.05 })).pValue).toBeCloseTo(
      1,
      14,
    );
    expect(summarize([3]).ok).toBe(false);
  });
});

describe('χ² tests', () => {
  it("goodness of fit – Mendel's peas 9:3:3:1", () => {
    const r = val(
      chiSquareGoodnessOfFit({
        observed: [315, 108, 101, 32],
        probabilities: [9 / 16, 3 / 16, 3 / 16, 1 / 16],
        alpha: 0.05,
      }),
    );
    expect(rel(r.statistic, 0.47002398081534774)).toBeLessThan(1e-13);
    expect(r.df).toBe(3);
    expect(rel(r.pValue, 0.925425895103616)).toBeLessThan(1e-12);
    expect(r.critical).toBeCloseTo(7.81472790325118, 10);
    expect(r.reject).toBe(false);
    expect(r.expected).toEqual([312.75, 104.25, 104.25, 34.75]);
    const same = val(
      chiSquareGoodnessOfFit({
        observed: [315, 108, 101, 32],
        expected: [312.75, 104.25, 104.25, 34.75],
        alpha: 0.05,
      }),
    );
    expect(same.statistic).toBeCloseTo(r.statistic, 14);
  });
  it('two-way table: χ² = 4, df 2, p = e^(−2)', () => {
    const r = val(
      chiSquareTwoWay({
        observed: [
          [20, 30, 25],
          [30, 20, 25],
        ],
        alpha: 0.05,
      }),
    );
    expect(r.statistic).toBeCloseTo(4, 13);
    expect(r.df).toBe(2);
    expect(rel(r.pValue, Math.exp(-2))).toBeLessThan(1e-13);
    expect(r.expected).toEqual([
      [25, 25, 25],
      [25, 25, 25],
    ]);
    expect(r.critical).toBeCloseTo(-2 * Math.log(0.05), 11);
  });
  it('validation', () => {
    expect(
      chiSquareGoodnessOfFit({ observed: [1, 2], probabilities: [0.5, 0.4], alpha: 0.05 }).ok,
    ).toBe(false);
    expect(chiSquareGoodnessOfFit({ observed: [1, 2], expected: [0, 3], alpha: 0.05 }).ok).toBe(
      false,
    );
    expect(chiSquareGoodnessOfFit({ observed: [1, 2], alpha: 0.05 }).ok).toBe(false);
    expect(
      chiSquareTwoWay({
        observed: [
          [1, 2],
          [0, 0],
        ],
        alpha: 0.05,
      }).ok,
    ).toBe(false);
    expect(chiSquareTwoWay({ observed: [[1, 2], [3]], alpha: 0.05 }).ok).toBe(false);
  });
});

describe('linear regression inference (Anscombe I)', () => {
  it('slope t test', () => {
    const r = val(linRegTTest({ x: ANS_X, y: ANS_Y, alternative: '≠', alpha: 0.05 }));
    expect(rel(r.standardError, 0.1179055005956341)).toBeLessThan(1e-12);
    expect(rel(r.statistic, 4.241455288892832)).toBeLessThan(1e-12);
    expect(rel(r.pValue, 0.002169628873078797)).toBeLessThan(1e-10);
    expect(r.df).toBe(9);
    expect(rel(r.regression.s, 1.2366033227263211)).toBeLessThan(1e-12);
    expect(r.reject).toBe(true);
  });
  it('slope, mean-response and prediction intervals at x₀ = 12', () => {
    const s = val(linRegSlopeInterval({ x: ANS_X, y: ANS_Y, level: 0.95 }));
    expect(rel(s.lower, 0.23337013638518733)).toBeLessThan(1e-11);
    expect(rel(s.upper, 0.7668116817966308)).toBeLessThan(1e-11);
    expect(s.critical).toBeCloseTo(2.2621571627982053, 11);
    const m = val(linRegMeanInterval({ x: ANS_X, y: ANS_Y, x0: 12, level: 0.95 }));
    expect(rel(m.lower, 7.838572923814495)).toBeLessThan(1e-12);
    expect(rel(m.upper, 10.16379071254914)).toBeLessThan(1e-12);
    const p = val(linRegPredictionInterval({ x: ANS_X, y: ANS_Y, x0: 12, level: 0.95 }));
    expect(rel(p.lower, 5.971816173948176)).toBeLessThan(1e-12);
    expect(rel(p.upper, 12.03054746241546)).toBeLessThan(1e-12);
  });
  it('degenerate data', () => {
    expect(linRegSlopeInterval({ x: [1, 2], y: [1, 2], level: 0.95 }).ok).toBe(false);
    expect(linRegTTest({ x: [1, 2, 3], y: [2, 4, 6], alternative: '≠', alpha: 0.05 }).ok).toBe(
      false,
    );
    expect(linRegSlopeInterval({ x: [1, 1, 1], y: [1, 2, 3], level: 0.95 }).ok).toBe(false);
  });
});

describe('parameter validation', () => {
  it('rejects bad α, levels, alternatives and counts', () => {
    const results: MathResult<unknown>[] = [
      zTestMean({ mean: 1, sigma: 1, n: 5, mu0: 0, alternative: '≠', alpha: 0 }),
      zTestMean({ mean: 1, sigma: 0, n: 5, mu0: 0, alternative: '≠', alpha: 0.05 }),
      zTestMean({ mean: 1, sigma: 1, n: 5, mu0: 0, alternative: '=' as '≠', alpha: 0.05 }),
      zIntervalMean({ mean: 1, sigma: 1, n: 5, level: 1 }),
      tTestMean({ mean: 1, s: 1, n: 1, mu0: 0, alternative: '<', alpha: 0.05 }),
      tTestMean({ mean: 1, s: 1, n: 2.5, mu0: 0, alternative: '<', alpha: 0.05 }),
      zTestProportion({ x: 11, n: 10, p0: 0.5, alternative: '>', alpha: 0.05 }),
      zTestProportion({ x: 5, n: 10, p0: 1, alternative: '>', alpha: 0.05 }),
      zTestTwoProportions({ x1: 0, n1: 10, x2: 0, n2: 10, alternative: '>', alpha: 0.05 }),
    ];
    for (const r of results) expect(r.ok).toBe(false);
  });
});
