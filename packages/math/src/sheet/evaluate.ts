/**
 * Evaluation of one compiled formula (prompt 041). Sheet functions (SUM, IF, …) are evaluated here,
 * innermost first, and replaced by bound symbols; the rest goes to the value evaluator with the
 * references bound as variables. IF/IFERROR are lazy: only the chosen branch is evaluated.
 *
 * References as values: a cell is its value (empty = 0, text = #VALUE!, an error propagates); a
 * range of one row or one column is a list in reading order; a 2-D range is a matrix (real entries
 * only). Whole columns/rows are clipped to the used area. Sheet functions read ranges directly and
 * skip empty and text cells (COUNTA counts them). Errors are values, never exceptions. Pure.
 */
import type { Expr } from '../ast/nodes';
import type { AngleMode } from '../numeric/evaluate';
import type { MathErrorCode } from '../result';
import { evaluateValue } from '../value/evaluate-value';
import { type Value, list, matrix, real } from '../value/value';
import { type CompiledFormula, REF_PREFIX, SHEET_FUNCTIONS } from './formula';
import { type Rect, type Ref, colName, refRect } from './refs';

export type SheetErrorCode = MathErrorCode | 'cycle' | 'ref' | 'value' | 'name';

export interface SheetError {
  readonly code: SheetErrorCode;
  readonly message: string;
}

/** The value of a cell. */
export type CellValue =
  | { readonly kind: 'empty' }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly value: Value }
  | { readonly kind: 'error'; readonly error: SheetError };

export const EMPTY: CellValue = { kind: 'empty' };

export const errorValue = (code: SheetErrorCode, message: string): CellValue => ({
  kind: 'error',
  error: { code, message },
});

/** Short label of an error in a cell: `#DIV/0!`, `#CYCLE!`, `#REF!`, `#VALUE!`, `#NAME?` … */
export function errorLabel(code: SheetErrorCode): string {
  switch (code) {
    case 'division-by-zero':
      return '#DIV/0!';
    case 'cycle':
      return '#CYCLE!';
    case 'ref':
      return '#REF!';
    case 'value':
      return '#VALUE!';
    case 'name':
    case 'unknown-symbol':
    case 'unknown-function':
      return '#NAME?';
    case 'syntax':
      return '#SYNTAX!';
    case 'domain':
    case 'no-convergence':
      return '#NUM!';
    default:
      return '#N/A';
  }
}

/** What a formula sees of its sheet. */
export interface EvalContext {
  cell(row: number, col: number): CellValue;
  /** target of a name; undefined = no such name, null = its cells were deleted */
  name(name: string): Ref | null | undefined;
  /** size of the used area (rows, cols): the bounds of whole-column/row ranges */
  used(): { readonly rows: number; readonly cols: number };
  /** variables of other views (home) for identifiers that are no sheet name */
  variable?(name: string): Value | undefined;
  readonly angle?: AngleMode;
  readonly complexResults?: boolean;
}

class SheetFail extends Error {
  constructor(readonly error: SheetError) {
    super(error.message);
  }
}

const raise = (code: SheetErrorCode, message: string): never => {
  throw new SheetFail({ code, message });
};

/** A copy of `e` with `f` applied to its direct sub-expressions. */
function mapChildren(e: Expr, f: (x: Expr) => Expr): Expr {
  switch (e.type) {
    case 'num':
    case 'sym':
      return e;
    case 'neg':
    case 'post':
      return { ...e, arg: f(e.arg) };
    case 'bin':
    case 'rel':
      return { ...e, left: f(e.left), right: f(e.right) };
    case 'call':
      return { ...e, args: e.args.map(f) };
    case 'deriv':
      return { ...e, expr: f(e.expr) };
    case 'int':
      return {
        ...e,
        expr: f(e.expr),
        lower: e.lower && f(e.lower),
        upper: e.upper && f(e.upper),
      };
    case 'series':
      return { ...e, expr: f(e.expr), lower: f(e.lower), upper: f(e.upper) };
    case 'limit':
      return { ...e, expr: f(e.expr), to: f(e.to) };
    case 'list':
      return { ...e, items: e.items.map(f) };
    case 'matrix':
      return { ...e, rows: e.rows.map((r) => r.map(f)) };
  }
}

function symbols(e: Expr, out = new Set<string>()): Set<string> {
  if (e.type === 'sym') out.add(e.name);
  else mapChildren(e, (x) => (symbols(x, out), x));
  return out;
}

const LIFTED = 'ℱ';

