import type { Expr } from '../../../math/ast/nodes';
import { STACK_LIMIT, drop, dropN, level, push, swap, top, visibleLevels } from './entry-stack';

const entry = (latex: string) => ({
  expr: { type: 'sym', name: latex } as Expr,
  latex,
  approximate: false,
});

describe('entry-stack', () => {
  const s = push(push([], entry('a'), 1), entry('b'), 2);

  it('pushes onto level 1 and drops it', () => {
    expect(top(s)?.latex).toBe('b');
    expect(level(s, 2)?.latex).toBe('a');
    expect(top(drop(s))?.latex).toBe('a');
    expect(drop([])).toEqual([]);
    expect(dropN(s, 2)).toEqual([]);
  });

  it('swaps levels 1 and 2 without touching the input', () => {
    expect(swap(s).map((e) => e.latex)).toEqual(['b', 'a']);
    expect(s.map((e) => e.latex)).toEqual(['a', 'b']);
    expect(swap([s[0]])).toEqual([s[0]]);
  });

  it('keeps at most STACK_LIMIT entries', () => {
    let big: ReturnType<typeof push> = [];
    for (let i = 0; i < STACK_LIMIT + 5; i++) big = push(big, entry(String(i)), i);
    expect(big.length).toBe(STACK_LIMIT);
    expect(big[0].latex).toBe('5');
  });

  it('lists the visible levels from the top down', () => {
    expect(visibleLevels(s, 3).map((r) => [r.level, r.entry?.latex ?? null])).toEqual([
      [3, null],
      [2, 'a'],
      [1, 'b'],
    ]);
  });
});
