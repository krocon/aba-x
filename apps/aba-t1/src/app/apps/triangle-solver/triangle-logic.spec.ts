import { describe, expect, it } from 'vitest';
import {
  type TriangleState,
  corners,
  initTriangle,
  setGiven,
  shown,
  solve,
} from './triangle-logic';

const given = (g: Partial<TriangleState['given']>, extra: Partial<TriangleState> = {}) => {
  const s = initTriangle();
  return { ...s, given: { ...s.given, ...g }, ...extra };
};

describe('triangle solver logic', () => {
  it('waits for three values', () => {
    expect(solve(given({ a: 3, b: 4 }))).toBeNull();
  });

  it('solves SSS', () => {
    const r = solve(given({ a: 3, b: 4, c: 5 }));
    expect(r?.ok && r.value.case).toBe('SSS');
    const t = shown(initTriangle(), r);
    expect(t?.C).toBeCloseTo(90, 10);
    expect(t?.area).toBeCloseTo(6, 10);
  });

  it('shows both SSA solutions', () => {
    const s = given({ a: 6, b: 8, A: 35 });
    const r = solve(s);
    expect(r?.ok && r.value.triangles.length).toBe(2);
    const t0 = shown(s, r);
    const t1 = shown({ ...s, pick: 1 }, r);
    expect(t0 && t1 && t0.B + t1.B).toBeCloseTo(180, 9);
  });

  it('reports inconsistent data and not enough sides', () => {
    expect(solve(given({ A: 50, B: 60, C: 70 }))?.ok).toBe(false);
    expect(solve(given({ a: 1, b: 1, c: 5 }))?.ok).toBe(false);
  });

  it('solves a right triangle from two values', () => {
    const r = solve(given({ a: 3, b: 4 }, { right: true }));
    expect(r?.ok && r.value.triangles[0].c).toBeCloseTo(5, 12);
    expect(setGiven(initTriangle(), 'a', -1)).toMatch(/positive/);
    expect(typeof setGiven({ ...initTriangle(), right: true }, 'C', 80)).toBe('string');
  });

  it('places the corners', () => {
    const r = solve(given({ a: 3, b: 4, c: 5 }));
    const t = shown(initTriangle(), r)!;
    const [, b, c] = corners(t, 'deg');
    expect(b).toEqual([5, 0]);
    expect(Math.hypot(c[0] - 5, c[1])).toBeCloseTo(3, 10);
  });
});
