import { describe, expect, it } from 'vitest';
import { type Triangle, solveRightTriangle, solveTriangle, triangleArea } from './triangle';

const val = <T>(r: { ok: boolean; value?: T; error?: { message: string } }) => {
  if (!r.ok) throw new Error(`not ok: ${r.error?.message}`);
  return r.value as T;
};
const deg = (x: number) => (x * 180) / Math.PI;
const close = (t: Triangle, e: Partial<Triangle>, digits = 9) => {
  for (const [k, v] of Object.entries(e)) expect(t[k as keyof Triangle]).toBeCloseTo(v, digits);
};
const A345 = deg(Math.atan2(3, 4));
const B345 = deg(Math.atan2(4, 3));

describe('solveTriangle', () => {
  it('SSS: 3-4-5', () => {
    const r = val(solveTriangle({ a: 3, b: 4, c: 5 }));
    expect(r.case).toBe('SSS');
    expect(r.triangles).toHaveLength(1);
    close(r.triangles[0], { A: A345, B: B345, C: 90, area: 6, perimeter: 12 });
  });

  it('SSS: equilateral and in radians', () => {
    const r = val(solveTriangle({ a: 2, b: 2, c: 2 }, { unit: 'rad' }));
    close(r.triangles[0], { A: Math.PI / 3, B: Math.PI / 3, C: Math.PI / 3, area: Math.sqrt(3) });
  });

  it('SAS', () => {
    const r = val(solveTriangle({ b: 4, c: 3, A: 90 }));
    expect(r.case).toBe('SAS');
    close(r.triangles[0], { a: 5, B: B345, C: A345, area: 6 });
    // obtuse included angle: law of cosines a² = 25 + 64 − 80·cos 120° = 129
    const o = val(solveTriangle({ a: 5, b: 8, C: 120 }));
    close(o.triangles[0], { c: Math.sqrt(129), area: 20 * Math.sin(Math.PI * (2 / 3)) });
    expect(o.triangles[0].A + o.triangles[0].B).toBeCloseTo(60, 10);
  });

  it('ASA and AAS', () => {
    const asa = val(solveTriangle({ A: 30, B: 60, c: 2 }));
    expect(asa.case).toBe('ASA');
    close(asa.triangles[0], { a: 1, b: Math.sqrt(3), C: 90 });
    const aas = val(solveTriangle({ A: 30, B: 60, a: 1 }));
    expect(aas.case).toBe('AAS');
    close(aas.triangles[0], { b: Math.sqrt(3), c: 2, C: 90 });
  });

  it('SSA with two solutions (a = 6, b = 8, A = 40°)', () => {
    const r = val(solveTriangle({ a: 6, b: 8, A: 40 }));
    expect(r.case).toBe('SSA');
    expect(r.triangles).toHaveLength(2);
    const B1 = deg(Math.asin((8 * Math.sin((40 * Math.PI) / 180)) / 6));
    expect(B1).toBeCloseTo(58.99, 2);
    close(r.triangles[0], { B: B1, C: 180 - 40 - B1 });
    close(r.triangles[1], { B: 180 - B1, C: B1 - 40 });
    expect(r.triangles[1].B).toBeCloseTo(121.01, 2);
    for (const t of r.triangles) {
      // law of sines and the given values hold in both
      expect(t.a / Math.sin((t.A * Math.PI) / 180)).toBeCloseTo(
        t.c / Math.sin((t.C * Math.PI) / 180),
        9,
      );
      expect(t.a).toBe(6);
      expect(t.b).toBe(8);
    }
  });

  it('SSA with one solution (opposite side longer) and the right-angle case', () => {
    const one = val(solveTriangle({ a: 10, b: 8, A: 40 }));
    expect(one.triangles).toHaveLength(1);
    const right = val(solveTriangle({ a: 1, c: 2, A: 30 }));
    expect(right.triangles).toHaveLength(1);
    close(right.triangles[0], { C: 90, b: Math.sqrt(3) }, 6);
  });

  it('SSA without a solution', () => {
    const r = val(solveTriangle({ a: 3, b: 8, A: 40 }));
    expect(r.triangles).toEqual([]);
    // obtuse angle opposite the shorter side
    expect(val(solveTriangle({ a: 5, b: 8, A: 100 })).triangles).toEqual([]);
    expect(val(solveTriangle({ a: 5, b: 5, A: 90 })).triangles).toEqual([]);
  });

  it('checks the consistency of more than three values', () => {
    const r = val(solveTriangle({ a: 3, b: 4, c: 5, C: 90 }));
    expect(r.triangles).toHaveLength(1);
    expect(solveTriangle({ a: 3, b: 4, c: 5, C: 80 }).ok).toBe(false);
    const all = val(solveTriangle({ a: 3, b: 4, c: 5, A: A345, B: B345, C: 90 }));
    expect(all.triangles).toHaveLength(1);
    expect(solveTriangle({ A: 30, B: 60, C: 100, a: 1 }).ok).toBe(false);
    expect(val(solveTriangle({ A: 30, B: 60, C: 90, a: 1 })).triangles).toHaveLength(1);
    // an extra value picks one of the two SSA solutions
    const B1 = deg(Math.asin((8 * Math.sin((40 * Math.PI) / 180)) / 6));
    const pick = val(solveTriangle({ a: 6, b: 8, A: 40, B: 180 - B1 }));
    expect(pick.triangles).toHaveLength(1);
    expect(pick.triangles[0].B).toBeCloseTo(180 - B1, 9);
  });

  it('rejects invalid input', () => {
    const code = (r: ReturnType<typeof solveTriangle>) => (r.ok ? 'ok' : r.error.code);
    expect(code(solveTriangle({ a: 1, b: 2 }))).toBe('not-solvable');
    expect(code(solveTriangle({ A: 50, B: 60, C: 70 }))).toBe('not-solvable');
    expect(code(solveTriangle({ a: 1, b: 2, c: 3 }))).toBe('domain');
    expect(code(solveTriangle({ a: 1, b: 1, c: 5 }))).toBe('domain');
    expect(code(solveTriangle({ a: -1, b: 2, c: 2 }))).toBe('domain');
    expect(code(solveTriangle({ a: 0, b: 2, c: 2 }))).toBe('domain');
    expect(code(solveTriangle({ a: 1, A: 100, B: 80 }))).toBe('domain');
    expect(code(solveTriangle({ a: 1, b: 1, A: 180 }))).toBe('domain');
    expect(code(solveTriangle({ a: 1, b: 1, A: 4 }, { unit: 'rad' }))).toBe('domain');
    expect(code(solveTriangle({ a: NaN, b: 1, c: 1 }))).toBe('domain');
  });
});

