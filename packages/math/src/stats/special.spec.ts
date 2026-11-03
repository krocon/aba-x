import { describe, expect, it } from 'vitest';
import type { MathResult } from '../result';
import {
  erf,
  erfc,
  lnBeta,
  lnGamma,
  regularizedBeta,
  regularizedGammaP,
  regularizedGammaQ,
} from './special';

const val = <T>(r: MathResult<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
};
const rel = (got: number, want: number) => Math.abs(got - want) / Math.abs(want);

// Reference values: mpmath at 40 digits.
describe('special functions', () => {
  it.each([
    [0.1, 2.252712651734206],
    [0.5, 0.5723649429247001],
    [1.5, -0.12078223763524522],
    [3.7, 1.428072326665388],
    [10, 12.80182748008147],
    [30.5, 72.9534711841694],
    [171.3, 708.1149470389969],
    [100000.0, 1051287.7089736569],
    [-2.5, -0.056243716497674054],
  ])('lnΓ(%d)', (x, want) => {
    expect(Math.abs(lnGamma(x) - want)).toBeLessThan(2e-15 * Math.max(1, Math.abs(want)));
  });
  it('lnΓ at poles and small integers', () => {
    expect(lnGamma(0)).toBe(Infinity);
    expect(lnGamma(-3)).toBe(Infinity);
    expect(lnGamma(1)).toBe(0);
    expect(lnGamma(2)).toBe(0);
    expect(lnGamma(6)).toBe(Math.log(120));
    expect(lnBeta(2, 3)).toBeCloseTo(Math.log(1 / 12), 15);
  });
  it.each([
    [1e-10, 1.1283791670955126e-10, 0.999999999887162],
    [0.1, 0.1124629160182849, 0.887537083981715],
    [0.5, 0.5204998778130465, 0.4795001221869535],
    [1, 0.8427007929497149, 0.15729920705028513],
    [1.5, 0.9661051464753108, 0.033894853524689274],
    [2, 0.9953222650189527, 0.004677734981047266],
    [3, 0.9999779095030014, 2.209049699858544e-5],
    [-0.7, -0.6778011938374184, 1.6778011938374184],
    [5, 1, 1.537459794428035e-12],
    [10, 1, 2.088487583762545e-45],
    [26, 1, 5.663192408856143e-296],
  ])('erf/erfc(%d)', (x, e, ec) => {
    // rows with erf = 1 give only erfc; erf is then 1 − erfc to double precision
    expect(rel(erf(x), e === 1 ? 1 - ec : e)).toBeLessThan(1e-14);
    expect(rel(erfc(x), ec)).toBeLessThan(1e-13);
  });
  it.each([
    [0.5, 0.3, 0.5614219739190002, 0.4385780260809999],
    [1, 1, 0.6321205588285577, 0.36787944117144233],
    [3, 2.5, 0.45618688411667047, 0.5438131158833295],
    [10, 15, 0.9301463393005902, 0.06985366069940976],
    [100, 90, 0.15822098918643018, 0.8417790108135699],
    [1000, 1050, 0.9413288886226819, 0.05867111137731808],
    [2.5, 30, 0.9999999999878454, 1.215456977718304e-11],
  ])('P/Q(%d, %d)', (a, x, p, q) => {
    expect(rel(val(regularizedGammaP(a, x)), p)).toBeLessThan(1e-13);
    expect(rel(val(regularizedGammaQ(a, x)), q)).toBeLessThan(1e-13);
  });
  it.each([
    [0.3, 2, 3, 0.3483],
    [0.5, 0.5, 0.5, 0.5],
    [0.9, 10, 2, 0.6973568802000001],
    [0.01, 1, 50, 0.39499393286246337],
    [0.6, 200, 150, 0.8601906604801526],
    [0.999, 3, 0.7, 0.981785175090461],
  ])('I_%d(%d, %d)', (x, a, b, want) => {
    expect(rel(val(regularizedBeta(x, a, b)), want)).toBeLessThan(1e-13);
  });
  it('domain errors', () => {
    expect(regularizedGammaP(0, 1).ok).toBe(false);
    expect(regularizedGammaQ(1, -1).ok).toBe(false);
    expect(regularizedBeta(1.5, 1, 1).ok).toBe(false);
    expect(regularizedBeta(0.5, -1, 1).ok).toBe(false);
    expect(val(regularizedBeta(0, 2, 2))).toBe(0);
    expect(val(regularizedBeta(1, 2, 2))).toBe(1);
  });
});
