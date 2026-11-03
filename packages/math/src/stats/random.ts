/**
 * Seeded random numbers (prompt 038), pure and reproducible: the same seed gives the same
 * sequence on every platform.
 *
 * - Generator: xoshiro128** (Blackman/Vigna), 32-bit integer arithmetic only (`Math.imul`, `>>>`),
 *   state seeded by SplitMix32 from the 64 bits of the seed number.
 * - `random()`: 53-bit uniform double in [0, 1) from two outputs.
 * - `int(a, b)`: unbiased (rejection sampling). `normal`: Marsaglia's polar method (the spare
 *   value is cached). `binomial`/`poisson`: sequential inversion for small means, otherwise exact
 *   inversion through the quantile function of `distributions.ts` – so every draw is exactly
 *   distributed, without approximations.
 */
import { type MathResult, fail, ok } from '../result';
import { binomial, poisson } from './distributions';

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
}

export class Rng {
  private s: [number, number, number, number];
  private spare: number | null = null;

  private constructor(state: readonly number[]) {
    this.s = [state[0] >>> 0, state[1] >>> 0, state[2] >>> 0, state[3] >>> 0];
  }

  /** Generator seeded from any finite number (all 64 bits of the double are used). */
  static seeded(seed: number): MathResult<Rng> {
    if (!Number.isFinite(seed)) return fail('domain', 'the seed must be a finite number');
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, seed === 0 ? 0 : seed); // −0 → 0
    const mix = splitmix32(view.getUint32(0) ^ Math.imul(view.getUint32(4), 0x85ebca6b));
    const state = [mix(), mix(), mix(), mix()];
    if (!state.some((v) => v !== 0)) state[0] = 1;
    return ok(new Rng(state));
  }

  /** Generator with an explicit xoshiro128 state (not all zero) – for reference tests. */
  static fromState(state: readonly [number, number, number, number]): MathResult<Rng> {
    if (state.every((v) => v >>> 0 === 0)) return fail('domain', 'the state must not be all zero');
    return ok(new Rng(state));
  }

  /** Next raw 32-bit output. */
  nextUint32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] = (s[2] ^ s[0]) >>> 0;
    s[3] = (s[3] ^ s[1]) >>> 0;
    s[1] = (s[1] ^ s[2]) >>> 0;
    s[0] = (s[0] ^ s[3]) >>> 0;
    s[2] = (s[2] ^ t) >>> 0;
    s[3] = rotl(s[3], 11);
    return result;
  }

  /** Uniform double in [0, 1) with 53 random bits. */
  random(): number {
    const a = this.nextUint32() >>> 5;
    const b = this.nextUint32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  /** Uniform in [a, b). */
  uniform(a = 0, b = 1): MathResult<number> {
    if (!Number.isFinite(a) || !Number.isFinite(b) || !(a < b))
      return fail('domain', 'uniform(a, b) needs finite a < b');
    return ok(a + (b - a) * this.random());
  }

  /** Uniform integer in [a, b] (both inclusive), unbiased; b − a < 2³². */
  int(a: number, b: number): MathResult<number> {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a > b || b - a >= 4294967296)
      return fail('domain', 'int(a, b) needs integers a ≤ b with b − a < 2³²');
    const range = b - a + 1;
    if (range === 4294967296) return ok(a + this.nextUint32());
    const limit = 4294967296 - (4294967296 % range);
    let v: number;
    do v = this.nextUint32();
    while (v >= limit);
    return ok(a + (v % range));
  }

  /** Normal(μ, σ) by the polar method. */
  normal(mu = 0, sigma = 1): MathResult<number> {
    if (!Number.isFinite(mu) || !(sigma > 0) || !Number.isFinite(sigma))
      return fail('domain', 'normal(μ, σ) needs a finite μ and σ > 0');
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return ok(mu + sigma * z);
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = 2 * this.random() - 1;
      v = 2 * this.random() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * f;
    return ok(mu + sigma * u * f);
  }

  /** Binomial(n, p) draw. */
  binomial(n: number, p: number): MathResult<number> {
    const d = binomial(n, p);
    if (!d.ok) return d;
    if (p === 0 || n === 0) return ok(0);
    if (p === 1) return ok(n);
    if (n * Math.min(p, 1 - p) < 30) {
      // sequential inversion: P(k+1) = P(k)·(n − k)/(k + 1)·p/q
      const u = this.random();
      const q = 1 - p;
      const r = p / q;
      let pk = Math.exp(n * Math.log1p(-p));
      let cum = pk;
      let k = 0;
      while (u >= cum && k < n) {
        pk *= ((n - k) / (k + 1)) * r;
        k++;
        cum += pk;
      }
      return ok(k);
    }
    return d.value.inv(this.random());
  }

  /** Poisson(λ) draw. */
  poisson(lambda: number): MathResult<number> {
    const d = poisson(lambda);
    if (!d.ok) return d;
    if (lambda < 30) {
      const u = this.random();
      let pk = Math.exp(-lambda);
      let cum = pk;
      let k = 0;
      while (u >= cum && k < 1000) {
        k++;
        pk *= lambda / k;
        cum += pk;
      }
      return ok(k);
    }
    return d.value.inv(this.random());
  }
}