/** Numbers of an aggregate and how many non-empty cells it saw. */
interface Collected {
  nums: number[];
  nonEmpty: number;
}

class FormulaEvaluator {
  private readonly lifted = new Map<string, Value>();

  constructor(
    private readonly f: CompiledFormula,
    private readonly ctx: EvalContext,
  ) {}

  run(): CellValue {
    try {
      return { kind: 'value', value: this.value(this.f.expr) };
    } catch (x) {
      if (x instanceof SheetFail) return { kind: 'error', error: x.error };
      throw x;
    }
  }

  /** The reference behind a symbol: a placeholder or a defined name (undefined = neither). */
  private refOf(name: string): Ref | null | undefined {
    if (name.startsWith(REF_PREFIX)) {
      const k = Number(name.slice(REF_PREFIX.length));
      if (Number.isInteger(k) && k < this.f.refs.length) return this.f.refs[k];
    }
    return this.f.names.includes(name) ? this.ctx.name(name) : undefined;
  }

  value(e: Expr): Value {
    const lifted = this.lift(e);
    const variables = new Map(this.lifted);
    for (const s of symbols(lifted)) {
      const ref = this.refOf(s);
      if (ref !== undefined) variables.set(s, this.refValue(ref));
      else if (this.f.names.includes(s)) {
        const x = this.ctx.variable?.(s);
        if (x) variables.set(s, x);
      }
    }
    const r = evaluateValue(lifted, {
      variables,
      angle: this.ctx.angle,
      complexResults: this.ctx.complexResults,
    });
    return r.ok ? r.value : raise(r.error.code, r.error.message);
  }

  /** Sheet function calls → bound symbols (evaluated innermost first, IF lazily). */
  private lift(e: Expr): Expr {
    if (e.type === 'call' && e.name in SHEET_FUNCTIONS) {
      const v = this.sheetCall(e.name, e.args);
      const name = `${LIFTED}${this.lifted.size}`;
      this.lifted.set(name, v);
      return { type: 'sym', name };
    }
    return mapChildren(e, (x) => this.lift(x));
  }

  private rect(ref: Ref): Rect {
    const q = refRect(ref);
    if (ref.kind !== 'cols' && ref.kind !== 'rows') return q;
    const u = this.ctx.used();
    return { ...q, r1: Math.min(q.r1, u.rows - 1), c1: Math.min(q.c1, u.cols - 1) };
  }

  private scalar(row: number, col: number): Value {
    const c = this.ctx.cell(row, col);
    switch (c.kind) {
      case 'empty':
        return real(0);
      case 'text':
        return raise('value', `${colName(col)}${row + 1} is text`);
      case 'error':
        throw new SheetFail(c.error);
      case 'value':
        return c.value;
    }
  }

  private refValue(ref: Ref | null): Value {
    if (!ref) return raise('ref', 'the referenced cells were deleted');
    if (ref.kind === 'cell') return this.scalar(ref.cell.row, ref.cell.col);
    const q = this.rect(ref);
    if (q.r1 < q.r0 || q.c1 < q.c0) return list([]);
    if (q.r0 === q.r1 || q.c0 === q.c1) {
      const items: Value[] = [];
      for (let r = q.r0; r <= q.r1; r++) {
        for (let c = q.c0; c <= q.c1; c++) items.push(this.scalar(r, c));
      }
      return list(items);
    }
    const rows: number[][] = [];
    for (let r = q.r0; r <= q.r1; r++) {
      const row: number[] = [];
      for (let c = q.c0; c <= q.c1; c++) {
        const v = this.scalar(r, c);
        row.push(v.kind === 'real' ? v.v : raise('value', 'a 2-D range needs real numbers'));
      }
      rows.push(row);
    }
    return matrix(rows);
  }

  private truth(e: Expr): boolean {
    const v = this.value(e);
    if (v.kind === 'real') return v.v !== 0;
    if (v.kind === 'int') return v.v !== '0';
    return raise('value', 'a condition must be a real number');
  }

  private realArg(e: Expr, what: string): number {
    const v = this.value(e);
    return v.kind === 'real' ? v.v : raise('value', `${what} needs a real number`);
  }

