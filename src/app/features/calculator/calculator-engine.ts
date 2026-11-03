import { Injectable, inject } from '@angular/core';
import { freeSymbols, substitute } from '@aba/math/ast/build';
import type { Expr } from '@aba/math/ast/nodes';
import { type AngleMode, type UserFunction, evaluateNumeric } from '@aba/math/numeric/evaluate';
import { parseLatex } from '@aba/math/parser/latex-parser';
import { parseLatexStatement } from '@aba/math/parser/statement';
import { type MathResult, fail, ok } from '@aba/math/result';
import { toLatex } from '@aba/math/serializer';
import { ComputeClient } from '../../core/compute/compute-client';
import { SettingsStore } from '../settings/settings-store';
import { pickVariable, solutionsDisplay, variablesOf, withConstant } from '../cas/cas-logic';
import {
  type FormattedNumber,
  becameComplex,
  formatNumber,
  hasDecimals,
  inlineFunctions,
  isPlainNumber,
  toRadians,
} from './evaluation-logic';

export interface EvalContext {
  readonly angle: AngleMode;
  /** →NUM / APPROX mode: decimals only. */
  readonly approx: boolean;
  /** Last result, for `Ans`. */
  readonly ans?: Expr;
  readonly variables?: ReadonlyMap<string, Expr>;
  readonly functions?: ReadonlyMap<string, UserFunction>;
  /** Significant digits of decimal results (settings). */
  readonly digits?: number;
}

export interface Evaluation {
  readonly input: string;
  readonly expr: Expr;
  readonly latex: string;
  /** Decimal approximation, shown as "≈ …" when the result is not a plain number. */
  readonly approx?: FormattedNumber;
  /** The result itself is an approximation (decimals from numerics or the CAS). */
  readonly approximate: boolean;
  /** Extra information for the message line (n ∈ ℤ, unchecked solutions, + C). */
  readonly note?: string;
}

export type CasOp = 'simplify' | 'expand' | 'factor' | 'solve' | 'deriv' | 'integ';

export type Outcome =
  | { readonly kind: 'value'; readonly evaluation: Evaluation }
  | { readonly kind: 'assign'; readonly name: string; readonly evaluation: Evaluation }
  | {
      readonly kind: 'define';
      readonly name: string;
      readonly params: string[];
      readonly body: Expr;
    };

/**
 * Standard-mode evaluation (prompt 005): parse → substitute Ans/variables → exact result from the
 * CAS (worker) where possible, numeric otherwise. Real numbers only for now: a complex result is
 * reported, not shown.
 */
@Injectable({ providedIn: 'root' })
export class CalculatorEngine {
  private readonly compute = inject(ComputeClient);
  private readonly settings = inject(SettingsStore);

  parse(latex: string, ctx: Pick<EvalContext, 'functions'>): MathResult<Expr> {
    return parseLatex(latex, { functions: new Set(ctx.functions?.keys() ?? []) });
  }

  /** Prepares a parsed expression: Ans and variables substituted, user functions inlined, degrees. */
  prepare(ast: Expr, ctx: EvalContext): MathResult<Expr> {
    const values = new Map<string, Expr>(ctx.variables ?? []);
    if (freeSymbols(ast).has('Ans')) {
      if (!ctx.ans) return fail('unknown-symbol', 'Ans: there is no previous result yet');
      values.set('Ans', ctx.ans);
    }
    let e = values.size ? substitute(ast, values) : ast;
    try {
      e = inlineFunctions(e, ctx.functions ?? new Map());
    } catch (x) {
      return fail('not-evaluable', (x as Error).message);
    }
    return ok(ctx.angle === 'deg' ? toRadians(e) : e);
  }

