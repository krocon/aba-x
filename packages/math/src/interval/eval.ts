/**
 * Evaluation of expressions and relations in X and Y over boxes (interval arithmetic) and points
 * (doubles) – the decision core of the implicit plotter (prompt 036).
 *
 * Input is the core AST. A relation is a `rel` node (`=`, `<`, `>`, `<=`, `>=`, `!=`); the logical
 * connectives are written as calls `and(…)`, `or(…)`, `not(…)`, `xor(…)` – the text and LaTeX
 * parsers know no AND/OR operators, but parse these calls when the names are passed as
 * user-defined functions: `parseText('and(Y>X^2, X<1)', { functions: LOGIC_FUNCTIONS })`.
 * `and`/`or`/`xor` take two or more arguments, `not` one. A chained comparison `0 < X < 1` (a
 * relation whose left side is a relation) means `and(0 < X, X < 1)`.
 *
 * Three-valued truth on a box: `'true'` – the relation holds at every point of the box, `'false'`
 * – at no point, `'unknown'` – not decided. A relation fails where one of its sides is undefined.
 * An equality (`=`) is never `'true'` on a box (its solution set has no area) and an inequality
 * `!=` is never `'false'`. Connectives use Kleene logic.
 *
 * The point evaluator follows the numeric evaluator (`numeric/evaluate.ts`) – real odd roots,
 * `log(x, b)`, `root(x, n)`, angle mode – and returns NaN where the function is undefined. The
 * interval evaluator encloses exactly these point functions; constant exponents and root orders
 * are taken as the double the point evaluator computes.
 */
import type { Expr, RelationOp } from '../ast/nodes';
import type { AngleMode } from '../numeric/evaluate';
import { erf } from '../numeric/evaluate';
import { type MathResult, fail, ok } from '../result';
import * as I from './interval';
import type { Interval } from './interval';

export type Truth = 'true' | 'false' | 'unknown';

/** Names accepted as logical connectives; pass them to the parser as `functions`. */
export const LOGIC_FUNCTIONS: ReadonlySet<string> = new Set(['and', 'or', 'not', 'xor']);

export interface RelationEvalOptions {
  /** Angle unit of the trigonometric functions (default `'rad'`). */
  readonly angle?: AngleMode;
  /** Further named values (stored variables A…Z); X and Y must not be among them. */
  readonly variables?: ReadonlyMap<string, number>;
  /** Names of the horizontal variable (default `['X', 'x']`). */
  readonly xNames?: readonly string[];
  /** Names of the vertical variable (default `['Y', 'y']`). */
  readonly yNames?: readonly string[];
}

export type IntervalFn = (x: Interval, y: Interval) => Interval;
/** Point function; NaN where undefined. */
export type PointFn = (x: number, y: number) => number;

/** One relation `left op right` of a formula, indexed in order of appearance. */
export interface RelationAtom {
  readonly index: number;
  readonly op: RelationOp;
  /** Enclosure of left − right over a box (for decisions, continuity and boundary cells). */
  readonly diffInterval: IntervalFn;
  /** left − right at a point (NaN where undefined) – the boundary is its zero set. */
  readonly diff: PointFn;
  readonly left: IntervalFn;
  readonly right: IntervalFn;
  readonly leftPoint: PointFn;
  readonly rightPoint: PointFn;
}

export interface CompiledRelation {
  readonly atoms: readonly RelationAtom[];
  /** Truth of the whole formula on the box X × Y. */
  truth(x: Interval, y: Interval): Truth;
  /** Truth of one atom on the box. */
  atomTruth(index: number, x: Interval, y: Interval): Truth;
  /** Truth of the formula at a point (undefined sides → false). */
  pointTruth(x: number, y: number): boolean;
  /** Point truth with some atoms forced to a value – does atom k matter at this point? */
  pointTruthWith(x: number, y: number, forced: ReadonlyMap<number, boolean>): boolean;
}

// ---------------------------------------------------------------------------------------------
// three-valued comparisons

