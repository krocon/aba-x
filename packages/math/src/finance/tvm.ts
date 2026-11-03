/**
 * Time value of money (prompt 039): the TVM equation of financial calculators with N, I%YR, PV,
 * PMT, FV, P/YR (payments per year), C/YR (compounding periods per year) and payment at the
 * beginning or end of the period; amortization; nominal ↔ effective interest.
 *
 * Sign convention (like HP/TI): money received is positive, money paid is negative. A loan of
 * 200 000 has PV = +200 000 and PMT < 0; a savings plan has PV ≤ 0, PMT < 0 and FV > 0.
 *
 * With the periodic rate i = (1 + I%YR / (100·C/YR))^(C/YR / P/YR) − 1 and k = 1 (begin) or
 * 0 (end):  PV + PMT·(1 + i·k)·(1 − (1+i)^−N)/i + FV·(1+i)^−N = 0  (i = 0: PV + PMT·N + FV = 0).
 */
import { type MathResult, fail, ok } from '../result';
import { brent } from '../numeric/roots';

export type PaymentTiming = 'end' | 'begin';
export type TvmVariable = 'n' | 'iyr' | 'pv' | 'pmt' | 'fv';

export interface Tvm {
  /** Number of payment periods. */
  readonly n: number;
  /** Nominal annual interest rate in percent. */
  readonly iyr: number;
  readonly pv: number;
  readonly pmt: number;
  readonly fv: number;
  /** Payments per year (default 1). */
  readonly py?: number;
  /** Compounding periods per year (default = py). */
  readonly cy?: number;
  /** Payment timing (default 'end'). */
  readonly timing?: PaymentTiming;
}

export interface TvmSolution {
  /** The computed value of the unknown. */
  readonly value: number;
  /** All five values, the unknown replaced. */
  readonly tvm: Tvm & { readonly py: number; readonly cy: number; readonly timing: PaymentTiming };
  /** Hint when the result is not unique (several interest rates). */
  readonly warning?: string;
}

const periods = (t: Tvm) => ({ py: t.py ?? 1, cy: t.cy ?? t.py ?? 1 });

/** Periodic rate per payment period from I%YR, P/YR and C/YR. */
export function periodicRate(iyr: number, py = 1, cy = py): number {
  // (1 + j)^(cy/py) − 1 computed via log1p/expm1 (exact for small rates)
  return Math.expm1((cy / py) * Math.log1p(iyr / 100 / cy));
}

/** I%YR from the periodic rate (inverse of `periodicRate`). */
export function annualRate(i: number, py = 1, cy = py): number {
  return 100 * cy * Math.expm1((py / cy) * Math.log1p(i));
}

/** (1 − (1+i)^−n)/i, stable near i = 0 (→ n). */
function annuity(i: number, n: number): number {
  if (i === 0) return n;
  return -Math.expm1(-n * Math.log1p(i)) / i;
}

/** Value of the TVM equation (0 when the five values are consistent). */
export function tvmResidual(t: Tvm): number {
  const { py, cy } = periods(t);
  const i = periodicRate(t.iyr, py, cy);
  const k = t.timing === 'begin' ? 1 : 0;
  return t.pv + t.pmt * (1 + i * k) * annuity(i, t.n) + t.fv * Math.exp(-t.n * Math.log1p(i));
}

function validate(t: Tvm, unknown: TvmVariable): MathResult<null> {
  const { py, cy } = periods(t);
  if (!(py > 0) || !(cy > 0) || !Number.isFinite(py) || !Number.isFinite(cy)) {
    return fail('domain', 'P/YR and C/YR must be positive');
  }
  for (const key of ['n', 'iyr', 'pv', 'pmt', 'fv'] as const) {
    if (key !== unknown && !Number.isFinite(t[key]))
      return fail('domain', `${key} must be a number`);
  }
  if (unknown !== 'n' && !(t.n > 0)) return fail('domain', 'N must be positive');
  if (unknown !== 'iyr' && !(t.iyr / 100 / cy > -1)) {
    return fail('domain', 'the interest rate must be greater than −100 % per period');
  }
  return ok(null);
}

/**
 * Solves the TVM equation for one unknown: closed forms for N, PV, PMT and FV; I%YR numerically
 * (all sign changes of the equation in the rate are searched; several rates → warning, the one
 * closest to 0 is returned). No solution → `not-solvable`, never a guess.
 */
