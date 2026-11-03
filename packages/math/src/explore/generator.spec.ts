import { describe, expect, it } from 'vitest';
import { PARAMS, clampParam, facts, matches, rng, task } from './generator';

describe('explorer', () => {
  it('describes the families', () => {
    expect(facts('linear', [2, -3]).latex).toBe('y=2x-3');
    const q = facts('quadratic', [1, 2, -4]);
    expect(q.details).toEqual(['y = 1x²-4x+0', 'S(2 | -4)', 'D = 16', 'x₁ = 0', 'x₂ = 4']);
    expect(facts('quadratic', [1, 0, 1]).details).toContain('no real roots');
    expect(facts('trig', [2, 2, 0, 1]).details[1]).toBe(`period ${Number(Math.PI.toFixed(6))}`);
  });

  it('keeps parameters on the grid, never a degenerate a or b', () => {
    expect(clampParam('quadratic', 0, 0.2)).toBe(0.5);
    expect(clampParam('linear', 1, 99)).toBe(8);
    expect(clampParam('trig', 1, 0)).toBe(0.5);
  });

  it('generates reproducible nice tasks within the ranges', () => {
    const a = task('quadratic', rng(42));
    expect(task('quadratic', rng(42))).toEqual(a);
    for (let s = 1; s < 50; s++) {
      for (const kind of ['linear', 'quadratic', 'trig'] as const) {
        task(kind, rng(s)).forEach((v, i) => {
          const d = PARAMS[kind][i];
          expect(v).toBeGreaterThanOrEqual(d.min);
          expect(v).toBeLessThanOrEqual(d.max);
          expect(Math.abs(v / d.step - Math.round(v / d.step))).toBeLessThan(1e-9);
        });
      }
    }
  });

  it('checks answers by the graph', () => {
    expect(matches('trig', [1, 1, 0, 0], [1, 1, 2 * Math.PI, 0])).toBe(true);
    expect(matches('linear', [1, 0], [1, 1])).toBe(false);
  });
});
