/**
 * Triangle solver (prompt 039): sides a, b, c and the opposite angles A, B, C. Any three values
 * with at least one side determine the triangle (SSS, SAS, ASA, AAS); SSA (two sides and a
 * non-included angle) is the ambiguous case with 0, 1 or 2 solutions. More than three values are
 * checked for consistency. All solutions are returned explicitly; invalid input is an error.
 */
import { type MathResult, fail, ok } from '../result';

export type AngleUnit = 'deg' | 'rad';

export interface TriangleInput {
  readonly a?: number;
  readonly b?: number;
  readonly c?: number;
  readonly A?: number;
  readonly B?: number;
  readonly C?: number;
}

export interface Triangle {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  /** Angles in the unit of the input. */
  readonly A: number;
  readonly B: number;
  readonly C: number;
  readonly area: number;
  readonly perimeter: number;
}

export interface TriangleOptions {
  /** Unit of the angles in input and output (default 'deg'). */
  readonly unit?: AngleUnit;
  /** Relative tolerance of the consistency check of more than three values (default 1e-6). */
  readonly tolerance?: number;
}

/** Which three given values were used. */
export type TriangleCase = 'SSS' | 'SAS' | 'ASA' | 'AAS' | 'SSA';

export interface TriangleSolution {
  readonly case: TriangleCase;
  /** 0, 1 or 2 triangles (only SSA can give 0 or 2). */
  readonly triangles: Triangle[];
}

const SIDES = ['a', 'b', 'c'] as const;
const ANGLES = ['A', 'B', 'C'] as const;
const EPS = 1e-12;

type Known = (number | undefined)[];
interface Raw {
  s: number[];
  g: number[];
}

/**
 * Solves a triangle from the given values. Errors: not enough data (fewer than three values or
 * no side), non-positive values, angles ≥ 180°, angle sum ≥ 180°, triangle inequality, and
 * inconsistent extra values. SSA without a triangle gives `triangles: []`.
 */
export function solveTriangle(
  input: TriangleInput,
  o: TriangleOptions = {},
): MathResult<TriangleSolution> {
  const unit = o.unit ?? 'deg';
  const toRad = unit === 'deg' ? Math.PI / 180 : 1;
  const s: Known = SIDES.map((k) => input[k]);
  const g: Known = ANGLES.map((k) => (input[k] === undefined ? undefined : input[k]! * toRad));
  for (const [i, k] of [...SIDES, ...ANGLES].entries()) {
    const v = input[k];
    if (v === undefined) continue;
    if (!Number.isFinite(v) || v <= 0) return fail('domain', `${k} must be a positive number`);
    if (i >= 3 && (g[i - 3] as number) >= Math.PI) {
      return fail('domain', `the angle ${k} must be less than ${unit === 'deg' ? '180°' : 'π'}`);
    }
  }
  const sideIdx = [0, 1, 2].filter((i) => s[i] !== undefined);
  const angleIdx = [0, 1, 2].filter((i) => g[i] !== undefined);
  if (sideIdx.length + angleIdx.length < 3) {
    return fail('not-solvable', 'not enough data: three values are needed');
  }
  if (sideIdx.length === 0) {
    return fail('not-solvable', 'not enough data: at least one side is needed');
  }
  if (angleIdx.length >= 2) {
    const sum = angleIdx.slice(0, 2).reduce((t, i) => t + (g[i] as number), 0);
    if (angleIdx.length === 2 && sum >= Math.PI - EPS) {
      return fail('domain', 'the angles add up to 180° or more');
    }
  }

  // choose three values: SSS, SAS, two angles + side, SSA
  let chosen: { case: TriangleCase; s: Known; g: Known };
  const pick = (si: number[], gi: number[]): { s: Known; g: Known } => ({
    s: [0, 1, 2].map((i) => (si.includes(i) ? s[i] : undefined)),
    g: [0, 1, 2].map((i) => (gi.includes(i) ? g[i] : undefined)),
  });
  const included = angleIdx.find((i) => !sideIdx.includes(i));
  if (sideIdx.length === 3) chosen = { case: 'SSS', ...pick(sideIdx, []) };
  else if (sideIdx.length === 2 && included !== undefined) {
    chosen = { case: 'SAS', ...pick(sideIdx, [included]) };
  } else if (angleIdx.length >= 2) {
    const two = angleIdx.slice(0, 2);
    const side = sideIdx[0];
    chosen = { case: two.includes(side) ? 'AAS' : 'ASA', ...pick([side], two) };
  } else chosen = { case: 'SSA', ...pick(sideIdx, angleIdx) };

  const raw = solveThree(chosen.s, chosen.g);
  if (!raw.ok) return raw;
  // keep the chosen values exactly (no round trip through the law of sines)
  for (const t of raw.value) {
    for (let i = 0; i < 3; i++) {
      t.s[i] = chosen.s[i] ?? t.s[i];
      t.g[i] = chosen.g[i] ?? t.g[i];
    }
  }

  // consistency of all given values
  const tol = o.tolerance ?? 1e-6;
  const fits = (t: Raw) =>
    [0, 1, 2].every(
      (i) =>
        (s[i] === undefined || Math.abs(t.s[i] - (s[i] as number)) <= tol * (s[i] as number)) &&
        (g[i] === undefined ||
          Math.abs(t.g[i] - (g[i] as number)) <= tol * Math.max(g[i] as number, 1e-3)),
    );
  const good = raw.value.filter(fits);
  if (raw.value.length > 0 && good.length === 0) {
    return fail('domain', 'the given values are inconsistent – no triangle has all of them');
  }
  const fromRad = 1 / toRad;
  return ok({
    case: chosen.case,
    triangles: good.map((t) => ({
      a: t.s[0],
      b: t.s[1],
      c: t.s[2],
      A: t.g[0] * fromRad,
      B: t.g[1] * fromRad,
      C: t.g[2] * fromRad,
      area: 0.5 * t.s[1] * t.s[2] * Math.sin(t.g[0]),
      perimeter: t.s[0] + t.s[1] + t.s[2],
    })),
  });
}

