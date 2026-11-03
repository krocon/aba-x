/**
 * Integer functions of the CAS menu (prompt 029): prime factors, primality, next/previous prime,
 * Euler's φ, divisors, integer quotient and remainder. Exact for safe integers (|n| ≤ 2⁵³ − 1);
 * larger or non-integer arguments are rejected instead of answered approximately.
 */
import { type MathResult, fail, ok } from '../result';

const MAX = Number.MAX_SAFE_INTEGER;

function int(n: number, what: string, min = 1): MathResult<number> {
  if (!Number.isInteger(n)) return fail('domain', `${what} needs an integer`);
  if (Math.abs(n) > MAX) return fail('domain', `${what}: the number is too large (more than 2^53)`);
  if (n < min) return fail('domain', `${what} needs an integer ≥ ${min}`);
  return ok(n);
}

/** n = Π pᵉ, primes ascending. 1 has no factors. */
export function primeFactors(n: number): MathResult<[number, number][]> {
  const c = int(n, 'ifactor');
  if (!c.ok) return c;
  const out: [number, number][] = [];
  let m = n;
  const take = (p: number) => {
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    if (e) out.push([p, e]);
  };
  take(2);
  take(3);
  for (let p = 5; p * p <= m; p += 6) {
    take(p);
    take(p + 2);
  }
  if (m > 1) out.push([m, 1]);
  return ok(out);
}

export function isPrime(n: number): MathResult<boolean> {
  const c = int(n, 'isprime', 0);
  if (!c.ok) return c;
  if (n < 2) return ok(false);
  if (n < 4) return ok(true);
  if (n % 2 === 0 || n % 3 === 0) return ok(false);
  for (let p = 5; p * p <= n; p += 6) if (n % p === 0 || n % (p + 2) === 0) return ok(false);
  return ok(true);
}

export function nextPrime(n: number): MathResult<number> {
  const c = int(n, 'nextprime', -MAX);
  if (!c.ok) return c;
  for (let k = Math.max(2, n + 1); k <= MAX; k++)
    if ((isPrime(k) as { value: boolean }).value) return ok(k);
  return fail('domain', 'nextprime: beyond 2^53');
}

export function prevPrime(n: number): MathResult<number> {
  const c = int(n, 'prevprime', 3);
  if (!c.ok) return c;
  for (let k = n - 1; k >= 2; k--) if ((isPrime(k) as { value: boolean }).value) return ok(k);
  return fail('domain', 'prevprime: there is no smaller prime');
}

export function euler(n: number): MathResult<number> {
  const f = primeFactors(n);
  if (!f.ok) return f;
  return ok(f.value.reduce((acc, [p, e]) => acc * (p - 1) * p ** (e - 1), 1));
}

export function divisors(n: number): MathResult<number[]> {
  const f = primeFactors(n);
  if (!f.ok) return f;
  let ds = [1];
  for (const [p, e] of f.value) {
    const next: number[] = [];
    for (const d of ds) for (let k = 0, q = 1; k <= e; k++, q *= p) next.push(d * q);
    ds = next;
  }
  return ok(ds.sort((a, b) => a - b));
}

/** Euclidean division with a remainder 0 ≤ r < |b| (like the calculator's iquo/irem). */
export function divide(a: number, b: number): MathResult<{ q: number; r: number }> {
  const ca = int(a, 'iquo', -MAX);
  const cb = int(b, 'iquo', -MAX);
  if (!ca.ok) return ca;
  if (!cb.ok) return cb;
  if (b === 0) return fail('division-by-zero', 'division by zero');
  const r = ((a % b) + Math.abs(b)) % Math.abs(b);
  return ok({ q: (a - r) / b, r });
}
