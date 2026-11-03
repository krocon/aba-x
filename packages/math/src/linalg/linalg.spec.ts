import { describe, expect, it } from 'vitest';
import {
  type Matrix,
  det,
  eigenSymmetric,
  eigenvalues,
  identity,
  inverse,
  multiply,
  rank,
  rref,
  solveLinear,
  transpose,
} from './linalg';

const val = <T>(r: { ok: boolean; value?: T }) => {
  if (!r.ok) throw new Error('not ok');
  return r.value as T;
};
const close = (a: number[][], b: number[][], d = 10) =>
  a.forEach((r, i) => r.forEach((x, j) => expect(x).toBeCloseTo(b[i][j], d)));

/** deterministic pseudo-random matrices */
function rnd(seed: number, n: number): Matrix {
  let s = seed;
  const next = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) * 10 - 5;
  return Array.from({ length: n }, () => Array.from({ length: n }, next));
}

describe('linear algebra', () => {
  it('determinant, inverse, transpose, rank', () => {
    expect(
      val(
        det([
          [1, 2],
          [3, 4],
        ]),
      ),
    ).toBeCloseTo(-2, 12);
    expect(
      val(
        det([
          [2, 0, 0],
          [0, 3, 0],
          [0, 0, 4],
        ]),
      ),
    ).toBe(24);
    expect(
      val(
        det([
          [1, 2],
          [2, 4],
        ]),
      ),
    ).toBe(0);
    close(
      val(
        inverse([
          [1, 2],
          [3, 4],
        ]),
      ),
      [
        [-2, 1],
        [1.5, -0.5],
      ],
    );
    expect(
      inverse([
        [1, 2],
        [2, 4],
      ]).ok,
    ).toBe(false);
    expect(transpose([[1, 2, 3]])).toEqual([[1], [2], [3]]);
    expect(
      rank([
        [1, 2, 3],
        [2, 4, 6],
        [1, 0, 1],
      ]),
    ).toBe(2);
    expect(
      rref([
        [1, 2, 3],
        [4, 5, 6],
      ]).rref,
    ).toEqual([
      [1, 0, -1],
      [0, 1, 2],
    ]);
    expect(det([[1, 2, 3]]).ok).toBe(false);
  });

  it('nearly singular matrices are treated as singular, not divided by noise', () => {
    expect(
      inverse([
        [1, 2],
        [1, 2 + 1e-15],
      ]).ok,
    ).toBe(false);
  });

  it('properties: A·A⁻¹ = I and det(AB) = det A · det B', () => {
    for (let k = 1; k <= 8; k++) {
      const a = rnd(k, 4);
      const b = rnd(k + 100, 4);
      close(val(multiply(a, val(inverse(a)))), identity(4), 9);
      expect(val(det(val(multiply(a, b))))).toBeCloseTo(val(det(a)) * val(det(b)), 6);
    }
  });

  it('solves linear systems', () => {
    const x = val(
      solveLinear(
        [
          [2, 1, -1],
          [-3, -1, 2],
          [-2, 1, 2],
        ],
        [8, -11, -3],
      ),
    );
    x.forEach((v, i) => expect(v).toBeCloseTo([2, 3, -1][i], 12));
    expect(
      solveLinear(
        [
          [1, 1],
          [1, 1],
        ],
        [1, 2],
      ).ok,
    ).toBe(false);
  });

  it('eigenvalues: symmetric (with vectors) and general (complex pairs)', () => {
    const s = val(
      eigenSymmetric([
        [2, 1],
        [1, 2],
      ]),
    );
    expect(s.values[0]).toBeCloseTo(1, 12);
    expect(s.values[1]).toBeCloseTo(3, 12);
    // A·v = λ·v
    const a = [
      [4, 1, 2],
      [1, 3, 0],
      [2, 0, 5],
    ];
    const e = val(eigenSymmetric(a));
    for (let k = 0; k < 3; k++) {
      const v = e.vectors.map((r) => r[k]);
      const av = a.map((r) => r.reduce((t, x, j) => t + x * v[j], 0));
      av.forEach((x, i) => expect(x).toBeCloseTo(e.values[k] * v[i], 10));
    }
    const rot = val(
      eigenvalues([
        [0, -1],
        [1, 0],
      ]),
    );
    expect(rot.map(([re, im]) => [Math.round(re * 1e12) / 1e12, im])).toEqual([
      [0, -1],
      [0, 1],
    ]);
    const g = val(
      eigenvalues([
        [1, 2, 0],
        [0, 3, 0],
        [0, 0, 5],
      ]),
    );
    expect(g.map(([re]) => re)).toEqual([1, 3, 5].map((x) => expect.closeTo(x, 10)));
    // trace = Σλ, det = Πλ on random matrices
    for (let k = 1; k <= 5; k++) {
      const m = rnd(k * 7, 5);
      const ev = val(eigenvalues(m));
      const tr = m.reduce((t, r, i) => t + r[i], 0);
      expect(ev.reduce((t, [re]) => t + re, 0)).toBeCloseTo(tr, 8);
      expect(Math.abs(ev.reduce((t, [, im]) => t + im, 0))).toBeLessThan(1e-8);
    }
  });
});
