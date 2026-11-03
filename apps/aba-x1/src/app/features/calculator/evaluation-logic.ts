/**
 * Pure helpers of the evaluation (prompt 005): degree handling, function inlining, number
 * formatting and the decision what the display shows.
 */
import { freeSymbols, substitute } from '@aba/math/ast/build';
import type { Expr } from '@aba/math/ast/nodes';
import type { UserFunction } from '@aba/math/numeric/evaluate';

const TRIG = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc']);
const INVERSE_TRIG = new Set(['arcsin', 'arccos', 'arctan']);
const DEG: Expr = {
  type: 'bin',
  op: '/',
  left: { type: 'sym', name: 'pi' },
  right: { type: 'num', value: '180' },
};
const RAD_TO_DEG: Expr = {
  type: 'bin',
  op: '/',
  left: { type: 'num', value: '180' },
  right: { type: 'sym', name: 'pi' },
};

/** Rewrites an expression for degree mode: sin(x) → sin(x·π/180), arcsin(x) → arcsin(x)·180/π. */
export function toRadians(e: Expr): Expr {
  const go = (x: Expr): Expr => {
    switch (x.type) {
      case 'call': {
        const args = x.args.map(go);
        if (TRIG.has(x.name)) {
          return {
            type: 'call',
            name: x.name,
            args: [{ type: 'bin', op: '*', left: args[0], right: DEG }],
          };
        }
        if (INVERSE_TRIG.has(x.name)) {
          return { type: 'bin', op: '*', left: { ...x, args }, right: RAD_TO_DEG };
        }
        return { ...x, args };
      }
      case 'neg':
      case 'post':
        return { ...x, arg: go(x.arg) };
      case 'bin':
      case 'rel':
        return { ...x, left: go(x.left), right: go(x.right) };
      case 'deriv':
        return { ...x, expr: go(x.expr) };
      case 'int':
        return {
          ...x,
          expr: go(x.expr),
          ...(x.lower ? { lower: go(x.lower) } : {}),
          ...(x.upper ? { upper: go(x.upper) } : {}),
        };
      case 'series':
        return { ...x, expr: go(x.expr), lower: go(x.lower), upper: go(x.upper) };
      case 'limit':
        return { ...x, expr: go(x.expr), to: go(x.to) };
      case 'matrix':
        return { ...x, rows: x.rows.map((r) => r.map(go)) };
      case 'list':
        return { ...x, items: x.items.map(go) };
      default:
        return x;
    }
  };
  return go(e);
}

/** Replaces calls of user functions by their bodies (the CAS knows nothing about them). */
export function inlineFunctions(e: Expr, fns: ReadonlyMap<string, UserFunction>, depth = 0): Expr {
  if (fns.size === 0) return e;
  if (depth > 32) throw new Error('function definitions are nested too deeply (recursion?)');
  const go = (x: Expr): Expr => {
    switch (x.type) {
      case 'call': {
        const args = x.args.map(go);
        const f = fns.get(x.name);
        if (!f) return { ...x, args };
        if (f.params.length !== args.length) {
          throw new Error(`${x.name} takes ${f.params.length} argument(s)`);
        }
        const body = substitute(f.body, new Map(f.params.map((p, i) => [p, args[i]])));
        return inlineFunctions(body, fns, depth + 1);
      }
      case 'neg':
      case 'post':
        return { ...x, arg: go(x.arg) };
      case 'bin':
      case 'rel':
        return { ...x, left: go(x.left), right: go(x.right) };
      case 'deriv':
        return { ...x, expr: go(x.expr) };
      case 'int':
        return {
          ...x,
          expr: go(x.expr),
          ...(x.lower ? { lower: go(x.lower) } : {}),
          ...(x.upper ? { upper: go(x.upper) } : {}),
        };
      case 'series':
        return { ...x, expr: go(x.expr), lower: go(x.lower), upper: go(x.upper) };
      case 'limit':
        return { ...x, expr: go(x.expr), to: go(x.to) };
      default:
        return x;
    }
  };
  return go(e);
}

export interface FormattedNumber {
  text: string;
  latex: string;
}

/** 12 significant digits, no trailing zeros, scientific notation outside 1e−6 … 1e15. */
export function formatNumber(x: number, digits = 12): FormattedNumber {
  if (Object.is(x, -0)) x = 0;
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return { text: String(x), latex: String(x) };
  const abs = Math.abs(x);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-6)) {
    const [m, exp] = x.toExponential(digits - 1).split('e');
    const mant = m.replace(/\.?0+$/, '');
    const e = Number(exp);
    return { text: `${mant}e${e}`, latex: `${mant}\\cdot10^{${e}}` };
  }
  const t = Number(x.toPrecision(digits)).toString();
  return { text: t, latex: t };
}

/** Is the expression just a (possibly negative) decimal or integer – no need for "≈ …"? */
export function isPlainNumber(e: Expr): boolean {
  if (e.type === 'num') return true;
  return e.type === 'neg' && e.arg.type === 'num';
}

export function hasDecimals(latex: string): boolean {
  return /\d\.\d/.test(latex);
}

/** Uses the imaginary unit although the input did not – a complex result. */
export function becameComplex(input: Expr, result: Expr): boolean {
  return freeSymbols(result).has('i') && !freeSymbols(input).has('i');
}
