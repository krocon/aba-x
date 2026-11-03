import { describe, expect, it } from 'vitest';
import { evaluateNumeric } from '../numeric/evaluate';
import { parseText } from '../parser/text-parser';
import { evaluateValue } from '../value/evaluate-value';

const num = (s: string) => {
  const p = parseText(s);
  if (!p.ok) throw new Error(p.error.message);
  const r = evaluateNumeric(p.value);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.value;
};
const val = (s: string) => {
  const p = parseText(s);
  if (!p.ok) throw new Error(p.error.message);
  return evaluateValue(p.value, {});
};

describe('probability functions of the catalogue', () => {
  it('normal, t, χ², F', () => {
    expect(num('normalcdf(1.96)')).toBeCloseTo(0.9750021048517795, 14);
    expect(num('invnorm(0.975)')).toBeCloseTo(1.959963984540054, 12);
    expect(num('normalcdf(110, 100, 15)')).toBeCloseTo(0.7475074624530771, 12);
    expect(num('normalpdf(0)')).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 14);
    expect(num('invt(0.975, 10)')).toBeCloseTo(2.228138851986274, 10);
    expect(num('chi2cdf(11.0705, 5)')).toBeCloseTo(0.95, 5);
    expect(num('invf(0.95, 5, 10)')).toBeCloseTo(3.325834530413011, 9);
  });

  it('discrete distributions', () => {
    expect(num('binompdf(2, 4, 0.5)')).toBeCloseTo(0.375, 14);
    expect(num('binomcdf(2, 4, 0.5)')).toBeCloseTo(0.6875, 14);
    expect(num('poissonpdf(0, 2)')).toBeCloseTo(Math.exp(-2), 14);
    expect(num('geomcdf(2, 0.5)')).toBeCloseTo(0.75, 14);
  });

  it('errors and element-wise lists in the value evaluator', () => {
    expect(val('normalcdf(1, 0, -1)').ok).toBe(false);
    const l = val('normalcdf({0, 1.96})');
    expect(l.ok && l.value.kind).toBe('list');
  });

  it('random numbers are reproducible after randseed', () => {
    num('randseed(42)');
    const a = [num('random()'), num('randint(1, 6)'), num('randnorm(0, 1)')];
    num('randseed(42)');
    expect([num('random()'), num('randint(1, 6)'), num('randnorm(0, 1)')]).toEqual(a);
    expect(a[0]).toBeGreaterThanOrEqual(0);
    expect(a[0]).toBeLessThan(1);
  });
});
