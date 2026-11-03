/**
 * Text input: `f(x) = x^2 - 3*x + 2`, `2sin(pi/6)`, `diff(x^3, x)`. Identifiers are whole names
 * (`ab` is one variable – unlike LaTeX, where letters are single symbols).
 */
import type { Expr } from '../ast/nodes';
import { type MathResult, fail, ok } from '../result';
import { ParseError, type ParseOptions, Pratt, type Tok } from './pratt';

const SINGLE: Record<string, string> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '·': '*',
  '×': '*',
  '/': '/',
  '÷': '/',
  '^': '^',
  '(': '(',
  ')': ')',
  '[': '[',
  ']': ']',
  // lists {1, 2, 3} (prompt 032) read like [1, 2, 3]
  '{': '[',
  '}': ']',
  ',': ',',
  '=': '=',
  '<': '<',
  '>': '>',
  '!': '!',
  '%': '%',
  '|': '|',
  '√': '√',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
};

const NAMES: Record<string, string> = { π: 'pi', '∞': 'inf' };

export function tokenizeText(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      toks.push({ k: 'num', v: num[0], s: i, e: i + num[0].length });
      i += num[0].length;
      continue;
    }
    // based integers #FFh (prompt 031): one number token, read by the value evaluator
    const based = /^#[0-9A-Za-z]+/.exec(src.slice(i));
    if (based) {
      toks.push({ k: 'num', v: based[0], s: i, e: i + based[0].length });
      i += based[0].length;
      continue;
    }
    // units _km, _degC (prompt 031): names that start with an underscore
    const unit = /^_[\p{L}][\p{L}\p{N}]*/u.exec(src.slice(i));
    if (unit) {
      toks.push({ k: 'id', v: unit[0], s: i, e: i + unit[0].length });
      i += unit[0].length;
      continue;
    }
    const id = /^[\p{L}][\p{L}\p{N}_]*/u.exec(src.slice(i));
    if (id && !NAMES[c]) {
      toks.push({ k: 'id', v: id[0], s: i, e: i + id[0].length });
      i += id[0].length;
      continue;
    }
    if (NAMES[c]) {
      toks.push({ k: 'id', v: NAMES[c], s: i, e: i + 1 });
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '!=' || two === '**') {
      toks.push({ k: 'op', v: two === '**' ? '^' : two, s: i, e: i + 2 });
      i += 2;
      continue;
    }
    if (SINGLE[c]) {
      toks.push({ k: 'op', v: SINGLE[c], s: i, e: i + 1 });
      i++;
      continue;
    }
    throw new ParseError('syntax', `unexpected character "${c}"`, i, i + 1);
  }
  toks.push({ k: 'eof', s: src.length, e: src.length });
  return toks;
}

export function parseText(src: string, opts: ParseOptions = {}): MathResult<Expr> {
  try {
    return ok(new Pratt(tokenizeText(src), opts).parseAll());
  } catch (e) {
    if (e instanceof ParseError) return fail(e.code, e.message, { start: e.start, end: e.end });
    throw e;
  }
}
