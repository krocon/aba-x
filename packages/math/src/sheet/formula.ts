/**
 * Cell inputs and the formula language of the spreadsheet (prompt 041).
 *
 * An input is a number (`1.5`, `-2E3`; with the decimal comma `1,5`), text (anything else; a
 * leading apostrophe forces text: `'12`) or a formula (`=A1+B1`). A formula is the text syntax of
 * the calculator plus references (`A1`, `$A$1`, `A1:B9`, `A:A`, `3:3`, names), `<>` for ≠,
 * `TRUE`/`FALSE` and the sheet functions (SUM, IF, …; function names are case-insensitive).
 * With the decimal comma, `;` separates arguments (`=ROUND(A1;2)`, `=1,5*A1`).
 *
 * Compiling replaces every reference by a placeholder symbol (`ℛ0`, `ℛ1`, …) and hands the rest to
 * the existing text parser – the AST is the one of the value evaluator. Pure.
 */
import type { Expr } from '../ast/nodes';
import { OPERATOR_FUNCTIONS, isConstant, lookupFunction } from '../functions';
import { parseText } from '../parser/text-parser';
import { type MathResult, fail, ok } from '../result';
import { REF_ERROR, type Ref, formatRef, parseRef, shiftRef } from './refs';

export type DecimalMark = '.' | ',';

export type CellInput =
  | { readonly kind: 'empty' }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'text'; readonly text: string }
  /** `src` is the input without the leading `=`. */
  | { readonly kind: 'formula'; readonly src: string };

const NUMBER = {
  '.': /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/,
  ',': /^[+-]?(?:\d+(?:,\d*)?|,\d+)(?:[eE][+-]?\d+)?$/,
};

/** What the user typed into a cell. Surrounding blanks of numbers are ignored. */
export function parseInput(input: string, decimal: DecimalMark = '.'): CellInput {
  if (input === '') return { kind: 'empty' };
  if (input.startsWith("'")) return { kind: 'text', text: input.slice(1) };
  if (input.startsWith('=')) return { kind: 'formula', src: input.slice(1) };
  const t = input.trim();
  if (NUMBER[decimal].test(t)) return { kind: 'number', value: Number(t.replace(',', '.')) };
  return { kind: 'text', text: input };
}

/** Sheet functions with their argument counts; they take ranges and are evaluated by the engine. */
export const SHEET_FUNCTIONS: Readonly<Record<string, readonly [number, number]>> = {
  SUM: [1, 255],
  PRODUCT: [1, 255],
  AVERAGE: [1, 255],
  MIN: [1, 255],
  MAX: [1, 255],
  COUNT: [1, 255],
  COUNTA: [1, 255],
  MEDIAN: [1, 255],
  STDEV: [1, 255],
  VAR: [1, 255],
  IF: [2, 3],
  IFERROR: [2, 2],
  AND: [1, 255],
  OR: [1, 255],
  NOT: [1, 1],
  ROUND: [1, 2],
};

const SHEET_SET: ReadonlySet<string> = new Set(Object.keys(SHEET_FUNCTIONS));

/** Prefix of the placeholder symbols of references. A letter, so the text tokenizer reads names. */
export const REF_PREFIX = 'ℛ';

export type FormulaToken =
  | { readonly t: 'ref'; readonly ref: Ref; readonly s: number; readonly e: number }
  | { readonly t: 'referr'; readonly s: number; readonly e: number }
  | {
      readonly t: 'ident';
      readonly name: string;
      readonly call: boolean;
      readonly s: number;
      readonly e: number;
    }
  | { readonly t: 'num'; readonly s: number; readonly e: number }
  | { readonly t: 'str'; readonly s: number; readonly e: number }
  | { readonly t: 'other'; readonly s: number; readonly e: number };

const NOT_IDENT = '(?![\\p{L}\\p{N}_$])';
const RE = {
  referr: /#REF!/iy,
  str: /"(?:[^"]|"")*"?/y,
  range: new RegExp(`\\$?[A-Za-z]{1,2}\\$?\\d+:\\$?[A-Za-z]{1,2}\\$?\\d+${NOT_IDENT}`, 'uy'),
  cols: new RegExp(`\\$?[A-Za-z]{1,2}:\\$?[A-Za-z]{1,2}${NOT_IDENT}`, 'uy'),
  rows: new RegExp(`\\$?\\d+:\\$?\\d+${NOT_IDENT}(?![.,])`, 'uy'),
  cell: new RegExp(`\\$?[A-Za-z]{1,2}\\$?\\d+${NOT_IDENT}`, 'uy'),
  ident: /[\p{L}_][\p{L}\p{N}_]*/uy,
  op: /<>|<=|>=|!=/y,
  numDot: /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y,
  numComma: /(?:\d+(?:,\d*)?|,\d+)(?:[eE][+-]?\d+)?/y,
};

function at(re: RegExp, src: string, i: number): string | null {
  re.lastIndex = i;
  const m = re.exec(src);
  return m ? m[0] : null;
}