/** Truth of `F op G` for enclosures F, G of both sides on a box. */
export function compareIntervals(F: Interval, G: Interval, op: RelationOp): Truth {
  if (F.def === 'none' || G.def === 'none') return 'false';
  const all = F.def === 'all' && G.def === 'all';
  let holds: boolean; // relation proven on every (defined) point
  let fails: boolean; // relation proven false on every defined point
  switch (op) {
    case '<':
      holds = F.hi < G.lo;
      fails = F.lo >= G.hi;
      break;
    case '<=':
      holds = F.hi <= G.lo;
      fails = F.lo > G.hi;
      break;
    case '>':
      holds = F.lo > G.hi;
      fails = F.hi <= G.lo;
      break;
    case '>=':
      holds = F.lo >= G.hi;
      fails = F.hi < G.lo;
      break;
    case '=':
      holds = false;
      fails = F.hi < G.lo || F.lo > G.hi;
      break;
    case '!=':
      holds = F.hi < G.lo || F.lo > G.hi;
      fails = false;
      break;
  }
  if (fails) return 'false';
  if (holds && all) return 'true';
  return 'unknown';
}

function comparePoints(l: number, r: number, op: RelationOp): boolean {
  if (l !== l || r !== r) return false;
  switch (op) {
    case '<':
      return l < r;
    case '<=':
      return l <= r;
    case '>':
      return l > r;
    case '>=':
      return l >= r;
    case '=':
      return l === r;
    case '!=':
      return l !== r;
  }
}

const kleeneAnd = (ts: Truth[]): Truth =>
  ts.includes('false') ? 'false' : ts.every((t) => t === 'true') ? 'true' : 'unknown';
const kleeneOr = (ts: Truth[]): Truth =>
  ts.includes('true') ? 'true' : ts.every((t) => t === 'false') ? 'false' : 'unknown';
const kleeneNot = (t: Truth): Truth =>
  t === 'true' ? 'false' : t === 'false' ? 'true' : 'unknown';
function kleeneXor(ts: Truth[]): Truth {
  if (ts.includes('unknown')) return 'unknown';
  return ts.filter((t) => t === 'true').length % 2 === 1 ? 'true' : 'false';
}

// ---------------------------------------------------------------------------------------------
// compilation

class CompileError extends Error {
  constructor(
    readonly code: 'unknown-symbol' | 'unknown-function' | 'unsupported' | 'syntax',
    message: string,
  ) {
    super(message);
  }
}

const bad = (code: CompileError['code'], message: string): never => {
  throw new CompileError(code, message);
};

const isInt = Number.isInteger;

interface Ctx {
  readonly angle: AngleMode;
  readonly vars: ReadonlyMap<string, number>;
  readonly xNames: readonly string[];
  readonly yNames: readonly string[];
}

function context(o: RelationEvalOptions): Ctx {
  return {
    angle: o.angle ?? 'rad',
    vars: o.variables ?? new Map(),
    xNames: o.xNames ?? ['X', 'x'],
    yNames: o.yNames ?? ['Y', 'y'],
  };
}

/** True if the expression does not depend on X or Y. */
function isConstant(e: Expr, c: Ctx): boolean {
  switch (e.type) {
    case 'num':
      return true;
    case 'sym':
      return !c.xNames.includes(e.name) && !c.yNames.includes(e.name);
    case 'neg':
    case 'post':
      return isConstant(e.arg, c);
    case 'bin':
      return isConstant(e.left, c) && isConstant(e.right, c);
    case 'call':
      return e.args.every((a) => isConstant(a, c));
    default:
      return false;
  }
}

const DEG = I.div(I.PI, I.point(180));
const RAD = I.div(I.point(180), I.PI);

/** Arity check against the catalogue of supported functions. */
const ARITY: Record<string, [number, number]> = {
  sin: [1, 1],
  cos: [1, 1],
  tan: [1, 1],
  cot: [1, 1],
  sec: [1, 1],
  csc: [1, 1],
  arcsin: [1, 1],
  arccos: [1, 1],
  arctan: [1, 1],
  sinh: [1, 1],
  cosh: [1, 1],
  tanh: [1, 1],
  arsinh: [1, 1],
  arcosh: [1, 1],
  artanh: [1, 1],
  exp: [1, 1],
  ln: [1, 1],
  log: [1, 2],
  sqrt: [1, 1],
  root: [2, 2],
  abs: [1, 1],
  sign: [1, 1],
  floor: [1, 1],
  ceil: [1, 1],
  round: [1, 1],
  erf: [1, 1],
  min: [2, 32],
  max: [2, 32],
};

