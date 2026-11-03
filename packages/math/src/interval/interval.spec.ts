import { describe, expect, it } from 'vitest';
import * as I from './interval';
import type { Interval } from './interval';

/** Deterministic pseudo-random numbers (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(36);
const randomInterval = (lo: number, hi: number): Interval => {
  const a = lo + (hi - lo) * rand();
  const b = lo + (hi - lo) * rand();
  return I.make(Math.min(a, b), Math.max(a, b));
};
const pointsIn = (a: Interval, n = 40) => [
  a.lo,
  a.hi,
  ...Array.from({ length: n }, () => a.lo + (a.hi - a.lo) * rand()),
];

/**
 * Inclusion property for a unary function: for random boxes and random points inside, f(point)
 * lies in F(box) wherever f is defined; F reports 'none' only if f is undefined at every sample,
 * and 'all' only if f is defined at every sample.
 */
function checkUnary(
  name: string,
  F: (a: Interval) => Interval,
  f: (x: number) => number,
  lo: number,
  hi: number,
  boxes = 300,
) {
  for (let k = 0; k < boxes; k++) {
    const box = randomInterval(lo, hi);
    const r = F(box);
    for (const x of pointsIn(box)) {
      const v = f(x);
      if (Number.isNaN(v)) {
        expect(r.def, `${name} undefined at ${x} but def all on [${box.lo}, ${box.hi}]`).not.toBe(
          'all',
        );
        continue;
      }
      expect(r.def, `${name}(${x}) defined but def none`).not.toBe('none');
      if (!(r.lo <= v && v <= r.hi)) {
        throw new Error(
          `${name}(${x}) = ${v} not in [${r.lo}, ${r.hi}] for box [${box.lo}, ${box.hi}]`,
        );
      }
    }
  }
}

function checkBinary(
  name: string,
  F: (a: Interval, b: Interval) => Interval,
  f: (x: number, y: number) => number,
  lo: number,
  hi: number,
) {
  for (let k = 0; k < 300; k++) {
    const a = randomInterval(lo, hi);
    const b = randomInterval(lo, hi);
    const r = F(a, b);
    const xs = pointsIn(a, 12);
    const ys = pointsIn(b, 12);
    for (const x of xs)
      for (const y of ys) {
        const v = f(x, y);
        if (Number.isNaN(v)) {
          expect(r.def).not.toBe('all');
          continue;
        }
        expect(r.def).not.toBe('none');
        if (!(r.lo <= v && v <= r.hi)) {
          throw new Error(`${name}(${x}, ${y}) = ${v} not in [${r.lo}, ${r.hi}]`);
        }
      }
  }
}

describe('nextUp / nextDown', () => {
  it('steps to the neighbouring double', () => {
    expect(I.nextUp(1)).toBe(1 + Number.EPSILON);
    expect(I.nextDown(1)).toBe(1 - Number.EPSILON / 2);
    expect(I.nextUp(0)).toBe(Number.MIN_VALUE);
    expect(I.nextDown(0)).toBe(-Number.MIN_VALUE);
    expect(I.nextUp(-Number.MIN_VALUE)).toBe(-0);
    expect(I.nextUp(Number.MAX_VALUE)).toBe(Infinity);
    expect(I.nextUp(-Infinity)).toBe(-Number.MAX_VALUE);
    expect(I.nextDown(-1)).toBe(-1 - Number.EPSILON);
    expect(I.nextUp(Infinity)).toBe(Infinity);
    expect(Number.isNaN(I.nextUp(NaN))).toBe(true);
    // across the exponent boundary
    expect(I.nextUp(2 - Number.EPSILON)).toBe(2);
    expect(I.nextDown(2)).toBe(2 - Number.EPSILON);
    for (const x of [0.1, 3.7e-300, 1e300, -5.5, 123456.789]) {
      expect(I.nextUp(x)).toBeGreaterThan(x);
      expect(I.nextDown(x)).toBeLessThan(x);
      expect(I.nextDown(I.nextUp(x))).toBe(x);
    }
  });

  it('encloses decimal literals and π', () => {
    const tenth = I.fromDecimal('0.1');
    expect(tenth.lo).toBeLessThan(0.1);
    expect(tenth.hi).toBeGreaterThan(0.1);
    expect(I.fromDecimal('3')).toMatchObject({ lo: 3, hi: 3 });
    expect(I.PI.lo).toBeLessThan(Math.PI);
    expect(I.PI.hi).toBeGreaterThan(Math.PI);
  });
});

