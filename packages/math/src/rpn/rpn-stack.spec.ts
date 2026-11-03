import { describe, expect, it } from 'vitest';
import { complex, real } from '../value/value';
import { apply, drop, dropN, dup, pick, roll, rollDown, swap, type Stack } from './rpn-stack';

const s = (...xs: number[]): Stack => xs.map(real);
const nums = (r: { ok: boolean; value?: Stack }) =>
  r.ok ? (r.value as Stack).map((v) => (v.kind === 'real' ? v.v : NaN)) : 'error';

describe('RPN stack', () => {
  it.each([
    ['drop', drop(s(1, 2, 3)), [1, 2]],
    ['dup', dup(s(1, 2)), [1, 2, 2]],
    ['swap', swap(s(1, 2, 3)), [1, 3, 2]],
    ['pick 3', pick(s(1, 2, 3), 3), [1, 2, 3, 1]],
    ['roll 3', roll(s(1, 2, 3), 3), [2, 3, 1]],
    ['roll 1', roll(s(1, 2, 3), 1), [1, 2, 3]],
    ['rollDown 3', rollDown(s(1, 2, 3), 3), [3, 1, 2]],
    ['rollDown 2', rollDown(s(1, 2, 3), 2), [1, 3, 2]],
    ['dropN 2', dropN(s(1, 2, 3), 2), [1]],
  ])('%s', (_, r, want) => expect(nums(r)).toEqual(want));

  it('roll and rollDown undo each other', () => {
    const st = s(5, 6, 7, 8);
    for (let n = 1; n <= 4; n++) {
      const r = roll(st, n);
      expect(r.ok && nums(rollDown(r.value, n))).toEqual([5, 6, 7, 8]);
    }
  });

  it('reports missing arguments and bad levels, stack unchanged', () => {
    expect(drop([]).ok).toBe(false);
    expect(swap(s(1)).ok).toBe(false);
    expect(pick(s(1, 2), 3)).toMatchObject({ ok: false, error: { code: 'domain' } });
    expect(roll(s(1), 0).ok).toBe(false);
    expect(dropN(s(1), 2).ok).toBe(false);
  });

  it('applies operations to the top levels', () => {
    expect(nums(apply(s(9, 3, 4), { kind: 'binary', op: '+' }))).toEqual([9, 7]);
    expect(nums(apply(s(2, 3), { kind: 'binary', op: '^' }))).toEqual([8]);
    expect(nums(apply(s(10, 4), { kind: 'binary', op: '-' }))).toEqual([6]);
    expect(nums(apply(s(30), { kind: 'call', name: 'sin', arity: 1 }, { angle: 'deg' }))).toEqual([
      0.5,
    ]);
    expect(nums(apply(s(5), { kind: 'post', op: '!' }))).toEqual([120]);
    expect(
      nums(
        apply(s(4), {
          kind: 'expr',
          arity: 1,
          build: ([x]) => ({ type: 'bin', op: '/', left: { type: 'num', value: '1' }, right: x }),
        }),
      ),
    ).toEqual([0.25]);
    expect(apply(s(1, 0), { kind: 'binary', op: '/' })).toMatchObject({
      ok: false,
      error: { code: 'division-by-zero' },
    });
    expect(apply(s(1), { kind: 'binary', op: '+' })).toMatchObject({ ok: false });
    expect(apply([complex(0, 1), complex(0, 1)], { kind: 'binary', op: '*' })).toEqual({
      ok: true,
      value: [real(-1)],
    });
  });
});
