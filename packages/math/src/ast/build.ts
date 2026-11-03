import type { BinaryOp, CallNode, Expr, NumberNode, RelationOp, SymbolNode } from './nodes';

/** Short builders – used by parsers, the CAS adapter and tests. */
export const num = (value: string | number | bigint): NumberNode => ({
  type: 'num',
  value: String(value),
});
export const sym = (name: string): SymbolNode => ({ type: 'sym', name });
export const neg = (arg: Expr): Expr => ({ type: 'neg', arg });
export const bin = (op: BinaryOp, left: Expr, right: Expr): Expr => ({
  type: 'bin',
  op,
  left,
  right,
});
export const add = (l: Expr, r: Expr) => bin('+', l, r);
export const sub = (l: Expr, r: Expr) => bin('-', l, r);
export const mul = (l: Expr, r: Expr) => bin('*', l, r);
export const div = (l: Expr, r: Expr) => bin('/', l, r);
export const pow = (l: Expr, r: Expr) => bin('^', l, r);
export const call = (name: string, ...args: Expr[]): CallNode => ({ type: 'call', name, args });
export const rel = (op: RelationOp, left: Expr, right: Expr): Expr => ({
  type: 'rel',
  op,
  left,
  right,
});

/** Structural equality (numbers compared as written). */
export function exprEquals(a: Expr, b: Expr): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** All free symbol names (bound variables of ∫, Σ, lim, d/dx are excluded inside their body). */
export function freeSymbols(e: Expr, bound: ReadonlySet<string> = new Set()): Set<string> {
  const out = new Set<string>();
  const visit = (x: Expr, b: ReadonlySet<string>): void => {
    switch (x.type) {
      case 'num':
        return;
      case 'sym':
        if (!b.has(x.name)) out.add(x.name);
        return;
      case 'neg':
      case 'post':
        return visit(x.arg, b);
      case 'bin':
      case 'rel':
        visit(x.left, b);
        return visit(x.right, b);
      case 'call':
        return x.args.forEach((a) => visit(a, b));
      case 'deriv':
        return visit(x.expr, b);
      case 'int': {
        if (x.lower) visit(x.lower, b);
        if (x.upper) visit(x.upper, b);
        const inner = x.lower ? new Set([...b, x.variable]) : b;
        return visit(x.expr, inner);
      }
      case 'series': {
        visit(x.lower, b);
        visit(x.upper, b);
        return visit(x.expr, new Set([...b, x.variable]));
      }
      case 'limit':
        visit(x.to, b);
        return visit(x.expr, new Set([...b, x.variable]));
      case 'matrix':
        return x.rows.forEach((r) => r.forEach((c) => visit(c, b)));
      case 'list':
        return x.items.forEach((i) => visit(i, b));
    }
  };
  visit(e, bound);
  return out;
}

/** Replaces free occurrences of symbols (no capture handling needed: bound names are skipped). */
export function substitute(e: Expr, values: ReadonlyMap<string, Expr>): Expr {
  const go = (x: Expr, shadow: ReadonlySet<string>): Expr => {
    switch (x.type) {
      case 'num':
        return x;
      case 'sym':
        return !shadow.has(x.name) && values.has(x.name) ? values.get(x.name)! : x;
      case 'neg':
        return { ...x, arg: go(x.arg, shadow) };
      case 'post':
        return { ...x, arg: go(x.arg, shadow) };
      case 'bin':
        return { ...x, left: go(x.left, shadow), right: go(x.right, shadow) };
      case 'rel':
        return { ...x, left: go(x.left, shadow), right: go(x.right, shadow) };
      case 'call':
        return { ...x, args: x.args.map((a) => go(a, shadow)) };
      case 'deriv':
        return { ...x, expr: go(x.expr, shadow) };
      case 'int': {
        const inner = x.lower ? new Set([...shadow, x.variable]) : shadow;
        return {
          ...x,
          expr: go(x.expr, inner),
          ...(x.lower ? { lower: go(x.lower, shadow) } : {}),
          ...(x.upper ? { upper: go(x.upper, shadow) } : {}),
        };
      }
      case 'series': {
        const inner = new Set([...shadow, x.variable]);
        return {
          ...x,
          expr: go(x.expr, inner),
          lower: go(x.lower, shadow),
          upper: go(x.upper, shadow),
        };
      }
      case 'limit':
        return { ...x, expr: go(x.expr, new Set([...shadow, x.variable])), to: go(x.to, shadow) };
      case 'matrix':
        return { ...x, rows: x.rows.map((r) => r.map((c) => go(c, shadow))) };
      case 'list':
        return { ...x, items: x.items.map((i) => go(i, shadow)) };
    }
  };
  return go(e, new Set());
}