const ALIASES: Record<string, string> = {
  asin: 'arcsin',
  acos: 'arccos',
  atan: 'arctan',
  asinh: 'arsinh',
  arcsinh: 'arsinh',
  acosh: 'arcosh',
  arccosh: 'arcosh',
  atanh: 'artanh',
  arctanh: 'artanh',
  lg: 'log',
  sgn: 'sign',
};

function checkCall(name: string, n: number): string {
  if (LOGIC_FUNCTIONS.has(name)) bad('unsupported', `${name}(…) is only allowed around relations`);
  const canonical = ALIASES[name] ?? name;
  const arity = ARITY[canonical];
  if (!arity) return bad('unknown-function', `${name} cannot be used in a relation plot`);
  if (n < arity[0] || n > arity[1])
    bad('syntax', `${name} takes ${arity[0]}–${arity[1]} argument(s)`);
  return canonical;
}

/** Classification of a constant exponent, mirroring the numeric evaluator. */
function powerKind(p: number): 'int' | 'odd-root' | 'real' {
  if (isInt(p)) return 'int';
  const inv = 1 / p;
  return Math.abs(inv - Math.round(inv)) < 1e-12 && Math.round(inv) % 2 !== 0 ? 'odd-root' : 'real';
}

// ---- point compiler ---------------------------------------------------------------------------

function pointPow(a: number, b: number): number {
  if (a === 0 && b < 0) return NaN;
  if (a < 0 && !isInt(b)) {
    return powerKind(b) === 'odd-root' ? -Math.pow(-a, b) : NaN;
  }
  return Math.pow(a, b);
}

const POINT1: Record<string, (x: number) => number> = {
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  arsinh: Math.asinh,
  arcosh: (x) => (x >= 1 ? Math.acosh(x) : NaN),
  artanh: (x) => (Math.abs(x) < 1 ? Math.atanh(x) : NaN),
  exp: Math.exp,
  ln: (x) => (x > 0 ? Math.log(x) : NaN),
  sqrt: (x) => (x >= 0 ? Math.sqrt(x) : NaN),
  abs: Math.abs,
  sign: Math.sign,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  erf,
};

function compilePointExpr(e: Expr, c: Ctx): PointFn {
  switch (e.type) {
    case 'num': {
      const v = Number(e.value);
      return () => v;
    }
    case 'sym': {
      if (c.xNames.includes(e.name)) return (x) => x;
      if (c.yNames.includes(e.name)) return (_x, y) => y;
      const v = c.vars.get(e.name);
      if (v !== undefined) return () => v;
      if (e.name === 'pi') return () => Math.PI;
      if (e.name === 'e') return () => Math.E;
      return bad('unknown-symbol', `unknown variable ${e.name}`);
    }
    case 'neg': {
      const a = compilePointExpr(e.arg, c);
      return (x, y) => -a(x, y);
    }
    case 'post': {
      if (e.op === '!') return bad('unsupported', 'factorial is not supported in relation plots');
      const a = compilePointExpr(e.arg, c);
      return (x, y) => a(x, y) / 100;
    }
    case 'bin': {
      const l = compilePointExpr(e.left, c);
      const r = compilePointExpr(e.right, c);
      switch (e.op) {
        case '+':
          return (x, y) => l(x, y) + r(x, y);
        case '-':
          return (x, y) => l(x, y) - r(x, y);
        case '*':
          return (x, y) => l(x, y) * r(x, y);
        case '/':
          return (x, y) => {
            const d = r(x, y);
            return d === 0 ? NaN : l(x, y) / d;
          };
        case '^':
          return (x, y) => pointPow(l(x, y), r(x, y));
      }
      break;
    }
    case 'call':
      return compilePointCall(e.name, e.args, c);
    case 'rel':
      return bad('unsupported', 'a relation cannot be used as a value');
    default:
      return bad('unsupported', `${e.type} is not supported in relation plots`);
  }
  return bad('unsupported', 'unsupported expression');
}

