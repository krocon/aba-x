/**
 * Triangle solver app (prompt 039), pure: the six values (null = not given), the mode (general or
 * right-angled with C = 90°), the angle unit and which of two SSA solutions is shown.
 * Mathematics: `@aba/math/geometry/triangle`.
 */
import {
  type AngleUnit,
  type Triangle,
  type TriangleInput,
  type TriangleSolution,
  solveRightTriangle,
  solveTriangle,
} from '@aba/math/geometry/triangle';
import type { MathResult } from '@aba/math/result';

export const TRI_KEYS = ['a', 'b', 'c', 'A', 'B', 'C'] as const;
export type TriKey = (typeof TRI_KEYS)[number];

export interface TriangleState {
  given: Record<TriKey, number | null>;
  right: boolean;
  unit: AngleUnit;
  /** index of the shown solution (SSA: 0 or 1) */
  pick: number;
}

export function initTriangle(): TriangleState {
  return {
    given: { a: null, b: null, c: null, A: null, B: null, C: null },
    right: false,
    unit: 'deg',
    pick: 0,
  };
}

export const rightAngle = (unit: AngleUnit) => (unit === 'deg' ? 90 : Math.PI / 2);

/** The given values (in right mode C is fixed). */
export function givenValues(s: TriangleState): TriangleInput {
  const out: Partial<Record<TriKey, number>> = {};
  for (const k of TRI_KEYS) {
    if (s.right && k === 'C') continue;
    const v = s.given[k];
    if (v !== null) out[k] = v;
  }
  return out;
}

/** Solves when at least three values (right mode: two) are given; null when too few so far. */
export function solve(s: TriangleState): MathResult<TriangleSolution> | null {
  const g = givenValues(s);
  const count = Object.keys(g).length;
  if (count < (s.right ? 2 : 3)) return null;
  if (s.right) return solveRightTriangle(g, { unit: s.unit });
  return solveTriangle(g, { unit: s.unit });
}

/** The shown triangle (pick wraps to the existing solutions). */
export function shown(s: TriangleState, r: MathResult<TriangleSolution> | null): Triangle | null {
  if (!r?.ok || !r.value.triangles.length) return null;
  const t = r.value.triangles;
  return t[Math.min(s.pick, t.length - 1)];
}

/**
 * Corner points of a triangle in the plane: A at the origin, B on the positive x axis, C above.
 * Angles in the unit of the state.
 */
export function corners(t: Triangle, unit: AngleUnit): [number, number][] {
  const A = unit === 'deg' ? (t.A * Math.PI) / 180 : t.A;
  return [
    [0, 0],
    [t.c, 0],
    [t.b * Math.cos(A), t.b * Math.sin(A)],
  ];
}

/** Rejects a value for C in right mode. */
export function setGiven(s: TriangleState, k: TriKey, v: number | null): TriangleState | string {
  if (s.right && k === 'C') return 'C is the right angle in this mode';
  if (v !== null && !(v > 0)) return `${k} must be positive`;
  return { ...s, given: { ...s.given, [k]: v }, pick: 0 };
}
