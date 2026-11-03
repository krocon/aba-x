import { describe, expect, it } from 'vitest';
import type { MathResult } from '../result';
import {
  type Distribution,
  binomial,
  chiSquare,
  exponential,
  fisherF,
  geometric,
  normal,
  poisson,
  studentT,
  uniform,
} from './distributions';

const val = <T>(r: MathResult<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
};

const factories: Record<string, (...p: number[]) => MathResult<Distribution>> = {
  normal: (mu, s) => normal(mu, s),
  studentT: (n) => studentT(n),
  chiSquare: (n) => chiSquare(n),
  fisherF: (a, b) => fisherF(a, b),
  binomial: (n, p) => binomial(n, p),
  poisson: (l) => poisson(l),
  geometric: (p) => geometric(p),
  exponential: (l) => exponential(l),
  uniform: (a, b) => uniform(a, b),
};

function evaluate(d: Distribution, fn: string, x: number): MathResult<number> {
  if (fn === 'cdf') return d.cdf(x);
  if (fn === 'sf') return d.sf(x);
  return d.kind === 'continuous' ? d.pdf(x) : d.pmf(x);
}

/** Relative error, with an absolute floor for values near zero. */
const relErr = (got: number, want: number) =>
  Math.abs(got - want) / Math.max(Math.abs(want), 1e-300);