function compilePointCall(rawName: string, args: readonly Expr[], c: Ctx): PointFn {
  const name = checkCall(rawName, args.length);
  const fs = args.map((a) => compilePointExpr(a, c));
  const a = fs[0];
  const toRad = c.angle === 'deg' ? (v: number) => (v * Math.PI) / 180 : (v: number) => v;
  const fromRad = c.angle === 'deg' ? (v: number) => (v * 180) / Math.PI : (v: number) => v;
  const nz = (v: number) => (v === 0 ? NaN : v);
  switch (name) {
    case 'sin':
      return (x, y) => Math.sin(toRad(a(x, y)));
    case 'cos':
      return (x, y) => Math.cos(toRad(a(x, y)));
    case 'tan':
      return (x, y) => Math.tan(toRad(a(x, y)));
    case 'cot':
      return (x, y) => 1 / nz(Math.tan(toRad(a(x, y))));
    case 'sec':
      return (x, y) => 1 / nz(Math.cos(toRad(a(x, y))));
    case 'csc':
      return (x, y) => 1 / nz(Math.sin(toRad(a(x, y))));
    case 'arcsin':
      return (x, y) => fromRad(Math.asin(a(x, y)));
    case 'arccos':
      return (x, y) => fromRad(Math.acos(a(x, y)));
    case 'arctan':
      return (x, y) => fromRad(Math.atan(a(x, y)));
    case 'log': {
      if (fs.length === 1) return (x, y) => (a(x, y) > 0 ? Math.log10(a(x, y)) : NaN);
      const b = fs[1];
      return (x, y) => {
        const v = a(x, y);
        const base = b(x, y);
        return v > 0 && base > 0 && base !== 1 ? Math.log(v) / Math.log(base) : NaN;
      };
    }
    case 'root': {
      const n = fs[1];
      return (x, y) => {
        const v = a(x, y);
        const k = n(x, y);
        if (!isInt(k) || k < 2) return NaN;
        if (v < 0) return k % 2 === 1 ? -Math.pow(-v, 1 / k) : NaN;
        return Math.pow(v, 1 / k);
      };
    }
    case 'min':
      return (x, y) => Math.min(...fs.map((f) => f(x, y)));
    case 'max':
      return (x, y) => Math.max(...fs.map((f) => f(x, y)));
    default: {
      const f = POINT1[name];
      return (x, y) => f(a(x, y));
    }
  }
}

// ---- interval compiler ------------------------------------------------------------------------

function compileIntervalExpr(e: Expr, c: Ctx): IntervalFn {
  if (isConstant(e, c) && e.type !== 'num') {
    // constant subtree: evaluate once (still as an enclosure)
    const f = compileIntervalInner(e, c);
    const v = f(I.point(0), I.point(0));
    return () => v;
  }
  return compileIntervalInner(e, c);
}

function compileIntervalInner(e: Expr, c: Ctx): IntervalFn {
  switch (e.type) {
    case 'num': {
      const v = I.fromDecimal(e.value);
      return () => v;
    }
    case 'sym': {
      if (c.xNames.includes(e.name)) return (x) => x;
      if (c.yNames.includes(e.name)) return (_x, y) => y;
      const n = c.vars.get(e.name);
      if (n !== undefined) {
        const v = I.point(n);
        return () => v;
      }
      if (e.name === 'pi') return () => I.PI;
      if (e.name === 'e') return () => I.E;
      return bad('unknown-symbol', `unknown variable ${e.name}`);
    }
    case 'neg': {
      const a = compileIntervalExpr(e.arg, c);
      return (x, y) => I.neg(a(x, y));
    }
    case 'post': {
      if (e.op === '!') return bad('unsupported', 'factorial is not supported in relation plots');
      const a = compileIntervalExpr(e.arg, c);
      const hundred = I.point(100);
      return (x, y) => I.div(a(x, y), hundred);
    }
    case 'bin': {
      const l = compileIntervalExpr(e.left, c);
      if (e.op === '^' && isConstant(e.right, c)) {
        const p = compilePointExpr(e.right, c)(0, 0);
        if (p !== p) return () => I.NONE;
        const kind = powerKind(p);
        if (kind === 'int') return (x, y) => I.powInt(l(x, y), p);
        if (kind === 'odd-root') return (x, y) => I.powOddRoot(l(x, y), p);
        return (x, y) => I.powReal(l(x, y), p);
      }
      const r = compileIntervalExpr(e.right, c);
      const op = { '+': I.add, '-': I.sub, '*': I.mul, '/': I.div, '^': I.pow }[e.op];
      return (x, y) => op(l(x, y), r(x, y));
    }
    case 'call':
      return compileIntervalCall(e.name, e.args, c);
    case 'rel':
      return bad('unsupported', 'a relation cannot be used as a value');
    default:
      return bad('unsupported', `${e.type} is not supported in relation plots`);
  }
}