describe('right triangles and area', () => {
  it('solves a right triangle from two values', () => {
    close(val(solveRightTriangle({ a: 3, b: 4 })).triangles[0], { c: 5, A: A345, area: 6 });
    close(val(solveRightTriangle({ a: 3, c: 5 })).triangles[0], { b: 4, B: B345 });
    close(val(solveRightTriangle({ c: 2, A: 30 })).triangles[0], { a: 1, b: Math.sqrt(3), B: 60 });
    close(val(solveRightTriangle({ b: 1, B: Math.PI / 4 }, { unit: 'rad' })).triangles[0], {
      a: 1,
      c: Math.SQRT2,
      A: Math.PI / 4,
    });
  });

  it('rejects a leg longer than the hypotenuse and missing data', () => {
    expect(solveRightTriangle({ a: 6, c: 5 }).ok).toBe(false);
    expect(solveRightTriangle({ A: 30 }).ok).toBe(false);
    expect(solveRightTriangle({ A: 30, B: 50, a: 1 }).ok).toBe(false);
  });

  it('computes the area from three sides (Heron)', () => {
    expect(val(triangleArea(3, 4, 5))).toBeCloseTo(6, 14);
    // needle triangle: Kahan's form stays accurate
    expect(val(triangleArea(1e8, 1e8, 1))).toBeCloseTo(0.5 * 1e8 * Math.sqrt(1 - 0.25e-16), 6);
    expect(triangleArea(1, 2, 3).ok).toBe(false);
    expect(triangleArea(0, 2, 3).ok).toBe(false);
  });
});
