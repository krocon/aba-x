import { describe, expect, it } from 'vitest';
import { expandFlows, irr, mirr, nfv, npv, paybackPeriod, signChanges } from './cashflow';

const val = <T>(r: { ok: boolean; value?: T; error?: { message: string } }) => {
  if (!r.ok) throw new Error(`not ok: ${r.error?.message}`);
  return r.value as T;
};

describe('cash flows', () => {
  it('computes NPV and NFV', () => {
    expect(val(npv([-100, 60, 60], 10))).toBeCloseTo(4.132231404958667, 12);
    expect(val(nfv([-100, 60, 60], 10))).toBeCloseTo(4.132231404958667 * 1.21, 10);
    expect(val(npv([-100, 60, 60], 0))).toBe(20);
    expect(val(npv([5], 10))).toBe(5);
  });

  it('computes the IRR of known examples', () => {
    const r = val(irr([-100, 60, 60]));
    expect(r.irr).toBeCloseTo(13.06623862918075, 10);
    expect(r.rates).toHaveLength(1);
    expect(r.warning).toBeUndefined();
    // Excel IRR documentation
    expect(val(irr([-70000, 12000, 15000, 18000, 21000, 26000])).irr).toBeCloseTo(8.66309480365, 8);
    expect(val(irr([-70000, 12000, 15000, 18000, 21000])).irr).toBeCloseTo(-2.1244848273, 8);
  });

  it('does not pick one of several IRRs silently', () => {
    const r = val(irr([-100, 230, -132]));
    expect(r.irr).toBeNull();
    expect(r.rates[0]).toBeCloseTo(10, 9);
    expect(r.rates[1]).toBeCloseTo(20, 9);
    expect(r.signChanges).toBe(2);
    expect(r.warning).toMatch(/not unique/);
  });

  it('warns with several sign changes but one rate', () => {
    const r = val(irr([-100, 150, -1]));
    expect(r.irr).not.toBeNull();
    expect(val(npv([-100, 150, -1], r.irr as number))).toBeCloseTo(0, 9);
    expect(r.warning).toMatch(/sign changes/);
  });

  it('reports cash flows without IRR', () => {
    expect(irr([100, 50]).ok).toBe(false);
    expect(irr([-100, 0, 0]).ok).toBe(false);
    // sign change, but NPV never zero: −100 + 100v − 100v² < 0 for all v
    const r = irr([-100, 100, -100]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('not-solvable');
  });

  it('counts sign changes and expands grouped flows', () => {
    expect(signChanges([-1, 0, 2, 3, -1, 0, 4])).toBe(3);
    expect(val(expandFlows(-100, [{ amount: 30, count: 3 }, { amount: 50 }]))).toEqual([
      -100, 30, 30, 30, 50,
    ]);
    expect(expandFlows(0, [{ amount: 1, count: 0 }]).ok).toBe(false);
  });

  it('computes the MIRR (Excel example)', () => {
    const flows = [-120000, 39000, 30000, 21000, 37000, 46000];
    expect(val(mirr(flows, 10, 12))).toBeCloseTo(12.60941303659051, 9);
    expect(mirr([100, 200], 10, 10).ok).toBe(false);
    expect(mirr([-100], 10, 10).ok).toBe(false);
  });

  it('computes the payback period, also discounted', () => {
    expect(val(paybackPeriod([-100, 30, 40, 50]))).toBeCloseTo(2.6, 12);
    const d = val(paybackPeriod([-100, 60, 60], 10));
    // discounted: −100 + 54.545 = −45.455, then 49.587 → 1 + 45.455/49.587
    expect(d).toBeCloseTo(1 + (100 - 60 / 1.1) / (60 / 1.21), 12);
    expect(paybackPeriod([-100, 30, 30]).ok).toBe(false);
    expect(val(paybackPeriod([10, 5]))).toBe(0);
  });

  it('validates the input', () => {
    expect(npv([], 10).ok).toBe(false);
    expect(npv([1, NaN], 10).ok).toBe(false);
    expect(npv([1, 2], -100).ok).toBe(false);
  });
});
