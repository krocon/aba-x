import { describe, expect, it } from 'vitest';
import { jacobian, solveFor, solveOne, solveSystem } from './solve-multi';

const val = <T>(r: { ok: boolean; value?: T; error?: { message: string } }) => {
  if (!r.ok) throw new Error(`not ok: ${r.error?.message}`);
  return r.value as T;
};

describe('solveOne', () => {
  it('finds a simple zero near the start value', () => {
    const r = val(solveOne((x) => x * x - 2, 1));
    expect(r.kind).toBe('zero');
    expect(r.solved).toBe(true);
    expect(r.x).toBeCloseTo(Math.SQRT2, 13);
  });

  it('finds the zero nearest to the start value', () => {
    expect(val(solveOne((x) => x * x - 2, -3)).x).toBeCloseTo(-Math.SQRT2, 13);
    expect(val(solveOne(Math.sin, 3)).x).toBeCloseTo(Math.PI, 13);
    expect(val(solveOne(Math.sin, 6)).x).toBeCloseTo(2 * Math.PI, 13);
  });

  it('accepts an exact zero at the start value', () => {
    const r = val(solveOne((x) => x - 5, 5));
    expect(r).toMatchObject({ kind: 'zero', x: 5, fx: 0 });
  });

  it('searches far away when needed', () => {
    expect(val(solveOne((x) => x - 1e6, 0)).x).toBeCloseTo(1e6, 6);
    expect(val(solveOne((x) => Math.exp(x) - 1e-8, 10)).x).toBeCloseTo(Math.log(1e-8), 10);
  });

  it('reports a pole as a sign change, not a solution', () => {
    const r = val(solveOne((x) => 1 / x, 0.7));
    expect(r.kind).toBe('sign-change');
    expect(r.solved).toBe(false);
    expect(Math.abs(r.x)).toBeLessThan(1e-6);
    expect(r.message).toMatch(/not a solution/);
    const t = val(solveOne((x) => 1 / (x - 2), 1.5));
    expect(t.kind).toBe('sign-change');
    expect(t.x).toBeCloseTo(2, 6);
  });

  it('reports a jump (sign function) as a sign change', () => {
    const r = val(solveOne((x) => (x < 1 ? -1 : 1), 0));
    expect(r.kind).toBe('sign-change');
    expect(r.x).toBeCloseTo(1, 10);
  });

  it('reports an equation without zero as extremum with the closest x', () => {
    const r = val(solveOne((x) => x * x + 1, 3));
    expect(r.kind).toBe('extremum');
    expect(r.solved).toBe(false);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.fx).toBeCloseTo(1, 10);
    const c = val(solveOne((x) => Math.cos(x) + 2, 1));
    expect(c.kind).toBe('extremum');
    expect(c.fx).toBeCloseTo(1, 10);
  });

  it('finds a touching zero (double root) without a sign change', () => {
    const r = val(solveOne((x) => (x - 3) ** 2, 1));
    expect(r.kind).toBe('zero');
    expect(r.x).toBeCloseTo(3, 4);
  });

  it('handles domain gaps (sqrt) and an undefined start value', () => {
    expect(val(solveOne((x) => Math.sqrt(x) - 2, 1)).x).toBeCloseTo(4, 12);
    expect(val(solveOne((x) => Math.log(x) - 1, -5)).x).toBeCloseTo(Math.E, 12);
    expect(val(solveOne((x) => Math.sqrt(x - 10) - 1, 0)).x).toBeCloseTo(11, 10);
  });

  it('respects the search interval and a second start value', () => {
    expect(val(solveOne(Math.sin, 0.1, { lo: 1, hi: 4 })).x).toBeCloseTo(Math.PI, 12);
    expect(val(solveOne(Math.sin, 1.5, { guess2: 3.5 })).x).toBeCloseTo(Math.PI, 12);
    expect(val(solveOne(Math.sin, 2, { guess2: 2.5 })).x).toBeCloseTo(Math.PI, 12);
  });

  it('rejects unusable input and functions undefined everywhere', () => {
    expect(solveOne((x) => x, NaN).ok).toBe(false);
    expect(solveOne((x) => x, 0, { lo: 2, hi: 1 }).ok).toBe(false);
    const r = solveOne(() => NaN, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('domain');
  });
});