const INTERVAL1: Record<string, (a: Interval) => Interval> = {
  sinh: I.sinh,
  cosh: I.cosh,
  tanh: I.tanh,
  arsinh: I.asinh,
  arcosh: I.acosh,
  artanh: I.atanh,
  exp: I.exp,
  ln: I.ln,
  sqrt: I.sqrt,
  abs: I.abs,
  sign: I.sign,
  floor: I.floor,
  ceil: I.ceil,
  round: I.round,
  erf: (a) => I.increasingAbs(a, erf, 1e-13, -1, 1),
};

function compileIntervalCall(rawName: string, args: readonly Expr[], c: Ctx): IntervalFn {
  const name = checkCall(rawName, args.length);
  const a = compileIntervalExpr(args[0], c);
  const deg = c.angle === 'deg';
  const toRad = deg ? (v: Interval) => I.mul(v, DEG) : (v: Interval) => v;
  const fromRad = deg ? (v: Interval) => I.mul(v, RAD) : (v: Interval) => v;
  const one = I.point(1);
  switch (name) {
    case 'sin':
      return (x, y) => I.sin(toRad(a(x, y)));
    case 'cos':
      return (x, y) => I.cos(toRad(a(x, y)));
    case 'tan':
      return (x, y) => I.tan(toRad(a(x, y)));
    case 'cot':
      return (x, y) => {
        const t = toRad(a(x, y));
        return I.div(I.cos(t), I.sin(t));
      };
    case 'sec':
      return (x, y) => I.div(one, I.cos(toRad(a(x, y))));
    case 'csc':
      return (x, y) => I.div(one, I.sin(toRad(a(x, y))));
    case 'arcsin':
      return (x, y) => fromRad(I.asin(a(x, y)));
    case 'arccos':
      return (x, y) => fromRad(I.acos(a(x, y)));
    case 'arctan':
      return (x, y) => fromRad(I.atan(a(x, y)));
    case 'log': {
      if (args.length === 1) return (x, y) => I.log10(a(x, y));
      const b = compileIntervalExpr(args[1], c);
      return (x, y) => I.div(I.ln(a(x, y)), I.ln(b(x, y)));
    }
    case 'root': {
      if (!isConstant(args[1], c)) {
        // the order varies over the box: only integer orders ≥ 2 are defined – no tight enclosure
        return () => I.entire('partial');
      }
      const n = compilePointExpr(args[1], c)(0, 0);
      return (x, y) => I.rootN(a(x, y), n);
    }
    case 'min':
    case 'max': {
      const fs = args.map((e) => compileIntervalExpr(e, c));
      const op = name === 'min' ? I.min : I.max;
      return (x, y) => fs.slice(1).reduce((acc, f) => op(acc, f(x, y)), fs[0](x, y));
    }
    default: {
      const f = INTERVAL1[name];
      return (x, y) => f(a(x, y));
    }
  }
}

// ---- relations and connectives ----------------------------------------------------------------

type Formula =
  | { readonly kind: 'atom'; readonly atom: RelationAtom }
  | { readonly kind: 'and' | 'or' | 'xor'; readonly args: readonly Formula[] }
  | { readonly kind: 'not'; readonly arg: Formula };

function compileFormula(e: Expr, c: Ctx, atoms: RelationAtom[]): Formula {
  if (e.type === 'rel') {
    if (e.left.type === 'rel') {
      // chained comparison a < b < c → and(a < b, b < c)
      const first = compileFormula(e.left, c, atoms);
      const second = compileFormula({ ...e, left: e.left.right }, c, atoms);
      return { kind: 'and', args: [first, second] };
    }
    const left = compileIntervalExpr(e.left, c);
    const right = compileIntervalExpr(e.right, c);
    const leftPoint = compilePointExpr(e.left, c);
    const rightPoint = compilePointExpr(e.right, c);
    const atom: RelationAtom = {
      index: atoms.length,
      op: e.op,
      left,
      right,
      leftPoint,
      rightPoint,
      diffInterval: (x, y) => I.sub(left(x, y), right(x, y)),
      diff: (x, y) => leftPoint(x, y) - rightPoint(x, y),
    };
    atoms.push(atom);
    return { kind: 'atom', atom };
  }
  if (e.type === 'call' && LOGIC_FUNCTIONS.has(e.name)) {
    if (e.name === 'not') {
      if (e.args.length !== 1) bad('syntax', 'not takes one argument');
      return { kind: 'not', arg: compileFormula(e.args[0], c, atoms) };
    }
    if (e.args.length < 2) bad('syntax', `${e.name} takes two or more arguments`);
    const kind = e.name as 'and' | 'or' | 'xor';
    return { kind, args: e.args.map((a) => compileFormula(a, c, atoms)) };
  }
  return bad('unsupported', 'expected a relation (=, <, >, ≤, ≥, ≠) or and/or/not/xor');
}

