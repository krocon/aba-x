/**
 * Arithmetic of quantities with units and of based integers (prompt 031) for `evaluateValue`.
 * Each function returns null when its operands are plain real/complex numbers, so the evaluator
 * continues with its own rules.
 */
import {
  type Base,
  type IntegerSettings,
  DEFAULT_INTEGER,
  arith,
  bits,
  mask,
  parseBased,
  toSigned,
} from '../integer/base';
import { type MathResult, fail, ok } from '../result';
import {
  baseUnits,
  convertValue,
  derivedFor,
  dimensionless,
  isUnitName,
  measure,
  multiplyUnits,
  powUnits,
} from '../units/units';
import { type BasedInt, type Value, based, quantity, real } from './value';

const isQ = (v: Value) => v.kind === 'unit' || v.kind === 'int';

export function intLiteral(lit: string, s: IntegerSettings = DEFAULT_INTEGER): MathResult<Value> {
  const r = parseBased(lit, s.base);
  return r.ok ? ok(based(mask(r.value.v, s.bits), r.value.base)) : r;
}

export function unitSymbol(name: string): MathResult<Value> {
  const n = name.slice(1);
  return isUnitName(n) ? ok(quantity(1, { [n]: 1 })) : fail('unknown-symbol', `unknown unit ${n}`);
}

const big = (v: BasedInt) => BigInt(v.v);
/** A based integer as a real number (two's complement if signed). */
export const intReal = (v: BasedInt, s: IntegerSettings) => Number(toSigned(big(v), s));

/** Plain number of a value for functions: integers → real, dimensionless quantities → SI value. */
export function plain(
  v: Value,
  s: IntegerSettings,
): MathResult<{ value: Value; radians: boolean }> {
  if (v.kind === 'int') return ok({ value: real(intReal(v, s)), radians: false });
  if (v.kind === 'unit') {
    const m = measure(v.u);
    if (!m) return fail('unknown-symbol', 'unknown unit');
    if (!dimensionless(m.dims)) return fail('domain', 'this function needs a number without units');
    return ok({ value: real(v.v * m.factor), radians: true });
  }
  return ok({ value: v, radians: false });
}

function scalar(v: Value): number | null {
  return v.kind === 'real' ? v.v : null;
}

export function binaryQ(
  op: string,
  a: Value,
  b: Value,
  s: IntegerSettings,
): MathResult<Value> | null {
  if (!isQ(a) && !isQ(b)) return null;
  if (a.kind === 'complex' || b.kind === 'complex') {
    return fail('unsupported', 'complex numbers with units or based integers are not supported');
  }
  // based integers: with each other (or with whole reals) in the integer arithmetic
  if (a.kind === 'int' || b.kind === 'int') {
    if (a.kind === 'unit' || b.kind === 'unit')
      return fail('unsupported', 'based integers have no units');
    const whole = (v: Value) => v.kind === 'int' || (v.kind === 'real' && Number.isInteger(v.v));
    if (whole(a) && whole(b)) {
      const base = (a.kind === 'int' ? a : (b as BasedInt)).base;
      const toBig = (v: Value) =>
        v.kind === 'int' ? big(v) : mask(BigInt((v as { v: number }).v), s.bits);
      const r = arith(op as '+', toBig(a), toBig(b), s);
      return r.ok ? ok(based(r.value, base)) : r;
    }
    return null; // mixed with fractions: real arithmetic (the evaluator converts)
  }
  // quantities
  const ua = a.kind === 'unit' ? a.u : {};
  const ub = b.kind === 'unit' ? b.u : {};
  const va = a.kind === 'unit' ? a.v : (a as { v: number }).v;
  const vb = b.kind === 'unit' ? b.v : (b as { v: number }).v;
  switch (op) {
    case '*':
      return ok(quantity(va * vb, multiplyUnits(ua, ub)));
    case '/':
      if (vb === 0) return fail('division-by-zero', 'division by zero');
      return ok(quantity(va / vb, multiplyUnits(ua, ub, -1)));
    case '^': {
      if (b.kind === 'unit') return fail('domain', 'an exponent cannot have units');
      const u = powUnits(ua, vb);
      if (!u.ok) return u;
      return ok(quantity(va ** vb, u.value));
    }
    default: {
      // + and −: the right operand in the units of the left one
      const conv = convertValue(vb, ub, ua);
      if (!conv.ok) return fail('domain', 'cannot add quantities of different dimensions');
      const da = measure(ua);
      const db = measure(ub);
      // temperature differences: no offset (20 °C + 5 K = 25 °C)
      const diff = da && db ? (vb * db.factor) / da.factor : conv.value;
      const sum = op === '+' ? va + diff : va - diff;
      return ok(quantity(sum, ua));
    }
  }
}

