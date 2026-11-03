/**
 * The CAS view of ABA-T1 (prompt 029): one input line → one command. Top-level calls like
 * `factor(…)`, `solve(…, x)`, `taylor(…)` choose the operation; anything else is simplified.
 * Every answer goes through a numerical check (`verify.ts`) or is exact by construction; what the
 * engine cannot do is refused with `unsupported`, never guessed. Runs in the worker.
 */
import nerdamer from 'nerdamer';
import { freeSymbols, substitute } from '../ast/build';
import type { Expr } from '../ast/nodes';
import { compile, evaluateNumeric, type UserFunction } from '../numeric/evaluate';
import { integrateAdaptive } from '../numeric/quadrature';
import { brent } from '../numeric/roots';
import { type MathResult, fail, ok } from '../result';
import type { CasValue, Solutions, SystemSolution } from './engine';
import * as Z from './integer';
import { NerdamerEngine, accept, run } from './nerdamer-engine';
import { fromNerdamer, splitList, toNerdamer } from './nerdamer-syntax';
import { type Check, checkEqual, close } from './verify';

/** Command names the parser must read as function calls in the CAS view. */
export const CAS_COMMANDS = [
  'simplify',
  'expand',
  'factor',
  'solve',
  'nsolve',
  'partfrac',
  'quo',
  'rem',
  'degree',
  'coeff',
  'gcd',
  'lcm',
  'taylor',
  'laplace',
  'ifactor',
  'isprime',
  'nextprime',
  'prevprime',
  'euler',
  'divisors',
  'iquo',
  'irem',
] as const;

export type CasCommand = (typeof CAS_COMMANDS)[number];

export type CasOutput =
  | { kind: 'value'; value: CasValue }
  | { kind: 'solutions'; value: Solutions }
  | { kind: 'system'; value: SystemSolution[] }
  | { kind: 'list'; items: CasValue[] }
  | { kind: 'bool'; value: boolean };

export interface CasScope {
  /** CAS variables (`a := 2`) and home variables, substituted before the command runs */
  readonly variables?: ReadonlyMap<string, Expr>;
  readonly functions?: ReadonlyMap<string, UserFunction>;
}

const engine = new NerdamerEngine();
const num = (v: number): Expr => ({ type: 'num', value: String(v) });
const exact = (expr: Expr): CasValue => ({ expr, approximate: false, verified: true });
const value = (r: MathResult<CasValue>): MathResult<CasOutput> =>
  r.ok ? ok({ kind: 'value', value: r.value }) : r;

/** Variables substituted, user function calls expanded (depth-limited). */
export function inline(e: Expr, scope: CasScope, depth = 0): Expr {
  if (depth > 32) throw new Error('user functions nest too deeply');
  const go = (x: Expr): Expr => {
    switch (x.type) {
      case 'sym':
        return scope.variables?.get(x.name) ?? x;
      case 'call': {
        const args = x.args.map(go);
        const f = scope.functions?.get(x.name);
        if (!f || f.params.length !== args.length) return { ...x, args };
        const body = substitute(f.body, new Map(f.params.map((p, k) => [p, args[k]])));
        return inline(body, scope, depth + 1);
      }
      case 'neg':
      case 'post':
        return { ...x, arg: go(x.arg) };
      case 'bin':
      case 'rel':
        return { ...x, left: go(x.left), right: go(x.right) };
      case 'list':
        return { ...x, items: x.items.map(go) };
      case 'matrix':
        return { ...x, rows: x.rows.map((r) => r.map(go)) };
      case 'int':
        return {
          ...x,
          expr: go(x.expr),
          lower: x.lower && go(x.lower),
          upper: x.upper && go(x.upper),
        };
      case 'series':
        return { ...x, expr: go(x.expr), lower: go(x.lower), upper: go(x.upper) };
      case 'deriv':
        return { ...x, expr: go(x.expr) };
      case 'limit':
        return { ...x, expr: go(x.expr), to: go(x.to) };
      default:
        return x;
    }
  };
  return go(e);
}

