/**
 * Measurements and tests of the geometry app (prompt 042), numerically in double precision:
 * coordinates, distances, lengths, areas, slopes, angles (radians), radii, equations, arc length,
 * and the predicates collinear, concyclic, parallel, perpendicular, equilateral, isosceles and
 * "point on object". Lengths are compared with the tolerance 1e-9 × scene size (`scale`, from
 * `Construction.scale()`), directions with a relative angle tolerance of 1e-9.
 */
import { type MathResult, fail, ok } from '../result';
import {
  classifyConic,
  conicFromCircle,
  conicValue,
  ellipseCircumference,
  normalizeConic,
} from './conic';
import { circumcircle } from './constructions';
import {
  type ConicCoefficients,
  type Shape,
  type Vec,
  asLinear,
  cross,
  dist,
  dot,
  norm,
  projectParam,
  signedArea,
  sub,
  unit,
} from './shapes';

export interface MeasureOptions {
  /** Scene size; the length tolerance is 1e-9 × scale (default 1). */
  readonly scale?: number;
}

const ANGLE_TOL = 1e-9;
const tolerance = (o?: MeasureOptions): number => 1e-9 * Math.max(1, o?.scale ?? 1);

const notA = (what: string): MathResult<never> => fail('domain', `expected ${what}`);

/** Error for wrong arguments: undefined objects are reported as such, other kinds as a domain error. */
function reject(what: string, ...s: Shape[]): MathResult<never> {
  const u = s.find(isUndef);
  return u ? fail('not-evaluable', `undefined object: ${u.reason}`) : notA(what);
}

const isUndef = (s: Shape): s is Extract<Shape, { kind: 'undefined' }> => s.kind === 'undefined';

function defined(...s: Shape[]): MathResult<true> {
  const u = s.find(isUndef);
  return u ? fail('not-evaluable', `undefined object: ${u.reason}`) : ok(true);
}

export function coordinates(s: Shape): MathResult<Vec> {
  return s.kind === 'point' ? ok(s.p) : notA('a point');
}

/** Distance from `p` to the point set of a shape (lines, rays, segments, circles, polygons). */
function distanceToSet(p: Vec, s: Shape): number | undefined {
  switch (s.kind) {
    case 'point':
      return dist(p, s.p);
    case 'line':
    case 'ray':
    case 'segment': {
      const l = asLinear(s);
      if (!l) return s.kind === 'segment' ? dist(p, s.a) : undefined;
      const t = Math.min(l.tmax, Math.max(l.tmin, projectParam(l, p)));
      return dist(p, { x: l.p.x + l.d.x * t, y: l.p.y + l.d.y * t });
    }
    case 'circle':
      return Math.abs(dist(p, s.c) - s.r);
    case 'polygon':
      return Math.min(
        ...s.pts.map((a, i) =>
          distanceToSet(p, { kind: 'segment', a, b: s.pts[(i + 1) % s.pts.length] })!,
        ),
      );
    case 'polyline': {
      let m = Infinity;
      for (const path of s.paths) {
        const n = s.closed ? path.length : path.length - 1;
        for (let i = 0; i < n; i++)
          m = Math.min(
            m,
            distanceToSet(p, { kind: 'segment', a: path[i], b: path[(i + 1) % path.length] })!,
          );
        if (path.length === 1) m = Math.min(m, dist(p, path[0]));
      }
      return m;
    }
    case 'conic': {
      // First-order distance |Q(p)| / |∇Q(p)| (exact enough for "on the curve" tests).
      const q = normalizeConic(s.q);
      const g = Math.hypot(2 * q.A * p.x + q.B * p.y + q.D, q.B * p.x + 2 * q.C * p.y + q.E);
      const v = Math.abs(conicValue(q, p));
      return g > 0 ? v / g : v === 0 ? 0 : Infinity;
    }
    default:
      return undefined;
  }
}

/** Distance point–point, point–line/ray/segment/circle/polygon, or between parallel lines. */
export function distance(a: Shape, b: Shape): MathResult<number> {
  const d = defined(a, b);
  if (!d.ok) return d;
  if (a.kind !== 'point' && b.kind === 'point') return distance(b, a);
  if (a.kind === 'point') {
    const v = distanceToSet(a.p, b);
    return v === undefined ? fail('unsupported', `no distance to a ${b.kind}`) : ok(v);
  }
  if (a.kind === 'line' && b.kind === 'line') {
    if (Math.abs(cross(a.d, b.d)) > ANGLE_TOL) return ok(0);
    return ok(Math.abs(cross(sub(b.p, a.p), a.d)));
  }
  return fail('unsupported', `no distance between a ${a.kind} and a ${b.kind}`);
}

