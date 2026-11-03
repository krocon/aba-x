/**
 * Smaller finance worksheets (prompt 039): break-even, percent change, margin and markup, bonds
 * (price ↔ yield, accrued interest) and Black–Scholes with greeks. Rates are in percent. Every
 * worksheet solves for one chosen unknown; impossible combinations are errors, never guesses.
 */
import { type MathResult, fail, ok } from '../result';
import { brent } from '../numeric/roots';
import {
  type CalendarDate,
  type DayCountBasis,
  addMonths,
  dayNumber,
  days360,
  daysInMonth,
  validateDate,
} from './dates';

const finite = (values: Record<string, number | undefined>, skip: string): MathResult<null> => {
  for (const [k, v] of Object.entries(values)) {
    if (k !== skip && !Number.isFinite(v)) return fail('domain', `${k} must be a number`);
  }
  return ok(null);
};

const result = (x: number, what: string): MathResult<number> =>
  Number.isFinite(x) ? ok(x) : fail('not-solvable', `${what} is undefined for these values`);

// ---------------------------------------------------------------------------------------------
// Break-even:  profit = quantity·(price − variableCost) − fixedCost

export interface BreakEven {
  readonly fixedCost: number;
  readonly variableCost: number;
  readonly price: number;
  readonly profit: number;
  readonly quantity: number;
}

/** Solves the break-even equation for one unknown (profit 0 = break-even quantity). */
export function solveBreakEven(b: BreakEven, unknown: keyof BreakEven): MathResult<number> {
  const c = finite({ ...b }, unknown);
  if (!c.ok) return c;
  const { fixedCost: fc, variableCost: vc, price: p, profit: pft, quantity: q } = b;
  switch (unknown) {
    case 'profit':
      return ok(q * (p - vc) - fc);
    case 'fixedCost':
      return ok(q * (p - vc) - pft);
    case 'quantity':
      if (p === vc) return fail('not-solvable', 'price equals variable cost – no break-even');
      return result((pft + fc) / (p - vc), 'the quantity');
    case 'price':
      if (q === 0) return fail('not-solvable', 'the price is undefined for quantity 0');
      return ok((pft + fc) / q + vc);
    case 'variableCost':
      if (q === 0) return fail('not-solvable', 'the variable cost is undefined for quantity 0');
      return ok(p - (pft + fc) / q);
  }
}

// ---------------------------------------------------------------------------------------------
// Percent change:  new = old·(1 + percent/100)^periods

export interface PercentChange {
  readonly old: number;
  readonly new: number;
  readonly percent: number;
  /** Compounding periods (default 1). */
  readonly periods?: number;
}

