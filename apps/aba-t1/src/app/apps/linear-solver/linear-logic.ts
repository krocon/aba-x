/**
 * Linear solver app (prompt 039), pure: an n×n system (n = 2 … 6) as coefficients and right
 * side, and the description of its solution set. Mathematics: `@aba/math/linalg/linear-system`.
 */
import { type LinearSystemResult, analyzeLinearSystem } from '@aba/math/linalg/linear-system';
import type { MathResult } from '@aba/math/result';
import { formatReal } from '@aba/math/value/format';

export const MAX_N = 6;

export interface LinearState {
  n: number;
  /** MAX_N × MAX_N coefficients (only the top-left n×n are used) */
  a: number[][];
  b: number[];
}

export function initLinear(): LinearState {
  const zero = () => new Array<number>(MAX_N).fill(0);
  return {
    n: 3,
    a: Array.from({ length: MAX_N }, (_, i) => zero().map((_, j) => (i === j ? 1 : 0))),
    b: zero(),
  };
}

export function solveState(s: LinearState): MathResult<LinearSystemResult> {
  const n = s.n;
  return analyzeLinearSystem(
    s.a.slice(0, n).map((r) => r.slice(0, n)),
    s.b.slice(0, n),
  );
}

const fmt = (x: number) => formatReal(x, { mode: 'standard', digits: 0, decimal: '.' });

/** One line per variable: `x1 = 2`, or with parameters `x1 = 2 − t1`, `x2 = t1`. */
export function describe(r: LinearSystemResult, n: number): string[] {
  if (r.kind === 'none') return [];
  if (r.kind === 'unique') return r.x.map((x, j) => `x${j + 1} = ${fmt(x)}`);
  return Array.from({ length: n }, (_, j) => {
    const terms: string[] = [];
    if (r.particular[j] !== 0) terms.push(fmt(r.particular[j]));
    r.basis.forEach((v, k) => {
      const c = v[j];
      if (c === 0) return;
      const t = `t${k + 1}`;
      const abs = Math.abs(c);
      const body = abs === 1 ? t : `${fmt(abs)}·${t}`;
      if (!terms.length) terms.push(c < 0 ? `−${body}` : body);
      else terms.push(`${c < 0 ? '−' : '+'} ${body}`);
    });
    return `x${j + 1} = ${terms.length ? terms.join(' ') : '0'}`;
  });
}