export function compareQ(
  op: string,
  a: Value,
  b: Value,
  s: IntegerSettings,
): MathResult<boolean> | null {
  if (!isQ(a) && !isQ(b)) return null;
  const n = (v: Value): number | null =>
    v.kind === 'int' ? intReal(v, s) : v.kind === 'real' ? v.v : v.kind === 'unit' ? v.v : null;
  const x = n(a);
  let y = n(b);
  if (x === null || y === null) return fail('domain', 'complex numbers cannot be compared here');
  if (a.kind === 'unit' || b.kind === 'unit') {
    const conv = convertValue(y, b.kind === 'unit' ? b.u : {}, a.kind === 'unit' ? a.u : {});
    if (!conv.ok) return fail('domain', 'cannot compare quantities of different dimensions');
    y = conv.value;
  }
  const close = (p: number, q: number) =>
    p === q || Math.abs(p - q) <= 1e-12 * Math.max(Math.abs(p), Math.abs(q));
  switch (op) {
    case '=':
      return ok(close(x, y));
    case '!=':
      return ok(!close(x, y));
    case '<':
      return ok(x < y);
    case '>':
      return ok(x > y);
    case '<=':
      return ok(x <= y);
    default:
      return ok(x >= y);
  }
}

const BIT: Record<string, Parameters<typeof bits>[0]> = {
  bitand: 'and',
  bitor: 'or',
  bitxor: 'xor',
  bitnot: 'not',
  bitsl: 'sl',
  bitsr: 'sr',
  bitasr: 'asr',
  bitrl: 'rl',
  bitrr: 'rr',
};
const BASES: Record<string, Base> = { bin: 2, oct: 8, dec: 10, hex: 16 };

/** Functions of units and based integers; null for other names. */
export function callQ(name: string, args: Value[], s: IntegerSettings): MathResult<Value> | null {
  const [a, b] = args;
  const unitOf = (v: Value | undefined) => (v?.kind === 'unit' ? v.u : null);
  switch (name) {
    case 'convert': {
      const from = unitOf(a) ?? {};
      const to = unitOf(b);
      if (!a || !to) return fail('syntax', 'convert(value, 1_unit) needs a target unit');
      const v = a.kind === 'unit' ? a.v : scalar(a);
      if (v === null) return fail('domain', 'convert needs a real quantity');
      const r = convertValue(v, from, to);
      return r.ok ? ok(quantity(r.value, to)) : r;
    }
    case 'mksa':
    case 'usimplify':
    case 'ufactor': {
      if (!a || a.kind !== 'unit') return a ? ok(a) : fail('syntax', `${name} needs a quantity`);
      const m = measure(a.u);
      if (!m) return fail('unknown-symbol', 'unknown unit');
      const si = a.v * m.factor;
      if (name === 'mksa') return ok(quantity(si, baseUnits(m.dims)));
      if (name === 'usimplify') {
        const d = derivedFor(m.dims);
        return ok(d ? quantity(si, { [d]: 1 }) : quantity(si, baseUnits(m.dims)));
      }
      // ufactor(q, 1_u): q in u times the remaining SI base units
      const target = unitOf(b);
      const t = target && measure(target);
      if (!target || !t) return fail('syntax', 'ufactor(value, 1_unit) needs a unit');
      const rest = m.dims.map((x, i) => x - t.dims[i]) as unknown as typeof m.dims;
      const u = multiplyUnits(target, baseUnits(rest));
      return ok(quantity(si / t.factor, u));
    }
    case 'r2b': {
      const v = a && scalar(a);
      if (v === null || v === undefined || !Number.isInteger(v))
        return fail('domain', 'r2b needs an integer');
      return ok(based(mask(BigInt(v), s.bits), s.base));
    }
    case 'b2r':
      return a?.kind === 'int'
        ? ok(real(intReal(a, s)))
        : fail('domain', 'b2r needs a based integer');
  }
  if (BASES[name]) {
    if (a?.kind === 'int') return ok({ ...a, base: BASES[name] });
    const v = a && scalar(a);
    if (v === null || v === undefined || !Number.isInteger(v))
      return fail('domain', `${name} needs an integer`);
    return ok(based(mask(BigInt(v), s.bits), BASES[name]));
  }
  const op = BIT[name];
  if (op) {
    const toBig = (v: Value | undefined): bigint | null =>
      v?.kind === 'int'
        ? big(v)
        : v?.kind === 'real' && Number.isInteger(v.v)
          ? mask(BigInt(v.v), s.bits)
          : null;
    const x = toBig(a);
    const y = op === 'not' ? 0n : b ? toBig(b) : 1n;
    if (x === null || y === null) return fail('domain', `${name} needs integers`);
    const base = a?.kind === 'int' ? a.base : s.base;
    return ok(based(bits(op, x, y, s), base));
  }
  return null;
}

export { DEFAULT_INTEGER, type IntegerSettings };