  /**
   * The input line in Standard mode: an expression, `a = …` (assignment, value evaluated now) or
   * `f(x) = …` (definition, kept symbolic).
   */
  async evaluateStatement(
    latex: string,
    ctx: EvalContext,
    mode: 'standard' | 'cas' = 'standard',
  ): Promise<MathResult<Outcome>> {
    const st = parseLatexStatement(latex, { functions: new Set(ctx.functions?.keys() ?? []) });
    if (!st.ok) return st;
    const s = st.value;
    if (s.kind === 'define') {
      return ok({ kind: 'define', name: s.name, params: s.params, body: s.body });
    }
    // CAS mode: `x = 5` and `x^2 = 4` are equations, lists are systems – they go onto the stack
    const asIs = (expr: Expr) =>
      ok<Outcome>({
        kind: 'value',
        evaluation: { input: latex, expr, latex: toLatex(expr), approximate: false },
      });
    if (mode === 'cas') {
      if (s.kind === 'assign') {
        return asIs({ type: 'rel', op: '=', left: { type: 'sym', name: s.name }, right: s.value });
      }
      if (s.expr.type === 'rel' || s.expr.type === 'list') return asIs(s.expr);
    }
    if (s.kind === 'assign') {
      const v = await this.evaluateExpr(s.value, ctx, latex);
      return v.ok ? ok({ kind: 'assign', name: s.name, evaluation: v.value }) : v;
    }
    if (s.expr.type === 'rel') {
      return fail('unsupported', 'equations are solved in the CAS mode (F2 → SOLVE)');
    }
    const v = await this.evaluateExpr(s.expr, ctx, latex);
    return v.ok ? ok({ kind: 'value', evaluation: v.value }) : v;
  }

  async evaluate(latex: string, ctx: EvalContext): Promise<MathResult<Evaluation>> {
    const parsed = this.parse(latex, ctx);
    if (!parsed.ok) return parsed;
    if (parsed.value.type === 'rel') {
      return fail('unsupported', 'equations are solved in the CAS mode (F2 → SOLVE)');
    }
    return this.evaluateExpr(parsed.value, ctx, latex);
  }

  async evaluateExpr(
    ast: Expr,
    ctx: EvalContext,
    input = toLatex(ast),
  ): Promise<MathResult<Evaluation>> {
    const prepared = this.prepare(ast, ctx);
    if (!prepared.ok) return prepared;
    const e = prepared.value;
    const numeric = evaluateNumeric(e, { functions: ctx.functions });

    if (ctx.approx) {
      if (!numeric.ok) return numeric;
      const n = formatNumber(numeric.value, ctx.digits);
      return ok({ input, expr: numberExpr(n.text), latex: n.latex, approximate: true });
    }

    // A closed expression without a real value (1/0, ln 0, arcsin 2) has no exact form either –
    // except overflow, where the CAS still gives the exact big number.
    const closed = [...freeSymbols(e)].every((s) => CONSTANTS.has(s));
    if (!numeric.ok && closed && isUndefined(numeric.error.code, numeric.error.message)) {
      return numeric;
    }

    const cas = await this.compute.run({ op: 'simplify', expr: e }, this.settings.timeoutMs());
    if (cas.ok) {
      if (becameComplex(e, cas.value.expr)) {
        return fail('domain', 'the result is complex (complex numbers are not supported yet)');
      }
      const decimalsFromInput = hasDecimals(input);
      const approx =
        numeric.ok && !isPlainNumber(cas.value.expr)
          ? formatNumber(numeric.value, ctx.digits)
          : undefined;
      return ok({
        input,
        expr: cas.value.expr,
        latex: toLatex(cas.value.expr),
        approx,
        approximate: cas.value.approximate && !decimalsFromInput,
      });
    }
    if (cas.error.code === 'timeout' || cas.error.code === 'cancelled') return cas;
    if (numeric.ok) {
      const n = formatNumber(numeric.value, ctx.digits);
      return ok({
        input,
        expr: numberExpr(n.text),
        latex: n.latex,
        approximate: !Number.isInteger(numeric.value),
      });
    }
    // the numeric error is usually the more precise one (division by zero, domain)
    return numeric.error.code === 'unknown-symbol' ? cas : numeric;
  }