describe('solveFor', () => {
  it('solves for any variable of a multi-variable equation', () => {
    // E = m·c²  →  0 = m·c² − E ; vars [E, m, c]
    const eq = ([E, m, c]: number[]) => m * c * c - E;
    expect(val(solveFor(eq, [0, 2, 3], 0)).x).toBeCloseTo(18, 12);
    expect(val(solveFor(eq, [18, 1, 3], 1)).x).toBeCloseTo(2, 12);
    expect(val(solveFor(eq, [18, 2, 1], 2)).x).toBeCloseTo(3, 12);
    expect(val(solveFor(eq, [18, 2, -1], 2)).x).toBeCloseTo(-3, 12);
  });

  it('rejects an invalid index', () => {
    expect(solveFor(([x]) => x, [1], 1).ok).toBe(false);
  });
});

describe('solveSystem', () => {
  it('solves a linear system', () => {
    const r = val(solveSystem(([x, y]) => [x + y - 3, x - y - 1], [0, 0]));
    expect(r.x[0]).toBeCloseTo(2, 10);
    expect(r.x[1]).toBeCloseTo(1, 10);
  });

  it('solves a nonlinear system (circle ∩ line) from different start values', () => {
    const F = ([x, y]: number[]) => [x * x + y * y - 4, x - y];
    const a = val(solveSystem(F, [1, 1])).x;
    expect(a[0]).toBeCloseTo(Math.SQRT2, 10);
    expect(a[1]).toBeCloseTo(Math.SQRT2, 10);
    const b = val(solveSystem(F, [-1, -2])).x;
    expect(b[0]).toBeCloseTo(-Math.SQRT2, 10);
  });

  it('solves a three-variable system', () => {
    const F = ([x, y, z]: number[]) => [x * y * z - 6, x + y + z - 6, x * x + y * y + z * z - 14];
    const r = val(solveSystem(F, [0.8, 2.2, 3.3]));
    const sorted = [...r.x].sort((p, q) => p - q);
    sorted.forEach((v, i) => expect(v).toBeCloseTo(i + 1, 9));
    expect(r.residual).toBeLessThan(1e-10);
  });

  it('solves Rosenbrock-type and exponential systems', () => {
    const r = val(solveSystem(([x, y]) => [10 * (y - x * x), 1 - x], [-1.2, 1]));
    expect(r.x[0]).toBeCloseTo(1, 10);
    expect(r.x[1]).toBeCloseTo(1, 10);
    const e = val(solveSystem(([x, y]) => [Math.exp(x) - y, x + y - 2], [0, 0]));
    expect(Math.exp(e.x[0])).toBeCloseTo(e.x[1], 10);
  });

  it('reports a system without solution instead of a guess', () => {
    const r = solveSystem(([x, y]) => [x * x + y * y + 1, x - y], [1, 2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('not-solvable');
    const p = solveSystem(([x, y]) => [x + y - 1, x + y - 2], [0, 0]);
    expect(p.ok).toBe(false);
  });

  it('handles a singular Jacobian at the start value', () => {
    // J = [[1, 1], [1, 1]] at (0, 0): Levenberg–Marquardt steps lead to the solution (1, 1)
    const r = val(solveSystem(([x, y]) => [x + y - 2, x + y - 2 + (x - y) ** 3], [0, 0]));
    // a triple root in x − y: only |x − y|³ ≤ tol is reachable
    expect(r.x[0]).toBeCloseTo(1, 3);
    expect(r.x[0] + r.x[1]).toBeCloseTo(2, 9);
    // stationary point of the residual: reported, not "solved"
    const s = solveSystem(([x, y]) => [x * x - 1, y - 1], [0, 0.5]);
    expect(s.ok).toBe(false);
  });

  it('validates the shape and the start values', () => {
    expect(solveSystem(([x]) => [x, x], [1]).ok).toBe(false);
    expect(solveSystem(() => [], []).ok).toBe(false);
    expect(solveSystem(([x]) => [x], [NaN]).ok).toBe(false);
    expect(solveSystem(([x]) => [Math.log(x)], [-1]).ok).toBe(false);
  });

  it('computes a numerical Jacobian', () => {
    const J = jacobian(([x, y]) => [x * y, Math.sin(x)], [2, 3]);
    expect(J).not.toBeNull();
    expect(J![0][0]).toBeCloseTo(3, 8);
    expect(J![0][1]).toBeCloseTo(2, 8);
    expect(J![1][0]).toBeCloseTo(Math.cos(2), 8);
    expect(J![1][1]).toBeCloseTo(0, 8);
  });
});
