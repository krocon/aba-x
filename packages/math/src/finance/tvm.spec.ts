import { describe, expect, it } from 'vitest';
import {
  type Tvm,
  amortizationSchedule,
  amortize,
  annualRate,
  effectiveToNominal,
  nominalToEffective,
  periodicRate,
  solveTvm,
  tvmResidual,
} from './tvm';

const val = <T>(r: { ok: boolean; value?: T; error?: { message: string } }) => {
  if (!r.ok) throw new Error(`not ok: ${r.error?.message}`);
  return r.value as T;
};

/** 30-year mortgage of 200 000 at 6 % with monthly payments. */
const mortgage: Tvm = { n: 360, iyr: 6, pv: 200000, pmt: 0, fv: 0, py: 12 };
const PMT = -1199.1010503055138;

describe('solveTvm', () => {
  it('computes the mortgage payment to the cent', () => {
    const r = val(solveTvm(mortgage, 'pmt'));
    expect(r.value.toFixed(2)).toBe('-1199.10');
    expect(r.value).toBeCloseTo(PMT, 8);
    expect(r.tvm).toMatchObject({ pmt: r.value, py: 12, cy: 12, timing: 'end' });
    expect(tvmResidual(r.tvm)).toBeCloseTo(0, 6);
  });

  it('solves the mortgage for every other variable', () => {
    const full = { ...mortgage, pmt: PMT };
    expect(val(solveTvm({ ...full, n: 0 }, 'n')).value).toBeCloseTo(360, 8);
    expect(val(solveTvm({ ...full, iyr: 0 }, 'iyr')).value).toBeCloseTo(6, 10);
    expect(val(solveTvm({ ...full, pv: 0 }, 'pv')).value).toBeCloseTo(200000, 6);
    expect(val(solveTvm(full, 'fv')).value).toBeCloseTo(0, 6);
  });

  it('computes a sinking fund (future value target)', () => {
    const r = val(solveTvm({ n: 60, iyr: 6, pv: 0, pmt: 0, fv: 10000, py: 12 }, 'pmt'));
    expect(r.value.toFixed(2)).toBe('-143.33');
  });

  it('computes an annuity due (payments at the beginning)', () => {
    const r = val(solveTvm({ n: 10, iyr: 8, pv: 0, pmt: -1000, fv: 0, timing: 'begin' }, 'pv'));
    expect(r.value).toBeCloseTo(7246.887910856764, 8);
    const end = val(solveTvm({ n: 10, iyr: 8, pv: 0, pmt: -1000, fv: 0 }, 'pv'));
    expect(r.value / end.value).toBeCloseTo(1.08, 12);
  });

  it('computes the future value of a savings plan', () => {
    const r = val(solveTvm({ n: 12, iyr: 5, pv: -1000, pmt: -100, fv: 0, py: 12 }, 'fv'));
    expect(r.value).toBeCloseTo(2279.0474470433246, 8);
  });

  it('allows different payment and compounding frequencies', () => {
    // Canadian mortgage: semi-annual compounding, monthly payments
    const t: Tvm = { n: 300, iyr: 6, pv: 100000, pmt: 0, fv: 0, py: 12, cy: 2 };
    expect(val(solveTvm(t, 'pmt')).value).toBeCloseTo(-639.8066236767343, 8);
    expect(periodicRate(6, 12, 2)).toBeCloseTo(1.03 ** (1 / 6) - 1, 15);
    expect(annualRate(periodicRate(6, 12, 2), 12, 2)).toBeCloseTo(6, 12);
    const back = val(solveTvm({ ...t, pmt: -639.8066236767343, iyr: 0 }, 'iyr'));
    expect(back.value).toBeCloseTo(6, 9);
  });

  it('handles 0 % interest', () => {
    const t: Tvm = { n: 10, iyr: 0, pv: 1000, pmt: 0, fv: 0 };
    expect(val(solveTvm(t, 'pmt')).value).toBeCloseTo(-100, 12);
    expect(val(solveTvm({ ...t, pmt: -100 }, 'n')).value).toBeCloseTo(10, 12);
    expect(val(solveTvm({ ...t, pmt: -100, iyr: 5 }, 'iyr')).value).toBeCloseTo(0, 9);
  });

  it('solves for a negative interest rate', () => {
    const r = val(solveTvm({ n: 5, iyr: 0, pv: -1000, pmt: 0, fv: 900 }, 'iyr'));
    expect(r.value).toBeCloseTo(100 * (0.9 ** (1 / 5) - 1), 9);
  });

  it('reports no interest rate when the signs do not allow one', () => {
    const r = solveTvm({ n: 10, iyr: 0, pv: 100, pmt: 10, fv: 100 }, 'iyr');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('not-solvable');
  });

  it('warns when several interest rates solve the equation', () => {
    // flows −100, +230, −132 → 10 % and 20 %
    const r = val(solveTvm({ n: 2, iyr: 0, pv: -100, pmt: 230, fv: -362 }, 'iyr'));
    expect(r.value).toBeCloseTo(10, 9);
    expect(r.warning).toMatch(/2 interest rates/);
    expect(r.warning).toMatch(/20\.0000/);
  });

  it('reports an impossible N', () => {
    // payment smaller than the interest: the loan is never paid off
    const r = solveTvm({ n: 0, iyr: 12, pv: 1000, pmt: -5, fv: 0, py: 12 }, 'n');
    expect(r.ok).toBe(false);
    expect(solveTvm({ n: 0, iyr: 0, pv: 1000, pmt: 0, fv: 0 }, 'n').ok).toBe(false);
  });

  it('validates the input', () => {
    expect(solveTvm({ ...mortgage, py: 0 }, 'pmt').ok).toBe(false);
    expect(solveTvm({ ...mortgage, n: 0 }, 'pmt').ok).toBe(false);
    expect(solveTvm({ ...mortgage, pv: NaN }, 'pmt').ok).toBe(false);
    expect(solveTvm({ ...mortgage, iyr: -1300 }, 'pmt').ok).toBe(false);
    // the unknown itself may be anything
    expect(solveTvm({ ...mortgage, pmt: NaN }, 'pmt').ok).toBe(true);
  });
});

