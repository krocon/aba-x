/**
 * RPN stack of the ABA-T1 home view (prompt 028), pure and immutable. Level 1 is the last array
 * element. Operations take their arguments from the stack and push the result; errors leave the
 * stack unchanged. ABA-X1 keeps its own stack of exact expressions (different semantics).
 */
import type { Expr } from '../ast/nodes';
import { type MathResult, fail, ok } from '../result';
import { type ValueScope, evaluateValue } from '../value/evaluate-value';
import type { Value } from '../value/value';

export type Stack = readonly Value[];

const tooFew = (n: number) =>
  fail<Stack>('syntax', `needs ${n} argument${n === 1 ? '' : 's'} on the stack`);
const badLevel = (n: number, size: number) =>
  fail<Stack>('domain', `level ${n} does not exist (stack has ${size})`);

/** Level n (1 = bottom) → array index. */
const at = (s: Stack, n: number) => s.length - n;

export function push(s: Stack, v: Value): Stack {
  return [...s, v];
}

export function level(s: Stack, n: number): Value | undefined {
  return n >= 1 && n <= s.length ? s[at(s, n)] : undefined;
}

export function drop(s: Stack): MathResult<Stack> {
  return s.length ? ok(s.slice(0, -1)) : tooFew(1);
}

export function dup(s: Stack): MathResult<Stack> {
  return s.length ? ok([...s, s[s.length - 1]]) : tooFew(1);
}

export function swap(s: Stack): MathResult<Stack> {
  if (s.length < 2) return tooFew(2);
  return ok([...s.slice(0, -2), s[s.length - 1], s[s.length - 2]]);
}

/** PICK n: copies level n to level 1. */
export function pick(s: Stack, n: number): MathResult<Stack> {
  const v = level(s, n);
  return v ? ok([...s, v]) : badLevel(n, s.length);
}

/** ROLL n: moves level n to level 1 (the levels below move up). */
export function roll(s: Stack, n: number): MathResult<Stack> {
  if (n < 1 || n > s.length) return badLevel(n, s.length);
  const i = at(s, n);
  return ok([...s.slice(0, i), ...s.slice(i + 1), s[i]]);
}

/** ROLLD n: moves level 1 to level n. */
export function rollDown(s: Stack, n: number): MathResult<Stack> {
  if (n < 1 || n > s.length) return badLevel(n, s.length);
  const top = s[s.length - 1];
  const rest = s.slice(0, -1);
  const i = rest.length - (n - 1);
  return ok([...rest.slice(0, i), top, ...rest.slice(i)]);
}

/** DROPN n: removes levels 1…n. */
export function dropN(s: Stack, n: number): MathResult<Stack> {
  if (n < 1 || n > s.length) return badLevel(n, s.length);
  return ok(s.slice(0, s.length - n));
}

/** Names of the stack arguments inside an operation (cannot clash with user names). */
const ARG = (k: number) => `$${k}`;
const sym = (k: number): Expr => ({ type: 'sym', name: ARG(k) });

/** How an operation is built from its arguments (`$1` = the deepest of them). */
export type Operation =
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^' }
  | { kind: 'call'; name: string; arity: number }
  | { kind: 'neg' }
  | { kind: 'post'; op: '!' | '%' }
  /** an expression of `$1 … $n`, e.g. x² = `$1^2`, 1/x = `1/$1` */
  | { kind: 'expr'; arity: number; build: (args: Expr[]) => Expr };

export function arity(op: Operation): number {
  switch (op.kind) {
    case 'binary':
      return 2;
    case 'neg':
    case 'post':
      return 1;
    default:
      return op.arity;
  }
}

/** Applies an operation to the top levels; the result replaces them. */
export function apply(s: Stack, op: Operation, scope: ValueScope = {}): MathResult<Stack> {
  const n = arity(op);
  if (s.length < n) return tooFew(n);
  const args = s.slice(s.length - n);
  const syms = args.map((_, k) => sym(k + 1));
  const expr: Expr =
    op.kind === 'binary'
      ? { type: 'bin', op: op.op, left: syms[0], right: syms[1] }
      : op.kind === 'call'
        ? { type: 'call', name: op.name, args: syms }
        : op.kind === 'neg'
          ? { type: 'neg', arg: syms[0] }
          : op.kind === 'post'
            ? { type: 'post', op: op.op, arg: syms[0] }
            : op.build(syms);
  const variables = new Map(scope.variables ?? []);
  args.forEach((v, k) => variables.set(ARG(k + 1), v));
  const r = evaluateValue(expr, { ...scope, variables });
  return r.ok ? ok([...s.slice(0, s.length - n), r.value]) : r;
}
