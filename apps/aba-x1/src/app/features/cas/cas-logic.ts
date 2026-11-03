/** Pure helpers of the CAS mode (prompts 010–012). */
import { freeSymbols } from '@aba/math/ast/build';
import type { Expr } from '@aba/math/ast/nodes';
import type { Solutions } from '@aba/math/symbolic/engine';
import { evaluateNumeric } from '@aba/math/numeric/evaluate';
import { toLatex } from '@aba/math/serializer';

const CONSTANTS = new Set(['pi', 'e', 'i', 'inf']);

/** The variable an operation works on: x if present, else the only free name; null = ambiguous/none. */
export function pickVariable(e: Expr): string | null {
  const free = [...freeSymbols(e)].filter((s) => !CONSTANTS.has(s)).sort();
  if (free.includes('x')) return 'x';
  return free.length === 1 ? free[0] : null;
}

/** All free names (for systems of equations). */
export function variablesOf(e: Expr): string[] {
  return [...freeSymbols(e)].filter((s) => !CONSTANTS.has(s)).sort();
}

/** `x = −2, x = 2` as a list of equations plus its LaTeX; general solutions note n ∈ ℤ. */
export function solutionsDisplay(s: Solutions): { expr: Expr; latex: string; note: string | null } {
  // ascending where the value is real and known (x = −2, x = 2), the rest keeps the CAS order
  const key = (e: Expr) => {
    const v = evaluateNumeric(e);
    return v.ok ? v.value : Infinity;
  };
  const sorted = [...s.solutions].sort((a, b) => key(a.expr) - key(b.expr));
  const eqs: Expr[] = sorted.map((v) => ({
    type: 'rel',
    op: '=',
    left: { type: 'sym', name: s.variable },
    right: v.expr,
  }));
  const latex = eqs.map(toLatex).join(',\\;');
  const approx = s.solutions.some((v) => v.approximate);
  const notes = [
    s.parameter ? `${s.parameter} ∈ ℤ` : null,
    approx ? 'numeric approximations' : null,
    s.solutions.some((v) => !v.verified) ? 'not all solutions could be checked' : null,
  ].filter(Boolean);
  return {
    expr: { type: 'list', items: eqs },
    latex,
    note: notes.length ? notes.join(' · ') : null,
  };
}

/** Antiderivative with integration constant: F + C. */
export function withConstant(F: Expr): Expr {
  return { type: 'bin', op: '+', left: F, right: { type: 'sym', name: 'C' } };
}