/** The variable of a command: the given one, else the only free one, else x. */
function variableOf(e: Expr, given?: Expr): MathResult<string> {
  if (given) {
    return given.type === 'sym' ? ok(given.name) : fail('syntax', 'the variable must be a name');
  }
  const free = [...freeSymbols(e)].filter((s) => !['pi', 'e', 'i', 'inf'].includes(s));
  return ok(free.length === 1 ? free[0] : 'x');
}

function intArg(e: Expr | undefined, what: string): MathResult<number> {
  if (!e) return fail('syntax', `${what} is missing`);
  const r = evaluateNumeric(e);
  if (!r.ok) return r;
  return Number.isInteger(r.value) ? ok(r.value) : fail('domain', `${what} must be an integer`);
}

function nerd(text: string, check: (e: Expr) => Check): MathResult<CasValue> {
  return accept(text, check);
}

const NERD = nerdamer as unknown as (s: string) => { text(): string };

export function runCas(input: Expr, scope: CasScope = {}): MathResult<CasOutput> {
  let e: Expr;
  try {
    e = inline(input, scope);
  } catch (x) {
    return fail('not-evaluable', x instanceof Error ? x.message : String(x));
  }
  if (e.type === 'deriv') return value(engine.differentiate(e.expr, e.variable, e.order));
  if (e.type === 'int') {
    return value(
      e.lower && e.upper
        ? engine.integrateDefinite(e.expr, e.variable, e.lower, e.upper)
        : engine.integrate(e.expr, e.variable),
    );
  }
  if (e.type === 'limit') return value(engine.limit(e.expr, e.variable, e.to, e.direction));
  if (e.type === 'series') return sumSeries(e);
  if (e.type === 'call' && (CAS_COMMANDS as readonly string[]).includes(e.name)) {
    return command(e.name as CasCommand, e.args);
  }
  return value(engine.simplify(e));
}

