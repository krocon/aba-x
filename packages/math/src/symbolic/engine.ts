/**
 * Symbolic engine (prompt 009, ADR 0004). The interface promises only what the adapter really
 * does; every result is checked numerically before it is returned, so a CAS bug becomes an
 * honest error instead of a wrong answer.
 */
import type { Expr } from '../ast/nodes';
import type { MathResult } from '../result';

export interface CasValue {
  readonly expr: Expr;
  /** The CAS answered with decimals (e.g. roots of x⁵ − x − 1): an approximation. */
  readonly approximate: boolean;
  /** At least one numerical spot check agreed; false = could not be checked (never: disagreed). */
  readonly verified: boolean;
}

export interface Solutions {
  readonly variable: string;
  readonly solutions: readonly CasValue[];
  /** Name of an integer parameter in general solutions (x = π/6 + 2nπ), if any. */
  readonly parameter?: string;
}

export interface SystemSolution {
  readonly assignments: readonly { variable: string; value: CasValue }[];
}

export interface SymbolicEngine {
  simplify(e: Expr): MathResult<CasValue>;
  expand(e: Expr): MathResult<CasValue>;
  factor(e: Expr): MathResult<CasValue>;
  differentiate(e: Expr, variable: string, order?: number): MathResult<CasValue>;
  /** Antiderivative without the constant (the UI shows + C). */
  integrate(e: Expr, variable: string): MathResult<CasValue>;
  integrateDefinite(e: Expr, variable: string, lower: Expr, upper: Expr): MathResult<CasValue>;
  /** Solves `left = right` (or `e = 0`) for one variable. */
  solve(equation: Expr, variable: string): MathResult<Solutions>;
  solveSystem(
    equations: readonly Expr[],
    variables: readonly string[],
  ): MathResult<SystemSolution[]>;
  limit(e: Expr, variable: string, to: Expr, direction?: '+' | '-'): MathResult<CasValue>;
}
