import { describe, expect, it } from 'vitest';
import { analyzeLinearSystem } from './linear-system';

describe('analyzeLinearSystem', () => {
  it('finds the unique solution of a 3×3 system', () => {
    const r = analyzeLinearSystem(
      [
        [2, 1, -1],
        [-3, -1, 2],
        [-2, 1, 2],
      ],
      [8, -11, -3],
    );
    expect(r.ok && r.value.kind).toBe('unique');
    if (r.ok && r.value.kind === 'unique') {
      expect(r.value.x[0]).toBeCloseTo(2, 12);
      expect(r.value.x[1]).toBeCloseTo(3, 12);
      expect(r.value.x[2]).toBeCloseTo(-1, 12);
    }
  });

  it('detects infinitely many solutions with a null-space basis', () => {
    const r = analyzeLinearSystem(
      [
        [1, 1],
        [2, 2],
      ],
      [2, 4],
    );
    expect(r.ok && r.value.kind).toBe('infinite');
    if (r.ok && r.value.kind === 'infinite') {
      expect(r.value.particular).toEqual([2, 0]);
      expect(r.value.free).toEqual([1]);
      expect(r.value.basis).toEqual([[-1, 1]]);
      expect(r.value.rank).toBe(1);
    }
  });

  it('detects an inconsistent system', () => {
    const r = analyzeLinearSystem(
      [
        [1, 1],
        [1, 1],
      ],
      [1, 2],
    );
    expect(r.ok && r.value.kind).toBe('none');
  });

  it('rejects malformed input', () => {
    expect(analyzeLinearSystem([], []).ok).toBe(false);
    expect(analyzeLinearSystem([[1, 2]], [1, 2]).ok).toBe(false);
    expect(analyzeLinearSystem([[NaN]], [1]).ok).toBe(false);
  });
});
