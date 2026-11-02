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
  /** What was typed (LaTeX, for HIST). */
  readonly input?: string;
  /** Plain text of the result for the screen reader and the clipboard. */
  readonly text?: string;
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

/**
 * `count` levels for the display, highest first. Normally levels count…1; while a level above the
 * window is selected, the window scrolls so that it stays visible.
 */
export function visibleLevels(
  stack: readonly StackEntry[],
  count: number,
  selected: number | null = null,
): { level: number; entry: StackEntry | null }[] {
  const offset = selected !== null && selected > count ? selected - count : 0;
  return Array.from({ length: count }, (_, i) => {
    const lv = count - i + offset;
    return { level: lv, entry: level(stack, lv) };
  });
}

/** Moves a selection by delta within 1…size; null stays null. */
export function moveSelection(selected: number | null, delta: number, size: number): number | null {
  if (selected === null || size === 0) return null;
  return Math.min(size, Math.max(1, selected + delta));
}

/** Removes level n. */
export function dropLevel(stack: readonly StackEntry[], n: number): StackEntry[] {
  const i = stack.length - n;
  return i < 0 ? [...stack] : [...stack.slice(0, i), ...stack.slice(i + 1)];
}