function truthOf(f: Formula, x: Interval, y: Interval): Truth {
  switch (f.kind) {
    case 'atom':
      return compareIntervals(f.atom.left(x, y), f.atom.right(x, y), f.atom.op);
    case 'not':
      return kleeneNot(truthOf(f.arg, x, y));
    case 'and': {
      let all = true;
      for (const a of f.args) {
        const t = truthOf(a, x, y);
        if (t === 'false') return 'false';
        if (t !== 'true') all = false;
      }
      return all ? 'true' : 'unknown';
    }
    case 'or': {
      let none = true;
      for (const a of f.args) {
        const t = truthOf(a, x, y);
        if (t === 'true') return 'true';
        if (t !== 'false') none = false;
      }
      return none ? 'false' : 'unknown';
    }
    case 'xor':
      return kleeneXor(f.args.map((a) => truthOf(a, x, y)));
  }
}

function pointTruthOf(
  f: Formula,
  x: number,
  y: number,
  forced?: ReadonlyMap<number, boolean>,
): boolean {
  switch (f.kind) {
    case 'atom': {
      const v = forced?.get(f.atom.index);
      if (v !== undefined) return v;
      return comparePoints(f.atom.leftPoint(x, y), f.atom.rightPoint(x, y), f.atom.op);
    }
    case 'not':
      return !pointTruthOf(f.arg, x, y, forced);
    case 'and':
      return f.args.every((a) => pointTruthOf(a, x, y, forced));
    case 'or':
      return f.args.some((a) => pointTruthOf(a, x, y, forced));
    case 'xor':
      return f.args.filter((a) => pointTruthOf(a, x, y, forced)).length % 2 === 1;
  }
}

function guard<T>(f: () => T): MathResult<T> {
  try {
    return ok(f());
  } catch (e) {
    if (e instanceof CompileError) return fail(e.code, e.message);
    return fail('not-evaluable', e instanceof Error ? e.message : String(e));
  }
}

// ---------------------------------------------------------------------------------------------
// public API

/** Compiles an expression in X and Y to an interval function (enclosure over a box). */
export function compileInterval(e: Expr, o: RelationEvalOptions = {}): MathResult<IntervalFn> {
  return guard(() => compileIntervalExpr(e, context(o)));
}

/** Compiles an expression in X and Y to a point function (NaN where undefined). */
export function compilePoint(e: Expr, o: RelationEvalOptions = {}): MathResult<PointFn> {
  return guard(() => compilePointExpr(e, context(o)));
}

/** Encloses the values of an expression over the box X × Y. */
export function evaluateInterval(
  e: Expr,
  x: Interval,
  y: Interval,
  o: RelationEvalOptions = {},
): MathResult<Interval> {
  const f = compileInterval(e, o);
  return f.ok ? guard(() => f.value(x, y)) : f;
}

/** Compiles a relation or a connective of relations for repeated box and point decisions. */
export function compileRelation(
  e: Expr,
  o: RelationEvalOptions = {},
): MathResult<CompiledRelation> {
  return guard(() => {
    const atoms: RelationAtom[] = [];
    const formula = compileFormula(e, context(o), atoms);
    return {
      atoms,
      truth: (x, y) => truthOf(formula, x, y),
      atomTruth: (k, x, y) =>
        compareIntervals(atoms[k].left(x, y), atoms[k].right(x, y), atoms[k].op),
      pointTruth: (x, y) => pointTruthOf(formula, x, y),
      pointTruthWith: (x, y, forced) => pointTruthOf(formula, x, y, forced),
    };
  });
}

/** Truth of a relation (or connective) on the box X × Y. */
export function evaluateRelation(
  e: Expr,
  x: Interval,
  y: Interval,
  o: RelationEvalOptions = {},
): MathResult<Truth> {
  const r = compileRelation(e, o);
  return r.ok ? guard(() => r.value.truth(x, y)) : r;
}

export { kleeneAnd, kleeneNot, kleeneOr, kleeneXor };
