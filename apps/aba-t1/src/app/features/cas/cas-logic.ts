/**
 * CAS view of ABA-T1 (prompt 029), pure: reading a line (commands are calls), CAS variables and
 * functions (`a := …`, `f(x) := …`), home variables (capital names) as numbers, and the display of
 * an answer – exact LaTeX, or its decimal value in approximate mode.
 */
import type { Expr } from '@aba/math/ast/nodes';
import type { UserFunction } from '@aba/math/numeric/evaluate';
import { parseLatex } from '@aba/math/parser/latex-parser';
import { isFreeName, parseLatexStatement } from '@aba/math/parser/statement';
import { prettify } from '@aba/math/pretty';
import { type MathResult, fail, ok } from '@aba/math/result';
import { toLatex, toText } from '@aba/math/serializer';
import { CAS_COMMANDS, type CasOutput, type CasScope } from '@aba/math/symbolic/cas-commands';
import type { CasValue } from '@aba/math/symbolic/engine';
import { evaluateValue } from '@aba/math/value/evaluate-value';
import { type DisplayOptions, formatValue, valueLatex } from '@aba/math/value/format';
import type { Value } from '@aba/math/value/value';
import { STO_LATEX } from '../home/home-logic';

export type CasStatement =
  | { kind: 'expr'; expr: Expr }
  | { kind: 'assign'; name: string; expr: Expr }
  | { kind: 'define'; name: string; params: string[]; body: Expr };

/**
 * Command words typed letter by letter (`solve(` in MathLive is s·o·l·v·e) become
 * `\operatorname{solve}` when a parenthesis follows – names longer than one letter only.
 */
export function markCommands(src: string, names: Iterable<string>): string {
  // MathLive writes an inline shortcut \operatorname{solve} back as \operatorname{\mathrm{solve}}
  src = src.replace(/\\operatorname\{\\mathrm\{([^{}]*)\}\}/g, '\\operatorname{$1}');
  const long = [...names].filter((n) => n.length > 1).sort((a, b) => b.length - a.length);
  if (!long.length) return src;
  const re = new RegExp(`(?<![\\\\a-zA-Z{])(${long.join('|')})(?=\\s*(?:\\(|\\\\left\\())`, 'g');
  return src.replace(re, '\\operatorname{$1}');
}

export function parseCasInput(
  src: string,
  userFunctions: ReadonlySet<string>,
): MathResult<CasStatement> {
  const functions = new Set<string>([...CAS_COMMANDS, ...userFunctions]);
  src = markCommands(src, functions);
  const at = src.lastIndexOf(STO_LATEX);
  if (at >= 0) {
    // value ▶ name
    const name = src
      .slice(at + STO_LATEX.length)
      .replace(/\\(?:mathrm|operatorname)\{([^}]*)\}/g, '$1')
      .replace(/\s/g, '');
    if (!isFreeName(name)) return fail('syntax', `cannot store into "${name || '…'}"`);
    const r = parseLatex(src.slice(0, at), { functions });
    return r.ok ? ok({ kind: 'assign', name, expr: r.value }) : r;
  }
  const assign = /:=|\\coloneq(?:q)?/;
  if (assign.test(src)) {
    const r = parseLatexStatement(src.replace(assign, '='), { functions });
    if (!r.ok) return r;
    const st = r.value;
    if (st.kind === 'assign') return ok({ kind: 'assign', name: st.name, expr: st.value });
    if (st.kind === 'define') return ok(st);
    return fail('syntax', 'the left side of := must be a name or f(x)');
  }
  const r = parseLatex(src, { functions });
  return r.ok ? ok({ kind: 'expr', expr: r.value }) : r;
}

