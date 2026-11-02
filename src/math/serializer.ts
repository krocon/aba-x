/**
 * AST → text and AST → LaTeX (design 003 E5). Parentheses only where the parsers need them, so
 * `parseText(toText(e))` and `parseLatex(toLatex(e))` give `e` back (round-trip specs).
 */
import type { Expr } from './ast/nodes';

/** Binding strength of a node as an operand (higher = binds tighter). */
function prec(e: Expr): number {
  switch (e.type) {
    case 'rel':
      return 5;
    case 'bin':
      return e.op === '+' || e.op === '-' ? 10 : e.op === '^' ? 30 : 20;
    case 'neg':
      return 25;
    case 'post':
      return 40;
    case 'series':
    case 'limit':
    case 'deriv':
      // they take everything up to the next + or − (in LaTeX), so they bind like a sum
      return 10;
    default:
      return 50;
  }
}

// ---------------------------------------------------------------- text

export function toText(e: Expr): string {
  const wrap = (x: Expr, need: boolean) => (need ? `(${toText(x)})` : toText(x));
  switch (e.type) {
    case 'num':
      return e.value;
    case 'sym':
      return e.name;
    case 'neg':
      return `-${wrap(e.arg, prec(e.arg) < 30)}`;
    case 'post':
      return `${wrap(e.arg, prec(e.arg) < 40)}${e.op}`;
    case 'bin': {
      const p = prec(e);
      if (e.op === '^') {
        return `${wrap(e.left, prec(e.left) <= 30)}^${wrap(e.right, prec(e.right) < 30 && e.right.type !== 'neg')}`;
      }
      const right = wrap(e.right, prec(e.right) <= p || e.right.type === 'neg');
      const op = e.op === '+' || e.op === '-' ? ` ${e.op} ` : e.op;
      return `${wrap(e.left, prec(e.left) < p)}${op}${right}`;
    }
    case 'rel':
      return `${toText(e.left)} ${e.op} ${toText(e.right)}`;
    case 'call':
      return `${e.name}(${e.args.map(toText).join(', ')})`;
    case 'deriv':
      return `diff(${toText(e.expr)}, ${e.variable}${e.order > 1 ? `, ${e.order}` : ''})`;
    case 'int':
      return e.lower && e.upper
        ? `integrate(${toText(e.expr)}, ${e.variable}, ${toText(e.lower)}, ${toText(e.upper)})`
        : `integrate(${toText(e.expr)}, ${e.variable})`;
    case 'series':
      return `${e.kind === 'sum' ? 'sum' : 'product'}(${toText(e.expr)}, ${e.variable}, ${toText(e.lower)}, ${toText(e.upper)})`;
    case 'limit':
      return `limit(${toText(e.expr)}, ${e.variable}, ${toText(e.to)})`;
    case 'matrix':
      return `[${e.rows.map((r) => `[${r.map(toText).join(', ')}]`).join(', ')}]`;
    case 'list':
      return `[${e.items.map(toText).join(', ')}]`;
  }
}

// ---------------------------------------------------------------- LaTeX

const GREEK = new Set(
  'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi rho sigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Sigma Phi Psi Omega'.split(
    ' ',
  ),
);
const LATEX_FN = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'exp',
  'ln',
  'log',
]);
const REL: Record<string, string> = {
  '=': '=',
  '<': '<',
  '>': '>',
  '<=': '\\le ',
  '>=': '\\ge ',
  '!=': '\\ne ',
};

function latexSymbol(name: string): string {
  if (name === 'pi') return '\\pi ';
  if (name === 'inf') return '\\infty ';
  if (GREEK.has(name)) return `\\${name} `;
  const idx = /^(\p{L})_(\w+)$/u.exec(name);
  if (idx) return `${idx[1]}_{${idx[2]}}`;
  return name.length === 1 ? name : `\\mathrm{${name}}`;
}

function latexNumber(v: string): string {
  const m = /^(.*)[eE]([+-]?\d+)$/.exec(v);
  return m ? `${m[1]}\\cdot10^{${Number(m[2])}}` : v;
}

