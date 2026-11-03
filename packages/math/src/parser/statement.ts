/**
 * Statements of the input line (prompt 008): an expression, a variable assignment `a = 5` or a
 * function definition `f(x) = x^2 - 3x + 2` / `g(x, y) = …`. Whether `x = 5` assigns (Standard
 * mode) or is an equation (CAS mode) is the caller's decision – here only the shape is detected.
 */
import type { Expr } from '../ast/nodes';
import { CONSTANTS, lookupFunction } from '../functions';
import { type MathResult, fail, ok } from '../result';
import { scanLatexTokens } from './latex-parser';
import { ParseError, type ParseOptions, Pratt, type Tok } from './pratt';
import { tokenizeText } from './text-parser';

export type Statement =
  | { readonly kind: 'expr'; readonly expr: Expr }
  | { readonly kind: 'assign'; readonly name: string; readonly value: Expr }
  | {
      readonly kind: 'define';
      readonly name: string;
      readonly params: string[];
      readonly body: Expr;
    };

const RESERVED = new Set<string>([...CONSTANTS, 'Ans']);

/** Can `name` be a user variable or function name? */
export function isFreeName(name: string): boolean {
  return /^[\p{L}][\p{L}\p{N}_]*$/u.test(name) && !RESERVED.has(name) && !lookupFunction(name);
}

const isOp = (t: Tok | undefined, v: string) => t?.k === 'op' && t.v === v;

function detect(toks: readonly Tok[], opts: ParseOptions): Statement | null {
  const [t0, t1] = toks;
  if (t0?.k !== 'id' || !isFreeName(t0.v)) return null;
  // name = …
  if (isOp(t1, '=')) {
    const value = new Pratt(toks.slice(2), opts).parseAll();
    return { kind: 'assign', name: t0.v, value };
  }
  // name(p1, p2, …) = …
  if (!isOp(t1, '(')) return null;
  const params: string[] = [];
  let i = 2;
  for (;;) {
    const p = toks[i];
    if (p?.k !== 'id' || !isFreeName(p.v)) return null;
    params.push(p.v);
    i++;
    if (isOp(toks[i], ',')) i++;
    else if (isOp(toks[i], ')')) break;
    else return null;
  }
  if (!isOp(toks[i + 1], '=')) return null;
  if (new Set(params).size !== params.length) {
    throw new ParseError('syntax', 'parameter names must be different', toks[2].s, toks[i].e);
  }
  const fns = new Set([...(opts.functions ?? []), t0.v]);
  const body = new Pratt(toks.slice(i + 2), { ...opts, functions: fns }).parseAll();
  return { kind: 'define', name: t0.v, params, body };
}

function statement(toks: Tok[], opts: ParseOptions): MathResult<Statement> {
  try {
    return ok(detect(toks, opts) ?? { kind: 'expr', expr: new Pratt(toks, opts).parseAll() });
  } catch (e) {
    if (e instanceof ParseError) return fail(e.code, e.message, { start: e.start, end: e.end });
    throw e;
  }
}

export function parseLatexStatement(src: string, opts: ParseOptions = {}): MathResult<Statement> {
  try {
    return statement(scanLatexTokens(src, opts), opts);
  } catch (e) {
    if (e instanceof ParseError) return fail(e.code, e.message, { start: e.start, end: e.end });
    throw e;
  }
}

export function parseTextStatement(src: string, opts: ParseOptions = {}): MathResult<Statement> {
  try {
    return statement(tokenizeText(src), opts);
  } catch (e) {
    if (e instanceof ParseError) return fail(e.code, e.message, { start: e.start, end: e.end });
    throw e;
  }
}