  /** Numbers of the arguments: ranges cell by cell (text/empty skipped), others as values. */
  private collect(args: readonly Expr[], skipErrors: boolean): Collected {
    const out: Collected = { nums: [], nonEmpty: 0 };
    const push = (v: Value) => {
      out.nonEmpty++;
      if (v.kind === 'real') out.nums.push(v.v);
      else if (v.kind === 'int') out.nums.push(Number(v.v));
      else if (v.kind === 'list') {
        out.nonEmpty--;
        v.items.forEach(push);
      } else if (v.kind === 'matrix') {
        out.nonEmpty += v.rows.length * (v.rows[0]?.length ?? 0) - 1;
        for (const r of v.rows) out.nums.push(...r);
      } else if (!skipErrors) raise('value', 'only real numbers can be aggregated');
    };
    for (const a of args) {
      const ref = a.type === 'sym' ? this.refOf(a.name) : undefined;
      if (ref === undefined) {
        try {
          push(this.value(a));
        } catch (x) {
          if (!(skipErrors && x instanceof SheetFail)) throw x;
          out.nonEmpty++;
        }
        continue;
      }
      if (!ref) {
        if (skipErrors) continue;
        raise('ref', 'the referenced cells were deleted');
      }
      const q = this.rect(ref!);
      for (let r = q.r0; r <= q.r1; r++) {
        for (let c = q.c0; c <= q.c1; c++) {
          const cell = this.ctx.cell(r, c);
          if (cell.kind === 'empty') continue;
          if (cell.kind === 'text') out.nonEmpty++;
          else if (cell.kind === 'error') {
            if (!skipErrors) throw new SheetFail(cell.error);
            out.nonEmpty++;
          } else push(cell.value);
        }
      }
    }
    return out;
  }

  private sheetCall(name: string, args: readonly Expr[]): Value {
    const [min, max] = SHEET_FUNCTIONS[name];
    if (args.length < min || args.length > max) {
      raise('syntax', `${name} takes ${min === max ? min : `${min} to ${max}`} argument(s)`);
    }
    switch (name) {
      case 'IF':
        if (this.truth(args[0])) return this.value(args[1]);
        return args[2] ? this.value(args[2]) : real(0);
      case 'IFERROR':
        try {
          return this.value(args[0]);
        } catch (x) {
          if (x instanceof SheetFail) return this.value(args[1]);
          throw x;
        }
      case 'NOT':
        return real(this.truth(args[0]) ? 0 : 1);
      case 'AND':
      case 'OR': {
        const { nums } = this.collect(args, false);
        if (!nums.length) return raise('value', `${name} needs at least one value`);
        const t = name === 'AND' ? nums.every((x) => x !== 0) : nums.some((x) => x !== 0);
        return real(t ? 1 : 0);
      }
      case 'ROUND': {
        const x = this.realArg(args[0], 'ROUND');
        const n = args[1] ? this.realArg(args[1], 'ROUND') : 0;
        if (!Number.isInteger(n) || Math.abs(n) > 15)
          return raise('domain', 'ROUND: digits 0 … 15');
        return real(roundHalfAway(x, n));
      }
    }
    const skip = name === 'COUNT' || name === 'COUNTA';
    const { nums, nonEmpty } = this.collect(args, skip);
    const n = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    switch (name) {
      case 'SUM':
        return real(sum);
      case 'PRODUCT':
        return real(n ? nums.reduce((a, b) => a * b, 1) : 0);
      case 'COUNT':
        return real(n);
      case 'COUNTA':
        return real(nonEmpty);
      case 'MIN':
        return real(n ? Math.min(...nums) : 0);
      case 'MAX':
        return real(n ? Math.max(...nums) : 0);
      case 'AVERAGE':
        return n ? real(sum / n) : raise('division-by-zero', 'AVERAGE of no numbers');
      case 'MEDIAN': {
        if (!n) return raise('value', 'MEDIAN of no numbers');
        const s = [...nums].sort((a, b) => a - b);
        return real(n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2);
      }
      default: {
        // VAR, STDEV: sample variance / standard deviation
        if (n < 2) return raise('division-by-zero', `${name} needs at least two numbers`);
        const mean = sum / n;
        const v = nums.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
        return real(name === 'VAR' ? v : Math.sqrt(v));
      }
    }
  }
}

/** `v`·10^k without binary noise (decimal shift of the shortest representation). */
function shift(v: number, k: number): number {
  const [m, e] = v.toExponential().split('e');
  return Number(`${m}e${Number(e) + k}`);
}

/** Rounds half away from zero at `d` decimals (negative `d` = tens, hundreds …): 2.675 → 2.68. */
export function roundHalfAway(x: number, d: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const r = shift(Math.round(shift(Math.abs(x), d)), -d);
  return Math.sign(x) * r || 0;
}

/** The value of a compiled formula in its sheet. */
export function evaluateFormula(f: CompiledFormula, ctx: EvalContext): CellValue {
  return new FormulaEvaluator(f, ctx).run();
}
