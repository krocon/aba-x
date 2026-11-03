/**
 * General evaluator of the ABA-T1 home view (prompt 027): like `evaluateNumeric`, but on `Value`s –
 * complex numbers now, lists/matrices/units later. Real work is delegated to the proven real
 * evaluator (same domain errors, same exact trigonometry in degrees); the complex branch takes over
 * for complex arguments, or for real arguments outside the real domain when complex results are on.
 * Relations (`A = 5`, `x < 3`) are tests: 1 (true) or 0 (false). Never guesses.
 */
import type { Expr } from '../ast/nodes';
import { type AngleMode, type UserFunction, evaluateNumeric } from '../numeric/evaluate';
import { type MathErrorCode, type MathResult, fail, ok } from '../result';
import { C } from './complex';
import {
  DEFAULT_INTEGER,
  type IntegerSettings,
  binaryQ,
  callQ,
  compareQ,
  intLiteral,
  intReal,
  plain,
  unitSymbol,
} from './quantities';
import {
  type Complex,
  type Value,
  asComplex,
  complex,
  isFiniteValue,
  normalize,
  real,
} from './value';

export interface ValueScope {
  readonly angle?: AngleMode;
  /** Real functions may return complex results (√−4 = 2i). Typing `i` always works. */
  readonly complexResults?: boolean;
  readonly variables?: ReadonlyMap<string, Value>;
  readonly functions?: ReadonlyMap<string, UserFunction>;
  /** word size, sign and default base of based integers (prompt 031) */
  readonly integer?: IntegerSettings;
}

