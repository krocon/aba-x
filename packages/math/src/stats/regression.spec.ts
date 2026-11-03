import { describe, expect, it } from 'vitest';
import type { MathResult } from '../result';
import { type RegressionFit, fitRegression, leastSquares, levenbergMarquardt } from './regression';

const val = <T>(r: MathResult<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
};
const rel = (got: number, want: number) => Math.abs(got - want) / Math.max(Math.abs(want), 1e-300);
type Key = 'm' | 'b' | 'a' | 'c' | 'd' | 'e' | 'L';
const coef = (f: RegressionFit) => f.coefficients as Record<Key, number>;

// Reference coefficients: least squares in 60-digit arithmetic (mpmath).
describe('linearizable models', () => {
  it('linear – Anscombe I: y = 3.0001 + 0.5001x, r = 0.8164', () => {
    const x = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
    const y = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];
    const f = val(fitRegression('linear', x, y));
    expect(coef(f).m).toBeCloseTo(0.500090909090909, 13);
    expect(coef(f).b).toBeCloseTo(3.00009090909091, 12);
    expect(f.r).toBeCloseTo(0.81642051634484, 12);
    expect(f.r2).toBeCloseTo(0.81642051634484 ** 2, 12);
    expect(val(f.predict(10))).toBeCloseTo(8.001, 12);
    expect(val(f.predictX!(8.001))).toBeCloseTo(10, 12);
    expect(f.equation).toBe('y = 0.500091·x + 3.00009');
  });
  it('exponential y = b·e^(mx) and exponent y = b·mˣ', () => {
    const x = [0, 1, 2, 3, 4, 5];
    const y = [2.1, 3.4, 5.9, 9.8, 16.5, 27.1];
    const e = val(fitRegression('exponential', x, y));
    expect(rel(coef(e).b, 2.080972846379551)).toBeLessThan(1e-13);
    expect(rel(coef(e).m, 0.5152619085257)).toBeLessThan(1e-13);
    expect(e.r).toBeCloseTo(0.9998918483755568, 13);
    const p = val(fitRegression('exponent', x, y));
    expect(rel(coef(p).m, 1.6740768993976185)).toBeLessThan(1e-13);
    expect(rel(coef(p).b, 2.080972846379551)).toBeLessThan(1e-13);
    expect(val(e.predictX!(val(e.predict(2.5))))).toBeCloseTo(2.5, 12);
    expect(val(p.predictX!(val(p.predict(-1))))).toBeCloseTo(-1, 12);
  });
  it('power y = b·x^m', () => {
    const f = val(fitRegression('power', [1, 2, 3, 4, 5, 6], [2.9, 11.8, 27.5, 47.1, 76.3, 108.4]));
    expect(rel(coef(f).b, 2.911376104674422)).toBeLessThan(1e-13);
    expect(rel(coef(f).m, 2.0227248856973405)).toBeLessThan(1e-13);
    expect(f.r).toBeCloseTo(0.99993611269202, 13);
    expect(val(f.predictX!(val(f.predict(3.3))))).toBeCloseTo(3.3, 12);
  });
  it('logarithmic y = m·ln x + b', () => {
    const f = val(fitRegression('logarithmic', [1, 2, 4, 8, 16], [1.2, 2.9, 4.4, 6.1, 7.8]));
    expect(rel(coef(f).m, 2.3660198670579)).toBeLessThan(1e-12);
    expect(coef(f).b).toBeCloseTo(1.2, 13);
    expect(f.r).toBeCloseTo(0.9997769931211817, 13);
    expect(val(f.predictX!(val(f.predict(5))))).toBeCloseTo(5, 12);
  });
  it('inverse y = m/x + b', () => {
    const f = val(fitRegression('inverse', [0.5, 1, 2, 4, 5], [9.1, 5.2, 3.0, 2.1, 1.75]));
    expect(rel(coef(f).m, 4.062051971326165)).toBeLessThan(1e-13);
    expect(rel(coef(f).b, 1.0209789426523297)).toBeLessThan(1e-13);
    expect(f.r).toBeCloseTo(0.9996010137636746, 13);
    expect(val(f.predictX!(3))).toBeCloseTo(4.062051971326165 / (3 - 1.0209789426523297), 12);
  });
  it('domain errors instead of dropped points', () => {
    const cases: [Parameters<typeof fitRegression>[0], number[], number[]][] = [
      ['logarithmic', [0, 1, 2], [1, 2, 3]],
      ['power', [1, 2, 3], [1, -2, 3]],
      ['power', [-1, 2, 3], [1, 2, 3]],
      ['exponential', [1, 2, 3], [1, 0, 3]],
      ['exponent', [1, 2, 3], [-1, 2, 3]],
      ['inverse', [0, 2, 3], [1, 2, 3]],
      ['linear', [1, 2], [1]],
      ['linear', [1], [1]],
      ['linear', [1, NaN], [1, 2]],
    ];
    for (const [m, x, y] of cases) {
      const r = fitRegression(m, x, y);
      expect(r.ok, m).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('domain');
    }
  });
  it('degenerate data', () => {
    const r = fitRegression('linear', [2, 2, 2], [1, 2, 3]);
    expect(!r.ok && r.error.code).toBe('not-solvable');
    const flat = val(fitRegression('linear', [1, 2, 3], [5, 5, 5]));
    expect(coef(flat).m).toBe(0);
    expect(flat.r).toBeNull();
    expect(flat.r2).toBeNull();
    expect(flat.predictX!(5).ok).toBe(false);
    expect(val(fitRegression('logarithmic', [1, 2], [0, 1])).predict(-1).ok).toBe(false);
  });
});

