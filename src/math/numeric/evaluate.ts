/**
 * Floating-point evaluation of an expression (prompt 013/005). Used for approximations (→NUM), the
 * plotter and as the integrand of the numerical methods. Never guesses: undefined values become
 * typed errors (`domain`, `division-by-zero`, `not-evaluable`, …).
 */
import type { Expr } from '../ast/nodes';
import { type MathErrorCode, type MathResult, fail, ok } from '../result';
import { integrateAdaptive } from './quadrature';

export type AngleMode = 'rad' | 'deg';

export interface UserFunction {
  readonly params: readonly string[];
  readonly body: Expr;
}

export interface NumericScope {
  readonly angle?: AngleMode;
  readonly variables?: ReadonlyMap<string, number>;
  readonly functions?: ReadonlyMap<string, UserFunction>;
}

export class EvalError extends Error {
  constructor(
    readonly code: MathErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const err = (code: MathErrorCode, message: string): never => {
  throw new EvalError(code, message);
};

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) err('domain', 'factorial needs a non-negative integer');
  if (n > 170) return Infinity;
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

const isInt = (x: number) => Number.isInteger(x);

/** Error function (Abramowitz–Stegun 7.1.26 is too coarse – series/continued fraction, |err| < 1e-14). */
export function erf(x: number): number {
  if (x < 0) return -erf(-x);
  if (x < 3) {
    // Taylor series
    let sum = x;
    let term = x;
    for (let n = 1; n < 200; n++) {
      term *= (-x * x) / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return (2 / Math.sqrt(Math.PI)) * sum;
  }
  // continued fraction for erfc
  let f = 0;
  for (let n = 60; n >= 1; n--) f = n / 2 / (x + f);
  return 1 - Math.exp(-x * x) / Math.sqrt(Math.PI) / (x + f);
}

class Evaluator {
  private depth = 0;

  constructor(private readonly scope: NumericScope) {}

  private toRad(x: number): number {
    return this.scope.angle === 'deg' ? (x * Math.PI) / 180 : x;
  }

  private fromRad(x: number): number {
    return this.scope.angle === 'deg' ? (x * 180) / Math.PI : x;
  }

  /** Exact multiples of 180° (or π) give an exact 0 for sin – avoids sin(180°) = 1.2e-16. */
  private trig(f: 'sin' | 'cos' | 'tan', x: number): number {
    if (this.scope.angle === 'deg' && isInt(x)) {
      const m = ((x % 360) + 360) % 360;
      const table: Record<number, [number, number]> = {
        0: [0, 1],
        90: [1, 0],
        180: [0, -1],
        270: [-1, 0],
        30: [0.5, Math.sqrt(3) / 2],
        150: [0.5, -Math.sqrt(3) / 2],
        210: [-0.5, -Math.sqrt(3) / 2],
        330: [-0.5, Math.sqrt(3) / 2],
        60: [Math.sqrt(3) / 2, 0.5],
        120: [Math.sqrt(3) / 2, -0.5],
        240: [-Math.sqrt(3) / 2, -0.5],
        300: [-Math.sqrt(3) / 2, 0.5],
      };
      const hit = table[m];
      if (hit) {
        if (f === 'sin') return hit[0];
        if (f === 'cos') return hit[1];
        if (hit[1] === 0) err('domain', `tan(${x}°) is undefined`);
        return hit[0] / hit[1];
      }
    }
    const r = this.toRad(x);
    return f === 'sin' ? Math.sin(r) : f === 'cos' ? Math.cos(r) : Math.tan(r);
  }

  eval(e: Expr, vars: ReadonlyMap<string, number>): number {
    switch (e.type) {
      case 'num':
        return Number(e.value);
      case 'sym':
        return this.symbol(e.name, vars);
      case 'neg':
        return -this.eval(e.arg, vars);
      case 'post': {
        const x = this.eval(e.arg, vars);
        return e.op === '%' ? x / 100 : factorial(x);
      }
      case 'bin':
        return this.binary(e.op, this.eval(e.left, vars), this.eval(e.right, vars));
      case 'call':
        return this.call(e.name, e.args, vars);
      case 'int': {
        if (!e.lower || !e.upper)
          return err('not-evaluable', 'an indefinite integral has no numeric value');
        const a = this.eval(e.lower, vars);
        const b = this.eval(e.upper, vars);
        const r = integrateAdaptive(
          (t) => this.eval(e.expr, new Map([...vars, [e.variable, t]])),
          a,
          b,
        );
        if (!r.ok) throw new EvalError(r.error.code, r.error.message);
        return r.value.value;
      }
      case 'series': {
        const a = this.eval(e.lower, vars);
        const b = this.eval(e.upper, vars);
        if (!isInt(a) || !isInt(b)) return err('domain', 'sum bounds must be integers');
        if (b - a > 1e7) return err('not-evaluable', 'too many terms');
        let acc = e.kind === 'sum' ? 0 : 1;
        for (let k = a; k <= b; k++) {
          const v = this.eval(e.expr, new Map([...vars, [e.variable, k]]));
          acc = e.kind === 'sum' ? acc + v : acc * v;
        }
        return acc;
      }
      case 'deriv':
        return err('not-evaluable', 'a derivative needs the CAS or a point (use the CAS mode)');
      case 'limit':
        return err('not-evaluable', 'limits are computed symbolically (CAS mode)');
      case 'rel':
        return err('not-evaluable', 'an equation has no numeric value');
      case 'matrix':
      case 'list':
        return err('unsupported', 'matrices and lists are not supported here yet');
    }
  }

  private symbol(name: string, vars: ReadonlyMap<string, number>): number {
    if (vars.has(name)) return vars.get(name)!;
    const v = this.scope.variables?.get(name);
    if (v !== undefined) return v;
    if (name === 'pi') return Math.PI;
    if (name === 'e') return Math.E;
    if (name === 'inf') return Infinity;
    if (name === 'i') return err('unsupported', 'complex numbers are not supported yet');
    return err('unknown-symbol', `unknown variable ${name}`);
  }

  private binary(op: string, a: number, b: number): number {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        if (b === 0) err('division-by-zero', 'division by zero');
        return a / b;
      default: {
        if (a === 0 && b < 0) err('division-by-zero', '0 to a negative power');
        if (a < 0 && !isInt(b)) {
          // real odd roots: (−8)^(1/3) = −2
          const inv = 1 / b;
          if (Math.abs(inv - Math.round(inv)) < 1e-12 && Math.round(inv) % 2 !== 0) {
            return -Math.pow(-a, b);
          }
          err('domain', 'a negative base needs an integer exponent');
        }
        return Math.pow(a, b);
      }
    }
  }

  private call(name: string, argExprs: readonly Expr[], vars: ReadonlyMap<string, number>): number {
    const user = this.scope.functions?.get(name);
    if (user) {
      if (user.params.length !== argExprs.length) {
        err('syntax', `${name} takes ${user.params.length} argument(s)`);
      }
      if (++this.depth > 64) err('not-evaluable', `${name}: recursion too deep`);
      try {
        const inner = new Map(vars);
        user.params.forEach((p, k) => inner.set(p, this.eval(argExprs[k], vars)));
        return this.eval(user.body, inner);
      } finally {
        this.depth--;
      }
    }
    const a = argExprs.map((x) => this.eval(x, vars));
    const [x, y] = a;
    const need = (ok: boolean, msg: string) => ok || err('domain', msg);
    switch (name) {
      case 'sin':
      case 'cos':
      case 'tan':
        return this.trig(name, x);
      case 'cot':
        return 1 / this.nonZero(this.trig('tan', x), 'cot');
      case 'sec':
        return 1 / this.nonZero(this.trig('cos', x), 'sec');
      case 'csc':
        return 1 / this.nonZero(this.trig('sin', x), 'csc');
      case 'arcsin':
        need(Math.abs(x) <= 1, 'arcsin needs −1 ≤ x ≤ 1');
        return this.fromRad(Math.asin(x));
      case 'arccos':
        need(Math.abs(x) <= 1, 'arccos needs −1 ≤ x ≤ 1');
        return this.fromRad(Math.acos(x));
      case 'arctan':
        return this.fromRad(Math.atan(x));
      case 'sinh':
        return Math.sinh(x);
      case 'cosh':
        return Math.cosh(x);
      case 'tanh':
        return Math.tanh(x);
      case 'arsinh':
        return Math.asinh(x);
      case 'arcosh':
        need(x >= 1, 'arcosh needs x ≥ 1');
        return Math.acosh(x);
      case 'artanh':
        need(Math.abs(x) < 1, 'artanh needs −1 < x < 1');
        return Math.atanh(x);
      case 'exp':
        return Math.exp(x);
      case 'ln':
        need(x > 0, 'ln needs x > 0');
        return Math.log(x);
      case 'log':
        need(x > 0, 'log needs x > 0');
        if (a.length === 2) {
          need(y > 0 && y !== 1, 'the base must be positive and ≠ 1');
          return Math.log(x) / Math.log(y);
        }
        return Math.log10(x);
      case 'sqrt':
        need(x >= 0, 'square root of a negative number (complex numbers are not supported yet)');
        return Math.sqrt(x);
      case 'root': {
        need(isInt(y) && y >= 2, 'root(x, n) needs an integer n ≥ 2');
        if (x < 0) {
          need(y % 2 === 1, 'even root of a negative number');
          return -Math.pow(-x, 1 / y);
        }
        return Math.pow(x, 1 / y);
      }
      case 'abs':
        return Math.abs(x);
      case 'sign':
        return Math.sign(x);
      case 'floor':
        return Math.floor(x);
      case 'ceil':
        return Math.ceil(x);
      case 'round':
        return Math.round(x);
      case 'min':
        return Math.min(...a);
      case 'max':
        return Math.max(...a);
      case 'gcd':
        need(a.every(isInt), 'gcd needs integers');
        return a.reduce(gcd);
      case 'lcm':
        need(a.every(isInt), 'lcm needs integers');
        return a.reduce((p, q) => (p === 0 || q === 0 ? 0 : Math.abs(p * q) / gcd(p, q)));
      case 'mod':
        if (y === 0) err('division-by-zero', 'mod by zero');
        return ((x % y) + y) % y;
      case 'nCr':
      case 'nPr': {
        need(isInt(x) && isInt(y) && x >= 0 && y >= 0, `${name} needs non-negative integers`);
        if (y > x) return 0;
        let r = 1;
        for (let k = 0; k < y; k++) r *= name === 'nCr' ? (x - k) / (k + 1) : x - k;
        return Math.round(r);
      }
      case 'erf':
        return erf(x);
      default:
        return err('unknown-function', `unknown function ${name}`);
    }
  }

  private nonZero(v: number, name: string): number {
    if (v === 0) err('domain', `${name} is undefined here`);
    return v;
  }
}

/** Numeric value of `e`. Non-finite results (overflow) are reported, not returned. */
export function evaluateNumeric(e: Expr, scope: NumericScope = {}): MathResult<number> {
  try {
    const v = new Evaluator(scope).eval(e, new Map());
    if (Number.isNaN(v)) return fail('not-evaluable', 'the result is undefined');
    if (!Number.isFinite(v))
      return fail('domain', v > 0 ? 'overflow (result too large)' : 'overflow');
    return ok(v);
  } catch (x) {
    if (x instanceof EvalError) return fail(x.code, x.message);
    throw x;
  }
}

/**
 * f(x) as a plain JS function for plotting and numerical methods: errors become NaN (a gap in the
 * graph), so callers check `Number.isFinite`.
 */
export function compile(
  e: Expr,
  variable: string,
  scope: NumericScope = {},
): (x: number) => number {
  const ev = new Evaluator(scope);
  return (x: number) => {
    try {
      return ev.eval(e, new Map([[variable, x]]));
    } catch {
      return NaN;
    }
  };
}