function command(name: CasCommand, args: readonly Expr[]): MathResult<CasOutput> {
  const [a, b, c, d] = args;
  if (!a) return fail('syntax', `${name} needs an argument`);
  switch (name) {
    case 'simplify':
      return value(engine.simplify(a));
    case 'expand':
      return value(engine.expand(a));
    case 'factor':
      return value(engine.factor(a));
    case 'solve': {
      if (a.type === 'list') {
        const vars = b?.type === 'list' ? b.items : [];
        if (!vars.every((v) => v.type === 'sym')) return fail('syntax', 'variables must be names');
        const names = vars.length
          ? vars.map((v) => (v as { name: string }).name)
          : [...new Set(a.items.flatMap((q) => [...freeSymbols(q)]))].sort();
        const r = engine.solveSystem(a.items, names);
        return r.ok ? ok({ kind: 'system', value: r.value }) : r;
      }
      const v = variableOf(a, b);
      if (!v.ok) return v;
      const r = engine.solve(a, v.value);
      return r.ok ? ok({ kind: 'solutions', value: r.value }) : r;
    }
    case 'nsolve':
      return nsolve(a, b, c);
    case 'partfrac': {
      const v = variableOf(a, b);
      if (!v.ok) return v;
      const r = run(() => NERD(`partfrac(${toNerdamer(a)}, ${v.value})`).text());
      return value(r.ok ? nerd(r.value, (x) => checkEqual(a, x)) : r);
    }
    case 'quo':
    case 'rem': {
      if (!b) return fail('syntax', `${name}(a, b) needs two polynomials`);
      const r = polyDivide(a, b);
      if (!r.ok) return r;
      return ok({ kind: 'value', value: name === 'quo' ? r.value.q : r.value.r });
    }
    case 'coeff':
    case 'degree': {
      const v = variableOf(a, b);
      if (!v.ok) return v;
      const r = coefficients(a, v.value);
      if (!r.ok) return r;
      if (name === 'degree') return ok({ kind: 'value', value: exact(num(r.value.length - 1)) });
      return ok({ kind: 'list', items: r.value.map((x) => ({ ...x })) });
    }
    case 'gcd':
    case 'lcm':
      return gcdLcm(name, args);
    case 'taylor':
      return taylor(a, b, c, d);
    case 'laplace':
      return laplace(a, b, c);
    case 'ifactor': {
      const n = intArg(a, 'ifactor');
      if (!n.ok) return n;
      const f = Z.primeFactors(n.value);
      if (!f.ok) return f;
      if (!f.value.length) return ok({ kind: 'value', value: exact(num(1)) });
      const terms = f.value.map(([p, k]): Expr =>
        k === 1 ? num(p) : { type: 'bin', op: '^', left: num(p), right: num(k) },
      );
      return ok({
        kind: 'value',
        value: exact(terms.reduce((l, r) => ({ type: 'bin', op: '*', left: l, right: r }))),
      });
    }
    case 'isprime': {
      const n = intArg(a, 'isprime');
      if (!n.ok) return n;
      const r = Z.isPrime(n.value);
      return r.ok ? ok({ kind: 'bool', value: r.value }) : r;
    }
    case 'nextprime':
    case 'prevprime':
    case 'euler': {
      const n = intArg(a, name);
      if (!n.ok) return n;
      const f = name === 'nextprime' ? Z.nextPrime : name === 'prevprime' ? Z.prevPrime : Z.euler;
      const r = f(n.value);
      return r.ok ? ok({ kind: 'value', value: exact(num(r.value)) }) : r;
    }
    case 'divisors': {
      const n = intArg(a, 'divisors');
      if (!n.ok) return n;
      const r = Z.divisors(n.value);
      return r.ok ? ok({ kind: 'list', items: r.value.map((x) => exact(num(x))) }) : r;
    }
    case 'iquo':
    case 'irem': {
      const x = intArg(a, name);
      const y = intArg(b, name);
      if (!x.ok) return x;
      if (!y.ok) return y;
      const r = Z.divide(x.value, y.value);
      return r.ok
        ? ok({ kind: 'value', value: exact(num(name === 'iquo' ? r.value.q : r.value.r)) })
        : r;
    }
  }
}

/** Σ/Π: numerically for numeric bounds, symbolically (Nerdamer) with a check on small n. */
function sumSeries(e: Extract<Expr, { type: 'series' }>): MathResult<CasOutput> {
  const lo = evaluateNumeric(e.lower);
  const hi = evaluateNumeric(e.upper);
  if (lo.ok && hi.ok) {
    // numeric bounds: exact simplification of the explicit sum (small) or the value
    const r = engine.simplify(e);
    if (r.ok) return value(r);
  }
  const fn = e.kind === 'sum' ? 'sum' : 'product';
  const r = run(() =>
    NERD(
      `${fn}(${toNerdamer(e.expr)}, ${e.variable}, ${toNerdamer(e.lower)}, ${toNerdamer(e.upper)})`,
    ).text(),
  );
  if (!r.ok) return r;
  return value(
    nerd(r.value, (S) => {
      // compare with explicit sums for the free upper bound n = lower … lower + 5
      if (!lo.ok || e.upper.type !== 'sym') return 'unknown';
      const n = e.upper.name;
      for (let k = 0; k < 6; k++) {
        const top = lo.value + k;
        let acc = e.kind === 'sum' ? 0 : 1;
        for (let j = lo.value; j <= top; j++) {
          const t = evaluateNumeric(e.expr, { variables: new Map([[e.variable, j]]) });
          if (!t.ok) return 'unknown';
          acc = e.kind === 'sum' ? acc + t.value : acc * t.value;
        }
        const s = evaluateNumeric(S, { variables: new Map([[n, top]]) });
        if (!s.ok) return 'unknown';
        if (!close(s.value, acc, 1e-9)) return 'mismatch';
      }
      return 'ok';
    }),
  );
}