/** CAS variables, plus the real home variables with a capital name (A–Z, …) as numbers. */
export function casScope(
  casVars: ReadonlyMap<string, Expr>,
  casFns: ReadonlyMap<string, UserFunction>,
  homeVars: ReadonlyMap<string, Value>,
): CasScope {
  const variables = new Map<string, Expr>();
  for (const [k, v] of homeVars) {
    if (/^[A-Z]/.test(k) && k !== 'Ans' && v.kind === 'real') {
      variables.set(
        k,
        v.v < 0
          ? { type: 'neg', arg: { type: 'num', value: String(-v.v) } }
          : { type: 'num', value: String(v.v) },
      );
    }
  }
  for (const [k, v] of casVars) variables.set(k, v);
  return { variables, functions: casFns };
}

export interface CasAnswer {
  latex: string;
  text: string;
  /** the exact expression of a single value (for Copy, Sto, approximation) */
  expr: Expr | null;
  approximate: boolean;
  verified: boolean;
}

const exprLatex = (e: Expr) => toLatex(prettify(e));

/** An answer for the history; approximate mode shows decimal values where they exist. */
export function answerOf(
  o: CasOutput,
  approx: boolean,
  display: DisplayOptions,
  noSolution: string,
): CasAnswer {
  const one = (v: CasValue): { latex: string; text: string } => {
    if (approx || v.approximate) {
      const n = evaluateValue(v.expr);
      if (n.ok) return { latex: valueLatex(n.value, display), text: formatValue(n.value, display) };
    }
    return { latex: exprLatex(v.expr), text: toText(v.expr) };
  };
  switch (o.kind) {
    case 'value': {
      const d = one(o.value);
      return {
        ...d,
        expr: o.value.expr,
        approximate: approx || o.value.approximate,
        verified: o.value.verified,
      };
    }
    case 'bool':
      return {
        latex: `\\mathrm{${o.value}}`,
        text: String(o.value),
        expr: null,
        approximate: false,
        verified: true,
      };
    case 'list': {
      const parts = o.items.map(one);
      return {
        latex: `\\left[${parts.map((p) => p.latex).join(',\\;')}\\right]`,
        text: `[${parts.map((p) => p.text).join(', ')}]`,
        expr: null,
        approximate: approx || o.items.some((i) => i.approximate),
        verified: o.items.every((i) => i.verified),
      };
    }
    case 'solutions': {
      const s = o.value;
      if (!s.solutions.length) {
        return {
          latex: `\\text{${noSolution}}`,
          text: noSolution,
          expr: null,
          approximate: false,
          verified: true,
        };
      }
      // numeric solutions in ascending order (x = −2, x = 2)
      const key = (c: CasValue) => {
        const n = evaluateValue(c.expr);
        return n.ok && n.value.kind === 'real' ? n.value.v : NaN;
      };
      const sorted = [...s.solutions];
      if (sorted.every((c) => !Number.isNaN(key(c)))) sorted.sort((a, b) => key(a) - key(b));
      const parts = sorted.map(one);
      const v = s.variable;
      return {
        latex:
          parts.map((p) => `${v}=${p.latex}`).join(',\\;') +
          (s.parameter ? `,\\;${s.parameter}\\in\\mathbb{Z}` : ''),
        text: parts.map((p) => `${v}=${p.text}`).join(', '),
        expr: s.solutions.length === 1 ? s.solutions[0].expr : null,
        approximate: approx || s.solutions.some((x) => x.approximate),
        verified: s.solutions.every((x) => x.verified),
      };
    }
    case 'system': {
      if (!o.value.length) {
        return {
          latex: `\\text{${noSolution}}`,
          text: noSolution,
          expr: null,
          approximate: false,
          verified: true,
        };
      }
      const rows = o.value.map((sol) =>
        sol.assignments.map((a) => ({ v: a.variable, ...one(a.value) })),
      );
      return {
        latex: rows
          .map((r) => r.map((a) => `${a.v}=${a.latex}`).join(',\\;'))
          .join('\\quad\\text{or}\\quad '),
        text: rows.map((r) => r.map((a) => `${a.v}=${a.text}`).join(', ')).join(' or '),
        expr: null,
        approximate: approx,
        verified: o.value.every((sol) => sol.assignments.every((a) => a.value.verified)),
      };
    }
  }
}
