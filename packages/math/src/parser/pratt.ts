/**
 * Pratt parser shared by the text and the LaTeX front end (design 003 E2). Both lexers produce the
 * same token stream; LaTeX structures (\frac, \int … dx, \sqrt …) arrive already parsed as `expr`
 * tokens, operators that take the following term (Σ, lim, d/dx) as `prefix` tokens.
 *
 * Binding powers: relation 5 < + − 10 < × ÷ and implicit product 20 < unary − 25 < ^ 30 < ! % 40.
 * So −x² = −(x²), 2^−3 works, 2x² = 2·(x²), 1/2x = (1/2)·x (documented in docs/mathematics/syntax.md).
 */
import { call, div, mul, neg } from '../ast/build';
import type { BinaryOp, Expr, RelationOp } from '../ast/nodes';
import { OPERATOR_FUNCTIONS, lookupFunction } from '../functions';
import type { MathErrorCode } from '../result';

export type Tok =
  | { k: 'num'; v: string; s: number; e: number }
  /** Name: variable/constant, or a function when followed by `(`. */
  | { k: 'id'; v: string; s: number; e: number }
  /** Explicit function (LaTeX `\sin`, `\log_b`): `pow` = `\sin^2`, `extra` = log base. */
  | { k: 'fn'; v: string; pow?: Expr; extra?: Expr; s: number; e: number }
  | { k: 'op'; v: string; s: number; e: number }
  | { k: 'expr'; x: Expr; s: number; e: number }
  | { k: 'prefix'; make: (arg: Expr) => Expr; s: number; e: number }
  | { k: 'eof'; s: number; e: number };

export class ParseError extends Error {
  constructor(
    readonly code: MathErrorCode,
    message: string,
    readonly start: number,
    readonly end: number,
  ) {
    super(message);
  }
}

export interface ParseOptions {
  /** User-defined function names (prompt 008): `f(2)` is a call, otherwise `f·(2)`. */
  readonly functions?: ReadonlySet<string>;
}

const RELATIONS: Record<string, RelationOp> = {
  '=': '=',
  '<': '<',
  '>': '>',
  '<=': '<=',
  '>=': '>=',
  '!=': '!=',
};

export class Pratt {
  private i = 0;
  private absDepth = 0;
  private stopAtFn = 0;

  constructor(
    private readonly toks: readonly Tok[],
    private readonly opts: ParseOptions = {},
  ) {}

  parseAll(): Expr {
    if (this.peek().k === 'eof') throw this.err('syntax', 'empty input', this.peek());
    const e = this.expr(0);
    const t = this.peek();
    if (t.k !== 'eof') throw this.err('syntax', `unexpected ${describe(t)}`, t);
    return e;
  }

  private peek(): Tok {
    return this.toks[this.i];
  }

  private next(): Tok {
    return this.toks[this.i++];
  }

  private isOp(t: Tok, v: string): boolean {
    return t.k === 'op' && t.v === v;
  }

  private expect(v: string): Tok {
    const t = this.next();
    if (!this.isOp(t, v)) throw this.err('syntax', `expected "${v}" but found ${describe(t)}`, t);
    return t;
  }

  err(code: MathErrorCode, message: string, t: Tok): ParseError {
    return new ParseError(code, message, t.s, t.e);
  }

  /** Can this token start an operand (→ implicit multiplication)? */
  private startsOperand(t: Tok): boolean {
    switch (t.k) {
      case 'num':
      case 'id':
      case 'expr':
      case 'prefix':
        return true;
      case 'fn':
        return this.stopAtFn === 0;
      case 'op':
        return t.v === '(' || t.v === '[' || t.v === '√' || (t.v === '|' && this.absDepth === 0);
      default:
        return false;
    }
  }

  private lbp(t: Tok): number {
    if (t.k === 'op') {
      if (t.v in RELATIONS) return 5;
      if (t.v === '+' || t.v === '-') return 10;
      if (t.v === '*' || t.v === '/') return 20;
      if (t.v === '^') return 30;
      if (t.v === '!' || t.v === '%') return 40;
    }
    return this.startsOperand(t) ? 20 : 0;
  }

