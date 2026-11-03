import { describe, expect, it } from 'vitest';
import type { MathResult } from '../result';
import { Rng } from './random';

const val = <T>(r: MathResult<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
};

function moments(draw: () => number, n: number) {
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const v = draw();
    s += v;
    s2 += v * v;
  }
  const mean = s / n;
  return { mean, variance: s2 / n - mean * mean };
}

describe('Rng', () => {
  it('xoshiro128** reference outputs for the state (1, 2, 3, 4)', () => {
    // values of the reference C implementation, checked by hand for the first three
    const r = val(Rng.fromState([1, 2, 3, 4]));
    expect([r.nextUint32(), r.nextUint32(), r.nextUint32(), r.nextUint32()]).toEqual([
      11520, 0, 5927040, 70819200,
    ]);
  });
  it('is reproducible and seed dependent', () => {
    const a = val(Rng.seeded(42));
    const b = val(Rng.seeded(42));
    const c = val(Rng.seeded(43));
    const sa = Array.from({ length: 5 }, () => a.random());
    expect(Array.from({ length: 5 }, () => b.random())).toEqual(sa);
    expect(Array.from({ length: 5 }, () => c.random())).not.toEqual(sa);
    expect(val(Rng.seeded(0.5)).nextUint32()).not.toBe(val(Rng.seeded(0.25)).nextUint32());
    expect(Rng.seeded(NaN).ok).toBe(false);
    expect(Rng.fromState([0, 0, 0, 0]).ok).toBe(false);
  });
  it('uniform doubles lie in [0, 1) with the right moments', () => {
    const r = val(Rng.seeded(1));
    const m = moments(() => {
      const v = r.random();
      expect(v >= 0 && v < 1).toBe(true);
      return v;
    }, 50000);
    expect(m.mean).toBeCloseTo(0.5, 2);
    expect(m.variance).toBeCloseTo(1 / 12, 2);
  });
  it('integers are uniform over the range', () => {
    const r = val(Rng.seeded(7));
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 60000; i++) counts[val(r.int(1, 6)) - 1]++;
    for (const c of counts) expect(Math.abs(c - 10000)).toBeLessThan(400);
    expect(r.int(3, 2).ok).toBe(false);
    expect(val(r.int(5, 5))).toBe(5);
  });
  it('normal, binomial and Poisson moments', () => {
    const r = val(Rng.seeded(2026));
    const n = moments(() => val(r.normal(10, 2)), 40000);
    expect(n.mean).toBeCloseTo(10, 1);
    expect(Math.abs(n.variance - 4)).toBeLessThan(0.15);
    const b = moments(() => val(r.binomial(20, 0.3)), 20000);
    expect(Math.abs(b.mean - 6)).toBeLessThan(0.06);
    expect(Math.abs(b.variance - 4.2)).toBeLessThan(0.2);
    const bl = moments(() => val(r.binomial(1000, 0.4)), 2000);
    expect(Math.abs(bl.mean - 400)).toBeLessThan(1);
    const p = moments(() => val(r.poisson(3.5)), 20000);
    expect(Math.abs(p.mean - 3.5)).toBeLessThan(0.05);
    expect(Math.abs(p.variance - 3.5)).toBeLessThan(0.15);
    const pl = moments(() => val(r.poisson(200)), 2000);
    expect(Math.abs(pl.mean - 200)).toBeLessThan(1.2);
  });
  it('validates parameters', () => {
    const r = val(Rng.seeded(3));
    expect(r.normal(0, 0).ok).toBe(false);
    expect(r.uniform(2, 1).ok).toBe(false);
    expect(r.binomial(3.5, 0.2).ok).toBe(false);
    expect(r.poisson(-1).ok).toBe(false);
    expect(val(r.binomial(10, 0))).toBe(0);
    expect(val(r.binomial(10, 1))).toBe(10);
  });
});
