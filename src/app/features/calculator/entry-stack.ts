/**
 * The entry stack shown in the display (level 1 at the bottom, as on RPN calculators).
 * Walking skeleton: entries are the entered expressions; results follow with evaluation.
 * Immutable updates, pure functions.
 */
export interface StackEntry {
  id: number;
  latex: string;
}

export const STACK_LIMIT = 200;

export function push(stack: readonly StackEntry[], latex: string, id: number): StackEntry[] {
  return [...stack, { id, latex }].slice(-STACK_LIMIT);
}

/** Removes level 1. */
export function drop(stack: readonly StackEntry[]): StackEntry[] {
  return stack.slice(0, -1);
}

/** Exchanges levels 1 and 2 (no-op with fewer than two entries). */
export function swap(stack: readonly StackEntry[]): StackEntry[] {
  if (stack.length < 2) return [...stack];
  const s = [...stack];
  [s[s.length - 1], s[s.length - 2]] = [s[s.length - 2], s[s.length - 1]];
  return s;
}

/** Level 1, or null on an empty stack. */
export function top(stack: readonly StackEntry[]): StackEntry | null {
  return stack.at(-1) ?? null;
}

/** The `count` lowest levels for the display, highest level first: `[{level: 4, …}, …, {level: 1, …}]`. */
export function visibleLevels(
  stack: readonly StackEntry[],
  count: number,
): { level: number; entry: StackEntry | null }[] {
  return Array.from({ length: count }, (_, i) => {
    const level = count - i;
    return { level, entry: stack[stack.length - level] ?? null };
  });
}
