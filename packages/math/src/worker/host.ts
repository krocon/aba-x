/** Executes compute requests – runs in the worker, and in-thread where no worker exists (tests). */
import { type MathResult, fail, ok } from '../result';
import { NerdamerEngine } from '../symbolic/nerdamer-engine';
import type { ComputeOp, ComputeRequest, ComputeResponse } from './protocol';

const engine = new NerdamerEngine();

export function execute(task: ComputeOp): MathResult<unknown> {
  try {
    switch (task.op) {
      case 'simplify':
        return engine.simplify(task.expr);
      case 'expand':
        return engine.expand(task.expr);
      case 'factor':
        return engine.factor(task.expr);
      case 'differentiate':
        return engine.differentiate(task.expr, task.variable, task.order);
      case 'integrate':
        return engine.integrate(task.expr, task.variable);
      case 'integrateDefinite':
        return engine.integrateDefinite(task.expr, task.variable, task.lower, task.upper);
      case 'solve':
        return engine.solve(task.equation, task.variable);
      case 'solveSystem':
        return engine.solveSystem(task.equations, task.variables);
      case 'limit':
        return engine.limit(task.expr, task.variable, task.to, task.direction);
      case 'sleep': {
        const end = Date.now() + task.ms;
        while (Date.now() < end) {
          /* busy wait – test hook */
        }
        return ok(null);
      }
    }
  } catch (e) {
    return fail('not-evaluable', e instanceof Error ? e.message : String(e));
  }
}

export function handle(req: ComputeRequest): ComputeResponse {
  return { id: req.id, result: execute(req.task) };
}