  /** CAS menu operations (prompts 010–012) on an expression, equation or list of equations. */
  async casOperation(op: CasOp, target: Expr, ctx: EvalContext): Promise<MathResult<Evaluation>> {
    const prepared = this.prepare(target, ctx);
    if (!prepared.ok) return prepared;
    const e = prepared.value;
    const input = toLatex(target);
    const done = (expr: Expr, approximate: boolean, note?: string, latex = toLatex(expr)) => {
      // decimal value of closed results (785√5/6 ≈ 292.53…), as for ENTER
      const n = isPlainNumber(expr) ? null : evaluateNumeric(expr, { functions: ctx.functions });
      const approx = n?.ok ? formatNumber(n.value, ctx.digits) : undefined;
      return ok<Evaluation>({
        input,
        expr,
        latex,
        approximate,
        ...(approx ? { approx } : {}),
        ...(note ? { note } : {}),
      });
    };

    if (op === 'simplify' || op === 'expand' || op === 'factor') {
      if (e.type === 'rel' || e.type === 'list')
        return fail('unsupported', `${op.toUpperCase()} needs an expression`);
      const r = await this.compute.run({ op, expr: e }, this.settings.timeoutMs());
      return r.ok ? done(r.value.expr, r.value.approximate) : r;
    }
    if (op === 'solve') {
      if (e.type === 'list') {
        if (!e.items.every((x) => x.type === 'rel' && x.op === '=')) {
          return fail('syntax', 'SOLVE: a system is a list of equations [a = b, c = d]');
        }
        const variables = variablesOf(e);
        const r = await this.compute.run(
          { op: 'solveSystem', equations: [...e.items], variables },
          this.settings.timeoutMs(),
        );
        if (!r.ok) return r;
        if (r.value.length === 0) return fail('not-solvable', 'no solution found');
        const sets = r.value.map((set) =>
          set.assignments.map((a) => `${a.variable}=${toLatex(a.value.expr)}`).join(',\\;'),
        );
        const exprs: Expr[] = r.value.map((set) => ({
          type: 'list',
          items: set.assignments.map((a) => ({
            type: 'rel',
            op: '=',
            left: { type: 'sym', name: a.variable },
            right: a.value.expr,
          })),
        }));
        const expr: Expr = exprs.length === 1 ? exprs[0] : { type: 'list', items: exprs };
        return done(expr, false, undefined, sets.join('\\quad\\vert\\quad '));
      }
      const equation: Expr =
        e.type === 'rel'
          ? e
          : { type: 'rel', op: '=', left: e, right: { type: 'num', value: '0' } };
      if (equation.type === 'rel' && equation.op !== '=')
        return fail('unsupported', 'inequalities are not supported');
      const variable = pickVariable(equation);
      if (!variable) return fail('syntax', 'SOLVE: the equation needs exactly one unknown (or x)');
      const r = await this.compute.run(
        { op: 'solve', equation, variable },
        this.settings.timeoutMs(),
      );
      if (!r.ok) return r;
      if (r.value.solutions.length === 0)
        return fail('not-solvable', `no solution for ${variable}`);
      const d = solutionsDisplay(r.value);
      return done(
        d.expr,
        r.value.solutions.some((v) => v.approximate),
        d.note ?? undefined,
        d.latex,
      );
    }
    if (e.type === 'rel' || e.type === 'list') return fail('unsupported', 'needs an expression');
    const variable = pickVariable(e);
    if (!variable) return fail('syntax', 'the expression needs exactly one variable (or x)');
    if (op === 'deriv') {
      const r = await this.compute.run(
        { op: 'differentiate', expr: e, variable, order: 1 },
        this.settings.timeoutMs(),
      );
      return r.ok ? done(r.value.expr, r.value.approximate) : r;
    }
    const r = await this.compute.run(
      { op: 'integrate', expr: e, variable },
      this.settings.timeoutMs(),
    );
    if (!r.ok) {
      return r.error.code === 'not-solvable'
        ? fail(
            'not-solvable',
            'no elementary antiderivative found (definite integrals work numerically)',
          )
        : r;
    }
    return done(withConstant(r.value.expr), false, 'C: integration constant');
  }

  cancel(): void {
    this.compute.cancelAll();
  }
}

const CONSTANTS = new Set(['pi', 'e']);
const isUndefined = (code: string, message: string) =>
  code === 'division-by-zero' || (code === 'domain' && !message.startsWith('overflow'));

function numberExpr(text: string): Expr {
  const neg = text.startsWith('-');
  const body = neg ? text.slice(1) : text;
  const num: Expr = { type: 'num', value: body };
  return neg ? { type: 'neg', arg: num } : num;
}
