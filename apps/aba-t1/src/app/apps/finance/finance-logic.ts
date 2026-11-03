/**
 * Finance app (prompt 039), pure wiring: the state of every worksheet and the solve / result
 * steps. All formulas live in `@aba/math/finance/*` (sign convention: money received positive,
 * paid negative – see docs/mathematics/finance.md).
 */
import {
  type CashFlowGroup,
  expandFlows,
  irr,
  mirr,
  nfv,
  npv,
  paybackPeriod,
} from '@aba/math/finance/cashflow';
import {
  type CalendarDate,
  type DayCountBasis,
  addDays,
  dayOfWeek,
  daysBetween,
  formatDate,
  parseDate,
} from '@aba/math/finance/dates';
import { type DepreciationMethod, depreciation } from '@aba/math/finance/depreciation';
import {
  type BlackScholesResult,
  type BondPrice,
  type BreakEven,
  blackScholes,
  bondPrice,
  bondYield,
  solveBreakEven,
  solveMargin,
  solveMarkup,
  solvePercentChange,
} from '@aba/math/finance/misc';
import {
  type AmortizationRow,
  type PaymentTiming,
  type Tvm,
  type TvmVariable,
  amortizationSchedule,
  effectiveToNominal,
  nominalToEffective,
  solveTvm,
} from '@aba/math/finance/tvm';
import { type MathResult, fail, ok } from '@aba/math/result';

export const SHEETS = [
  'tvm',
  'cash',
  'conv',
  'date',
  'depr',
  'break',
  'pct',
  'margin',
  'bond',
  'bs',
] as const;
export type Sheet = (typeof SHEETS)[number];

export interface TvmState {
  n: number;
  iyr: number;
  pv: number;
  pmt: number;
  fv: number;
  py: number;
  cy: number;
  timing: PaymentTiming;
}

export interface FinanceState {
  sheet: Sheet;
  tvm: TvmState;
  cash: { cf0: number; flows: CashFlowGroup[]; rate: number; finRate: number; reinvRate: number };
  conv: { nominal: number; effective: number; c: number };
  date: { d1: string; d2: string; basis: DayCountBasis; add: number };
  depr: {
    method: DepreciationMethod;
    cost: number;
    salvage: number;
    life: number;
    factor: number;
    year: number;
  };
  brk: BreakEven;
  pct: { old: number; new: number; percent: number; periods: number };
  margin: { cost: number; price: number; percent: number; markup: boolean };
  bond: {
    settlement: string;
    maturity: string;
    coupon: number;
    redemption: number;
    frequency: number;
    basis: DayCountBasis;
    yld: number;
    price: number;
  };
  bs: {
    spot: number;
    strike: number;
    rate: number;
    volatility: number;
    time: number;
    dividend: number;
  };
}

export function initFinance(): FinanceState {
  return {
    sheet: 'tvm',
    tvm: { n: 360, iyr: 6, pv: 200000, pmt: 0, fv: 0, py: 12, cy: 12, timing: 'end' },
    cash: {
      cf0: -1000,
      flows: [
        { amount: 300, count: 1 },
        { amount: 400, count: 1 },
        { amount: 500, count: 1 },
      ],
      rate: 8,
      finRate: 8,
      reinvRate: 8,
    },
    conv: { nominal: 6, effective: 0, c: 12 },
    date: { d1: '2024-01-01', d2: '2024-12-31', basis: 'actual', add: 100 },
    depr: { method: 'sl', cost: 10000, salvage: 1000, life: 5, factor: 2, year: 1 },
    brk: { fixedCost: 5000, variableCost: 20, price: 45, profit: 0, quantity: 0 },
    pct: { old: 100, new: 120, percent: 0, periods: 1 },
    margin: { cost: 80, price: 100, percent: 0, markup: false },
    bond: {
      settlement: '2024-01-15',
      maturity: '2034-01-15',
      coupon: 5,
      redemption: 100,
      frequency: 2,
      basis: '30/360',
      yld: 6,
      price: 0,
    },
    bs: { spot: 100, strike: 100, rate: 5, volatility: 20, time: 1, dividend: 0 },
  };
}

export const TVM_KEYS: TvmVariable[] = ['n', 'iyr', 'pv', 'pmt', 'fv'];

export const toTvm = (t: TvmState): Tvm => ({ ...t });

/** Solves the TVM field `key`; the new state and a warning, or an error. */
export function solveTvmField(
  t: TvmState,
  key: TvmVariable,
): MathResult<{ tvm: TvmState; warning?: string }> {
  const r = solveTvm(toTvm(t), key);
  if (!r.ok) return r;
  return ok({ tvm: { ...t, [key]: r.value.value }, warning: r.value.warning });
}

/** The amortization table of all payments (unrounded, like the TVM values). */
export function amortTable(t: TvmState): MathResult<AmortizationRow[]> {
  if (!Number.isInteger(t.n) || t.n < 1) {
    return fail('domain', 'N must be a whole number of payments for the amortization table');
  }
  return amortizationSchedule(toTvm(t));
}