function polyDivide(a: Expr, b: Expr): MathResult<{ q: CasValue; r: CasValue }> {
  // Nerdamer's div gives [quotient, remainder]
  const t = run(() => NERD(`div(${toNerdamer(a)}, ${toNerdamer(b)})`).text());
  if (!t.ok) return t;
  const [qt, rt] = splitList(t.value);
  const q = fromNerdamer(qt ?? '');
  const r = fromNerdamer(rt ?? '');
  if (!q.ok) return q;
  if (!r.ok) return r;
  const verdict = checkEqual(a, {
    type: 'bin',
    op: '+',
    left: { type: 'bin', op: '*', left: q.value.expr, right: b },
    right: r.value.expr,
  });
  if (verdict === 'mismatch') return fail('unsupported', 'polynomial division failed the check');
  const verified = verdict === 'ok';
  return ok({ q: { ...q.value, verified }, r: { ...r.value, verified } });
}

/** Coefficients from the lowest power on, checked by rebuilding the polynomial. */
function coefficients(p: Expr, v: string): MathResult<CasValue[]> {
  const t = run(() => NERD(`coeffs(${toNerdamer(p)}, ${v})`).text());
  if (!t.ok) return t;
  const parts = splitList(t.value);
  const cs: Expr[] = [];
  for (const part of parts) {
    const c = fromNerdamer(part);
    if (!c.ok) return c;
    cs.push(c.value.expr);
  }
  while (cs.length > 1) {
    const last = evaluateNumeric(cs[cs.length - 1]);
    if (last.ok && last.value === 0) cs.pop();
    else break;
  }
  const rebuilt = cs.reduce<Expr>(
    (acc, c, k) => ({
      type: 'bin',
      op: '+',
      left: acc,
      right: {
        type: 'bin',
        op: '*',
        left: c,
        right: { type: 'bin', op: '^', left: { type: 'sym', name: v }, right: num(k) },
      },
    }),
    num(0),
  );
  if (cs.some((c) => freeSymbols(c).has(v))) {
    return fail('unsupported', `not a polynomial in ${v}`);
  }
  const verdict = checkEqual(p, rebuilt);
  if (verdict === 'mismatch') return fail('unsupported', `not a polynomial in ${v}`);
  return ok(cs.reverse().map((c) => ({ expr: c, approximate: false, verified: verdict === 'ok' })));
}

function gcdLcm(name: 'gcd' | 'lcm', args: readonly Expr[]): MathResult<CasOutput> {
  if (args.length < 2) return fail('syntax', `${name} needs two arguments`);
  const nums = args.map((x) => evaluateNumeric(x));
  if (nums.every((r) => r.ok && Number.isInteger(r.value))) {
    const r = evaluateNumeric({ type: 'call', name, args });
    return r.ok ? ok({ kind: 'value', value: exact(num(r.value)) }) : r;
  }
  const [a, b] = args;
  const t = run(() => NERD(`${name}(${toNerdamer(a)}, ${toNerdamer(b)})`).text());
  if (!t.ok) return t;
  const g = fromNerdamer(t.value);
  if (!g.ok) return g;
  // the gcd must divide both, the lcm must be divisible by both
  const pairs =
    name === 'gcd'
      ? [
          [a, g.value.expr],
          [b, g.value.expr],
        ]
      : [
          [g.value.expr, a],
          [g.value.expr, b],
        ];
  for (const [p, q] of pairs) {
    const d = polyDivide(p, q);
    if (!d.ok) return d;
    const zero = checkEqual(d.value.r.expr, num(0));
    if (zero === 'mismatch')
      return fail('unsupported', `the ${name} failed the divisibility check`);
  }
  return ok({ kind: 'value', value: { ...g.value, verified: true } });
}

