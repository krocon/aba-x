/**
 * Messages between the app and the compute worker (prompt 004). Everything is structured-clone
 * data: AST nodes and `MathResult`s, no functions or class instances.
 */
import type { Expr } from '../ast/nodes';
import type { MathResult } from '../result';
import type { CasValue, Solutions, SystemSolution } from '../symbolic/engine';
import type { ValueScope } from '../value/evaluate-value';
import type { Value } from '../value/value';

export type ComputeOp =
  | { op: 'simplify'; expr: Expr }
  | { op: 'expand'; expr: Expr }
  | { op: 'factor'; expr: Expr }
  | { op: 'differentiate'; expr: Expr; variable: string; order: number }
  | { op: 'integrate'; expr: Expr; variable: string }
  | { op: 'integrateDefinite'; expr: Expr; variable: string; lower: Expr; upper: Expr }
  | { op: 'solve'; equation: Expr; variable: string }
  | { op: 'solveSystem'; equations: Expr[]; variables: string[] }
  | { op: 'limit'; expr: Expr; variable: string; to: Expr; direction?: '+' | '-' }
  /** General evaluation on values (prompt 027, ABA-T1 home view). */
  | { op: 'evaluate'; expr: Expr; scope: ValueScope }
  /** Test hook: busy-waits `ms` milliseconds (timeout and cancel specs, prompt 004). */
  | { op: 'sleep'; ms: number };

export interface ComputeResults {
  simplify: CasValue;
  expand: CasValue;
  factor: CasValue;
  differentiate: CasValue;
  integrate: CasValue;
  integrateDefinite: CasValue;
  solve: Solutions;
  solveSystem: SystemSolution[];
  limit: CasValue;
  evaluate: Value;
  sleep: null;
}

export interface ComputeRequest {
  readonly id: number;
  readonly task: ComputeOp;
}

export interface ComputeResponse {
  readonly id: number;
  readonly result: MathResult<unknown>;
}
