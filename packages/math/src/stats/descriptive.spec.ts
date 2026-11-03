import { describe, expect, it } from 'vitest';
import type { MathResult } from '../result';
import { boxPlot, defaultHistogram, histogram, oneVar, sum, twoVar } from './descriptive';

const val = <T>(r: MathResult<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
};

describe('oneVar', () => {
  it('textbook data set: mean 5, σ = 2', () => {
    const s = val(oneVar([2, 4, 4, 4, 5, 5, 7, 9]));
    expect(s.n).toBe(8);
    expect(s.mean).toBe(5);
    expect(s.sum).toBe(40);
    expect(s.sumSquares).toBe(232);
    expect(s.sigma).toBe(2);
    expect(s.s).toBeCloseTo(Math.sqrt(32 / 7), 15);
    expect(s.variance).toBeCloseTo(32 / 7, 15);
    expect(s.serr).toBeCloseTo(Math.sqrt(32 / 7) / Math.sqrt(8), 15);
    expect([s.min, s.max, s.range]).toEqual([2, 9, 7]);
  });

  // Wikipedia "Quartile", Method 1 (TI-83 1-Var Stats): the median is excluded from both halves.
  it('quartiles – odd n (Wikipedia example 1)', () => {
    const s = val(oneVar([6, 7, 15, 36, 39, 40, 41, 42, 43, 47, 49]));
    expect([s.q1, s.median, s.q3]).toEqual([15, 40, 43]);
    expect(s.iqr).toBe(28);
  });
  it('quartiles – even n (Wikipedia example 2)', () => {
    const s = val(oneVar([7, 15, 36, 39, 40, 41]));
    expect([s.q1, s.median, s.q3]).toEqual([15, 37.5, 40]);
  });
  it('quartiles – unsorted input and small n', () => {
    expect(val(oneVar([9, 1, 8, 2, 7, 3, 6, 4, 5])).q1).toBe(2.5);
    expect(val(oneVar([9, 1, 8, 2, 7, 3, 6, 4, 5])).q3).toBe(7.5);
    const two = val(oneVar([3, 1]));
    expect([two.q1, two.median, two.q3]).toEqual([1, 2, 3]);
    const three = val(oneVar([1, 2, 3]));
    expect([three.q1, three.median, three.q3]).toEqual([1, 2, 3]);
  });
  it('frequencies equal the expanded list', () => {
    const a = val(oneVar([1, 2, 3, 10], [2, 0, 3, 1]));
    const b = val(oneVar([1, 1, 3, 3, 3, 10]));
    expect(a).toEqual(b);
  });
  it('n = 1: undefined sample quantities are null', () => {
    const s = val(oneVar([4.5]));
    expect(s.s).toBeNull();
    expect(s.variance).toBeNull();
    expect(s.serr).toBeNull();
    expect(s.sigma).toBe(0);
    expect([s.q1, s.median, s.q3]).toEqual([4.5, 4.5, 4.5]);
  });
  it('constant data and large offsets are numerically stable', () => {
    expect(val(oneVar([0.1, 0.1, 0.1])).sigma).toBe(0);
    const s = val(oneVar([1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16]));
    expect(s.variance).toBeCloseTo(30, 9);
    expect(s.mean).toBe(1e9 + 10);
  });
  it('rejects invalid input with a domain error', () => {
    for (const r of [
      oneVar([]),
      oneVar([1, NaN]),
      oneVar([1, Infinity]),
      oneVar([1, 2], [1]),
      oneVar([1, 2], [1, -1]),
      oneVar([1, 2], [1, 0.5]),
      oneVar([1, 2], [0, 0]),
    ]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('domain');
    }
  });
  it('compensated sum', () => {
    expect(sum([1e16, 1, -1e16])).toBe(1);
    expect(sum(new Array(10).fill(0.1))).toBe(1);
  });
});

describe('twoVar', () => {
  it('sums, covariances and r (hand-computed)', () => {
    // Sxx = 10, Syy = 6, Sxy = 6
    const s = val(twoVar([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]));
    expect([s.sumX, s.sumY, s.sumXY, s.sumX2, s.sumY2]).toEqual([15, 20, 66, 55, 86]);
    expect([s.sxx, s.syy, s.sxy]).toEqual([10, 6, 6]);
    expect(s.covariance).toBeCloseTo(1.5, 15);
    expect(s.populationCovariance).toBeCloseTo(1.2, 15);
    expect(s.r).toBeCloseTo(6 / Math.sqrt(60), 15);
    expect(s.sx).toBeCloseTo(Math.sqrt(2.5), 15);
    expect(s.sigmaY).toBeCloseTo(Math.sqrt(1.2), 15);
  });
  it('Anscombe quartet I: r = 0.816', () => {
    const x = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
    const y = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];
    const s = val(twoVar(x, y));
    expect(s.meanX).toBe(9);
    expect(s.meanY).toBeCloseTo(7.500909090909091, 14);
    expect(s.r).toBeCloseTo(0.81642051634484, 12);
  });
  it('constant x gives r = null; mismatched lengths fail', () => {
    expect(val(twoVar([2, 2, 2], [1, 2, 3])).r).toBeNull();
    expect(twoVar([1, 2], [1]).ok).toBe(false);
  });
});

describe('histogram and box plot', () => {
  it('counts classes [lo, hi) with frequencies', () => {
    const h = val(histogram([1, 2, 2.5, 3, 5, -1], 0, 2, [1, 1, 2, 1, 1, 1]));
    expect(h.classes.map((c) => c.count)).toEqual([1, 4, 1]);
    expect(h.classes[2]).toEqual({ lower: 4, upper: 6, count: 1 });
    expect(h.below).toBe(1);
    expect(histogram([1], 0, 0).ok).toBe(false);
    expect(histogram([1e9], 0, 1e-3).ok).toBe(false);
  });
  it('default classes (Sturges, 1-2-5 width)', () => {
    const d = val(defaultHistogram([3, 7, 12, 18, 25, 31, 40, 44]));
    // n = 8 → 4 classes, raw width 41/4 = 10.25 → 20
    expect(d).toEqual({ start: 0, width: 20 });
    expect(val(defaultHistogram([5, 5])).width).toBe(1);
  });
  it('five-number summary with 1.5·IQR outliers', () => {
    const b = val(boxPlot([1, 2, 3, 4, 5, 6, 7, 8, 9, 30]));
    // halves 1..5 and 6..30 → Q1 = 3, Q3 = 8, IQR 5 → fences −4.5 and 15.5
    expect([b.q1, b.median, b.q3]).toEqual([3, 5.5, 8]);
    expect([b.lowerFence, b.upperFence]).toEqual([-4.5, 15.5]);
    expect(b.outliers).toEqual([30]);
    expect([b.lowerWhisker, b.upperWhisker]).toEqual([1, 9]);
    expect(b.max).toBe(30);
  });
});
