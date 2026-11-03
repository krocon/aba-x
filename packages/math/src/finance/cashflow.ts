/**
 * Uneven cash flows (prompt 039): NPV, NFV, IRR, MIRR and payback period. `flows[0]` is CF0 at
 * time 0, `flows[t]` the flow at the end of period t; rates are in percent per period. Sign
 * convention as in TVM: received positive, paid negative.
 *
 * IRR is a polynomial root: with more than one sign change in the flows there may be several
 * (Descartes) – all rates found are returned and `irr` stays null, never a silently chosen root.
 */
import { type MathResult, fail, ok } from '../result';
import { signChangeRoots } from './tvm';

/** A group of equal flows (CFj with frequency Fj on TI/HP). */
export interface CashFlowGroup {
  readonly amount: number;
  readonly count?: number;
}

/** Expands CF0 and grouped flows into one flow per period. */
export function expandFlows(cf0: number, groups: readonly CashFlowGroup[]): MathResult<number[]> {
  const out = [cf0];
  for (const g of groups) {
    const c = g.count ?? 1;
    if (!Number.isInteger(c) || c < 1 || c > 1e5) {
      return fail('domain', 'the frequency of a cash flow must be a whole number 1 … 100 000');
    }
    for (let k = 0; k < c; k++) out.push(g.amount);
  }
  return ok(out);
}

function check(flows: readonly number[], rate?: number): MathResult<null> {
  if (flows.length === 0) return fail('domain', 'no cash flows');
  if (!flows.every(Number.isFinite)) return fail('domain', 'every cash flow must be a number');
  if (rate !== undefined && !(rate > -100 && Number.isFinite(rate))) {
    return fail('domain', 'the rate must be greater than −100 %');
  }
  return ok(null);
}

/** Σ CF_t / (1+r)^t (Horner in v = 1/(1+r)). */
function npvRaw(flows: readonly number[], r: number): number {
  const v = 1 / (1 + r);
  let s = 0;
  for (let t = flows.length - 1; t >= 0; t--) s = s * v + flows[t];
  return s;
}

/** Net present value at `rate` % per period. */
export function npv(flows: readonly number[], rate: number): MathResult<number> {
  const c = check(flows, rate);
  if (!c.ok) return c;
  return ok(npvRaw(flows, rate / 100));
}

/** Net future value at the last period: NPV · (1+r)^n. */
export function nfv(flows: readonly number[], rate: number): MathResult<number> {
  const c = check(flows, rate);
  if (!c.ok) return c;
  const r = rate / 100;
  let s = 0;
  for (const f of flows) s = s * (1 + r) + f;
  return ok(s);
}

/** Number of sign changes in the flows (zeros skipped). */
export function signChanges(flows: readonly number[]): number {
  let n = 0;
  let last = 0;
  for (const f of flows) {
    if (f === 0) continue;
    if (last !== 0 && Math.sign(f) !== Math.sign(last)) n++;
    last = f;
  }
  return n;
}

export interface IrrResult {
  /** The internal rate of return in % – null when several rates exist. */
  readonly irr: number | null;
  /** All rates (%) found in −99 % … 10 000 % per period, ascending. */
  readonly rates: number[];
  readonly signChanges: number;
  readonly warning?: string;
}

/**
 * Internal rate of return (NPV = 0) in % per period. Searches −99 % … 10 000 % for all sign
 * changes of NPV; no sign change in the flows or no rate found → `not-solvable`.
 */
export function irr(flows: readonly number[]): MathResult<IrrResult> {
  const c = check(flows);
  if (!c.ok) return c;
  const changes = signChanges(flows);
  if (changes === 0) {
    return fail('not-solvable', 'no IRR: the cash flows need at least one sign change');
  }
  // NPV in u = ln(1+r); for r < 0 the value NPV·(1+r)^n (same sign, no overflow towards −100 %)
  const g = (u: number) => {
    const r = Math.expm1(u);
    let val: number;
    if (u >= 0) val = npvRaw(flows, r);
    else {
      val = 0;
      for (const f of flows) val = val * (1 + r) + f;
    }
    return Number.isFinite(val) ? val : NaN;
  };
  const us = signChangeRoots(g, Math.log(0.01), Math.log(101), 6000);
  const rates = [...new Set(us.map((u) => 100 * Math.expm1(u)))].sort((a, b) => a - b);
  if (rates.length === 0) return fail('not-solvable', 'no IRR found (NPV has no zero)');
  if (rates.length > 1) {
    return ok({
      irr: null,
      rates,
      signChanges: changes,
      warning: `${rates.length} rates make the NPV zero – the IRR is not unique`,
    });
  }
  return ok({
    irr: rates[0],
    rates,
    signChanges: changes,
    ...(changes > 1
      ? { warning: `${changes} sign changes – another IRR may exist outside the searched range` }
      : {}),
  });
}

/**
 * Modified IRR in % per period: negative flows discounted to t = 0 at the finance rate, positive
 * flows compounded to t = n at the reinvestment rate; MIRR = (FV⁺ / −PV⁻)^(1/n) − 1.
 */
export function mirr(
  flows: readonly number[],
  financeRate: number,
  reinvestRate: number,
): MathResult<number> {
  const c = check(flows, financeRate);
  if (!c.ok) return c;
  const d = check(flows, reinvestRate);
  if (!d.ok) return d;
  const n = flows.length - 1;
  if (n < 1) return fail('domain', 'MIRR needs at least two cash flows');
  let pvNeg = 0;
  let fvPos = 0;
  flows.forEach((f, t) => {
    if (f < 0) pvNeg += f / (1 + financeRate / 100) ** t;
    else fvPos += f * (1 + reinvestRate / 100) ** (n - t);
  });
  if (pvNeg === 0 || fvPos === 0) {
    return fail('not-solvable', 'MIRR needs both negative and positive cash flows');
  }
  return ok(100 * ((fvPos / -pvNeg) ** (1 / n) - 1));
}

/**
 * Payback period: first time the cumulative (optionally discounted at `rate` %) flows reach 0,
 * linearly interpolated inside the period. Never paid back → `not-solvable`.
 */
export function paybackPeriod(flows: readonly number[], rate?: number): MathResult<number> {
  const c = check(flows, rate);
  if (!c.ok) return c;
  const r = (rate ?? 0) / 100;
  let cum = 0;
  for (let t = 0; t < flows.length; t++) {
    const f = flows[t] / (1 + r) ** t;
    const next = cum + f;
    if (t > 0 && cum < 0 && next >= 0) return ok(t - 1 + -cum / f);
    if (t === 0 && next >= 0) return ok(0);
    cum = next;
  }
  return fail('not-solvable', 'the investment is not paid back within the cash flows');
}