/** Length of a segment, circumference of a circle or ellipse, perimeter of a polygon, curve length. */
export function length(s: Shape): MathResult<number> {
  switch (s.kind) {
    case 'segment':
      return ok(dist(s.a, s.b));
    case 'circle':
      return ok(2 * Math.PI * s.r);
    case 'polygon':
      return ok(s.pts.reduce((sum, p, i) => sum + dist(p, s.pts[(i + 1) % s.pts.length]), 0));
    case 'polyline': {
      let sum = 0;
      for (const path of s.paths) {
        for (let i = 1; i < path.length; i++) sum += dist(path[i - 1], path[i]);
        if (s.closed && path.length > 1) sum += dist(path[path.length - 1], path[0]);
      }
      return ok(sum);
    }
    case 'conic': {
      const f = classifyConic(s.q);
      return f.type === 'ellipse'
        ? ok(ellipseCircumference(f.a, f.b))
        : fail('domain', 'the curve is unbounded');
    }
    case 'line':
    case 'ray':
      return fail('domain', 'the object is unbounded');
    default:
      return reject('a segment, circle, polygon or curve', s);
  }
}

/** Alias of `length` for closed figures. */
export const perimeter = length;

/** Area of a polygon (absolute shoelace area), circle or ellipse. */
export function area(s: Shape): MathResult<number> {
  switch (s.kind) {
    case 'polygon':
      return ok(Math.abs(signedArea(s.pts)));
    case 'circle':
      return ok(Math.PI * s.r * s.r);
    case 'conic': {
      const f = classifyConic(s.q);
      return f.type === 'ellipse'
        ? ok(Math.PI * f.a * f.b)
        : fail('domain', 'the area is unbounded');
    }
    default:
      return reject('a polygon, circle or ellipse', s);
  }
}

/** Slope dy/dx of a line, ray or segment; vertical ones have none. */
export function slope(s: Shape): MathResult<number> {
  const l = asLinear(s);
  if (!l) return reject('a line, ray or segment', s);
  if (Math.abs(l.d.x) <= ANGLE_TOL * norm(l.d)) return fail('domain', 'the line is vertical');
  return ok(l.d.y / l.d.x);
}

/** Angle ABC at vertex B, in [0, π]. */
export function angle(a: Shape, b: Shape, c: Shape): MathResult<number> {
  if (a.kind !== 'point' || b.kind !== 'point' || c.kind !== 'point') {
    return reject('three points', a, b, c);
  }
  const u = sub(a.p, b.p);
  const v = sub(c.p, b.p);
  if (!(norm(u) > 0) || !(norm(v) > 0)) return fail('domain', 'a side of the angle has length 0');
  return ok(Math.atan2(Math.abs(cross(u, v)), dot(u, v)));
}

/** Direction of a line-like shape. */
function direction(s: Shape): Vec | undefined {
  const l = asLinear(s);
  return l ? unit(l.d) : undefined;
}

/** Angle between two lines (rays, segments), in [0, π/2]. */
export function angleBetween(a: Shape, b: Shape): MathResult<number> {
  const u = direction(a);
  const v = direction(b);
  if (!u || !v) {
    return reject('two lines', a, b);
  }
  return ok(Math.atan2(Math.abs(cross(u, v)), Math.abs(dot(u, v))));
}

export function radius(s: Shape): MathResult<number> {
  return s.kind === 'circle' ? ok(s.r) : reject('a circle', s);
}

export type Equation =
  /** a·x + b·y + c = 0 with a² + b² = 1, a > 0 (or a = 0, b > 0). */
  | { readonly kind: 'line'; readonly a: number; readonly b: number; readonly c: number }
  /** (x − cx)² + (y − cy)² = r², also as general coefficients with A = C = 1. */
  | {
      readonly kind: 'circle';
      readonly center: Vec;
      readonly r: number;
      readonly coefficients: ConicCoefficients;
    }
  /** Normalised general conic (largest coefficient ±1) and its type. */
  | {
      readonly kind: 'conic';
      readonly coefficients: ConicCoefficients;
      readonly type: 'ellipse' | 'hyperbola' | 'parabola' | 'degenerate';
    };

/** Equation of a line (ray, segment carrier), circle or conic. */
export function equation(s: Shape): MathResult<Equation> {
  const l = asLinear(s);
  if (l) {
    const d = unit(l.d)!;
    let a = -d.y;
    let b = d.x;
    if (a < 0 || (a === 0 && b < 0)) {
      a = -a;
      b = -b;
    }
    return ok({ kind: 'line', a, b, c: -(a * l.p.x + b * l.p.y) });
  }
  if (s.kind === 'circle')
    return ok({ kind: 'circle', center: s.c, r: s.r, coefficients: conicFromCircle(s.c, s.r) });
  if (s.kind === 'conic')
    return ok({
      kind: 'conic',
      coefficients: normalizeConic(s.q),
      type: classifyConic(s.q).type,
    });
  return reject('a line, circle or conic', s);
}