  expr(rbp: number): Expr {
    let left = this.nud(this.next());
    for (;;) {
      const t = this.peek();
      const bp = this.lbp(t);
      if (bp <= rbp) return left;
      left = this.led(left, t);
    }
  }

  private led(left: Expr, t: Tok): Expr {
    if (t.k === 'op') {
      if (t.v in RELATIONS) {
        this.next();
        return { type: 'rel', op: RELATIONS[t.v], left, right: this.expr(5) };
      }
      if (t.v === '+' || t.v === '-' || t.v === '*' || t.v === '/') {
        this.next();
        const bp = t.v === '+' || t.v === '-' ? 10 : 20;
        return { type: 'bin', op: t.v as BinaryOp, left, right: this.expr(bp) };
      }
      if (t.v === '^') {
        this.next();
        return { type: 'bin', op: '^', left, right: this.expr(29) };
      }
      if (t.v === '!' || t.v === '%') {
        this.next();
        return { type: 'post', op: t.v, arg: left };
      }
    }
    // implicit multiplication
    return mul(left, this.expr(20));
  }

  private nud(t: Tok): Expr {
    switch (t.k) {
      case 'num':
        return { type: 'num', value: t.v };
      case 'expr':
        return t.x;
      case 'prefix':
        // Σ, lim, d/dx take one term: products and quotients, up to the next + or −
        return t.make(this.expr(10));
      case 'id':
        return this.identifier(t);
      case 'fn':
        return this.explicitFunction(t);
      case 'eof':
        throw this.err('syntax', 'unexpected end of input', t);
      case 'op':
        return this.prefixOperator(t);
    }
  }

  private prefixOperator(t: Extract<Tok, { k: 'op' }>): Expr {
    switch (t.v) {
      case '-':
        return neg(this.expr(25));
      case '+':
        return this.expr(25);
      case '(': {
        const e = this.expr(0);
        this.expect(')');
        return e;
      }
      case '[':
        return this.bracketList();
      case '|': {
        this.absDepth++;
        const e = this.expr(0);
        this.absDepth--;
        this.expect('|');
        return call('abs', e);
      }
      case '√':
        return call('sqrt', this.expr(30));
      default:
        throw this.err('syntax', `unexpected ${describe(t)}`, t);
    }
  }

  /** `[1, 2]` → list, `[[1, 2], [3, 4]]` → matrix. */
  private bracketList(): Expr {
    const items: Expr[] = [];
    if (!this.isOp(this.peek(), ']')) {
      do items.push(this.expr(0));
      while (this.isOp(this.peek(), ',') && this.next());
    }
    this.expect(']');
    if (items.length > 0 && items.every((x) => x.type === 'list')) {
      const rows = items.map((x) => (x as { items: readonly Expr[] }).items);
      if (rows.every((r) => r.length === rows[0].length)) return { type: 'matrix', rows };
    }
    return { type: 'list', items };
  }

  private args(): Expr[] {
    this.expect('(');
    const args: Expr[] = [];
    if (!this.isOp(this.peek(), ')')) {
      do args.push(this.expr(0));
      while (this.isOp(this.peek(), ',') && this.next());
    }
    this.expect(')');
    return args;
  }

  private identifier(t: Extract<Tok, { k: 'id' }>): Expr {
    const name = t.v;
    const builtin = lookupFunction(name);
    const operatorFn = (OPERATOR_FUNCTIONS as readonly string[]).includes(name);
    const userFn = this.opts.functions?.has(name) ?? false;
    if (this.isOp(this.peek(), '(') && (builtin || operatorFn || userFn)) {
      const args = this.args();
      if (operatorFn) return this.operatorCall(name, args, t);
      if (builtin) return this.checkedCall(builtin.name, builtin.minArgs, builtin.maxArgs, args, t);
      return call(name, ...args);
    }
    if (builtin && this.startsOperand(this.peek())) {
      // `sin x`, `ln 2`: the argument is one power-level operand
      return this.checkedCall(builtin.name, builtin.minArgs, builtin.maxArgs, [this.expr(29)], t);
    }
    if (builtin || operatorFn) throw this.err('syntax', `${name} needs an argument`, t);
    return { type: 'sym', name };
  }

