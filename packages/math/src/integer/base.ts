/**
 * Based integers (prompt 031): `#1010b`, `#777o`, `#99d`, `#FFh` with a word size of 1–64 bits,
 * unsigned or two's complement. Pure, on BigInt; the value is kept masked to the word size and
 * stored as a decimal string (BigInt does not survive JSON).
 */
import { type MathResult, fail, ok } from '../result';

export type Base = 2 | 8 | 10 | 16;

export interface IntegerSettings {
  readonly bits: number;
  readonly signed: boolean;
  /** base of literals without suffix and of results */
  readonly base: Base;
}

export const DEFAULT_INTEGER: IntegerSettings = { bits: 32, signed: false, base: 16 };

const SUFFIX: Record<string, Base> = { b: 2, o: 8, d: 10, h: 16 };
const LETTER: Record<Base, string> = { 2: 'b', 8: 'o', 10: 'd', 16: 'h' };
const DIGITS: Record<Base, RegExp> = {
  2: /^[01]+$/,
  8: /^[0-7]+$/,
  10: /^[0-9]+$/,
  16: /^[0-9a-f]+$/i,
};

/** `#FFh` → digits and base (a trailing b/o/d/h is a suffix if the rest fits that base). */
export function parseBased(
  lit: string,
  defaultBase: Base = 16,
): MathResult<{ v: bigint; base: Base }> {
  const body = lit.replace(/^#/, '');
  const last = body.slice(-1).toLowerCase();
  let digits = body;
  let base = defaultBase;
  if (SUFFIX[last] && body.length > 1 && DIGITS[SUFFIX[last]].test(body.slice(0, -1))) {
    base = SUFFIX[last];
    digits = body.slice(0, -1);
  }
  if (!DIGITS[base].test(digits)) return fail('syntax', `"${lit}" is not a number in base ${base}`);
  const prefix = { 2: '0b', 8: '0o', 10: '', 16: '0x' }[base];
  return ok({ v: BigInt(prefix + digits), base });
}

export function mask(v: bigint, bits: number): bigint {
  return BigInt.asUintN(bits, v);
}

/** The stored (masked) value as a number with sign per the settings. */
export function toSigned(v: bigint, s: IntegerSettings): bigint {
  return s.signed ? BigInt.asIntN(s.bits, v) : mask(v, s.bits);
}

export function formatBased(v: bigint, base: Base, bits: number): string {
  return `#${mask(v, bits).toString(base).toUpperCase()}${LETTER[base]}`;
}

export type IntOp = '+' | '-' | '*' | '/' | '^';

export function arith(op: IntOp, a: bigint, b: bigint, s: IntegerSettings): MathResult<bigint> {
  const x = toSigned(a, s);
  const y = toSigned(b, s);
  switch (op) {
    case '+':
      return ok(mask(x + y, s.bits));
    case '-':
      return ok(mask(x - y, s.bits));
    case '*':
      return ok(mask(x * y, s.bits));
    case '/':
      if (y === 0n) return fail('division-by-zero', 'division by zero');
      return ok(mask(x / y, s.bits));
    case '^':
      if (y < 0n) return fail('domain', 'negative exponents are not integers');
      if (y > 4096n) return fail('domain', 'exponent too large');
      return ok(mask(x ** y, s.bits));
  }
}

export type BitOp = 'and' | 'or' | 'xor' | 'not' | 'sl' | 'sr' | 'asr' | 'rl' | 'rr';

export function bits(op: BitOp, a: bigint, b: bigint, s: IntegerSettings): bigint {
  const w = BigInt(s.bits);
  const n = ((b % w) + w) % w;
  switch (op) {
    case 'and':
      return mask(a & b, s.bits);
    case 'or':
      return mask(a | b, s.bits);
    case 'xor':
      return mask(a ^ b, s.bits);
    case 'not':
      return mask(~a, s.bits);
    case 'sl':
      return mask(a << b, s.bits);
    case 'sr':
      return mask(a, s.bits) >> b;
    case 'asr':
      return mask(BigInt.asIntN(s.bits, a) >> b, s.bits);
    case 'rl':
      return mask((a << n) | (mask(a, s.bits) >> (w - n)), s.bits);
    case 'rr':
      return mask((mask(a, s.bits) >> n) | (a << (w - n)), s.bits);
  }
}