export interface AmortYear {
  year: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Sums of interest and principal per group of `size` payments (a year: P/YR payments). */
export function amortGroups(rows: readonly AmortizationRow[], size: number): AmortYear[] {
  const out: AmortYear[] = [];
  const k = Math.max(1, Math.round(size));
  for (let i = 0; i < rows.length; i += k) {
    const part = rows.slice(i, i + k);
    out.push({
      year: out.length + 1,
      interest: part.reduce((s, r) => s + r.interest, 0),
      principal: part.reduce((s, r) => s + r.principal, 0),
      balance: part[part.length - 1].balance,
    });
  }
  return out;
}

export function cashFlows(c: FinanceState['cash']): MathResult<number[]> {
  return expandFlows(c.cf0, c.flows);
}

export interface CashResults {
  npv: MathResult<number>;
  nfv: MathResult<number>;
  irr: MathResult<{ irr: number | null; rates: number[]; warning?: string }>;
  mirr: MathResult<number>;
  payback: MathResult<number>;
  discountedPayback: MathResult<number>;
}

export function cashResults(c: FinanceState['cash']): MathResult<CashResults> {
  const f = cashFlows(c);
  if (!f.ok) return f;
  return ok({
    npv: npv(f.value, c.rate),
    nfv: nfv(f.value, c.rate),
    irr: irr(f.value),
    mirr: mirr(f.value, c.finRate, c.reinvRate),
    payback: paybackPeriod(f.value),
    discountedPayback: paybackPeriod(f.value, c.rate),
  });
}

export const compounding = (c: number) => (c === 0 ? ('continuous' as const) : c);

/** Interest conversion: solve the nominal or the effective rate. */
export function solveConv(
  s: FinanceState['conv'],
  key: 'nominal' | 'effective',
): MathResult<FinanceState['conv']> {
  const r =
    key === 'effective'
      ? nominalToEffective(s.nominal, compounding(s.c))
      : effectiveToNominal(s.effective, compounding(s.c));
  return r.ok ? ok({ ...s, [key]: r.value }) : r;
}

export interface DateResults {
  days: MathResult<number>;
  dow1: MathResult<string>;
  dow2: MathResult<string>;
  plus: MathResult<string>;
}

export function dateResults(d: FinanceState['date']): DateResults {
  const a = parseDate(d.d1);
  const b = parseDate(d.d2);
  const dow = (x: MathResult<CalendarDate>): MathResult<string> => {
    if (!x.ok) return x;
    const w = dayOfWeek(x.value);
    return w.ok ? ok(w.value.name) : w;
  };
  const plus = a.ok ? addDays(a.value, d.add) : a;
  return {
    days: !a.ok ? a : !b.ok ? b : daysBetween(a.value, b.value, d.basis),
    dow1: dow(a),
    dow2: dow(b),
    plus: plus.ok ? ok(formatDate(plus.value)) : plus,
  };
}

/** Checks an ISO date typed into a field (null = fine). */
export function dateError(text: string): string | null {
  const r = parseDate(text);
  return r.ok ? null : r.error.message;
}

export function deprResult(d: FinanceState['depr']) {
  return depreciation(
    {
      method: d.method,
      cost: d.cost,
      salvage: d.salvage,
      life: d.life,
      factor: d.factor,
      switchToSl: false,
    },
    d.year,
  );
}

export type BreakKey = keyof BreakEven;
export const BREAK_KEYS: BreakKey[] = ['fixedCost', 'variableCost', 'price', 'profit', 'quantity'];

export function solveBreak(b: BreakEven, key: BreakKey): MathResult<BreakEven> {
  const r = solveBreakEven(b, key);
  return r.ok ? ok({ ...b, [key]: r.value }) : r;
}

export type PctKey = 'old' | 'new' | 'percent' | 'periods';
export function solvePct(p: FinanceState['pct'], key: PctKey): MathResult<FinanceState['pct']> {
  const r = solvePercentChange(p, key);
  return r.ok ? ok({ ...p, [key]: r.value }) : r;
}

export type MarginKey = 'cost' | 'price' | 'percent';
export function solveMarginField(
  m: FinanceState['margin'],
  key: MarginKey,
): MathResult<FinanceState['margin']> {
  const v = { cost: m.cost, price: m.price, percent: m.percent };
  const r = (m.markup ? solveMarkup : solveMargin)(v, key);
  return r.ok ? ok({ ...m, [key]: r.value }) : r;
}

function bondInput(b: FinanceState['bond']) {
  const s = parseDate(b.settlement);
  if (!s.ok) return s;
  const m = parseDate(b.maturity);
  if (!m.ok) return m;
  return ok({
    settlement: s.value,
    maturity: m.value,
    couponRate: b.coupon,
    redemption: b.redemption,
    frequency: b.frequency,
    basis: b.basis,
  });
}

/** Bond price from the yield. */
export function bondFromYield(b: FinanceState['bond']): MathResult<BondPrice> {
  const i = bondInput(b);
  return i.ok ? bondPrice(i.value, b.yld) : i;
}

/** Solves the bond price (from the yield) or the yield (from the price). */
export function solveBond(
  b: FinanceState['bond'],
  key: 'price' | 'yld',
): MathResult<FinanceState['bond']> {
  const i = bondInput(b);
  if (!i.ok) return i;
  if (key === 'price') {
    const p = bondPrice(i.value, b.yld);
    return p.ok ? ok({ ...b, price: p.value.price }) : p;
  }
  const y = bondYield(i.value, b.price);
  return y.ok ? ok({ ...b, yld: y.value }) : y;
}

export function bsResult(o: FinanceState['bs']): MathResult<BlackScholesResult> {
  return blackScholes({
    spot: o.spot,
    strike: o.strike,
    rate: o.rate,
    volatility: o.volatility,
    time: o.time,
    dividendYield: o.dividend,
  });
}

/** NPV as a function of the rate (for the NPV profile plot). */
export function npvProfile(c: FinanceState['cash']): ((rate: number) => number) | null {
  const f = cashFlows(c);
  if (!f.ok) return null;
  return (r) => {
    const v = npv(f.value, r);
    return v.ok ? v.value : NaN;
  };
}
