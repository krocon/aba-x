import { describe, expect, it } from 'vitest';
import {
  type Bond,
  accruedInterest,
  blackScholes,
  bondPrice,
  bondYield,
  normalCdf,
  solveBreakEven,
  solveMargin,
  solveMarkup,
  solvePercentChange,
} from './misc';

const val = <T>(r: { ok: boolean; value?: T; error?: { message: string } }) => {
  if (!r.ok) throw new Error(`not ok: ${r.error?.message}`);
  return r.value as T;
};
const d = (year: number, month: number, day: number) => ({ year, month, day });

describe('break-even', () => {
  const b = { fixedCost: 3000, variableCost: 15, price: 20, profit: 0, quantity: 600 };
  it('solves for every variable', () => {
    expect(val(solveBreakEven(b, 'quantity'))).toBe(600);
    expect(val(solveBreakEven({ ...b, quantity: 1000 }, 'profit'))).toBe(2000);
    expect(val(solveBreakEven({ ...b, profit: 2000, quantity: 1000 }, 'price'))).toBe(20);
    expect(val(solveBreakEven({ ...b, profit: 2000, quantity: 1000 }, 'variableCost'))).toBe(15);
    expect(val(solveBreakEven({ ...b, profit: 2000, quantity: 1000 }, 'fixedCost'))).toBe(3000);
  });
  it('reports impossible cases', () => {
    expect(solveBreakEven({ ...b, price: 15 }, 'quantity').ok).toBe(false);
    expect(solveBreakEven({ ...b, quantity: 0 }, 'price').ok).toBe(false);
    expect(solveBreakEven({ ...b, price: NaN }, 'quantity').ok).toBe(false);
  });
});

describe('percent change, margin, markup', () => {
  it('solves the percent change with periods', () => {
    expect(
      val(solvePercentChange({ old: 100, new: 121, percent: 0, periods: 2 }, 'percent')),
    ).toBeCloseTo(10, 12);
    expect(val(solvePercentChange({ old: 80, new: 0, percent: 25 }, 'new'))).toBe(100);
    expect(val(solvePercentChange({ old: 0, new: 100, percent: 25 }, 'old'))).toBe(80);
    expect(val(solvePercentChange({ old: 100, new: 50, percent: 0 }, 'percent'))).toBe(-50);
    expect(val(solvePercentChange({ old: 100, new: 200, percent: 7 }, 'periods'))).toBeCloseTo(
      Math.log(2) / Math.log(1.07),
      12,
    );
    expect(solvePercentChange({ old: 0, new: 5, percent: 0 }, 'percent').ok).toBe(false);
    expect(solvePercentChange({ old: 100, new: -5, percent: 3 }, 'periods').ok).toBe(false);
  });

  it('solves margin and markup', () => {
    expect(val(solveMargin({ cost: 75, price: 100, percent: 0 }, 'percent'))).toBe(25);
    expect(val(solveMargin({ cost: 75, price: 0, percent: 25 }, 'price'))).toBe(100);
    expect(val(solveMargin({ cost: 0, price: 100, percent: 25 }, 'cost'))).toBe(75);
    expect(val(solveMarkup({ cost: 75, price: 100, percent: 0 }, 'percent'))).toBeCloseTo(
      100 / 3,
      12,
    );
    expect(val(solveMarkup({ cost: 80, price: 0, percent: 25 }, 'price'))).toBe(100);
    expect(val(solveMarkup({ cost: 0, price: 100, percent: 25 }, 'cost'))).toBe(80);
    expect(solveMargin({ cost: 75, price: 0, percent: 100 }, 'price').ok).toBe(false);
    expect(solveMarkup({ cost: 0, price: 100, percent: 0 }, 'percent').ok).toBe(false);
  });
});

describe('bonds', () => {
  // Excel PRICE / YIELD documentation examples (basis 0 = 30/360 US)
  const bond: Bond = {
    settlement: d(2008, 2, 15),
    maturity: d(2017, 11, 15),
    couponRate: 5.75,
    frequency: 2,
    basis: '30/360',
  };

  it('computes the price from the yield', () => {
    const p = val(bondPrice(bond, 6.5));
    expect(p.price).toBeCloseTo(94.63436162, 7);
    expect(p.accruedInterest).toBeCloseTo(1.4375, 12);
    expect(p.dirtyPrice).toBeCloseTo(94.63436162 + 1.4375, 7);
    expect(val(accruedInterest(bond))).toBeCloseTo(1.4375, 12);
  });

  it('computes the yield from the price', () => {
    const y = val(bondYield({ ...bond, maturity: d(2016, 11, 15) }, 95.04287));
    expect(y).toBeCloseTo(6.5, 4);
    expect(val(bondYield(bond, 94.63436162))).toBeCloseTo(6.5, 7);
  });

  it('prices at par when the yield equals the coupon on a coupon date', () => {
    for (const basis of ['30/360', 'actual'] as const) {
      const b: Bond = { ...bond, settlement: d(2010, 5, 15), basis };
      expect(val(bondPrice(b, 5.75)).price).toBeCloseTo(100, 10);
      expect(val(bondPrice(b, 5.75)).accruedInterest).toBe(0);
    }
  });

  it('round-trips price and yield with actual/actual and annual coupons', () => {
    const b: Bond = {
      settlement: d(2024, 3, 7),
      maturity: d(2031, 8, 31),
      couponRate: 4,
      frequency: 1,
      basis: 'actual',
      redemption: 102,
    };
    const p = val(bondPrice(b, 3.3)).price;
    expect(val(bondYield(b, p))).toBeCloseTo(3.3, 9);
    // accrued interest: 2023-08-31 → 2024-03-07 is 189 of 366 days
    expect(val(accruedInterest(b))).toBeCloseTo((4 * 189) / 366, 12);
  });

  it('handles the last coupon period (simple interest)', () => {
    const b: Bond = { ...bond, settlement: d(2017, 8, 15) };
    const p = val(bondPrice(b, 6.5)).price;
    // (100 + 2.875) / (1 + 90/180 · 0.0325) − 2.875 · 90/180
    expect(p).toBeCloseTo(102.875 / (1 + 0.5 * 0.0325) - 1.4375, 10);
    expect(val(bondYield(b, p))).toBeCloseTo(6.5, 9);
  });

  it('validates the bond', () => {
    expect(bondPrice({ ...bond, settlement: d(2018, 1, 1) }, 5).ok).toBe(false);
    expect(bondPrice({ ...bond, frequency: 5 }, 5).ok).toBe(false);
    expect(bondPrice({ ...bond, settlement: d(2008, 2, 30) }, 5).ok).toBe(false);
    expect(bondYield(bond, -3).ok).toBe(false);
  });
});