/** Solves the percent-change equation (with compounding periods) for one unknown. */
export function solvePercentChange(
  p: PercentChange,
  unknown: 'old' | 'new' | 'percent' | 'periods',
): MathResult<number> {
  const n = p.periods ?? 1;
  const c = finite({ old: p.old, new: p.new, percent: p.percent, periods: n }, unknown);
  if (!c.ok) return c;
  const g = 1 + p.percent / 100;
  switch (unknown) {
    case 'new':
      return result(p.old * g ** n, 'the new value');
    case 'old':
      if (g === 0) return fail('not-solvable', 'the old value is undefined for −100 %');
      return result(p.new / g ** n, 'the old value');
    case 'percent': {
      if (p.old === 0) return fail('not-solvable', 'the change from 0 is undefined');
      if (n === 0) return fail('not-solvable', 'the change is undefined for 0 periods');
      const q = p.new / p.old;
      if (q < 0 && n !== 1) return fail('not-solvable', 'old and new have different signs');
      return result(100 * (n === 1 ? q - 1 : q ** (1 / n) - 1), 'the percentage');
    }
    case 'periods': {
      const q = p.new / p.old;
      if (!(q > 0) || !(g > 0) || g === 1) {
        return fail('not-solvable', 'no number of periods solves these values');
      }
      return result(Math.log(q) / Math.log(g), 'the number of periods');
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Margin (on the price) and markup (on the cost)

export interface Margin {
  readonly cost: number;
  readonly price: number;
  /** Percent of the price, or of the cost for markup. */
  readonly percent: number;
}

/** Gross margin: percent = (price − cost)/price · 100. */
export function solveMargin(m: Margin, unknown: keyof Margin): MathResult<number> {
  const c = finite({ ...m }, unknown);
  if (!c.ok) return c;
  switch (unknown) {
    case 'percent':
      if (m.price === 0) return fail('not-solvable', 'the margin of a price 0 is undefined');
      return ok((100 * (m.price - m.cost)) / m.price);
    case 'price':
      if (m.percent === 100) return fail('not-solvable', 'a margin of 100 % has no price');
      return ok(m.cost / (1 - m.percent / 100));
    case 'cost':
      return ok(m.price * (1 - m.percent / 100));
  }
}

/** Markup: percent = (price − cost)/cost · 100. */
export function solveMarkup(m: Margin, unknown: keyof Margin): MathResult<number> {
  const c = finite({ ...m }, unknown);
  if (!c.ok) return c;
  switch (unknown) {
    case 'percent':
      if (m.cost === 0) return fail('not-solvable', 'the markup on a cost 0 is undefined');
      return ok((100 * (m.price - m.cost)) / m.cost);
    case 'price':
      return ok(m.cost * (1 + m.percent / 100));
    case 'cost':
      if (m.percent === -100) return fail('not-solvable', 'a markup of −100 % has no cost');
      return ok(m.price / (1 + m.percent / 100));
  }
}

// ---------------------------------------------------------------------------------------------
// Bonds (price per 100 of par, like the TI BA II Plus and Excel PRICE/YIELD)

export interface Bond {
  readonly settlement: CalendarDate;
  readonly maturity: CalendarDate;
  /** Annual coupon rate in %. */
  readonly couponRate: number;
  /** Redemption value per 100 par (default 100). */
  readonly redemption?: number;
  /** Coupons per year: 1 or 2 (default 2). Others (4, 12) are accepted too. */
  readonly frequency?: number;
  /** Day count (default '30/360'): 'actual' = actual/actual. */
  readonly basis?: DayCountBasis;
}

export interface BondPrice {
  /** Clean price per 100 par. */
  readonly price: number;
  readonly accruedInterest: number;
  /** Price + accrued interest. */
  readonly dirtyPrice: number;
}

interface BondPeriod {
  /** Coupons from the next coupon date to maturity. */
  readonly n: number;
  /** Days of the coupon period (E), days since its start (A), days to the next coupon (DSC). */
  readonly e: number;
  readonly a: number;
  readonly dsc: number;
  readonly coupon: number;
  readonly redemption: number;
  readonly m: number;
}

function bondPeriod(b: Bond): MathResult<BondPeriod> {
  const s = validateDate(b.settlement);
  if (!s.ok) return s;
  const mt = validateDate(b.maturity);
  if (!mt.ok) return mt;
  const m = b.frequency ?? 2;
  if (![1, 2, 3, 4, 6, 12].includes(m)) {
    return fail('domain', 'the coupon frequency must be 1, 2, 3, 4, 6 or 12 per year');
  }
  const redemption = b.redemption ?? 100;
  if (!(redemption > 0) || !Number.isFinite(b.couponRate) || b.couponRate < 0) {
    return fail('domain', 'the coupon rate must be ≥ 0 and the redemption value positive');
  }
  const ds = dayNumber(b.settlement);
  if (ds >= dayNumber(b.maturity)) {
    return fail('domain', 'the settlement date must be before the maturity date');
  }
  const step = 12 / m;
  const eom = b.maturity.day === daysInMonth(b.maturity.year, b.maturity.month);
  // previous coupon date ≤ settlement < next coupon date, counted back from maturity
  let k = 1;
  while (dayNumber(addMonths(b.maturity, -k * step, eom)) > ds) k++;
  const prev = addMonths(b.maturity, -k * step, eom);
  const next = addMonths(b.maturity, -(k - 1) * step, eom);
  const basis = b.basis ?? '30/360';
  const e = basis === 'actual' ? dayNumber(next) - dayNumber(prev) : 360 / m;
  const a = basis === 'actual' ? ds - dayNumber(prev) : days360(prev, b.settlement);
  const dsc = basis === 'actual' ? dayNumber(next) - ds : e - a;
  return ok({ n: k, e, a, dsc, coupon: b.couponRate / m, redemption, m });
}

function priceAt(p: BondPeriod, yieldPct: number): number {
  const y = yieldPct / 100 / p.m;
  const ai = (p.coupon * p.a) / p.e;
  if (p.n === 1) return (p.redemption + p.coupon) / (1 + (p.dsc / p.e) * y) - ai;
  const lv = Math.log1p(y);
  const off = p.dsc / p.e;
  let sum = 0;
  for (let k = 1; k <= p.n; k++) sum += p.coupon * Math.exp(-(k - 1 + off) * lv);
  return p.redemption * Math.exp(-(p.n - 1 + off) * lv) + sum - ai;
}

/** Clean price, accrued interest and dirty price for an annual yield (%) to redemption. */
export function bondPrice(b: Bond, yieldPct: number): MathResult<BondPrice> {
  const p = bondPeriod(b);
  if (!p.ok) return p;
  if (!Number.isFinite(yieldPct) || !(yieldPct / 100 / p.value.m > -1)) {
    return fail('domain', 'the yield must be greater than −100 % per coupon period');
  }
  const price = priceAt(p.value, yieldPct);
  const accruedInterest = (p.value.coupon * p.value.a) / p.value.e;
  if (!Number.isFinite(price)) return fail('not-solvable', 'the price is undefined for this yield');
  return ok({ price, accruedInterest, dirtyPrice: price + accruedInterest });
}

/** Annual yield (%) to redemption from the clean price (the price falls with the yield). */
export function bondYield(b: Bond, price: number): MathResult<number> {
  const p = bondPeriod(b);
  if (!p.ok) return p;
  if (!(price > 0) || !Number.isFinite(price)) return fail('domain', 'the price must be positive');
  const g = (y: number) => {
    const v = priceAt(p.value, y) - price;
    return Number.isFinite(v) ? v : NaN;
  };
  const lo = -50 * p.value.m;
  const hi = 100000;
  if (!(g(lo) > 0) || !(g(hi) < 0)) {
    return fail('not-solvable', 'no yield gives this price');
  }
  const r = brent(g, lo, hi, { tol: 1e-15 });
  return r.ok ? ok(r.value.root) : r;
}

/** Accrued interest per 100 par at settlement. */
export function accruedInterest(b: Bond): MathResult<number> {
  const p = bondPeriod(b);
  return p.ok ? ok((p.value.coupon * p.value.a) / p.value.e) : p;
}

// ---------------------------------------------------------------------------------------------
// Black–Scholes (European options, continuous dividend yield)

export interface BlackScholesInput {
  readonly spot: number;
  readonly strike: number;
  /** Continuously compounded risk-free rate in % per year. */
  readonly rate: number;
  /** Volatility in % per year. */
  readonly volatility: number;
  /** Time to expiry in years. */
  readonly time: number;
  /** Continuous dividend yield in % per year (default 0). */
  readonly dividendYield?: number;
}

export interface Greeks {
  readonly delta: number;
  readonly gamma: number;
  /** Per year (divide by 365 for one day). */
  readonly theta: number;
  /** Per 1 percentage point of volatility. */
  readonly vega: number;
  /** Per 1 percentage point of the rate. */
  readonly rho: number;
}

export interface BlackScholesResult {
  readonly call: number;
  readonly put: number;
  readonly d1: number;
  readonly d2: number;
  readonly callGreeks: Greeks;
  readonly putGreeks: Greeks;
}

/**
 * Standard normal distribution function Φ(x), double precision (Hart 1968 / West 2005, continued
 * fraction beyond 7.07 – accurate in the tails, unlike 1 − erf).
 */
export function normalCdf(x: number): number {
  const z = Math.abs(x);
  let c: number;
  if (z > 37) c = 0;
  else {
    const e = Math.exp((-z * z) / 2);
    if (z < 7.07106781186547) {
      let n = 3.52624965998911e-2 * z + 0.700383064443688;
      n = n * z + 6.37396220353165;
      n = n * z + 33.912866078383;
      n = n * z + 112.079291497871;
      n = n * z + 221.213596169931;
      n = n * z + 220.206867912376;
      let d = 8.83883476483184e-2 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      c = (e * n) / d;
    } else {
      // continued fraction φ(z) / (z + 1/(z + 2/(z + 3/(z + …))))
      let b = z;
      for (let k = 60; k >= 1; k--) b = z + k / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

const normalPdf = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);

/** Black–Scholes–Merton prices of a European call and put with greeks. */
export function blackScholes(o: BlackScholesInput): MathResult<BlackScholesResult> {
  const { spot: S, strike: K, time: T } = o;
  const r = o.rate / 100;
  const sigma = o.volatility / 100;
  const q = (o.dividendYield ?? 0) / 100;
  if (![S, K, T, r, sigma, q].every(Number.isFinite)) return fail('domain', 'invalid values');
  if (!(S > 0) || !(K > 0)) return fail('domain', 'spot and strike must be positive');
  if (!(T > 0)) return fail('domain', 'the time to expiry must be positive');
  if (!(sigma > 0)) return fail('domain', 'the volatility must be positive');
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const dq = Math.exp(-q * T);
  const dr = Math.exp(-r * T);
  const call = S * dq * normalCdf(d1) - K * dr * normalCdf(d2);
  const put = K * dr * normalCdf(-d2) - S * dq * normalCdf(-d1);
  const gamma = (dq * normalPdf(d1)) / (S * sigma * sqrtT);
  const vega = (S * dq * normalPdf(d1) * sqrtT) / 100;
  const decay = -(S * dq * normalPdf(d1) * sigma) / (2 * sqrtT);
  return ok({
    call,
    put,
    d1,
    d2,
    callGreeks: {
      delta: dq * normalCdf(d1),
      gamma,
      theta: decay - r * K * dr * normalCdf(d2) + q * S * dq * normalCdf(d1),
      vega,
      rho: (K * T * dr * normalCdf(d2)) / 100,
    },
    putGreeks: {
      delta: -dq * normalCdf(-d1),
      gamma,
      theta: decay + r * K * dr * normalCdf(-d2) - q * S * dq * normalCdf(-d1),
      vega,
      rho: (-K * T * dr * normalCdf(-d2)) / 100,
    },
  });
}
