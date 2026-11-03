/**
 * AST ⇄ Nerdamer syntax (prompt 009, technical evaluation §3). Only functions on the allow-list
 * are translated; anything else is refused *before* Nerdamer sees it – Nerdamer treats unknown
 * names as symbols and then answers wrongly (diff(ln(x)/x) = 0).
 */
import type { Expr } from '../ast/nodes';
import { parseText } from '../parser/text-parser';
import { prettify } from '../pretty';
import { type MathResult, fail, ok } from '../result';

/** Our name → Nerdamer name. Missing here = not available in the CAS. */
const TO_NERDAMER: Record<string, string> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  cot: 'cot',
  sec: 'sec',
  csc: 'csc',
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  sinh: 'sinh',
  cosh: 'cosh',
  tanh: 'tanh',
  arsinh: 'asinh',
  arcosh: 'acosh',
  artanh: 'atanh',
  exp: 'exp',
  ln: 'log',
  sqrt: 'sqrt',
  abs: 'abs',
  sign: 'sign',
  floor: 'floor',
  ceil: 'ceil',
  round: 'round',
  min: 'min',
  max: 'max',
  mod: 'mod',
  erf: 'erf',
};

/** Nerdamer name → our text syntax, for parsing results. */
const FROM_NERDAMER: Record<string, string> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  cot: 'cot',
  sec: 'sec',
  csc: 'csc',
  asin: 'arcsin',
  acos: 'arccos',
  atan: 'arctan',
  sinh: 'sinh',
  cosh: 'cosh',
  tanh: 'tanh',
  asinh: 'arsinh',
  acosh: 'arcosh',
  atanh: 'artanh',
  exp: 'exp',
  log: 'ln',
  log10: 'log',
  sqrt: 'sqrt',
  abs: 'abs',
  sign: 'sign',
  floor: 'floor',
  ceil: 'ceil',
  round: 'round',
  min: 'min',
  max: 'max',
  mod: 'mod',
  erf: 'erf',
  fact: 'factorial',
};

export class NotExpressible extends Error {}

const nested = (e: Expr): string => `(${toNerdamer(e)})`;

/** AST → Nerdamer input. Throws `NotExpressible` for anything off the allow-list. */
export function toNerdamer(e: Expr): string {
  switch (e.type) {
    case 'num':
      return e.value;
    case 'sym':
      if (e.name === 'inf') return 'Infinity';
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(e.name)) throw new NotExpressible(`name ${e.name}`);
      return e.name;
    case 'neg':
      return `-${nested(e.arg)}`;
    case 'post':
      return e.op === '!' ? `fact${nested(e.arg)}` : `${nested(e.arg)}/100`;
    case 'bin':
      return `${nested(e.left)}${e.op}${nested(e.right)}`;
    case 'call': {
      const args = e.args.map(toNerdamer);
      if (e.name === 'log') {
        return args.length === 2 ? `log(${args[0]})/log(${args[1]})` : `log10(${args[0]})`;
      }
      if (e.name === 'root') return `nthroot(${args[0]},${args[1]})`;
      if (e.name === 'nCr')
        return `(fact(${args[0]})/(fact(${args[1]})*fact((${args[0]})-(${args[1]}))))`;
      if (e.name === 'nPr') return `(fact(${args[0]})/fact((${args[0]})-(${args[1]})))`;
      const name = TO_NERDAMER[e.name];
      if (!name) throw new NotExpressible(`function ${e.name}`);
      return `${name}(${args.join(',')})`;
    }
    case 'deriv':
      return `diff(${toNerdamer(e.expr)},${e.variable},${e.order})`;
    case 'int':
      if (e.lower || e.upper) throw new NotExpressible('nested definite integral');
      return `integrate(${toNerdamer(e.expr)},${e.variable})`;
    case 'series':
      return `${e.kind === 'sum' ? 'sum' : 'product'}(${toNerdamer(e.expr)},${e.variable},${toNerdamer(e.lower)},${toNerdamer(e.upper)})`;
    case 'limit':
      return `limit(${toNerdamer(e.expr)},${e.variable},${toNerdamer(e.to)})`;
    case 'rel':
      if (e.op !== '=') throw new NotExpressible('inequalities');
      return `${toNerdamer(e.left)}=${toNerdamer(e.right)}`;
    case 'matrix':
    case 'list':
      throw new NotExpressible('matrices and lists');
  }
}

export interface Parsed {
  readonly expr: Expr;
  /** Contains decimal numbers → a numerical approximation, not an exact result. */
  readonly approximate: boolean;
}

const UNEVALUATED = /\b(integrate|defint|limit|diff|sum|product)\(/;

/**
 * Nerdamer output → AST. Unevaluated operators mean "could not do it" (`not-solvable`); unknown
 * functions in the output (Si, Ci, Li …) mean the result cannot be shown honestly (`unsupported`).
 */
export function fromNerdamer(text: string, integerParam = 'n'): MathResult<Parsed> {
  if (UNEVALUATED.test(text)) return fail('not-solvable', 'the CAS could not compute this');
  let unknown: string | null = null;
  let src = text
    .replace(/\bInf\b|\bInfinity\b/g, 'inf')
    .replace(/\b_n\b/g, integerParam)
    .replace(/\bcbrt\(/g, 'root3(')
    .replace(/\b([A-Za-z_][A-Za-z0-9_]*)\(/g, (m, name: string) => {
      if (name === 'root3') return m;
      const mapped = FROM_NERDAMER[name];
      if (!mapped) unknown ??= name;
      return `${mapped ?? name}(`;
    });
  if (unknown) return fail('unsupported', `the result uses ${unknown}(), which ABA-X1 cannot show`);
  // cbrt(x) → root(x, 3); fact(x) → (x)!
  src = rewriteCall(src, 'root3', (a) => `root(${a}, 3)`);
  src = rewriteCall(src, 'factorial', (a) => `(${a})!`);
  const r = parseText(src);
  if (!r.ok) return fail('unsupported', `cannot read the CAS result "${text}"`);
  return ok({ expr: prettify(r.value), approximate: /\d\.\d/.test(text) });
}

/** Replaces name(arg) with balanced parentheses. */
function rewriteCall(src: string, name: string, make: (arg: string) => string): string {
  let out = src;
  for (let i = out.indexOf(`${name}(`); i >= 0; i = out.indexOf(`${name}(`)) {
    let depth = 0;
    let j = i + name.length;
    for (; j < out.length; j++) {
      if (out[j] === '(') depth++;
      else if (out[j] === ')' && --depth === 0) break;
    }
    out = out.slice(0, i) + make(out.slice(i + name.length + 1, j)) + out.slice(j + 1);
  }
  return out;
}

/** Splits `{a, b}` / `[a, b]` at top-level commas. */
export function splitList(text: string): string[] {
  const inner = text.trim().replace(/^[{[]|[}\]]$/g, '');
  if (!inner.trim()) return [];
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(inner.slice(start).trim());
  return parts;
}