/** Length of the counter-clockwise arc of a circle from (the direction of) A to B. */
export function arcLength(circle: Shape, a: Shape, b: Shape): MathResult<number> {
  if (circle.kind !== 'circle' || a.kind !== 'point' || b.kind !== 'point') {
    return reject('a circle and two points', circle, a, b);
  }
  const t = (p: Vec): number => Math.atan2(p.y - circle.c.y, p.x - circle.c.x);
  let th = t(b.p) - t(a.p);
  while (th < 0) th += 2 * Math.PI;
  return ok(circle.r * th);
}

// --- tests ---------------------------------------------------------------------------------------

function points(...s: Shape[]): Vec[] | undefined {
  return s.every((x) => x.kind === 'point') ? s.map((x) => (x as { p: Vec }).p) : undefined;
}

export function collinear(a: Shape, b: Shape, c: Shape, o?: MeasureOptions): MathResult<boolean> {
  const p = points(a, b, c);
  if (!p) return reject('three points', a, b, c);
  const u = sub(p[1], p[0]);
  const v = sub(p[2], p[0]);
  const m = Math.max(norm(u), norm(v), dist(p[1], p[2]));
  return ok(m === 0 || Math.abs(cross(u, v)) / m <= tolerance(o));
}

/** Four points on one circle (false when the first three are collinear). */
export function concyclic(
  a: Shape,
  b: Shape,
  c: Shape,
  d: Shape,
  o?: MeasureOptions,
): MathResult<boolean> {
  const p = points(a, b, c, d);
  if (!p) return reject('four points', a, b, c, d);
  const circle = circumcircle(p[0], p[1], p[2], tolerance(o));
  if (circle.kind !== 'circle') return ok(false);
  return ok(Math.abs(dist(p[3], circle.c) - circle.r) <= tolerance(o));
}

export function parallel(a: Shape, b: Shape): MathResult<boolean> {
  const u = direction(a);
  const v = direction(b);
  if (!u || !v) return reject('two lines', a, b);
  return ok(Math.abs(cross(u, v)) <= ANGLE_TOL);
}

export function perpendicular(a: Shape, b: Shape): MathResult<boolean> {
  const u = direction(a);
  const v = direction(b);
  if (!u || !v) return reject('two lines', a, b);
  return ok(Math.abs(dot(u, v)) <= ANGLE_TOL);
}

/** Side lengths of a triangle given as a polygon with three vertices or as three points. */
function triangleSides(s: readonly Shape[]): number[] | undefined {
  let p: Vec[] | undefined;
  if (s.length === 1 && s[0].kind === 'polygon' && s[0].pts.length === 3) p = [...s[0].pts];
  else if (s.length === 3) p = points(...s);
  return p && [dist(p[1], p[2]), dist(p[2], p[0]), dist(p[0], p[1])];
}

/** All sides equal (triangle as polygon or three points; any polygon: all sides equal). */
export function equilateral(o: MeasureOptions | undefined, ...s: Shape[]): MathResult<boolean> {
  const sides =
    s.length === 1 && s[0].kind === 'polygon'
      ? s[0].pts.map((p, i, a) => dist(p, a[(i + 1) % a.length]))
      : triangleSides(s);
  if (!sides) return notA('a triangle or polygon');
  return ok(sides.every((x) => Math.abs(x - sides[0]) <= tolerance(o)));
}

/** At least two sides of the triangle are equal. */
export function isosceles(o: MeasureOptions | undefined, ...s: Shape[]): MathResult<boolean> {
  const t = triangleSides(s);
  if (!t) return notA('a triangle');
  const eq = (x: number, y: number): boolean => Math.abs(x - y) <= tolerance(o);
  return ok(eq(t[0], t[1]) || eq(t[1], t[2]) || eq(t[0], t[2]));
}

/** The point lies on the object (line, ray, segment, circle, polygon edges, conic, curve). */
export function onObject(p: Shape, s: Shape, o?: MeasureOptions): MathResult<boolean> {
  const d = defined(p, s);
  if (!d.ok) return d;
  if (p.kind !== 'point') return notA('a point');
  const v = distanceToSet(p.p, s);
  if (v === undefined) return fail('unsupported', `cannot test a point on a ${s.kind}`);
  return ok(v <= tolerance(o));
}
