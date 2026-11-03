import { describe, expect, it } from 'vitest';
import {
  amortGroups,
  amortTable,
  bondFromYield,
  bsResult,
  cashResults,
  dateResults,
  deprResult,
  initFinance,
  solveBond,
  solveBreak,
  solveConv,
  solveMarginField,
  solvePct,
  solveTvmField,
} from './finance-logic';

describe('finance app logic', () => {
  it('computes the payment of a 30-year mortgage and its amortization', () => {
    const s = initFinance();
    const r = solveTvmField(s.tvm, 'pmt');
    expect(r.ok && r.value.tvm.pmt.toFixed(2)).toBe('-1199.10');
    if (!r.ok) return;
    const t = amortTable(r.value.tvm);
    expect(t.ok && t.value.length).toBe(360);
    if (!t.ok) return;
    const principal = t.value.reduce((x, row) => x + row.principal, 0);
    expect(principal).toBeCloseTo(-200000, 4);
    expect(t.value.at(-1)!.balance).toBeCloseTo(0, 4);
    const years = amortGroups(t.value, 12);
    expect(years.length).toBe(30);
    expect(years[0].interest).toBeCloseTo(-11933.19, 1);
  });

  it('refuses a fractional N for the table', () => {
    expect(amortTable({ ...initFinance().tvm, n: 12.5 }).ok).toBe(false);
  });

  it('computes NPV and IRR of the default cash flows', () => {
    const r = cashResults(initFinance().cash);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.npv.ok && r.value.npv.value).toBeCloseTo(
      -1000 + 300 / 1.08 + 400 / 1.08 ** 2 + 500 / 1.08 ** 3,
      9,
    );
    expect(r.value.irr.ok && r.value.irr.value.irr).toBeCloseTo(8.896, 2);
  });

  it('converts interest rates both ways', () => {
    const c = solveConv({ nominal: 12, effective: 0, c: 12 }, 'effective');
    expect(c.ok && c.value.effective).toBeCloseTo(12.6825030132, 8);
    const n = solveConv({ nominal: 0, effective: 12.6825030132, c: 12 }, 'nominal');
    expect(n.ok && n.value.nominal).toBeCloseTo(12, 8);
  });

  it('counts days with a leap year and checks dates', () => {
    const d = dateResults({ d1: '2024-01-01', d2: '2025-01-01', basis: 'actual', add: 60 });
    expect(d.days.ok && d.days.value).toBe(366);
    expect(d.plus.ok && d.plus.value).toBe('2024-03-01');
    expect(d.dow1.ok && d.dow1.value).toBe('Monday');
    expect(
      dateResults({ d1: '2023-02-29', d2: '2024-01-01', basis: 'actual', add: 0 }).days.ok,
    ).toBe(false);
  });

  it('wires the smaller worksheets', () => {
    const s = initFinance();
    expect(deprResult(s.depr).ok).toBe(true);
    const b = solveBreak(s.brk, 'quantity');
    expect(b.ok && b.value.quantity).toBeCloseTo(200, 12);
    const p = solvePct(s.pct, 'percent');
    expect(p.ok && p.value.percent).toBeCloseTo(20, 12);
    const m = solveMarginField(s.margin, 'percent');
    expect(m.ok && m.value.percent).toBeCloseTo(20, 12);
    const mu = solveMarginField({ ...s.margin, markup: true }, 'percent');
    expect(mu.ok && mu.value.percent).toBeCloseTo(25, 12);
    expect(bsResult(s.bs).ok).toBe(true);
    const price = solveBond(s.bond, 'price');
    expect(price.ok).toBe(true);
    if (price.ok) {
      const y = solveBond(price.value, 'yld');
      expect(y.ok && y.value.yld).toBeCloseTo(6, 8);
    }
    expect(bondFromYield({ ...s.bond, maturity: 'x' }).ok).toBe(false);
  });
});