// Reference values computed independently with mpmath (50 digits): ncdf/erfc, betainc,
// gammainc, exact rational binomial sums (fractions) and exact Poisson series.
type Case = [string, number[], 'cdf' | 'sf' | 'pdf' | 'pmf', number, number];
const CASES: Case[] = [
  ['normal', [0, 1], 'cdf', 1.96, 0.9750021048517795],
  ['normal', [0, 1], 'sf', 1.96, 0.024997895148220435],
  ['normal', [0, 1], 'cdf', -1.96, 0.024997895148220435],
  ['normal', [0, 1], 'sf', -1.96, 0.9750021048517795],
  ['normal', [0, 1], 'cdf', 0, 0.5],
  ['normal', [0, 1], 'sf', 0, 0.5],
  ['normal', [0, 1], 'cdf', 1, 0.8413447460685429],
  ['normal', [0, 1], 'sf', 1, 0.15865525393145705],
  ['normal', [0, 1], 'cdf', -3, 0.0013498980316300946],
  ['normal', [0, 1], 'sf', -3, 0.9986501019683699],
  ['normal', [0, 1], 'cdf', -8, 6.220960574271784e-16],
  ['normal', [0, 1], 'sf', -8, 0.9999999999999993],
  ['normal', [0, 1], 'cdf', -20, 2.7536241186062337e-89],
  ['normal', [0, 1], 'sf', -20, 1.0],
  ['normal', [0, 1], 'cdf', 5, 0.9999997133484281],
  ['normal', [0, 1], 'sf', 5, 2.866515718791939e-7],
  ['normal', [100, 15], 'cdf', 130, 0.9772498680518208],
  ['normal', [100, 15], 'sf', 130, 0.02275013194817921],
  ['normal', [10, 2], 'cdf', 7.5, 0.10564977366685525],
  ['normal', [10, 2], 'sf', 7.5, 0.8943502263331448],
  ['normal', [0, 1], 'cdf', 0.3, 0.6179114221889527],
  ['normal', [0, 1], 'sf', 0.3, 0.3820885778110474],
  ['normal', [0, 1], 'pdf', 0, 0.3989422804014327],
  ['normal', [0, 1], 'pdf', 1.5, 0.12951759566589174],
  ['normal', [5, 2], 'pdf', 3, 0.12098536225957167],
  ['studentT', [10], 'cdf', 2.228, 0.9749941140914443],
  ['studentT', [10], 'sf', 2.228, 0.025005885908555684],
  ['studentT', [1], 'cdf', 1, 0.75],
  ['studentT', [1], 'sf', 1, 0.25],
  ['studentT', [1], 'cdf', -3, 0.10241638234956674],
  ['studentT', [1], 'sf', -3, 0.8975836176504333],
  ['studentT', [2], 'cdf', 0.5, 0.6666666666666666],
  ['studentT', [2], 'sf', 0.5, 0.3333333333333333],
  ['studentT', [5], 'cdf', -2.015, 0.05000308616340317],
  ['studentT', [5], 'sf', -2.015, 0.9499969138365968],
  ['studentT', [30], 'cdf', 1.697, 0.9499750753969193],
  ['studentT', [30], 'sf', 1.697, 0.05002492460308076],
  ['studentT', [3], 'cdf', 10, 0.9989358004707929],
  ['studentT', [3], 'sf', 10, 0.001064199529207075],
  ['studentT', [25], 'cdf', -0.4, 0.34627692266917237],
  ['studentT', [25], 'sf', -0.4, 0.6537230773308277],
  ['studentT', [4.5], 'cdf', 1.3, 0.8719019560279829],
  ['studentT', [4.5], 'sf', 1.3, 0.12809804397201702],
  ['studentT', [1000], 'cdf', 2, 0.9771148267533741],
  ['studentT', [1000], 'sf', 2, 0.02288517324662582],
  ['studentT', [100], 'cdf', -4, 6.076182215038084e-5],
  ['studentT', [100], 'sf', -4, 0.9999392381778496],
  ['studentT', [10], 'pdf', 2.228, 0.04239462470643994],
  ['studentT', [1], 'pdf', 0, 0.3183098861837907],
  ['studentT', [3], 'pdf', -1.5, 0.12001717451358739],
  ['studentT', [1000000], 'pdf', 0.5, 0.35206520024085],
  ['chiSquare', [5], 'cdf', 11.07, 0.9499903813775945],
  ['chiSquare', [5], 'sf', 11.07, 0.05000961862240548],
  ['chiSquare', [1], 'cdf', 3.841, 0.9499863162360433],
  ['chiSquare', [1], 'sf', 3.841, 0.0500136837639567],
  ['chiSquare', [2], 'cdf', 1, 0.3934693402873666],
  ['chiSquare', [2], 'sf', 1, 0.6065306597126334],
  ['chiSquare', [10], 'cdf', 2, 0.0036598468273437122],
  ['chiSquare', [10], 'sf', 2, 0.9963401531726563],
  ['chiSquare', [10], 'cdf', 30, 0.9991433587892247],
  ['chiSquare', [10], 'sf', 30, 0.0008566412107753004],
  ['chiSquare', [100], 'cdf', 124.342, 0.9499992842300282],
  ['chiSquare', [100], 'sf', 124.342, 0.05000071576997177],
  ['chiSquare', [0.5], 'cdf', 0.1, 0.5165553208304656],
  ['chiSquare', [0.5], 'sf', 0.1, 0.4834446791695344],
  ['chiSquare', [3], 'cdf', 0.01, 0.0002651650586556098],
  ['chiSquare', [3], 'sf', 0.01, 0.9997348349413444],
  ['chiSquare', [50], 'cdf', 10, 1.599586398487006e-10],
  ['chiSquare', [50], 'sf', 10, 0.9999999998400414],
  ['chiSquare', [1], 'cdf', 40, 0.9999999997460371],
  ['chiSquare', [1], 'sf', 40, 2.539628589470865e-10],
  ['chiSquare', [5], 'pdf', 11.07, 0.01932814989768245],
  ['chiSquare', [1], 'pdf', 0.5, 0.4393912894677224],
  ['chiSquare', [4], 'pdf', 2, 0.18393972058572117],
  ['chiSquare', [200], 'pdf', 190, 0.018434335718066856],
  ['fisherF', [5, 10], 'cdf', 3.326, 0.9500067152560672],
  ['fisherF', [5, 10], 'sf', 3.326, 0.04999328474393286],
  ['fisherF', [1, 1], 'cdf', 1, 0.5],
  ['fisherF', [1, 1], 'sf', 1, 0.5],
  ['fisherF', [2, 20], 'cdf', 0.5, 0.3860867464592406],
  ['fisherF', [2, 20], 'sf', 0.5, 0.6139132535407593],
  ['fisherF', [10, 10], 'cdf', 1, 0.5],
  ['fisherF', [10, 10], 'sf', 1, 0.5],
  ['fisherF', [3, 7], 'cdf', 8.45, 0.9899959497647944],
  ['fisherF', [3, 7], 'sf', 8.45, 0.010004050235205546],
  ['fisherF', [30, 60], 'cdf', 0.6, 0.06430230247380923],
  ['fisherF', [30, 60], 'sf', 0.6, 0.9356976975261908],
  ['fisherF', [1.5, 2.5], 'cdf', 2, 0.7096143159642988],
  ['fisherF', [1.5, 2.5], 'sf', 2, 0.2903856840357012],
  ['fisherF', [5, 10], 'pdf', 3.326, 0.040579809235496186],
  ['fisherF', [1, 5], 'pdf', 0.7, 0.3062459002031479],
  ['fisherF', [2, 3], 'pdf', 1, 0.27885480092693404],
  ['fisherF', [40, 50], 'pdf', 1.1, 1.1427641221114697],
  ['binomial', [10, 0.5], 'pmf', 3, 0.1171875],
  ['binomial', [10, 0.5], 'cdf', 3, 0.171875],
  ['binomial', [10, 0.5], 'sf', 3, 0.828125],
  ['binomial', [20, 0.3], 'pmf', 6, 0.19163898275344257],
  ['binomial', [20, 0.3], 'cdf', 6, 0.608009812200924],
  ['binomial', [20, 0.3], 'sf', 6, 0.391990187799076],
  ['binomial', [100, 0.01], 'pmf', 2, 0.1848648188248634],
  ['binomial', [100, 0.01], 'cdf', 2, 0.9206267977478196],
  ['binomial', [100, 0.01], 'sf', 2, 0.07937320225218034],
  ['binomial', [50, 0.9], 'pmf', 45, 0.18492460089521523],
  ['binomial', [50, 0.9], 'cdf', 45, 0.5688015931709383],
  ['binomial', [50, 0.9], 'sf', 45, 0.4311984068290617],
  ['binomial', [7, 0.25], 'pmf', 0, 0.13348388671875],
  ['binomial', [7, 0.25], 'cdf', 0, 0.13348388671875],
  ['binomial', [7, 0.25], 'sf', 0, 0.86651611328125],
  ['binomial', [1000, 0.5], 'pmf', 500, 0.025225018178360804],
  ['binomial', [1000, 0.5], 'cdf', 500, 0.5126125090891804],
  ['binomial', [1000, 0.5], 'sf', 500, 0.4873874909108196],
  ['binomial', [30, 0.2], 'pmf', 29, 0.00000000000000000012884901888],
  ['binomial', [30, 0.2], 'cdf', 29, 1.0],
  ['binomial', [30, 0.2], 'sf', 29, 0.000000000000000000001073741824],
  ['poisson', [3], 'pmf', 2, 0.22404180765538775],
  ['poisson', [3], 'cdf', 2, 0.42319008112684353],
  ['poisson', [3], 'sf', 2, 0.5768099188731565],
  ['poisson', [3], 'pmf', 5, 0.10081881344492448],
  ['poisson', [3], 'cdf', 5, 0.9160820579686966],
  ['poisson', [3], 'sf', 5, 0.08391794203130346],
  ['poisson', [0.5], 'pmf', 0, 0.6065306597126334],
  ['poisson', [0.5], 'cdf', 0, 0.6065306597126334],
  ['poisson', [0.5], 'sf', 0, 0.3934693402873666],
  ['poisson', [10], 'pmf', 15, 0.03471806963068412],
  ['poisson', [10], 'cdf', 15, 0.9512595966960213],
  ['poisson', [10], 'sf', 15, 0.048740403303978705],
  ['poisson', [100], 'pmf', 80, 0.00519785412598018],
  ['poisson', [100], 'cdf', 80, 0.02264917664225561],
  ['poisson', [100], 'sf', 80, 0.9773508233577444],
  ['poisson', [0.001], 'pmf', 1, 0.000999000499833375],
  ['poisson', [0.001], 'cdf', 1, 0.9999995003332084],
  ['poisson', [0.001], 'sf', 1, 4.996667916333403e-7],
  ['poisson', [25], 'pmf', 40, 0.0014079694484448917],
  ['poisson', [25], 'cdf', 40, 0.9979644007190178],
  ['poisson', [25], 'sf', 40, 0.002035599280982178],
  ['geometric', [0.2], 'pmf', 3, 0.128],
  ['geometric', [0.2], 'cdf', 3, 0.48800000000000004],
  ['geometric', [0.5], 'pmf', 1, 0.5],
  ['geometric', [0.5], 'cdf', 1, 0.5],
  ['geometric', [0.01], 'pmf', 100, 0.003697296376497268],
  ['geometric', [0.01], 'cdf', 100, 0.6339676587267705],
  ['exponential', [2], 'cdf', 0.5, 0.6321205588285577],
  ['exponential', [2], 'pdf', 0.5, 0.7357588823428847],
  ['exponential', [0.1], 'cdf', 30, 0.950212931632136],
  ['exponential', [0.1], 'pdf', 30, 0.004978706836786394],
  ['uniform', [2, 6], 'cdf', 3, 0.25],
  ['uniform', [2, 6], 'pdf', 3, 0.25],
];