describe('Black–Scholes', () => {
  const o = { spot: 100, strike: 100, rate: 5, volatility: 20, time: 1 };

  it('has an accurate normal distribution function', () => {
    expect(normalCdf(0)).toBe(0.5);
    expect(normalCdf(1)).toBeCloseTo(0.8413447460685429, 14);
    expect(normalCdf(-1.96)).toBeCloseTo(0.024997895148220435, 14);
    expect(normalCdf(-10) / 7.619853024160527e-24).toBeCloseTo(1, 10);
    expect(normalCdf(40)).toBe(1);
  });

  it('prices the reference call and put', () => {
    const r = val(blackScholes(o));
    expect(r.call).toBeCloseTo(10.450583572185565, 10);
    expect(r.put).toBeCloseTo(5.573526022256971, 10);
    expect(r.callGreeks.delta).toBeCloseTo(0.6368306511756191, 12);
    expect(r.callGreeks.gamma).toBeCloseTo(0.018762017345846895, 10);
    expect(r.callGreeks.vega).toBeCloseTo(0.3752403469169379, 10);
    expect(r.callGreeks.theta).toBeCloseTo(-6.414027546438197, 9);
    expect(r.callGreeks.rho).toBeCloseTo(0.5323248154537634, 10);
  });

  it('satisfies put–call parity with dividends', () => {
    const p = { ...o, dividendYield: 3, spot: 110, time: 0.75 };
    const r = val(blackScholes(p));
    const parity = 110 * Math.exp(-0.03 * 0.75) - 100 * Math.exp(-0.05 * 0.75);
    expect(r.call - r.put).toBeCloseTo(parity, 12);
    expect(r.callGreeks.delta - r.putGreeks.delta).toBeCloseTo(Math.exp(-0.03 * 0.75), 12);
  });

  it('matches the greeks with finite differences', () => {
    const p = { ...o, dividendYield: 2, spot: 95, time: 0.5 };
    const r = val(blackScholes(p));
    const price = (q: typeof p) => val(blackScholes(q));
    const h = 1e-4;
    const dS = (k: 'call' | 'put') =>
      (price({ ...p, spot: 95 + h })[k] - price({ ...p, spot: 95 - h })[k]) / (2 * h);
    expect(r.callGreeks.delta).toBeCloseTo(dS('call'), 7);
    expect(r.putGreeks.delta).toBeCloseTo(dS('put'), 7);
    const gamma =
      (price({ ...p, spot: 95 + 0.01 }).call - 2 * r.call + price({ ...p, spot: 95 - 0.01 }).call) /
      1e-4;
    expect(r.callGreeks.gamma).toBeCloseTo(gamma, 6);
    for (const k of ['call', 'put'] as const) {
      const greeks = k === 'call' ? r.callGreeks : r.putGreeks;
      const vega =
        (price({ ...p, volatility: 20 + h })[k] - price({ ...p, volatility: 20 - h })[k]) / (2 * h);
      const rho = (price({ ...p, rate: 5 + h })[k] - price({ ...p, rate: 5 - h })[k]) / (2 * h);
      const theta =
        -(price({ ...p, time: 0.5 + h })[k] - price({ ...p, time: 0.5 - h })[k]) / (2 * h);
      expect(greeks.vega).toBeCloseTo(vega, 6);
      expect(greeks.rho).toBeCloseTo(rho, 6);
      expect(greeks.theta).toBeCloseTo(theta, 5);
    }
  });

  it('rejects invalid input', () => {
    expect(blackScholes({ ...o, time: 0 }).ok).toBe(false);
    expect(blackScholes({ ...o, volatility: 0 }).ok).toBe(false);
    expect(blackScholes({ ...o, spot: -1 }).ok).toBe(false);
    expect(blackScholes({ ...o, rate: NaN }).ok).toBe(false);
  });
});