/** Exactly three values (radians), at least one side → all triangles. */
function solveThree(s: Known, g: Known): MathResult<Raw[]> {
  const si = [0, 1, 2].filter((i) => s[i] !== undefined);
  const gi = [0, 1, 2].filter((i) => g[i] !== undefined);
  const S = s as number[];
  const G = g as number[];
  if (si.length === 3) {
    const [a, b, c] = S;
    if (a + b <= c || a + c <= b || b + c <= a) {
      return fail('domain', 'the sides violate the triangle inequality');
    }
    const angle = (x: number, y: number, z: number) =>
      Math.acos(Math.min(1, Math.max(-1, (y * y + z * z - x * x) / (2 * y * z))));
    const A = angle(a, b, c);
    const B = angle(b, a, c);
    return ok([{ s: [a, b, c], g: [A, B, Math.PI - A - B] }]);
  }
  if (si.length === 2) {
    const i = gi[0];
    if (!si.includes(i)) {
      // SAS: the angle i lies between the sides j and k
      const [j, k] = si;
      const si2 = Math.sqrt(S[j] ** 2 + S[k] ** 2 - 2 * S[j] * S[k] * Math.cos(G[i]));
      const gj = Math.atan2(S[j] * Math.sin(G[i]), S[k] - S[j] * Math.cos(G[i]));
      return ok([complete(i, si2, i, G[i], j, gj)]);
    }
    // SSA: angle i opposite the known side i, side j known
    const j = si.find((x) => x !== i) as number;
    const sinJ = (S[j] * Math.sin(G[i])) / S[i];
    if (sinJ > 1 + EPS) return ok([]);
    const candidates =
      sinJ >= 1 - EPS ? [Math.PI / 2] : [Math.asin(sinJ), Math.PI - Math.asin(sinJ)];
    return ok(
      candidates
        .filter((gj) => G[i] + gj < Math.PI - 1e-9)
        .map((gj) => complete(i, S[i], i, G[i], j, gj)),
    );
  }
  // one side, two angles (ASA / AAS)
  const k = [0, 1, 2].find((x) => !gi.includes(x)) as number;
  const gk = Math.PI - G[gi[0]] - G[gi[1]];
  if (gk <= 0) return fail('domain', 'the angles add up to 180° or more');
  const angles = [...G];
  angles[k] = gk;
  const side = si[0];
  return ok([complete(side, S[side], 0, angles[0], 1, angles[1])]);
}

/** From one side (index `si`) and two angles (indices `i`, `j`): the full triangle. */
function complete(si: number, side: number, i: number, gi: number, j: number, gj: number): Raw {
  const g = [0, 0, 0];
  g[i] = gi;
  g[j] = gj;
  const k = 3 - i - j;
  g[k] = Math.PI - gi - gj;
  const ratio = side / Math.sin(g[si]);
  return { s: g.map((x, n) => (n === si ? side : ratio * Math.sin(x))), g };
}

/** Right triangle (C = 90°, c the hypotenuse) from two more values incl. a side. */
export function solveRightTriangle(
  input: Omit<TriangleInput, 'C'>,
  o: TriangleOptions = {},
): MathResult<TriangleSolution> {
  const right = (o.unit ?? 'deg') === 'deg' ? 90 : Math.PI / 2;
  if (
    (input.a !== undefined && input.c !== undefined && input.a >= input.c) ||
    (input.b !== undefined && input.c !== undefined && input.b >= input.c)
  ) {
    return fail('domain', 'the hypotenuse c must be the longest side');
  }
  return solveTriangle({ ...input, C: right }, o);
}

/** Area from three sides (Heron, Kahan's stable form); triangle inequality checked. */
export function triangleArea(a: number, b: number, c: number): MathResult<number> {
  if (![a, b, c].every((x) => Number.isFinite(x) && x > 0)) {
    return fail('domain', 'the sides must be positive numbers');
  }
  const [x, y, z] = [a, b, c].sort((p, q) => q - p);
  if (y + z <= x) return fail('domain', 'the sides violate the triangle inequality');
  return ok(0.25 * Math.sqrt((x + (y + z)) * (z - (x - y)) * (z + (x - y)) * (x + (y - z))));
}
