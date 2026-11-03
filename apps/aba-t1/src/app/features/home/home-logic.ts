/**
 * Home view of ABA-T1 (prompt 027), pure: reading an input line (textbook = LaTeX, algebraic =
 * text) into a statement, the scope of an evaluation, history entries and their display.
 * `expr ▶ A` and `A := expr` store, `f(x) := …` defines, a plain `=` is a test (1/0).
 */
import type { Expr } from '@aba/math/ast/nodes';
import type { UserFunction } from '@aba/math/numeric/evaluate';
import { parseLatex } from '@aba/math/parser/latex-parser';
import { isFreeName, parseLatexStatement, parseTextStatement } from '@aba/math/parser/statement';
import { parseText } from '@aba/math/parser/text-parser';
import { type MathResult, fail, ok } from '@aba/math/result';
import type { ValueScope } from '@aba/math/value/evaluate-value';
import { type DisplayOptions, formatValue, valueLatex } from '@aba/math/value/format';
import type { Value } from '@aba/math/value/value';
import type { T1Settings } from '../settings/settings-logic';

export type InputKind = 'latex' | 'text';

export type HomeStatement =
  | { kind: 'expr'; expr: Expr }
  | { kind: 'store'; name: string; expr: Expr }
  | { kind: 'define'; name: string; params: string[]; body: Expr };

/** The Sto ▶ marker in each input form. */
export const STO_LATEX = '\\blacktriangleright';
export const STO_TEXT = '▶';

/** `\mathrm{AB}`, `\operatorname{AB}`, `AB` → `AB`. */
function plainName(src: string): string {
  return src
    .replace(/\\(?:mathrm|operatorname|text)\{([^}]*)\}/g, '$1')
    .replace(/\\[,; ]|\s/g, '')
    .trim();
}

export function parseHomeInput(
  src: string,
  kind: InputKind,
  functionNames: ReadonlySet<string> = new Set(),
): MathResult<HomeStatement> {
  const opts = { functions: functionNames };
  const sto = kind === 'latex' ? STO_LATEX : STO_TEXT;
  const at = src.lastIndexOf(sto);
  if (at >= 0) {
    const name = plainName(src.slice(at + sto.length));
    if (!isFreeName(name)) return fail('syntax', `cannot store into "${name || '…'}"`);
    const r =
      kind === 'latex' ? parseLatex(src.slice(0, at), opts) : parseText(src.slice(0, at), opts);
    return r.ok ? ok({ kind: 'store', name, expr: r.value }) : r;
  }
  const assign = kind === 'latex' ? /:=|\\coloneq(?:q)?/ : /:=/;
  if (assign.test(src)) {
    const plain = src.replace(assign, '=');
    const r = kind === 'latex' ? parseLatexStatement(plain, opts) : parseTextStatement(plain, opts);
    if (!r.ok) return r;
    const st = r.value;
    if (st.kind === 'assign') return ok({ kind: 'store', name: st.name, expr: st.value });
    if (st.kind === 'define') return ok(st);
    return fail('syntax', 'the left side of := must be a name or f(x)');
  }
  const r = kind === 'latex' ? parseLatex(src, opts) : parseText(src, opts);
  return r.ok ? ok({ kind: 'expr', expr: r.value }) : r;
}

export function scopeOf(
  settings: T1Settings,
  variables: ReadonlyMap<string, Value>,
  functions: ReadonlyMap<string, UserFunction>,
): ValueScope {
  return {
    angle: settings.angle,
    complexResults: settings.complex !== 'off',
    variables,
    functions,
  };
}

export function displayOptions(s: T1Settings): DisplayOptions {
  return {
    format: s.format,
    complexForm: s.complex === 'polar' ? 'polar' : 'rect',
    angle: s.angle,
  };
}

export interface HistoryEntry {
  /** the input as typed (LaTeX or text, see `kind`) */
  input: string;
  kind: InputKind;
  /** the stored value, so a later format change re-renders it; null for definitions/errors */
  value: Value | null;
  /** shown on the right when there is no value: an error or `Done` */
  note?: string;
  error?: boolean;
}

/** Right-hand side of a history row as LaTeX (value) or plain text (note). */
export function resultLatex(e: HistoryEntry, s: T1Settings): string | null {
  return e.value ? valueLatex(e.value, displayOptions(s)) : null;
}

export function resultText(e: HistoryEntry, s: T1Settings): string {
  return e.value ? formatValue(e.value, displayOptions(s)) : (e.note ?? '');
}

/** Input of a history row for the display (text inputs are shown as typed). */
export function inputLatex(e: HistoryEntry): string | null {
  return e.kind === 'latex' ? e.input : null;
}

/** A value as editable input (Copy of a result into the entry line). */
export function valueAsInput(v: Value, kind: InputKind, s: T1Settings): string {
  const full = {
    ...displayOptions(s),
    format: { mode: 'standard' as const, digits: 0, decimal: '.' as const },
  };
  const text = formatValue(v, full).replace(
    /E(-?\d+)/,
    kind === 'latex' ? '\\times10^{$1}' : '*10^($1)',
  );
  if (kind === 'text') return text.replace('∠', '∠');
  return text.replace(/\*i/g, 'i').replace('∠', '\\angle ');
}

export const MAX_HISTORY = 200;