describe('polynomial models (QR on centered abscissa)', () => {
  it('quadratic on calendar years (ill-conditioned raw Vandermonde)', () => {
    const x = Array.from({ length: 11 }, (_, i) => 2000 + i);
    const y = [3.1, 4.5, 6.2, 8.8, 11.9, 15.7, 20.1, 25.3, 30.8, 37.2, 44.1];
    const f = val(fitRegression('quadratic', x, y));
    expect(rel(coef(f).a, 0.31655011655011656)).toBeLessThan(1e-11);
    expect(rel(coef(f).b, -1265.2677855477855)).toBeLessThan(1e-9);
    expect(rel(coef(f).c, 1264338.244055944)).toBeLessThan(1e-9);
    expect(f.r2).toBeCloseTo(0.999978800700252, 13);
    // prediction stays accurate (evaluated in the centered variable)
    const p = 0.31655011655011656 * 2012.5 ** 2 - 1265.2677855477855 * 2012.5 + 1264338.244055944;
    expect(val(f.predict(2012.5))).toBeCloseTo(p, 6);
  });
  it('cubic and quartic', () => {
    const x = [-3, -2, -1, 0, 1, 2, 3, 4, 5];
    const y = [12.1, 3.2, -0.5, 1.1, 0.9, -2.3, 1.7, 15.8, 48.2];
    const c = val(fitRegression('cubic', x, y));
    const want3 = [0.3528619528619529, 0.9048340548340549, -3.978691678691679, -1.4573593073593074];
    (['a', 'b', 'c', 'd'] as const).forEach((k, i) =>
      expect(rel(coef(c)[k], want3[i])).toBeLessThan(1e-12),
    );
    expect(c.r2).toBeCloseTo(0.9500870820082485, 13);
    const q = val(fitRegression('quartic', x, y));
    const want4 = [
      0.12744755244755246, -0.15692825692825693, -0.42426184926184923, -0.30091945091945094,
      0.5089743589743589,
    ];
    (['a', 'b', 'c', 'd', 'e'] as const).forEach((k, i) =>
      expect(rel(coef(q)[k], want4[i])).toBeLessThan(1e-12),
    );
    expect(q.r2).toBeCloseTo(0.9972718925367027, 13);
  });
  it('exact polynomial data are reproduced', () => {
    const x = [-2, -1, 0, 1, 2, 3];
    const f = val(
      fitRegression(
        'quadratic',
        x,
        x.map((v) => 2 * v * v - 3 * v + 1),
      ),
    );
    expect(coef(f).a).toBeCloseTo(2, 13);
    expect(coef(f).b).toBeCloseTo(-3, 13);
    expect(coef(f).c).toBeCloseTo(1, 13);
    expect(f.r2).toBeCloseTo(1, 14);
    expect(f.equation).toBe('y = 2·x^2 + -3·x + 1');
  });
  it('too few distinct x values', () => {
    const r = fitRegression('cubic', [1, 1, 2, 2, 3], [1, 2, 3, 4, 5]);
    expect(!r.ok && r.error.code).toBe('not-solvable');
    expect(fitRegression('quartic', [1, 2, 3, 4], [1, 2, 3, 4]).ok).toBe(false);
  });
  it('leastSquares solves an overdetermined system', () => {
    const c = val(
      leastSquares(
        [
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        [1, 1, 3],
      ),
    );
    // normal equations [[2,1],[1,2]] c = [4,4] → c = (4/3, 4/3)
    expect(c[0]).toBeCloseTo(4 / 3, 14);
    expect(c[1]).toBeCloseTo(4 / 3, 14);
  });
});

describe('nonlinear models (Levenberg–Marquardt)', () => {
  it('logistic: exact data recover L, a, b', () => {
    const x = Array.from({ length: 11 }, (_, i) => i);
    const y = x.map((v) => 10 / (1 + 20 * Math.exp(-0.8 * v)));
    const f = val(fitRegression('logistic', x, y));
    expect(coef(f).L).toBeCloseTo(10, 8);
    expect(coef(f).a).toBeCloseTo(20, 7);
    expect(coef(f).b).toBeCloseTo(0.8, 9);
    expect(f.r2).toBeCloseTo(1, 12);
    expect(val(f.predictX!(5))).toBeCloseTo(Math.log(20) / 0.8, 7);
  });
  it('logistic with noise: the fit is at least as good as the generating curve', () => {
    const noise = [0.1, -0.2, 0.15, 0, -0.1, 0.2, -0.15, 0.05, -0.05, 0.1, -0.1, 0.05];
    const x = noise.map((_, i) => i);
    const gen = (v: number) => 50 / (1 + 30 * Math.exp(-0.9 * v));
    const y = x.map((v, i) => gen(v) + noise[i]);
    const f = val(fitRegression('logistic', x, y));
    const sseGen = x.reduce((s, v, i) => s + (y[i] - gen(v)) ** 2, 0);
    expect(f.sse).toBeLessThanOrEqual(sseGen);
    expect(coef(f).L).toBeCloseTo(50, 0);
  });
  it('logistic needs positive y values', () => {
    const r = fitRegression('logistic', [1, 2, 3], [-1, -2, -3]);
    expect(!r.ok && r.error.code).toBe('domain');
  });
  it('trigonometric: exact data recover a, b, c, d', () => {
    const x = Array.from({ length: 41 }, (_, i) => i * 0.5);
    const y = x.map((v) => 3 * Math.sin(0.7 * v + 0.4) + 2);
    const f = val(fitRegression('trigonometric', x, y));
    expect(coef(f).a).toBeCloseTo(3, 9);
    expect(coef(f).b).toBeCloseTo(0.7, 10);
    expect(coef(f).c).toBeCloseTo(0.4, 9);
    expect(coef(f).d).toBeCloseTo(2, 9);
    expect(f.r2).toBeCloseTo(1, 12);
  });
  it('trigonometric: monthly temperatures (period 12)', () => {
    const y = [0.5, 1.7, 5.2, 9.4, 14.0, 17.2, 19.1, 18.5, 14.8, 10.0, 5.1, 1.6];
    const x = y.map((_, i) => i + 1);
    const f = val(fitRegression('trigonometric', x, y));
    expect((2 * Math.PI) / coef(f).b).toBeGreaterThan(11);
    expect((2 * Math.PI) / coef(f).b).toBeLessThan(13.5);
    expect(coef(f).a).toBeGreaterThan(0);
    expect(coef(f).c).toBeGreaterThan(-Math.PI);
    expect(coef(f).c).toBeLessThanOrEqual(Math.PI);
    expect(f.r2!).toBeGreaterThan(0.99);
  });
  it('reports no-convergence honestly', () => {
    const model = {
      f: ([L, a, b]: readonly number[], x: number) => L / (1 + a * Math.exp(-b * x)),
      grad: ([L, a, b]: readonly number[], x: number) => {
        const e = Math.exp(-b * x);
        const d = 1 + a * e;
        return [1 / d, (-L * e) / (d * d), (L * a * x * e) / (d * d)];
      },
    };
    const x = Array.from({ length: 11 }, (_, i) => i);
    const y = x.map((v) => 10 / (1 + 20 * Math.exp(-0.8 * v)));
    const r = levenbergMarquardt(model, [1, 1, 0.01], x, y, 3);
    expect(!r.ok && r.error.code).toBe('no-convergence');
  });
});
