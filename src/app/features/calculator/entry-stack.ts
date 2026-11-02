/**
 * The entry stack shown in the display (level 1 at the bottom, as on RPN calculators). Each entry
 * holds a result: its AST (for Ans and stack operations), LaTeX and an optional approximation.
 * Immutable updates, pure functions.
 */
import type { Expr } from '../../../math/ast/nodes';

export interface StackEntry {
  readonly id: number;
  readonly expr: Expr;
  readonly latex: string;
  /** "≈ …" line (LaTeX of the decimal value), when the result is not a plain number. */
  readonly approx?: string;
  /** The result is itself an approximation. */
  readonly approximate: boolean;
  /** What was typed (for HIST and the screen reader). */
  readonly input?: string;
}

export type NewEntry = Omit<StackEntry, 'id'>;

export const STACK_LIMIT = 200;

export function push(stack: readonly StackEntry[], entry: NewEntry, id: number): StackEntry[] {
  return [...stack, { ...entry, id }].slice(-STACK_LIMIT);
}

/** Removes level 1. */
export function drop(stack: readonly StackEntry[]): StackEntry[] {
  return stack.slice(0, -1);
}

/** Removes the `n` lowest levels. */
export function dropN(stack: readonly StackEntry[], n: number): StackEntry[] {
  return stack.slice(0, Math.max(0, stack.length - n));
}

/** Exchanges levels 1 and 2 (no-op with fewer than two entries). */
export function swap(stack: readonly StackEntry[]): StackEntry[] {
  if (stack.length < 2) return [...stack];
  const s = [...stack];
  [s[s.length - 1], s[s.length - 2]] = [s[s.length - 2], s[s.length - 1]];
  return s;
}

/** Level n (1 = bottom), or null. */
export function level(stack: readonly StackEntry[], n: number): StackEntry | null {
  return stack[stack.length - n] ?? null;
}

/** Level 1, or null on an empty stack. */
export function top(stack: readonly StackEntry[]): StackEntry | null {
  return level(stack, 1);
}

/** The `count` lowest levels for the display, highest level first: `[{level: 4, …}, …, {level: 1, …}]`. */
export function visibleLevels(
  stack: readonly StackEntry[],
  count: number,
): { level: number; entry: StackEntry | null }[] {
  return Array.from({ length: count }, (_, i) => {
    const lv = count - i;
    return { level: lv, entry: level(stack, lv) };
  });
}