  private explicitFunction(t: Extract<Tok, { k: 'fn' }>): Expr {
    const def = lookupFunction(t.v);
    let args: Expr[];
    if (this.isOp(this.peek(), '(')) {
      args = this.args();
    } else {
      if (!this.startsOperand(this.peek())) throw this.err('syntax', `${t.v} needs an argument`, t);
      // `\sin 2x` = sin(2x): the argument is an implicit product, it ends at an explicit
      // operator or at the next function (`\sin x\cos x` = sin(x)·cos(x))
      this.stopAtFn++;
      try {
        let arg = this.expr(20);
        while (this.startsOperand(this.peek())) arg = mul(arg, this.expr(20));
        args = [arg];
      } finally {
        this.stopAtFn--;
      }
    }
    if (t.extra) args = [...args, t.extra];
    const name = def?.name ?? t.v;
    const result = def
      ? this.checkedCall(name, def.minArgs, def.maxArgs, args, t)
      : call(name, ...args);
    return t.pow ? { type: 'bin', op: '^', left: result, right: t.pow } : result;
  }

  private checkedCall(name: string, min: number, max: number, args: Expr[], t: Tok): Expr {
    if (args.length < min || args.length > max) {
      const want = min === max ? `${min}` : `${min}–${max}`;
      throw this.err('syntax', `${name} takes ${want} argument(s), got ${args.length}`, t);
    }
    return call(name, ...args);
  }

  /** diff(f, x[, n]), integrate(f, x[, a, b]), sum/product(f, k, a, b), limit(f, x, a). */
  private operatorCall(name: string, args: Expr[], t: Tok): Expr {
    const variable = (e: Expr | undefined): string => {
      if (e?.type !== 'sym') throw this.err('syntax', `${name}: the variable must be a name`, t);
      return e.name;
    };
    const count = (ok: boolean, usage: string) => {
      if (!ok) throw this.err('syntax', `usage: ${usage}`, t);
    };
    switch (name) {
      case 'diff': {
        count(args.length === 2 || args.length === 3, 'diff(f, x) or diff(f, x, n)');
        const order = args[2] ? Number(args[2].type === 'num' ? args[2].value : NaN) : 1;
        if (!Number.isInteger(order) || order < 1) {
          throw this.err('syntax', 'diff: the order must be a positive integer', t);
        }
        return { type: 'deriv', expr: args[0], variable: variable(args[1]), order };
      }
      case 'integrate':
        count(args.length === 2 || args.length === 4, 'integrate(f, x) or integrate(f, x, a, b)');
        return args.length === 4
          ? {
              type: 'int',
              expr: args[0],
              variable: variable(args[1]),
              lower: args[2],
              upper: args[3],
            }
          : { type: 'int', expr: args[0], variable: variable(args[1]) };
      case 'sum':
      case 'product':
        count(args.length === 4, `${name}(f, k, a, b)`);
        return {
          type: 'series',
          kind: name === 'sum' ? 'sum' : 'prod',
          expr: args[0],
          variable: variable(args[1]),
          lower: args[2],
          upper: args[3],
        };
      default:
        count(args.length === 3, 'limit(f, x, a)');
        return { type: 'limit', expr: args[0], variable: variable(args[1]), to: args[2] };
    }
  }
}

export function describe(t: Tok): string {
  switch (t.k) {
    case 'eof':
      return 'end of input';
    case 'op':
    case 'num':
    case 'id':
    case 'fn':
      return `"${t.v}"`;
    default:
      return 'expression';
  }
}

/** a / b as built by \frac – kept as a separate helper for the LaTeX lexer. */
export const fraction = (a: Expr, b: Expr): Expr => div(a, b);
