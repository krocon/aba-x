/**
 * Sequences (prompt 035): U1(N) … U0(N), explicit in N or recursive up to order 2 with the start
 * terms U(1), U(2); definitions may refer to other sequences. Values are computed on demand with a
 * memo; a sequence that needs itself at the same or a later index is reported, never looped.
 */
import type { Expr } from '../ast/nodes';
import { evaluateNumeric, type NumericScope } from '../numeric/evaluate';
import { type MathResult, fail, ok } from '../result';

export interface SequenceDef {
  name: string;
  expr: Expr | null;
  /** start terms U(1), U(2) (undefined = not given) */
  start: readonly (number | undefined)[];
}

export const MAX_N = 100000;

class SeqError extends Error {}

export class SequenceSystem {
  private readonly memo = new Map<string, Map<number, number>>();
  private readonly busy = new Set<string>();
  private readonly defs: Map<string, SequenceDef>;

  constructor(
    defs: readonly SequenceDef[],
    private readonly scope: NumericScope = {},
  ) {
    this.defs = new Map(defs.map((d) => [d.name, d]));
  }

  value(name: string, n: number): MathResult<number> {
    try {
      return ok(this.at(name, n));
    } catch (e) {
      if (e instanceof SeqError) return fail('not-evaluable', e.message);
      throw e;
    }
  }

  private at(name: string, n: number): number {
    const d = this.defs.get(name);
    if (!d) throw new SeqError(`unknown sequence ${name}`);
    if (!Number.isInteger(n) || n < 1)
      throw new SeqError(`${name}(${n}): N must be an integer ≥ 1`);
    if (n > MAX_N) throw new SeqError(`${name}: N above ${MAX_N}`);
    const m = this.memo.get(name) ?? new Map<number, number>();
    this.memo.set(name, m);
    const known = m.get(n);
    if (known !== undefined) return known;
    const s = d.start[n - 1];
    if (s !== undefined) {
      m.set(n, s);
      return s;
    }
    if (!d.expr) throw new SeqError(`${name} has no definition`);
    // fill from below so that deep recursions do not overflow the stack
    for (let k = 1; k < n; k++)
      if (!m.has(k) && (d.start[k - 1] !== undefined || k > d.start.length))
        this.direct(name, d, k, m);
    return this.direct(name, d, n, m);
  }

  private direct(name: string, d: SequenceDef, n: number, m: Map<number, number>): number {
    const known = m.get(n);
    if (known !== undefined) return known;
    const s = d.start[n - 1];
    if (s !== undefined) {
      m.set(n, s);
      return s;
    }
    const key = `${name}:${n}`;
    if (this.busy.has(key)) throw new SeqError(`${name}(${n}) refers to itself`);
    this.busy.add(key);
    try {
      const resolved = this.resolve(d.expr!, n, name);
      const r = evaluateNumeric(resolved, {
        ...this.scope,
        variables: new Map([...(this.scope.variables ?? []), ['N', n]]),
      });
      if (!r.ok) throw new SeqError(`${name}(${n}): ${r.error.message}`);
      m.set(n, r.value);
      return r.value;
    } finally {
      this.busy.delete(key);
    }
  }

  /** Replaces calls U(k) by their values (k evaluated at the current N). */
  private resolve(e: Expr, n: number, self: string): Expr {
    const go = (x: Expr): Expr => {
      switch (x.type) {
        case 'call': {
          if (!this.defs.has(x.name)) return { ...x, args: x.args.map(go) };
          if (x.args.length !== 1) throw new SeqError(`${x.name} takes one argument`);
          const k = evaluateNumeric(go(x.args[0]), {
            ...this.scope,
            variables: new Map([['N', n]]),
          });
          if (!k.ok) throw new SeqError(k.error.message);
          const idx = Math.round(k.value);
          if (Math.abs(idx - k.value) > 1e-9)
            throw new SeqError(`${x.name}(${k.value}): index must be an integer`);
          if (x.name === self && idx >= n)
            throw new SeqError(`${self}(${n}) refers to ${self}(${idx})`);
          const v = this.at(x.name, idx);
          return v < 0
            ? { type: 'neg', arg: { type: 'num', value: String(-v) } }
            : { type: 'num', value: String(v) };
        }
        case 'neg':
        case 'post':
          return { ...x, arg: go(x.arg) };
        case 'bin':
        case 'rel':
          return { ...x, left: go(x.left), right: go(x.right) };
        default:
          return x;
      }
    };
    return go(e);
  }
}

/**
 * For the cobweb plot: a first-order recursion U(N) = g(U(N−1)) as g, or null when the definition
 * also depends on N or on other terms.
 */
export function cobwebMap(def: SequenceDef): Expr | null {
  let fine = true;
  const go = (x: Expr): Expr => {
    switch (x.type) {
      case 'sym':
        if (x.name === 'N') fine = false;
        return x;
      case 'call': {
        if (x.name !== def.name) return { ...x, args: x.args.map(go) };
        const a = x.args[0];
        const isNm1 =
          a?.type === 'bin' &&
          a.op === '-' &&
          a.left.type === 'sym' &&
          a.left.name === 'N' &&
          a.right.type === 'num' &&
          a.right.value === '1';
        if (!isNm1) fine = false;
        return { type: 'sym', name: 'X' };
      }
      case 'neg':
      case 'post':
        return { ...x, arg: go(x.arg) };
      case 'bin':
      case 'rel':
        return { ...x, left: go(x.left), right: go(x.right) };
      default:
        return x;
    }
  };
  if (!def.expr) return null;
  const g = go(def.expr);
  return fine ? g : null;
}