export function solveTvm(t: Tvm, unknown: TvmVariable): MathResult<TvmSolution> {
  const v = validate(t, unknown);
  if (!v.ok) return v;
  const { py, cy } = periods(t);
  const timing = t.timing ?? 'end';
  const k = timing === 'begin' ? 1 : 0;
  const done = (value: number, warning?: string): MathResult<TvmSolution> =>
    Number.isFinite(value)
      ? ok({
          value,
          tvm: { ...t, [unknown]: value, py, cy, timing },
          ...(warning ? { warning } : {}),
        })
      : fail('not-solvable', `no finite value for ${unknown}`);

  if (unknown === 'iyr') return solveRate(t, py, cy, k, done);

  const i = periodicRate(t.iyr, py, cy);
  const b = 1 + i * k;
  switch (unknown) {
    case 'pv':
      return done(-(t.pmt * b * annuity(i, t.n) + t.fv * Math.exp(-t.n * Math.log1p(i))));
    case 'fv':
      return done(-(t.pv + t.pmt * b * annuity(i, t.n)) * Math.exp(t.n * Math.log1p(i)));
    case 'pmt': {
      const a = b * annuity(i, t.n);
      if (a === 0) return fail('not-solvable', 'the payment is undefined for these values');
      return done(-(t.pv + t.fv * Math.exp(-t.n * Math.log1p(i))) / a);
    }
    case 'n': {
      if (i === 0) {
        if (t.pmt === 0) return fail('not-solvable', 'N is undefined for PMT = 0 at 0 % interest');
        const n = -(t.pv + t.fv) / t.pmt;
        return n > 0 ? done(n) : fail('not-solvable', 'no positive N solves these values');
      }
      // v^N = (PV + A)/(A − FV) with A = PMT·(1 + i·k)/i and v = 1/(1+i)
      const A = (t.pmt * b) / i;
      const ratio = (t.pv + A) / (A - t.fv);
      if (!(ratio > 0) || !Number.isFinite(ratio)) {
        return fail('not-solvable', 'no N solves these values (check the signs of PV, PMT and FV)');
      }
      const n = -Math.log(ratio) / Math.log1p(i);
      return n > 0 ? done(n) : fail('not-solvable', 'no positive N solves these values');
    }
  }
}

function solveRate(
  t: Tvm,
  py: number,
  cy: number,
  k: number,
  done: (value: number, warning?: string) => MathResult<TvmSolution>,
): MathResult<TvmSolution> {
  const flows = [t.pv, t.pmt, t.fv].filter((x) => x !== 0);
  if (!flows.some((x) => x > 0) || !flows.some((x) => x < 0)) {
    return fail('not-solvable', 'no interest rate: PV, PMT and FV need opposite signs');
  }
  // residual in u = ln(1 + i): the whole range i > −1 maps to the real line
  const g = (u: number) => {
    const i = Math.expm1(u);
    const r = t.pv + t.pmt * (1 + i * k) * annuity(i, t.n) + t.fv * Math.exp(-t.n * u);
    return Number.isFinite(r) ? r : NaN;
  };
  const roots = signChangeRoots(g, -6, 6, 4000);
  if (roots.length === 0) return fail('not-solvable', 'no interest rate solves these values');
  roots.sort((a, b) => Math.abs(a) - Math.abs(b));
  const warning =
    roots.length > 1
      ? `${roots.length} interest rates solve these values: ${roots
          .map((u) => annualRate(Math.expm1(u), py, cy).toPrecision(6))
          .join(', ')} %`
      : undefined;
  return done(annualRate(Math.expm1(roots[0]), py, cy), warning);
}

/**
 * All sign changes of `g` on [a, b] (grid + Brent); exact zeros on the grid included.
 * A sign change over a pole is not reported (|g| must be small at the root). Shared by the IRR.
 */
export function signChangeRoots(
  g: (u: number) => number,
  a: number,
  b: number,
  samples: number,
): number[] {
  const roots: number[] = [];
  const h = (b - a) / samples;
  let x0 = a;
  let g0 = g(x0);
  for (let s = 1; s <= samples; s++) {
    const x1 = s === samples ? b : a + s * h;
    const g1 = g(x1);
    if (g0 === 0) roots.push(x0);
    else if (!Number.isNaN(g0) && !Number.isNaN(g1) && g0 * g1 < 0) {
      const r = brent(g, x0, x1);
      if (r.ok && Math.abs(g(r.value.root)) <= 1e-6 * (Math.abs(g0) + Math.abs(g1))) {
        roots.push(r.value.root);
      }
    }
    x0 = x1;
    g0 = g1;
  }
  if (g0 === 0) roots.push(x0);
  return roots;
}

