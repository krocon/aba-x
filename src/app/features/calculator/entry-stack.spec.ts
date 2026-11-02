import { STACK_LIMIT, drop, push, swap, top, visibleLevels } from './entry-stack';

describe('entry-stack', () => {
  const s = push(push([], 'a', 1), 'b', 2);

  it('pushes onto level 1 and drops it', () => {
    expect(top(s)?.latex).toBe('b');
    expect(top(drop(s))?.latex).toBe('a');
    expect(drop([])).toEqual([]);
  });

  it('swaps levels 1 and 2 without touching the input', () => {
    expect(swap(s).map((e) => e.latex)).toEqual(['b', 'a']);
    expect(s.map((e) => e.latex)).toEqual(['a', 'b']);
    expect(swap([{ id: 1, latex: 'x' }])).toEqual([{ id: 1, latex: 'x' }]);
  });

  it('keeps at most STACK_LIMIT entries', () => {
    let big: ReturnType<typeof push> = [];
    for (let i = 0; i < STACK_LIMIT + 5; i++) big = push(big, String(i), i);
    expect(big.length).toBe(STACK_LIMIT);
    expect(big[0].latex).toBe('5');
  });

  it('lists the visible levels from the top down', () => {
    expect(visibleLevels(s, 3)).toEqual([
      { level: 3, entry: null },
      { level: 2, entry: { id: 1, latex: 'a' } },
      { level: 1, entry: { id: 2, latex: 'b' } },
    ]);
  });
});