describe('interval arithmetic – inclusion property', () => {
  it('+ − × ÷', () => {
    checkBinary('add', I.add, (x, y) => x + y, -1e3, 1e3);
    checkBinary('sub', I.sub, (x, y) => x - y, -1e3, 1e3);
    checkBinary('mul', I.mul, (x, y) => x * y, -50, 50);
    checkBinary('div', I.div, (x, y) => (y === 0 ? NaN : x / y), -5, 5);
    checkBinary('min', I.min, Math.min, -5, 5);
    checkBinary('max', I.max, Math.max, -5, 5);
  });

  it('division by an interval containing 0', () => {
    const r = I.div(I.make(1, 2), I.make(-1, 1));
    expect(r.def).toBe('partial');
    expect(r.cont).toBe(false);
    expect(I.div(I.make(1, 2), I.make(0, 0)).def).toBe('none');
    const half = I.div(I.make(1, 2), I.make(0, 4));
    expect(half.lo).toBeLessThanOrEqual(0.25);
    expect(half.hi).toBe(Infinity);
  });

  it('powers and roots', () => {
    for (const n of [2, 3, 4, 5, -1, -2, -3, 0, 7]) {
      checkUnary(
        `x^${n}`,
        (a) => I.powInt(a, n),
        (x) => (n < 0 && x === 0 ? NaN : x ** n),
        -4,
        4,
      );
    }
    for (const p of [0.5, 1.5, 2.7, -0.5, -1.25]) {
      checkUnary(
        `x^${p}`,
        (a) => I.powReal(a, p),
        (x) => (x < 0 || (x === 0 && p < 0) ? NaN : Math.pow(x, p)),
        -3,
        5,
      );
    }
    const odd = (p: number) => (x: number) =>
      x === 0 && p < 0 ? NaN : x < 0 ? -Math.pow(-x, p) : Math.pow(x, p);
    checkUnary('x^(1/3)', (a) => I.powOddRoot(a, 1 / 3), odd(1 / 3), -8, 8);
    checkUnary('x^(-1/3)', (a) => I.powOddRoot(a, -1 / 3), odd(-1 / 3), -8, 8);
    checkUnary('root(x,3)', (a) => I.rootN(a, 3), odd(1 / 3), -8, 8);
    checkUnary(
      'root(x,4)',
      (a) => I.rootN(a, 4),
      (x) => (x < 0 ? NaN : Math.pow(x, 1 / 4)),
      -8,
      8,
    );
    checkUnary('sqrt', I.sqrt, (x) => (x < 0 ? NaN : Math.sqrt(x)), -2, 10);
    checkBinary(
      'pow',
      I.pow,
      (x, y) => ((x < 0 && !Number.isInteger(y)) || (x === 0 && y < 0) ? NaN : Math.pow(x, y)),
      -2,
      3,
    );
  });

  it('exp and logarithms', () => {
    checkUnary('exp', I.exp, Math.exp, -20, 20);
    checkUnary('ln', I.ln, (x) => (x > 0 ? Math.log(x) : NaN), -1, 10);
    checkUnary('log10', I.log10, (x) => (x > 0 ? Math.log10(x) : NaN), -1, 100);
    expect(I.ln(I.make(-2, -1)).def).toBe('none');
    expect(I.ln(I.make(-2, 1)).def).toBe('partial');
  });

  it('trigonometric functions, also on wide and large boxes', () => {
    for (const [lo, hi] of [
      [-1, 1],
      [-10, 10],
      [1e5, 1e5 + 10],
      [-1e3, 1e3],
    ] as const) {
      checkUnary('sin', I.sin, Math.sin, lo, hi);
      checkUnary('cos', I.cos, Math.cos, lo, hi);
      checkUnary('tan', I.tan, Math.tan, lo, hi);
    }
    // sin over [0, π] reaches 1 at π/2
    const s = I.sin(I.make(0, 3));
    expect(s.hi).toBe(1);
    expect(s.lo).toBeLessThanOrEqual(0);
    // tan across a pole
    expect(I.tan(I.make(1.5, 1.6))).toMatchObject({ def: 'partial', cont: false });
    expect(I.tan(I.make(0, 1)).def).toBe('all');
    checkUnary('arcsin', I.asin, Math.asin, -2, 2);
    checkUnary('arccos', I.acos, Math.acos, -2, 2);
    checkUnary('arctan', I.atan, Math.atan, -50, 50);
  });

  it('hyperbolic functions', () => {
    checkUnary('sinh', I.sinh, Math.sinh, -10, 10);
    checkUnary('cosh', I.cosh, Math.cosh, -10, 10);
    checkUnary('tanh', I.tanh, Math.tanh, -10, 10);
    checkUnary('arsinh', I.asinh, Math.asinh, -10, 10);
    checkUnary('arcosh', I.acosh, Math.acosh, -3, 10);
    checkUnary('artanh', I.atanh, (x) => (Math.abs(x) < 1 ? Math.atanh(x) : NaN), -2, 2);
  });

  it('piecewise functions with jumps', () => {
    checkUnary('abs', I.abs, Math.abs, -5, 5);
    checkUnary('sign', I.sign, Math.sign, -2, 2);
    checkUnary('floor', I.floor, Math.floor, -5, 5);
    checkUnary('ceil', I.ceil, Math.ceil, -5, 5);
    checkUnary('round', I.round, Math.round, -5, 5);
    expect(I.floor(I.make(0.2, 0.8)).cont).toBe(true);
    expect(I.floor(I.make(0.8, 1.2)).cont).toBe(false);
    expect(I.sign(I.make(-1, 1)).cont).toBe(false);
  });

  it('NaN endpoints become the whole line, never a wrong bound', () => {
    const r = I.div(I.make(1, Infinity), I.make(1, Infinity));
    expect(r.lo).toBeLessThanOrEqual(0);
    expect(r.hi).toBe(Infinity);
  });
});