/** Splits a formula (without `=`) into references, names, numbers and the rest. */
export function lexFormula(src: string, decimal: DecimalMark = '.'): FormulaToken[] {
  const out: FormulaToken[] = [];
  let i = 0;
  while (i < src.length) {
    let m: string | null;
    if ((m = at(RE.referr, src, i))) {
      out.push({ t: 'referr', s: i, e: (i += m.length) });
      continue;
    }
    if (src[i] === '"' && (m = at(RE.str, src, i))) {
      out.push({ t: 'str', s: i, e: (i += m.length) });
      continue;
    }
    let ref: Ref | null = null;
    for (const re of [RE.range, RE.cols, RE.rows, RE.cell]) {
      m = at(re, src, i);
      if (m && (ref = parseRef(m))) break;
    }
    if (ref && m) {
      out.push({ t: 'ref', ref, s: i, e: (i += m.length) });
      continue;
    }
    if ((m = at(decimal === ',' ? RE.numComma : RE.numDot, src, i))) {
      out.push({ t: 'num', s: i, e: (i += m.length) });
      continue;
    }
    if ((m = at(RE.ident, src, i))) {
      let j = i + m.length;
      while (j < src.length && /\s/.test(src[j])) j++;
      out.push({ t: 'ident', name: m, call: src[j] === '(', s: i, e: (i += m.length) });
      continue;
    }
    m = at(RE.op, src, i) ?? src[i];
    out.push({ t: 'other', s: i, e: (i += m.length) });
  }
  return out;
}

/** A formula ready for evaluation; `refs[k]` belongs to the symbol `ℛk` (null = `#REF!`). */
export interface CompiledFormula {
  readonly expr: Expr;
  readonly refs: readonly (Ref | null)[];
  /** identifiers that may be names of cells or ranges (resolved at evaluation time) */
  readonly names: readonly string[];
}

/** The canonical spelling of a called function: sheet functions upper case, built-ins as catalogued. */
export function functionName(name: string): string {
  const up = name.toUpperCase();
  if (SHEET_SET.has(up)) return up;
  const known = (n: string) =>
    lookupFunction(n) !== undefined || (OPERATOR_FUNCTIONS as readonly string[]).includes(n);
  if (known(name)) return name;
  const low = name.toLowerCase();
  return known(low) ? low : name;
}

/** Names may not look like cells, functions, constants or TRUE/FALSE; they are case-sensitive. */
export function isValidName(name: string): boolean {
  if (!/^[\p{L}][\p{L}\p{N}_]*$/u.test(name)) return false;
  if (/^[A-Za-z]+\d+$/.test(name) || name.startsWith(REF_PREFIX)) return false;
  if (isConstant(name) || /^(true|false)$/i.test(name)) return false;
  return functionName(name) === name && !SHEET_SET.has(name) && !lookupFunction(name);
}

/** Formula text (without `=`) → AST with placeholder symbols for the references. */
export function compileFormula(
  src: string,
  decimal: DecimalMark = '.',
): MathResult<CompiledFormula> {
  const refs: (Ref | null)[] = [];
  const index = new Map<string, number>();
  const names = new Set<string>();
  const placeholder = (ref: Ref | null) => {
    const key = ref ? formatRef(ref) : REF_ERROR;
    let k = index.get(key);
    if (k === undefined) {
      k = refs.push(ref) - 1;
      index.set(key, k);
    }
    return `${REF_PREFIX}${k}`;
  };
  let out = '';
  for (const tok of lexFormula(src, decimal)) {
    const text = src.slice(tok.s, tok.e);
    switch (tok.t) {
      case 'ref':
        out += placeholder(tok.ref);
        break;
      case 'referr':
        out += placeholder(null);
        break;
      case 'str':
        return fail('unsupported', 'text in formulas is not supported');
      case 'num':
        out += decimal === ',' ? text.replace(',', '.') : text;
        break;
      case 'ident':
        if (tok.call) {
          out += functionName(text);
        } else if (/^(true|false)$/i.test(text)) {
          out += /^t/i.test(text) ? '1' : '0';
        } else {
          if (text.startsWith('$')) return fail('syntax', `invalid reference ${text}`);
          if (!isConstant(text) && !text.startsWith('_')) names.add(text);
          out += text;
        }
        break;
      case 'other':
        if (text === '$') return fail('syntax', 'invalid reference');
        if (text === '<>') out += '!=';
        else if (decimal === ',' && text === ';') out += ',';
        else if (decimal === ',' && text === ',') return fail('syntax', 'use ; between arguments');
        else out += text;
        break;
    }
  }
  const parsed = parseText(out, { functions: SHEET_SET });
  if (!parsed.ok) return fail(parsed.error.code, parsed.error.message);
  return ok({ expr: parsed.value, refs, names: [...names] });
}

/**
 * Rewrites every reference of an input (inputs without `=` stay unchanged): `f` returns the new
 * reference, or null for `#REF!`. Everything else of the text is kept as typed.
 */
export function rewriteRefs(
  input: string,
  f: (ref: Ref) => Ref | null,
  decimal: DecimalMark = '.',
): string {
  if (!input.startsWith('=')) return input;
  const src = input.slice(1);
  let out = '=';
  for (const tok of lexFormula(src, decimal)) {
    if (tok.t === 'ref') {
      const r = f(tok.ref);
      out += r ? formatRef(r) : REF_ERROR;
    } else {
      out += src.slice(tok.s, tok.e);
    }
  }
  return out;
}

/** An input copied by (dRow, dCol): relative references move, absolute ones stay. */
export function shiftFormula(
  input: string,
  dRow: number,
  dCol: number,
  decimal: DecimalMark = '.',
): string {
  return rewriteRefs(input, (r) => shiftRef(r, dRow, dCol), decimal);
}

/** True when the input is a formula whose references would change when copied by (dRow, dCol). */
export function hasRelativeRefs(input: string, decimal: DecimalMark = '.'): boolean {
  return shiftFormula(input, 1, 1, decimal) !== input;
}
