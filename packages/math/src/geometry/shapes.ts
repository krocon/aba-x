/**
 * Dynamic geometry (prompt 042): plane vectors and the computed value ("shape") of every object of a
 * construction. Pure, double precision, world coordinates.
 *
 * A shape is either a concrete figure or the explicit state `undefined` with a reason (parallel lines
 * have no intersection point, three collinear points no circumcircle …) – never a made-up figure.
 */

export interface Vec {
  readonly x: number;
  readonly y: number;
}

/** General conic Ax² + Bxy + Cy² + Dx + Ey + F = 0. */
export interface ConicCoefficients {
  readonly A: number;
  readonly B: number;
  readonly C: number;
  readonly D: number;
  readonly E: number;
  readonly F: number;
}

export type Shape =
  | { readonly kind: 'point'; readonly p: Vec }
  /** Infinite line through `p` with unit direction `d`. */
  | { readonly kind: 'line'; readonly p: Vec; readonly d: Vec }
  /** Ray from `p` in unit direction `d`. */
  | { readonly kind: 'ray'; readonly p: Vec; readonly d: Vec }
  | { readonly kind: 'segment'; readonly a: Vec; readonly b: Vec }
  | { readonly kind: 'circle'; readonly c: Vec; readonly r: number }
  /** Closed polygon, vertices in construction order. */
  | { readonly kind: 'polygon'; readonly pts: readonly Vec[] }
  /** Ellipse, hyperbola, parabola or a general conic, by its coefficients. */
  | { readonly kind: 'conic'; readonly q: ConicCoefficients }
  /** Sampled curve (locus, inverted figures); paths break where the curve is undefined. */
  | {
      readonly kind: 'polyline';
      readonly paths: readonly (readonly Vec[])[];
      readonly closed: boolean;
    }
  /** Slider or numeric argument. */
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'undefined'; readonly reason: string };

export type ShapeKind = Exclude<Shape['kind'], 'undefined'>;
export type ShapeOf<K extends Shape['kind']> = Extract<Shape, { kind: K }>;

/** Line-like kinds that intersect, reflect and carry points the same way. */
export const LINEAR_KINDS: readonly ShapeKind[] = ['line', 'ray', 'segment'];

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const norm = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
/** `a` turned by +90° (left normal). */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const rotateVec = (a: Vec, angle: number): Vec => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
/** Unit vector, or `undefined` for the zero vector. */
export function unit(a: Vec): Vec | undefined {
  const n = norm(a);
  return n > 0 && Number.isFinite(n) ? { x: a.x / n, y: a.y / n } : undefined;
}
export const finiteVec = (a: Vec): boolean => Number.isFinite(a.x) && Number.isFinite(a.y);

export const undef = (reason: string): Shape => ({ kind: 'undefined', reason });
export const point = (p: Vec): Shape => (finiteVec(p) ? { kind: 'point', p } : undef('overflow'));

/** Line through `a` and `b`; equal points give `undefined`. */
export function lineThrough(a: Vec, b: Vec, kind: 'line' | 'ray' = 'line'): Shape {
  const d = unit(sub(b, a));
  return d ? { kind, p: a, d } : undef('the two points coincide');
}

/** Uniform parametrisation p + t·d, t ∈ [tmin, tmax], of a line, ray or segment. */
export interface Linear {
  readonly p: Vec;
  readonly d: Vec;
  readonly tmin: number;
  readonly tmax: number;
}

/** Parametrisation of a line-like shape; a segment of length 0 has none. */
export function asLinear(s: Shape): Linear | undefined {
  switch (s.kind) {
    case 'line':
      return { p: s.p, d: s.d, tmin: -Infinity, tmax: Infinity };
    case 'ray':
      return { p: s.p, d: s.d, tmin: 0, tmax: Infinity };
    case 'segment':
      return norm(sub(s.b, s.a)) > 0 ? { p: s.a, d: sub(s.b, s.a), tmin: 0, tmax: 1 } : undefined;
    default:
      return undefined;
  }
}

/** Parameter of the orthogonal projection of `q` onto the carrier line of `l`. */
export const projectParam = (l: Linear, q: Vec): number => dot(sub(q, l.p), l.d) / dot(l.d, l.d);

/** Orthogonal projection of `q` onto the infinite carrier line. */
export const footOnCarrier = (l: Linear, q: Vec): Vec => add(l.p, mul(l.d, projectParam(l, q)));

/** Signed area of a polygon (positive = counter-clockwise). */
export function signedArea(pts: readonly Vec[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += cross(pts[i], pts[(i + 1) % pts.length]);
  return s / 2;
}

/** Points of a shape that determine its size (for the scene scale and the tolerance). */
export function characteristicPoints(s: Shape): Vec[] {
  switch (s.kind) {
    case 'point':
      return [s.p];
    case 'line':
    case 'ray':
      return [s.p];
    case 'segment':
      return [s.a, s.b];
    case 'circle':
      return [add(s.c, vec(s.r, s.r)), sub(s.c, vec(s.r, s.r))];
    case 'polygon':
      return [...s.pts];
    case 'polyline':
      return s.paths.flat();
    default:
      return [];
  }
}