/** Taylor polynomial Σ f⁽ᵏ⁾(a)/k!·(x−a)ᵏ from verified derivatives. */
function taylor(f: Expr, vArg?: Expr, nArg?: Expr, aArg?: Expr): MathResult<CasOutput> {
  const v = variableOf(f, vArg);
  if (!v.ok) return v;
  const n = nArg ? intArg(nArg, 'the order') : ok(5);
  if (!n.ok) return n;
  if (n.value < 0 || n.value > 12) return fail('domain', 'the order must be between 0 and 12');
  const at = aArg ?? num(0);
  const x: Expr = { type: 'sym', name: v.value };
  let term: CasValue = exact(f);
  let sum: Expr = num(0);
  let fact = 1;
  let verified = true;
  for (let k = 0; k <= n.value; k++) {
    if (k > 0) {
      const d = engine.differentiate(term.expr, v.value);
      if (!d.ok) return d;
      term = d.value;
      verified &&= d.value.verified;
      fact *= k;
    }
    const c = engine.simplify(substitute(term.expr, new Map([[v.value, at]])));
    if (!c.ok) return c;
    const shift: Expr = { type: 'bin', op: '-', left: x, right: at };
    sum = {
      type: 'bin',
      op: '+',
      left: sum,
      right: {
        type: 'bin',
        op: '*',
        left: { type: 'bin', op: '/', left: c.value.expr, right: num(fact) },
        right: { type: 'bin', op: '^', left: shift, right: num(k) },
      },
    };
  }
  const s = engine.expand(sum);
  if (!s.ok) return s;
  return ok({ kind: 'value', value: { ...s.value, verified: verified && s.value.verified } });
}

/** Laplace transform (Nerdamer), checked by numerical integration at s = 2 and s = 3. */
function laplace(f: Expr, tArg?: Expr, sArg?: Expr): MathResult<CasOutput> {
  const t = variableOf(f, tArg);
  if (!t.ok) return t;
  const s = sArg?.type === 'sym' ? sArg.name : 's';
  const r = run(() => NERD(`laplace(${toNerdamer(f)}, ${t.value}, ${s})`).text());
  if (!r.ok) return r;
  return value(
    nerd(r.value, (F) => {
      const g = compile(f, t.value);
      let agreed = 0;
      for (const sv of [2, 3]) {
        const num = integrateAdaptive((x) => g(x) * Math.exp(-sv * x), 0, 60);
        const val = evaluateNumeric(F, { variables: new Map([[s, sv]]) });
        if (!num.ok || !val.ok) continue;
        if (!close(num.value.value, val.value, 1e-5)) return 'mismatch';
        agreed++;
      }
      return agreed ? 'ok' : 'unknown';
    }),
  );
}

/** nsolve(f, x, guess) or nsolve(f, x, a, b): a numerical root (Brent in a bracket). */
function nsolve(eq: Expr, vArg?: Expr, g1?: Expr, g2?: Expr): MathResult<CasOutput> {
  const v = variableOf(eq, vArg);
  if (!v.ok) return v;
  const f =
    eq.type === 'rel' ? ({ type: 'bin', op: '-', left: eq.left, right: eq.right } as Expr) : eq;
  const fn = compile(f, v.value);
  const a0 = g1 ? evaluateNumeric(g1) : ok(0);
  if (!a0.ok) return a0;
  let lo: number;
  let hi: number;
  if (g2) {
    const b0 = evaluateNumeric(g2);
    if (!b0.ok) return b0;
    [lo, hi] = [a0.value, b0.value];
  } else {
    // widen a bracket around the guess until the sign changes
    let w = 0.5;
    [lo, hi] = [a0.value - w, a0.value + w];
    while (Math.sign(fn(lo)) === Math.sign(fn(hi)) && w < 1e6) {
      w *= 2;
      [lo, hi] = [a0.value - w, a0.value + w];
    }
  }
  const r = brent(fn, lo, hi);
  if (!r.ok) return r;
  return ok({
    kind: 'value',
    value: { expr: num(r.value.root), approximate: true, verified: true },
  });
}
