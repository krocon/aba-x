import { describe, expect, it } from 'vitest';
import { arith, bits, formatBased, parseBased, toSigned } from './base';

const S = { bits: 8, signed: false, base: 16 as const };
const v = (lit: string) => {
  const r = parseBased(lit);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('based integers', () => {
  it('reads literals with and without suffix', () => {
    expect(v('#FFh')).toEqual({ v: 255n, base: 16 });
    expect(v('#1010b')).toEqual({ v: 10n, base: 2 });
    expect(v('#777o')).toEqual({ v: 511n, base: 8 });
    expect(v('#99d')).toEqual({ v: 99n, base: 10 });
    // a trailing b/o/d/h is a suffix when the rest fits that base: #1B = binary 1, #1Bh = 27
    expect(v('#1B')).toEqual({ v: 1n, base: 2 });
    expect(v('#1Bh')).toEqual({ v: 27n, base: 16 });
    expect(v('#C3')).toEqual({ v: 195n, base: 16 });
    // a suffix that does not fit falls back to hexadecimal digits
    expect(v('#12b')).toEqual({ v: 0x12bn, base: 16 });
    expect(parseBased('#12g').ok).toBe(false);
  });

  it('wraps at the word size and rounds division toward zero', () => {
    expect(arith('+', 255n, 1n, S)).toEqual({ ok: true, value: 0n });
    expect(arith('-', 0n, 1n, S)).toEqual({ ok: true, value: 255n });
    expect(arith('/', 7n, 2n, S)).toEqual({ ok: true, value: 3n });
    expect(arith('/', 1n, 0n, S).ok).toBe(false);
    expect(toSigned(255n, { ...S, signed: true })).toBe(-1n);
    expect(arith('/', 250n, 2n, { ...S, signed: true })).toEqual({ ok: true, value: 253n }); // −6/2 = −3
  });

  it('bit operations, shifts and rotations', () => {
    expect(bits('and', 0b1100n, 0b1010n, S)).toBe(0b1000n);
    expect(bits('xor', 0b1100n, 0b1010n, S)).toBe(0b0110n);
    expect(bits('not', 0n, 0n, S)).toBe(255n);
    expect(bits('sl', 0x81n, 1n, S)).toBe(0x02n);
    expect(bits('asr', 0x80n, 1n, S)).toBe(0xc0n);
    expect(bits('rl', 0x81n, 1n, S)).toBe(0x03n);
    expect(bits('rr', 0x81n, 1n, S)).toBe(0xc0n);
    expect(formatBased(255n, 2, 8)).toBe('#11111111b');
    expect(formatBased(-1n, 16, 16)).toBe('#FFFFh');
  });
});