describe('distributions – reference values (mpmath)', () => {
  it('has at least 60 reference cases', () => expect(CASES.length).toBeGreaterThanOrEqual(60));
  it.each(CASES)('%s(%j).%s(%d) = %d', (name, params, fn, x, want) => {
    const d = val(factories[name](...params));
    const got = val(evaluate(d, fn, x));
    expect(relErr(got, want)).toBeLessThan(1e-12);
  });
});

describe('distributions – well-known quantiles', () => {
  it('Φ(1.96) and the 97.5 % normal quantile', () => {
    const n = val(normal());
    expect(val(n.cdf(1.96))).toBeCloseTo(0.9750021048517795, 15);
    expect(val(n.inv(0.975))).toBeCloseTo(1.959963984540054, 13);
    expect(val(n.inv(0.5))).toBeCloseTo(0, 15);
  });
  it('t, χ², F critical values of printed tables', () => {
    expect(val(val(studentT(10)).inv(0.975))).toBeCloseTo(2.228138851986274, 12);
    expect(val(val(chiSquare(5)).inv(0.95))).toBeCloseTo(11.070497693516351, 11);
    expect(val(val(fisherF(5, 10)).inv(0.95))).toBeCloseTo(3.325834530413011, 11);
    expect(val(val(studentT(1)).inv(0.975))).toBeCloseTo(12.706204736174707, 10);
  });
  it('upper quantiles for tiny α keep their accuracy', () => {
    const n = val(normal());
    const z = val(n.invUpper(1e-10));
    expect(relErr(val(n.sf(z)), 1e-10)).toBeLessThan(1e-12);
    expect(z).toBeCloseTo(6.361340902404056, 11);
  });
  it('discrete quantile: smallest k with cdf(k) ≥ p', () => {
    const b = val(binomial(10, 0.5));
    // cdf(4) = 386/1024 = 0.376953125, cdf(5) = 638/1024
    expect(val(b.inv(0.376953125))).toBe(4);
    expect(val(b.inv(0.377))).toBe(5);
    expect(val(b.inv(0))).toBe(0);
    expect(val(b.inv(1))).toBe(10);
    expect(val(val(poisson(3)).inv(0.5))).toBe(3);
    expect(val(val(geometric(0.2)).inv(0.488))).toBe(3); // cdf(3) = 1 − 0.8³ = 0.488
  });
});