class ValueError extends Error {
  constructor(
    readonly code: MathErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const err = (code: MathErrorCode, message: string): never => {
  throw new ValueError(code, message);
};

const num = (x: number): Expr => ({ type: 'num', value: String(x) });

/**
 * Real functions whose domain errors have a complex answer (√−4, ln −1, arcsin 2 …). Others –
 * tan 90°, 0⁻¹, factorials – stay errors: a complex fallback there would be a guess.
 */
const COMPLEX_FALLBACK = new Set([
  'sqrt',
  'ln',
  'log',
  'root',
  'arcsin',
  'arccos',
  'arcosh',
  'artanh',
]);

/** Tolerance of the equality test (relative, like 12 significant digits). */
const EQ_TOL = 1e-12;

class ValueEvaluator {
  private depth = 0;

  private readonly ints: IntegerSettings;

  constructor(private readonly scope: ValueScope) {
    this.ints = scope.integer ?? DEFAULT_INTEGER;
  }

  private unwrap<T>(r: MathResult<T>): T {
    if (!r.ok) throw new ValueError(r.error.code, r.error.message);
    return r.value;
  }

  eval(e: Expr, local: ReadonlyMap<string, Value>): Value {
    switch (e.type) {
      case 'num':
        return e.value.startsWith('#')
          ? this.unwrap(intLiteral(e.value, this.ints))
          : real(Number(e.value));
      case 'sym':
        return this.symbol(e.name, local);
      case 'neg': {
        const a = this.eval(e.arg, local);
        if (a.kind === 'unit') return { ...a, v: -a.v };
        if (a.kind === 'int') return this.binary('-', real(0), a);
        return a.kind === 'real' ? real(-a.v) : C.neg(a);
      }
      case 'post': {
        let a = this.eval(e.arg, local);
        if (a.kind === 'unit' && e.op === '%') return { ...a, v: a.v / 100 };
        if (a.kind === 'unit') return err('domain', 'factorial needs a non-negative integer');
        if (a.kind === 'int') a = real(intReal(a, this.ints));
        if (a.kind !== 'real') {
          if (e.op === '%') return complex(a.re / 100, a.im / 100);
          return err('domain', 'factorial needs a non-negative integer');
        }
        return this.real({ type: 'post', op: e.op, arg: num(a.v) });
      }
      case 'bin':
        return this.binary(e.op, this.eval(e.left, local), this.eval(e.right, local));
      case 'call':
        return this.call(e.name, e.args, local);
      case 'rel':
        return this.relation(e.op, this.eval(e.left, local), this.eval(e.right, local));
      case 'int':
      case 'series':
      case 'deriv':
      case 'limit':
        // numeric calculus on real variables only (the bound variable stays real)
        return this.real(e, this.realVariables(local));
      case 'matrix':
      case 'list':
        return err('unsupported', 'lists and matrices follow in a later version');
    }
  }

  private symbol(name: string, local: ReadonlyMap<string, Value>): Value {
    const v = local.get(name) ?? this.scope.variables?.get(name);
    if (v) return v;
    switch (name) {
      case 'pi':
        return real(Math.PI);
      case 'e':
        return real(Math.E);
      case 'inf':
        return real(Infinity);
      case 'i':
        return complex(0, 1);
      default:
        if (name.startsWith('_')) return this.unwrap(unitSymbol(name));
        return err('unknown-symbol', `unknown variable ${name}`);
    }
  }

  /** The real evaluator on a closed expression; its errors are ours. */
  private real(e: Expr, variables: ReadonlyMap<string, number> = new Map()): Value {
    const r = evaluateNumeric(e, {
      angle: this.scope.angle,
      variables: new Map([...this.realVariables(new Map()), ...variables]),
      functions: this.scope.functions,
    });
    if (!r.ok) throw new ValueError(r.error.code, r.error.message);
    return real(r.value);
  }

  private realVariables(local: ReadonlyMap<string, Value>): Map<string, number> {
    const out = new Map<string, number>();
    for (const m of [this.scope.variables, local]) {
      for (const [k, v] of m ?? []) if (v.kind === 'real') out.set(k, v.v);
    }
    return out;
  }

  /** Real first; outside the real domain the complex branch (if on), else the real error. */
  private realOrComplex(realExpr: Expr, complexFn: () => Complex | null, what: string): Value {
    try {
      return this.real(realExpr);
    } catch (x) {
      if (!(x instanceof ValueError) || x.code !== 'domain') throw x;
      if (what !== 'power' && !COMPLEX_FALLBACK.has(what)) throw x;
      const c = complexFn();
      if (!c || !Number.isFinite(c.re) || !Number.isFinite(c.im)) throw x;
      if (!this.scope.complexResults) {
        throw new ValueError('domain', 'the result is complex (complex results are off)');
      }
      return normalize(c);
    }
  }

  private binary(op: string, a: Value, b: Value): Value {
    const q = binaryQ(op, a, b, this.ints);
    if (q) return this.unwrap(q);
    if (a.kind === 'int') a = real(intReal(a, this.ints));
    if (b.kind === 'int') b = real(intReal(b, this.ints));
    if (a.kind === 'real' && b.kind === 'real') {
      const e: Expr = { type: 'bin', op: op as '+', left: num(a.v), right: num(b.v) };
      if (op !== '^') return this.real(e);
      return this.realOrComplex(e, () => C.pow(asComplex(a), asComplex(b)), 'power');
    }
    const x = asComplex(a);
    const y = asComplex(b);
    switch (op) {
      case '+':
        return normalize(C.add(x, y));
      case '-':
        return normalize(C.sub(x, y));
      case '*':
        return normalize(C.mul(x, y));
      case '/':
        return normalize(C.div(x, y) ?? err('division-by-zero', 'division by zero'));
      default:
        return normalize(C.pow(x, y) ?? err('division-by-zero', '0 to a non-positive power'));
    }
  }

  private relation(op: string, a: Value, b: Value): Value {
    const q = compareQ(op, a, b, this.ints);
    if (q) return real(this.unwrap(q) ? 1 : 0);
    const close = (p: number, q: number) =>
      p === q || Math.abs(p - q) <= EQ_TOL * Math.max(Math.abs(p), Math.abs(q));
    if (op === '=' || op === '!=') {
      const x = asComplex(a);
      const y = asComplex(b);
      const eq = close(x.re, y.re) && close(x.im, y.im);
      return real(eq === (op === '=') ? 1 : 0);
    }
    if (a.kind !== 'real' || b.kind !== 'real') {
      return err('domain', 'complex numbers cannot be ordered');
    }
    const r =
      op === '<' ? a.v < b.v : op === '>' ? a.v > b.v : op === '<=' ? a.v <= b.v : a.v >= b.v;
    return real(r ? 1 : 0);
  }

  call(name: string, argExprs: readonly Expr[], local: ReadonlyMap<string, Value>): Value {
    const user = this.scope.functions?.get(name);
    if (user) {
      if (user.params.length !== argExprs.length) {
        err('syntax', `${name} takes ${user.params.length} argument(s)`);
      }
      if (++this.depth > 64) err('not-evaluable', `${name}: recursion too deep`);
      try {
        const inner = new Map(local);
        user.params.forEach((p, k) => inner.set(p, this.eval(argExprs[k], local)));
        return this.eval(user.body, inner);
      } finally {
        this.depth--;
      }
    }
    let args = argExprs.map((a) => this.eval(a, local));
    const special = callQ(name, args, this.ints);
    if (special) return this.unwrap(special);
    if (args.some((a) => a.kind === 'unit' || a.kind === 'int')) {
      // √ of a quantity keeps its units (√(4_m^2) = 2_m); |x| too
      const [a0] = args;
      if (a0?.kind === 'unit' && (name === 'sqrt' || name === 'abs')) {
        return name === 'abs' ? { ...a0, v: Math.abs(a0.v) } : this.binary('^', a0, real(0.5));
      }
      const plains = args.map((a) => this.unwrap(plain(a, this.ints)));
      args = plains.map((p) => p.value);
      if (
        plains.some((p) => p.radians) &&
        ['sin', 'cos', 'tan', 'cot', 'sec', 'csc'].includes(name)
      ) {
        // an angle with a unit (30_deg) is converted to radians, whatever the angle mode
        return new ValueEvaluator({ ...this.scope, angle: 'rad' }).call(
          name,
          args.map((v) => num((v as { v: number }).v)),
          local,
        );
      }
    }
    const complexFns = ['re', 'im', 'conj', 'arg', 'abs'];
    if (args.every((a) => a.kind === 'real') && !complexFns.includes(name)) {
      const e: Expr = { type: 'call', name, args: args.map((a) => num((a as { v: number }).v)) };
      const one = asComplex(args[0] ?? real(0));
      return this.realOrComplex(e, () => this.complexCall(name, one, args), name);
    }
    if (args.length !== 1 && !(name === 'log' && args.length === 2)) {
      return err('domain', `${name} is not defined for complex arguments`);
    }
    const r = this.complexCall(name, asComplex(args[0]), args);
    return r ? normalize(r) : err('domain', `${name} is undefined here`);
  }

  private toRad(z: Complex): Complex {
    return this.scope.angle === 'deg' ? complex((z.re * Math.PI) / 180, (z.im * Math.PI) / 180) : z;
  }

  private fromRad(z: Complex | null): Complex | null {
    if (!z || this.scope.angle !== 'deg') return z;
    return complex((z.re * 180) / Math.PI, (z.im * 180) / Math.PI);
  }

  /** null = undefined at this point; unknown functions are reported. */
  private complexCall(name: string, z: Complex, args: Value[]): Complex | null {
    switch (name) {
      case 're':
        return complex(z.re, 0);
      case 'im':
        return complex(z.im, 0);
      case 'conj':
        return C.conj(z);
      case 'abs':
        return complex(C.abs(z), 0);
      case 'arg': {
        if (z.re === 0 && z.im === 0) return null;
        return this.fromRad(complex(C.arg(z), 0));
      }
      case 'sqrt':
        return C.sqrt(z);
      case 'exp':
        return C.exp(z);
      case 'ln':
        return C.ln(z);
      case 'log': {
        const l = C.ln(z);
        const base = args.length === 2 ? C.ln(asComplex(args[1])) : complex(Math.LN10, 0);
        return l && base ? C.div(l, base) : null;
      }
      case 'sin':
        return C.sin(this.toRad(z));
      case 'cos':
        return C.cos(this.toRad(z));
      case 'tan':
        return C.tan(this.toRad(z));
      case 'arcsin':
        return this.fromRad(C.asin(z));
      case 'arccos':
        return this.fromRad(C.acos(z));
      case 'arctan':
        return this.fromRad(C.atan(z));
      case 'sinh':
        return C.sinh(z);
      case 'cosh':
        return C.cosh(z);
      case 'tanh':
        return C.tanh(z);
      case 'arcosh': {
        // acosh z = ln(z + √(z−1)·√(z+1))
        const s = C.mul(C.sqrt(C.sub(z, complex(1, 0))), C.sqrt(C.add(z, complex(1, 0))));
        return C.ln(C.add(z, s));
      }
      case 'artanh': {
        // atanh z = ½·(ln(1+z) − ln(1−z))
        const a = C.ln(C.add(complex(1, 0), z));
        const b = C.ln(C.sub(complex(1, 0), z));
        return a && b ? complex((a.re - b.re) / 2, (a.im - b.im) / 2) : null;
      }
      case 'root': {
        const n = args[1];
        if (n?.kind !== 'real' || !Number.isInteger(n.v) || n.v < 2) return null;
        return C.pow(z, complex(1 / n.v, 0));
      }
      default:
        return err('unknown-function', `${name} is not defined for complex arguments`);
    }
  }
}

/** Value of `e`. Non-finite results (overflow) are reported, not returned. */
export function evaluateValue(e: Expr, scope: ValueScope = {}): MathResult<Value> {
  try {
    const v = new ValueEvaluator(scope).eval(e, new Map());
    if (!isFiniteValue(v)) return fail('domain', 'overflow (result too large)');
    return ok(v);
  } catch (x) {
    if (x instanceof ValueError) return fail(x.code, x.message);
    throw x;
  }
}