const paren = (s: string) => `\\left(${s}\\right)`;

/** Operand of Σ, lim, d/dx: they take one term (up to + or −), so sums need parentheses. */
function latexTerm(e: Expr): string {
  return prec(e) > 10 && e.type !== 'neg' ? toLatex(e) : paren(toLatex(e));
}

export function toLatex(e: Expr): string {
  const wrap = (x: Expr, need: boolean) => (need ? paren(toLatex(x)) : toLatex(x));
  switch (e.type) {
    case 'num':
      return latexNumber(e.value);
    case 'sym':
      return latexSymbol(e.name);
    case 'neg':
      // a fraction is a block of its own: −\frac{a}{b} needs no parentheses
      return `-${wrap(e.arg, prec(e.arg) < 30 && !(e.arg.type === 'bin' && e.arg.op === '/'))}`;
    case 'post':
      return `${wrap(e.arg, prec(e.arg) < 40)}${e.op === '%' ? '\\%' : '!'}`;
    case 'bin': {
      if (e.op === '/') return `\\frac{${toLatex(e.left)}}{${toLatex(e.right)}}`;
      if (e.op === '^') {
        const base = wrap(e.left, prec(e.left) <= 30 || e.left.type === 'call');
        return `${base}^{${toLatex(e.right)}}`;
      }
      const p = prec(e);
      const left = wrap(e.left, prec(e.left) < p);
      const right = wrap(e.right, prec(e.right) <= p || e.right.type === 'neg');
      if (e.op === '*') {
        const juxtapose =
          e.left.type === 'num' &&
          (e.right.type === 'sym' ||
            e.right.type === 'call' ||
            (e.right.type === 'bin' &&
              e.right.op === '^' &&
              (e.right.left.type === 'sym' || e.right.left.type === 'call')));
        return juxtapose ? `${left}${right}` : `${left}\\cdot ${right}`;
      }
      return `${left}${e.op}${right}`;
    }
    case 'rel':
      return `${toLatex(e.left)}${REL[e.op]}${toLatex(e.right)}`;
    case 'call':
      return latexCall(e.name, e.args);
    case 'deriv': {
      const n = e.order > 1 ? `^{${e.order}}` : '';
      return `\\frac{d${n}}{d${e.variable}${n}}${latexTerm(e.expr)}`;
    }
    case 'int':
      return `\\int${e.lower && e.upper ? `_{${toLatex(e.lower)}}^{${toLatex(e.upper)}}` : ' '}${toLatex(e.expr)}\\,d${e.variable}`;
    case 'series':
      return `\\${e.kind}_{${e.variable}=${toLatex(e.lower)}}^{${toLatex(e.upper)}}${latexTerm(e.expr)}`;
    case 'limit':
      return `\\lim_{${e.variable}\\to ${toLatex(e.to)}${e.direction ? `^${e.direction}` : ''}}${latexTerm(e.expr)}`;
    case 'matrix':
      return `\\begin{pmatrix}${e.rows.map((r) => r.map(toLatex).join('&')).join('\\\\')}\\end{pmatrix}`;
    case 'list':
      return `\\left[${e.items.map(toLatex).join(',')}\\right]`;
  }
}

function latexCall(name: string, args: readonly Expr[]): string {
  const list = paren(args.map(toLatex).join(','));
  switch (name) {
    case 'sqrt':
      return `\\sqrt{${toLatex(args[0])}}`;
    case 'root':
      return `\\sqrt[${toLatex(args[1])}]{${toLatex(args[0])}}`;
    case 'abs':
      return `\\left|${toLatex(args[0])}\\right|`;
    case 'log':
      return args.length === 2
        ? `\\log_{${toLatex(args[1])}}${paren(toLatex(args[0]))}`
        : `\\log${paren(toLatex(args[0]))}`;
    default:
      if (LATEX_FN.has(name)) return `\\${name}${list}`;
      return `\\operatorname{${name}}${list}`;
  }
}
