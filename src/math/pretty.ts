/**
 * Textbook form of CAS output (prompt 005/006): x^(1/2) → √x, x^(−n) → 1/xⁿ, (1/2)·x → x/2,
 * −1 + x → x − 1, (−1)·x → −x. Only rewrites into equal expressions.
 */
import type { Expr } from './ast/nodes';

const isNum = (e: Expr, v?: string): e is { type: 'num'; value: string } =>
  e.type === 'num' && (v === undefined || e.value === v);
const isNegNum = (e: Expr): boolean => e.type === 'neg' && e.arg.type === 'num';
const isOneOver = (e: Expr): e is { type: 'bin'; op: '/'; left: Expr; right: Expr } =>
  e.type === 'bin' && e.op === '/' && isNum(e.left, '1');

/** A negative term: −a, −2·x, (−1/2)·x … → its positive part, else null. */
function negativePart(e: Expr): Expr | null {
  if (e.type === 'neg') return e.arg;
  if (e.type === 'bin' && (e.op === '*' || e.op === '/')) {
    const l = negativePart(e.left);
    if (l) return isNum(l, '1') && e.op === '*' ? e.right : { ...e, left: l };
  }
  return null;
}

export function prettify(e: Expr): Expr {
  switch (e.type) {
    case 'neg': {
      const a = prettify(e.arg);
      return a.type === 'neg' ? a.arg : { type: 'neg', arg: a };
    }
    case 'post':
      return { ...e, arg: prettify(e.arg) };
    case 'call':
      return { ...e, args: e.args.map(prettify) };
    case 'rel':
      return { ...e, left: prettify(e.left), right: prettify(e.right) };
    case 'list':
      return { ...e, items: e.items.map(prettify) };
    case 'matrix':
      return { ...e, rows: e.rows.map((r) => r.map(prettify)) };
    case 'bin':
      return binary(e.op, prettify(e.left), prettify(e.right));
    default:
      return e;
  }
}

function binary(op: '+' | '-' | '*' | '/' | '^', l: Expr, r: Expr): Expr {
  switch (op) {
    case '^': {
      // x^(1/2) → √x, x^(1/n) → ⁿ√x
      if (isOneOver(r)) {
        if (isNum(r.right, '2')) return { type: 'call', name: 'sqrt', args: [l] };
        if (r.right.type === 'num') return { type: 'call', name: 'root', args: [l, r.right] };
      }
      // x^(−n) → 1/xⁿ
      if (isNegNum(r)) {
        const n = (r as { arg: Expr }).arg;
        const den = isNum(n, '1') ? l : ({ type: 'bin', op: '^', left: l, right: n } as Expr);
        return { type: 'bin', op: '/', left: { type: 'num', value: '1' }, right: den };
      }
      return { type: 'bin', op, left: l, right: r };
    }
    case '*': {
      if (isNum(l, '1')) return r;
      // (−1)·x → −x
      if (isNegNum(l) && isNum((l as { arg: Expr }).arg, '1')) return { type: 'neg', arg: r };
      // (a/n)·x → a·x/n ; (1/n)·x → x/n
      if (l.type === 'bin' && l.op === '/' && l.right.type === 'num') {
        const top = isNum(l.left, '1') ? r : binary('*', l.left, r);
        return binary('/', top, l.right);
      }
      if (isNegNum(l) === false && l.type === 'neg' && l.arg.type === 'bin' && l.arg.op === '/') {
        return { type: 'neg', arg: binary('*', l.arg, r) };
      }
      // x·(1/y) → x/y, (1/y)·x → x/y
      if (isOneOver(r)) return { type: 'bin', op: '/', left: l, right: r.right };
      if (isOneOver(l)) return { type: 'bin', op: '/', left: r, right: l.right };
      return { type: 'bin', op, left: l, right: r };
    }
    case '/': {
      // (−a)/b → −(a/b)
      if (l.type === 'neg') return { type: 'neg', arg: binary('/', l.arg, r) };
      return { type: 'bin', op, left: l, right: r };
    }
    case '+': {
      // a + (−b) → a − b ; (−a) + b → b − a
      const rn = negativePart(r);
      if (rn) return { type: 'bin', op: '-', left: l, right: rn };
      const ln = negativePart(l);
      if (ln && !negativePart(r)) return { type: 'bin', op: '-', left: r, right: ln };
      return { type: 'bin', op, left: l, right: r };
    }
    default: {
      const rn = negativePart(r);
      if (rn) return { type: 'bin', op: '+', left: l, right: rn };
      return { type: 'bin', op, left: l, right: r };
    }
  }
}