describe('amortization', () => {
  const loan: Tvm = { ...mortgage, pmt: PMT };

  it('splits the first payment into interest and principal (HP/TI signs)', () => {
    const [row] = val(amortizationSchedule(loan, 1, 1));
    expect(row.period).toBe(1);
    expect(row.interest).toBeCloseTo(-1000, 10);
    expect(row.principal).toBeCloseTo(-199.1010503, 6);
    expect(row.balance).toBeCloseTo(199800.8989497, 6);
  });

  it('sums a year and the whole loan', () => {
    const y1 = val(amortize(loan, 1, 12));
    expect(y1.interest).toBeCloseTo(-11933.189179112622, 6);
    expect(y1.balance).toBeCloseTo(197543.97657544664, 6);
    expect(y1.interest + y1.principal).toBeCloseTo(12 * PMT, 8);
    const all = val(amortize(loan, 1, 360));
    expect(all.interest.toFixed(2)).toBe('-231676.38');
    expect(all.principal).toBeCloseTo(-200000, 5);
    expect(all.balance).toBeCloseTo(0, 5);
    const schedule = val(amortizationSchedule(loan));
    expect(schedule).toHaveLength(360);
    expect(schedule[359].balance).toBeCloseTo(0, 5);
  });

  it('rounds the interest to cents on request', () => {
    const rows = val(amortizationSchedule(loan, 1, 2, { decimals: 2 }));
    expect(rows[1].interest).toBe(Math.round(-199800.8989497 * 0.005 * 100) / 100);
  });

  it('uses no interest on the first payment in begin mode', () => {
    const lease: Tvm = { n: 12, iyr: 12, pv: 10000, pmt: 0, fv: 0, py: 12, timing: 'begin' };
    const pmt = val(solveTvm(lease, 'pmt')).value;
    const rows = val(amortizationSchedule({ ...lease, pmt }));
    expect(rows[0].interest).toBe(0);
    expect(rows[0].balance).toBeCloseTo(10000 + pmt, 8);
    expect(rows[11].balance).toBeCloseTo(0, 6);
  });

  it('validates the range', () => {
    expect(amortize(loan, 0, 12).ok).toBe(false);
    expect(amortize(loan, 5, 4).ok).toBe(false);
    expect(amortize(loan, 1, 1.5).ok).toBe(false);
    expect(amortizationSchedule({ ...loan, n: 12.5 }).ok).toBe(false);
  });
});

describe('interest conversion', () => {
  it('converts nominal to effective and back', () => {
    expect(val(nominalToEffective(6, 12))).toBeCloseTo(6.167781186449828, 12);
    expect(val(effectiveToNominal(6.167781186449828, 12))).toBeCloseTo(6, 12);
    expect(val(nominalToEffective(6, 1))).toBeCloseTo(6, 14);
    expect(val(nominalToEffective(8, 4))).toBeCloseTo(8.243216, 6);
  });

  it('handles continuous compounding', () => {
    expect(val(nominalToEffective(6, 'continuous'))).toBeCloseTo(6.183654654535964, 12);
    expect(val(effectiveToNominal(6.183654654535964, 'continuous'))).toBeCloseTo(6, 12);
  });

  it('rejects invalid periods and rates', () => {
    expect(nominalToEffective(6, 0).ok).toBe(false);
    expect(effectiveToNominal(-100, 12).ok).toBe(false);
    expect(nominalToEffective(-1300, 12).ok).toBe(false);
  });
});
