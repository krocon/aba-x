import { describe, expect, it } from 'vitest';
import { analyzeLinearSystem } from '@aba/math/linalg/linear-system';
import { describe as describeSolution, initLinear, solveState } from './linear-logic';

describe('linear solver logic', () => {
  it('starts with the 3×3 identity (unique solution 0)', () => {
    const r = solveState(initLinear());
    expect(r.ok && r.value.kind).toBe('unique');
  });

  it('describes a unique solution', () => {
    const s = initLinear();
    s.n = 2;
    s.a[0] = [1, 1, 0, 0, 0, 0];
    s.a[1] = [1, -1, 0, 0, 0, 0];
    s.b[0] = 10;
    s.b[1] = 2;
    const r = solveState(s);
    expect(r.ok && describeSolution(r.value, 2)).toEqual(['x1 = 6', 'x2 = 4']);
  });

  it('describes infinitely many solutions with parameters', () => {
    const r = analyzeLinearSystem(
      [
        [1, 1],
        [2, 2],
      ],
      [2, 4],
    );
    expect(r.ok && describeSolution(r.value, 2)).toEqual(['x1 = 2 − t1', 'x2 = t1']);
  });

  it('has no lines for an inconsistent system', () => {
    const r = analyzeLinearSystem(
      [
        [1, 1],
        [1, 1],
      ],
      [1, 2],
    );
    expect(r.ok && describeSolution(r.value, 2)).toEqual([]);
  });
});
