import { describe, expect, it } from 'vitest';
import { divide, divisors, euler, isPrime, nextPrime, prevPrime, primeFactors } from './integer';

const v = <T>(r: { ok: boolean; value?: T }) => (r.ok ? r.value : 'error');

describe('integer functions', () => {
  it('factors', () => {
    expect(v(primeFactors(360))).toEqual([
      [2, 3],
      [3, 2],
      [5, 1],
    ]);
    expect(v(primeFactors(1))).toEqual([]);
    expect(v(primeFactors(97))).toEqual([[97, 1]]);
    expect(v(primeFactors(2 ** 31 - 1))).toEqual([[2147483647, 1]]);
    expect(v(primeFactors(600851475143))).toEqual([
      [71, 1],
      [839, 1],
      [1471, 1],
      [6857, 1],
    ]);
    expect(v(primeFactors(2.5))).toBe('error');
    expect(v(primeFactors(2 ** 60))).toBe('error');
  });

  it('property: the factors multiply back', () => {
    for (let n = 1; n < 2000; n += 37) {
      const f = primeFactors(n);
      expect(f.ok && f.value.reduce((a, [p, e]) => a * p ** e, 1)).toBe(n);
    }
  });

  it('primes, φ, divisors, quotient and remainder', () => {
    expect([0, 1, 2, 3, 4, 97, 91].map((n) => v(isPrime(n)))).toEqual([
      false,
      false,
      true,
      true,
      false,
      true,
      false,
    ]);
    expect(v(nextPrime(13))).toBe(17);
    expect(v(nextPrime(-5))).toBe(2);
    expect(v(prevPrime(13))).toBe(11);
    expect(v(prevPrime(2))).toBe('error');
    expect(v(euler(36))).toBe(12);
    expect(v(divisors(12))).toEqual([1, 2, 3, 4, 6, 12]);
    expect(v(divide(17, 5))).toEqual({ q: 3, r: 2 });
    expect(v(divide(-17, 5))).toEqual({ q: -4, r: 3 });
    expect(v(divide(1, 0))).toBe('error');
  });
});