describe('distributions – inverse round trips', () => {
  const probs = [1e-12, 1e-6, 0.001, 0.025, 0.1, 0.3, 0.5, 0.7, 0.9, 0.975, 0.999, 1 - 1e-9];
  const cont: [string, () => MathResult<Distribution>][] = [
    ['N(0,1)', () => normal()],
    ['N(-3,0.2)', () => normal(-3, 0.2)],
    ['t(1)', () => studentT(1)],
    ['t(3.5)', () => studentT(3.5)],
    ['t(200)', () => studentT(200)],
    ['χ²(1)', () => chiSquare(1)],
    ['χ²(7)', () => chiSquare(7)],
    ['χ²(300)', () => chiSquare(300)],
    ['F(1,1)', () => fisherF(1, 1)],
    ['F(4,12)', () => fisherF(4, 12)],
    ['F(50,3)', () => fisherF(50, 3)],
    ['Exp(0.3)', () => exponential(0.3)],
  ];
  it.each(cont)('%s: cdf(inv(p)) = p', (_n, make) => {
    const d = val(make());
    if (d.kind !== 'continuous') throw new Error('continuous expected');
    for (const p of probs) {
      const x = val(d.inv(p));
      if (p < 0.5) expect(relErr(val(d.cdf(x)), p)).toBeLessThan(1e-9);
      else expect(relErr(val(d.sf(x)), 1 - p)).toBeLessThan(1e-9);
      const xu = val(d.invUpper(p));
      if (p < 0.5) expect(relErr(val(d.sf(xu)), p)).toBeLessThan(1e-9);
    }
  });
  it('uniform quantiles are linear', () => {
    const u = val(uniform(-1, 4));
    expect(val(u.inv(0.3))).toBeCloseTo(0.5, 15);
    expect(val(u.invUpper(0.3))).toBeCloseTo(2.5, 15);
    expect(val(u.inv(0))).toBe(-1);
    expect(val(u.inv(1))).toBe(4);
  });
  it('extreme lower tails of the normal and Cauchy quantiles', () => {
    for (const d of [val(normal()), val(studentT(1)), val(studentT(2))]) {
      if (d.kind !== 'continuous') throw new Error('continuous expected');
      const x = val(d.inv(1e-300));
      expect(relErr(val(d.cdf(x)), 1e-300), d.name).toBeLessThan(1e-9);
    }
  });
  const disc: [string, () => MathResult<Distribution>][] = [
    ['B(20,0.3)', () => binomial(20, 0.3)],
    ['B(1000,0.02)', () => binomial(1000, 0.02)],
    ['Poi(0.7)', () => poisson(0.7)],
    ['Poi(250)', () => poisson(250)],
    ['Geo(0.05)', () => geometric(0.05)],
  ];
  it.each(disc)('%s: inv(p) is the smallest k with cdf(k) ≥ p', (_n, make) => {
    const d = val(make());
    for (const p of [1e-9, 0.01, 0.2, 0.5, 0.8, 0.99, 0.9999]) {
      const k = val(d.inv(p));
      expect(val(d.cdf(k))).toBeGreaterThanOrEqual(p * (1 - 1e-13));
      expect(val(d.cdf(k - 1))).toBeLessThan(p);
    }
  });
});