// ---------------------------------------------------------------------------------------------
// Amortization

export interface AmortizationRow {
  /** Payment number (1-based). */
  readonly period: number;
  /** Interest part of the payment (sign of PMT, like HP/TI). */
  readonly interest: number;
  /** Principal part of the payment (PMT − interest). */
  readonly principal: number;
  /** Balance after the payment (sign of PV). */
  readonly balance: number;
}

export interface AmortizationSummary {
  readonly from: number;
  readonly to: number;
  readonly interest: number;
  readonly principal: number;
  /** Balance after payment `to`. */
  readonly balance: number;
}

export interface AmortizationOptions {
  /** Rounds every interest amount to this many decimals (real loans: 2); default unrounded. */
  readonly decimals?: number;
}

/**
 * Amortization schedule of payments `from`…`to` (default all N), HP/TI style: interest =
 * −balance·i (in begin mode payment 1 has no interest and the interest of a period is paid
 * with the next payment), principal = PMT − interest, balance += principal.
 */
export function amortizationSchedule(
  t: Tvm,
  from = 1,
  to = t.n,
  o: AmortizationOptions = {},
): MathResult<AmortizationRow[]> {
  const v = validate(t, 'fv');
  if (!v.ok) return v;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return fail('domain', 'the payment range must be whole numbers 1 ≤ from ≤ to');
  }
  if (to > 1e6) return fail('domain', 'at most 1 000 000 payments');
  const { py, cy } = periods(t);
  const i = periodicRate(t.iyr, py, cy);
  const round =
    o.decimals === undefined
      ? (x: number) => x
      : (x: number) => {
          const f = 10 ** (o.decimals as number);
          return Math.round(x * f) / f;
        };
  const rows: AmortizationRow[] = [];
  let balance = t.pv;
  for (let p = 1; p <= to; p++) {
    const interest = t.timing === 'begin' && p === 1 ? 0 : round(-balance * i);
    const principal = t.pmt - interest;
    balance += principal;
    if (p >= from) rows.push({ period: p, interest, principal, balance });
  }
  return ok(rows);
}

/** Totals of interest and principal of payments `from`…`to` (AMORT of HP/TI). */
export function amortize(
  t: Tvm,
  from: number,
  to: number,
  o: AmortizationOptions = {},
): MathResult<AmortizationSummary> {
  const s = amortizationSchedule(t, from, to, o);
  if (!s.ok) return s;
  const rows = s.value;
  return ok({
    from,
    to,
    interest: rows.reduce((sum, r) => sum + r.interest, 0),
    principal: rows.reduce((sum, r) => sum + r.principal, 0),
    balance: rows[rows.length - 1].balance,
  });
}

// ---------------------------------------------------------------------------------------------
// Interest conversion

/** Compounding periods per year, or continuous compounding. */
export type Compounding = number | 'continuous';

function checkPeriods(c: Compounding): MathResult<null> {
  return c === 'continuous' || (Number.isFinite(c) && c > 0)
    ? ok(null)
    : fail('domain', 'the compounding periods must be positive');
}

/** Effective annual rate (%) of a nominal rate (%) compounded `c` times a year (or continuously). */
export function nominalToEffective(nominal: number, c: Compounding): MathResult<number> {
  const v = checkPeriods(c);
  if (!v.ok) return v;
  if (c === 'continuous') return ok(100 * Math.expm1(nominal / 100));
  if (!(nominal / 100 / c > -1)) return fail('domain', 'the rate must be above −100 % per period');
  return ok(100 * Math.expm1(c * Math.log1p(nominal / 100 / c)));
}

/** Nominal annual rate (%) compounded `c` times a year (or continuously) of an effective rate (%). */
export function effectiveToNominal(effective: number, c: Compounding): MathResult<number> {
  const v = checkPeriods(c);
  if (!v.ok) return v;
  if (!(effective > -100)) return fail('domain', 'the effective rate must be above −100 %');
  const l = Math.log1p(effective / 100);
  if (c === 'continuous') return ok(100 * l);
  return ok(100 * c * Math.expm1(l / c));
}
