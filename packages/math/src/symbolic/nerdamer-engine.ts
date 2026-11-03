/**
 * `SymbolicEngine` on Nerdamer 2.0.1 (ADR 0004). Nerdamer types never leave this file. Pitfalls
 * from the technical evaluation §3 are handled here: allow-listed functions only, unevaluated
 * results are failures, decimals are marked, every answer is spot-checked numerically.
 */
import nerdamer from 'nerdamer';
import { freeSymbols, substitute, sub } from '../ast/build';
import type { Expr } from '../ast/nodes';
import { integrateAdaptive } from '../numeric/quadrature';
import { compile, evaluateNumeric } from '../numeric/evaluate';
import { type MathErrorCode, type MathResult, fail, ok } from '../result';
import { toText } from '../serializer';
import type { CasValue, Solutions, SymbolicEngine, SystemSolution } from './engine';
import { NotExpressible, fromNerdamer, splitList, toNerdamer } from './nerdamer-syntax';
import { type Check, checkDerivative, checkEqual, checkSolution, close } from './verify';

interface Entity {
  text(): string;
}

class DefiniteFailed extends Error {
  constructor(
    readonly code: MathErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function run<T>(f: () => T): MathResult<T> {
  try {
    return ok(f());
  } catch (e) {
    if (e instanceof NotExpressible)
      return fail('unsupported', `the CAS cannot handle ${e.message}`);
    if (e instanceof DefiniteFailed) return fail(e.code, e.message);
    const msg = e instanceof Error ? e.message : String(e);
    const code: MathErrorCode = /division by zero/i.test(msg) ? 'division-by-zero' : 'not-solvable';
    return fail(code, `CAS: ${msg}`);
  }
}

/** Parses Nerdamer text and applies a numerical check. */
export function accept(
  text: string,
  check: (e: Expr) => Check,
  param?: string,
): MathResult<CasValue> {
  const parsed = fromNerdamer(text, param);
  if (!parsed.ok) return parsed;
  const verdict = check(parsed.value.expr);
  if (verdict === 'mismatch') {
    return fail('unsupported', `the CAS result ${text} failed the numerical check – not shown`);
  }
  return ok({ ...parsed.value, verified: verdict === 'ok' });
}

/** A free name for the integer parameter of general solutions. */
function parameterName(e: Expr): string {
  const used = freeSymbols(e);
  return ['n', 'm', 'k', 'j'].find((n) => !used.has(n)) ?? 'n_0';
}

export class NerdamerEngine implements SymbolicEngine {
  /**
   * Nerdamer input. Operator nodes inside an expression (d/dx, ∫, lim) are resolved first by the
   * engine methods – so they are verified like a direct call.
   */
  private n(e: Expr): string {
    return toNerdamer(this.resolveDefinite(e));
  }

  private resolveDefinite(e: Expr): Expr {
    const go = (x: Expr): Expr => {
      switch (x.type) {
        case 'int': {
          const body = go(x.expr);
          if (!x.lower || !x.upper) {
            const F = this.integrate(body, x.variable);
            if (!F.ok) throw new DefiniteFailed(F.error.code, F.error.message);
            return F.value.expr;
          }
          const r = this.integrateDefinite(body, x.variable, go(x.lower), go(x.upper));
          if (!r.ok) throw new DefiniteFailed(r.error.code, r.error.message);
          return r.value.expr;
        }
        case 'neg':
        case 'post':
          return { ...x, arg: go(x.arg) };
        case 'bin':
        case 'rel':
          return { ...x, left: go(x.left), right: go(x.right) };
        case 'call':
          return { ...x, args: x.args.map(go) };
        case 'deriv': {
          // every operator node is computed by its own (verified) engine method
          const r = this.differentiate(go(x.expr), x.variable, x.order);
          if (!r.ok) throw new DefiniteFailed(r.error.code, r.error.message);
          return r.value.expr;
        }
        case 'series':
          return { ...x, expr: go(x.expr), lower: go(x.lower), upper: go(x.upper) };
        case 'limit': {
          const r = this.limit(go(x.expr), x.variable, go(x.to), x.direction);
          if (!r.ok) throw new DefiniteFailed(r.error.code, r.error.message);
          return r.value.expr;
        }
        default:
          return x;
      }
    };
    return go(e);
  }

  simplify(e: Expr): MathResult<CasValue> {
    const r = run(() =>
      (nerdamer as unknown as { simplify(s: string): Entity }).simplify(this.n(e)).text(),
    );
    return r.ok ? accept(r.value, (x) => checkEqual(e, x)) : r;
  }

  expand(e: Expr): MathResult<CasValue> {
    const r = run(() => (nerdamer(this.n(e)) as unknown as { expand(): Entity }).expand().text());
    return r.ok ? accept(r.value, (x) => checkEqual(e, x)) : r;
  }

  factor(e: Expr): MathResult<CasValue> {
    const r = run(() =>
      (nerdamer as unknown as { factor(s: string): Entity }).factor(this.n(e)).text(),
    );
    return r.ok ? accept(r.value, (x) => checkEqual(e, x)) : r;
  }

  differentiate(e: Expr, variable: string, order = 1): MathResult<CasValue> {
    let current: CasValue = { expr: e, approximate: false, verified: true };
    for (let k = 0; k < order; k++) {
      const input = current.expr;
      const r = run(() =>
        (nerdamer as unknown as { diff(s: string, v: string): Entity })
          .diff(this.n(input), variable)
          .text(),
      );
      if (!r.ok) return r;
      const next = accept(r.value, (x) => checkDerivative(input, x, variable));
      if (!next.ok) return next;
      current = { ...next.value, verified: current.verified && next.value.verified };
    }
    return ok(current);
  }

  integrate(e: Expr, variable: string): MathResult<CasValue> {
    const r = run(() =>
      (nerdamer as unknown as { integrate(s: string, v: string): Entity })
        .integrate(this.n(e), variable)
        .text(),
    );
    // d/dx F must give back the integrand
    return r.ok ? accept(r.value, (F) => checkDerivative(F, e, variable)) : r;
  }

  integrateDefinite(e: Expr, variable: string, lower: Expr, upper: Expr): MathResult<CasValue> {
    // The numerical value decides whether the integral exists at all (∫₋₁¹ 1/x² must not give −2).
    const a = evaluateNumeric(lower);
    const b = evaluateNumeric(upper);
    const others = [...freeSymbols(e)].filter((s) => s !== variable && !['pi', 'e'].includes(s));
    const numeric =
      a.ok && b.ok && others.length === 0
        ? integrateAdaptive(compile(e, variable), a.value, b.value)
        : null;
    if (numeric && !numeric.ok) return numeric;

    const F = this.integrate(e, variable);
    if (F.ok) {
      const at = (bound: Expr): MathResult<CasValue> => {
        if (bound.type === 'sym' && bound.name === 'inf') {
          return this.limit(F.value.expr, variable, bound);
        }
        if (bound.type === 'neg' && bound.arg.type === 'sym' && bound.arg.name === 'inf') {
          return this.limit(F.value.expr, variable, bound);
        }
        return ok({
          expr: substitute(F.value.expr, new Map([[variable, bound]])),
          approximate: false,
          verified: true,
        });
      };
      const Fb = at(upper);
      const Fa = at(lower);
      if (Fb.ok && Fa.ok) {
        const exact = this.simplify(sub(Fb.value.expr, Fa.value.expr));
        if (exact.ok) {
          // symbolic bounds or parameters: nothing to compare with
          if (!numeric) return ok({ ...exact.value, verified: false });
          const v = evaluateNumeric(exact.value.expr);
          if (v.ok && close(v.value, numeric.value.value, 1e-6)) {
            return ok({ ...exact.value, verified: true });
          }
        }
      }
    }
    if (numeric?.ok) {
      return ok({
        expr: { type: 'num', value: String(numeric.value.value) },
        approximate: true,
        verified: true,
      });
    }
    return F.ok ? fail('not-solvable', 'the definite integral could not be evaluated') : F;
  }

  solve(equation: Expr, variable: string): MathResult<Solutions> {
    const param = parameterName(equation);
    const r = run(() =>
      (nerdamer as unknown as { solve(s: string, v: string): Entity })
        .solve(this.n(equation), variable)
        .text(),
    );
    if (!r.ok) return r;
    const solutions: CasValue[] = [];
    let rejected = 0;
    let usesParam = false;
    for (const part of splitList(r.value)) {
      const parsed = fromNerdamer(part, param);
      if (!parsed.ok) return parsed;
      if (freeSymbols(parsed.value.expr).has(param)) usesParam = true;
      const verdict = checkSolution(equation, variable, parsed.value.expr);
      if (verdict === 'mismatch') {
        rejected++;
        continue;
      }
      solutions.push({ ...parsed.value, verified: verdict === 'ok' });
    }
    if (rejected > 0 && solutions.length === 0) {
      return fail('not-solvable', 'the CAS returned no verifiable solution');
    }
    return ok({ variable, solutions, ...(usesParam ? { parameter: param } : {}) });
  }

  solveSystem(
    equations: readonly Expr[],
    variables: readonly string[],
  ): MathResult<SystemSolution[]> {
    const r = run(() =>
      (nerdamer as unknown as { solveSystem(e: string[], v: string[]): Entity })
        .solveSystem(
          equations.map((e) => this.n(e)),
          [...variables],
        )
        .text(),
    );
    if (!r.ok) return r;
    // [{x => 2, y => 1}, …]
    const out: SystemSolution[] = [];
    for (const block of splitList(r.value)) {
      const assignments: { variable: string; value: CasValue }[] = [];
      for (const pair of splitList(block)) {
        const [name, value] = pair.split('=>').map((s) => s.trim());
        const parsed = fromNerdamer(value ?? '');
        if (!parsed.ok || !name)
          return fail('unsupported', `cannot read the CAS result "${r.value}"`);
        assignments.push({ variable: name, value: { ...parsed.value, verified: false } });
      }
      const values = new Map(assignments.map((a) => [a.variable, a.value.expr]));
      const all = equations.map((eq) =>
        checkSolution(substitute(eq, values), '_', { type: 'num', value: '0' }),
      );
      if (all.includes('mismatch')) continue;
      const verified = all.every((c) => c === 'ok');
      out.push({
        assignments: assignments.map((a) => ({ ...a, value: { ...a.value, verified } })),
      });
    }
    return ok(out);
  }

  limit(e: Expr, variable: string, to: Expr, direction?: '+' | '-'): MathResult<CasValue> {
    const target = toNerdamer(to);
    const r = run(() =>
      (nerdamer as unknown as { limit(s: string, v: string, t: string): Entity })
        .limit(this.n(e), variable, target)
        .text(),
    );
    if (!r.ok) return r;
    return accept(r.value, (L) => this.checkLimit(e, variable, to, L, direction));
  }

  /** Compares the limit with f near the target (loose: limits converge slowly). */
  private checkLimit(e: Expr, v: string, to: Expr, L: Expr, direction?: '+' | '-'): Check {
    const lv = evaluateNumeric(L);
    const f = compile(e, v);
    if (to.type === 'sym' && to.name === 'inf') {
      const y = f(1e7);
      if (!lv.ok) return Number.isFinite(y) && Math.abs(y) < 1e6 ? 'mismatch' : 'unknown';
      return Number.isFinite(y) ? (close(y, lv.value, 1e-3) ? 'ok' : 'mismatch') : 'unknown';
    }
    const a = evaluateNumeric(to);
    if (!a.ok || !lv.ok) return 'unknown';
    const h = 1e-6 * Math.max(1, Math.abs(a.value));
    const sides = direction === '+' ? [h] : direction === '-' ? [-h] : [h, -h];
    for (const s of sides) {
      const y = f(a.value + s);
      if (!Number.isFinite(y)) return 'unknown';
      if (!close(y, lv.value, 1e-3)) return 'mismatch';
    }
    return 'ok';
  }
}

/** For logs and tests: the engine's input for an expression. */
export const nerdamerInput = (e: Expr) => toNerdamer(e);
export const asText = (v: CasValue) => toText(v.expr);