describe('distributions – properties and validation', () => {
  it('pmfs sum to one and match the cdf', () => {
    const d = val(binomial(40, 0.37));
    let s = 0;
    for (let k = 0; k <= 40; k++) {
      s += val(d.pmf(k));
      expect(relErr(val(d.cdf(k)), s)).toBeLessThan(1e-12);
    }
    expect(s).toBeCloseTo(1, 14);
  });
  it('degenerate binomial parameters', () => {
    expect(val(val(binomial(5, 0)).cdf(0))).toBe(1);
    expect(val(val(binomial(5, 1)).pmf(5))).toBe(1);
    expect(val(val(binomial(5, 1)).cdf(4))).toBe(0);
    expect(val(val(binomial(0, 0.4)).pmf(0))).toBe(1);
  });
  it('non-integer arguments of discrete distributions', () => {
    const d = val(poisson(2));
    expect(val(d.pmf(1.5))).toBe(0);
    expect(val(d.cdf(1.5))).toBe(val(d.cdf(1)));
    expect(val(d.cdf(-1))).toBe(0);
  });
  it('symmetry and tails', () => {
    const t = val(studentT(4));
    expect(val(t.cdf(-1.3)) + val(t.cdf(1.3))).toBeCloseTo(1, 15);
    expect(val(t.cdf(0))).toBe(0.5);
    expect(val(val(normal()).cdf(-37))).toBeGreaterThan(0);
    expect(val(val(chiSquare(3)).cdf(-1))).toBe(0);
  });
  it('rejects invalid parameters with a domain error', () => {
    for (const r of [
      normal(0, 0),
      normal(NaN, 1),
      studentT(0),
      chiSquare(-1),
      fisherF(1, 0),
      binomial(2.5, 0.5),
      binomial(3, 1.2),
      poisson(0),
      geometric(0),
      exponential(-2),
      uniform(3, 3),
    ]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('domain');
    }
  });
  it('rejects invalid probabilities and unbounded quantiles', () => {
    const n = val(normal());
    expect(n.inv(1.5).ok).toBe(false);
    expect(n.inv(0).ok).toBe(false);
    expect(n.cdf(NaN).ok).toBe(false);
    expect(val(val(chiSquare(2)).inv(0))).toBe(0);
    expect(val(poisson(2)).inv(1).ok).toBe(false);
  });
});
