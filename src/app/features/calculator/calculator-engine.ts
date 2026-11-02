import { Injectable, inject } from '@angular/core';
import { freeSymbols, substitute } from '../../../math/ast/build';
import type { Expr } from '../../../math/ast/nodes';
import { type AngleMode, type UserFunction, evaluateNumeric } from '../../../math/numeric/evaluate';
import { parseLatex } from '../../../math/parser/latex-parser';
import { type MathResult, fail, ok } from '../../../math/result';
import { toLatex } from '../../../math/serializer';
import { ComputeClient } from '../../core/compute/compute-client';
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
}

export interface Evaluation {
  readonly input: string;
  readonly expr: Expr;
  readonly latex: string;
  /** Decimal approximation, shown as "≈ …" when the result is not a plain number. */
  readonly approx?: FormattedNumber;
  /** The result itself is an approximation (decimals from numerics or the CAS). */
  readonly approximate: boolean;
}

/**
 * Standard-mode evaluation (prompt 005): parse → substitute Ans/variables → exact result from the
 * CAS (worker) where possible, numeric otherwise. Real numbers only for now: a complex result is
 * reported, not shown.
 */
@Injectable({ providedIn: 'root' })
export class CalculatorEngine {
  private readonly compute = inject(ComputeClient);

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
      const n = formatNumber(numeric.value);
      return ok({ input, expr: numberExpr(n.text), latex: n.latex, approximate: true });
    }

    // A closed expression without a real value (1/0, ln 0, arcsin 2) has no exact form either –
    // except overflow, where the CAS still gives the exact big number.
    const closed = [...freeSymbols(e)].every((s) => CONSTANTS.has(s));
    if (!numeric.ok && closed && isUndefined(numeric.error.code, numeric.error.message)) {
      return numeric;
    }

    const cas = await this.compute.run({ op: 'simplify', expr: e });
    if (cas.ok) {
      if (becameComplex(e, cas.value.expr)) {
        return fail('domain', 'the result is complex (complex numbers are not supported yet)');
      }
      const decimalsFromInput = hasDecimals(input);
      const approx =
        numeric.ok && !isPlainNumber(cas.value.expr) ? formatNumber(numeric.value) : undefined;
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
      const n = formatNumber(numeric.value);
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
