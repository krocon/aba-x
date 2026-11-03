/**
 * Command set of the geometry app (prompt 042): for every construction command the allowed argument
 * kinds, the static result kinds and the pure computation. The model (`model.ts`) resolves
 * references and keeps the dependency graph; everything here is stateless.
 *
 * Angles are radians; numbers are literals or sliders. Index arguments are 1-based.
 */
import { conicFromAxes, conicFromFocusDirectrix, conicThroughFive } from './conic';
import {
  angleBisector,
  chooseIntersection,
  circumcircle,
  equilateralTriangle,
  excircle,
  foot,
  incircle,
  intersectionCandidates,
  parallelogram,
  perpendicularBisector,
  pointOn,
  regularPolygon,
  square,
  tangentLine,
} from './constructions';
import {
  LINEAR_KINDS,
  type Shape,
  type ShapeKind,
  type Vec,
  asLinear,
  dist,
  lineThrough,
  mid,
  perp,
  point,
  sub,
  undef,
  unit,
  vec,
} from './shapes';
import {
  applyAffine,
  dilation,
  invert,
  lineReflection,
  pointReflection,
  project,
  rotation,
  similarity,
  translation,
} from './transform';

export type GeoCommand =
  | 'point'
  | 'pointOn'
  | 'midpoint'
  | 'intersect'
  | 'segment'
  | 'ray'
  | 'line'
  | 'parallel'
  | 'perpendicular'
  | 'perpBisector'
  | 'angleBisector'
  | 'tangent'
  | 'altitude'
  | 'median'
  | 'polygon'
  | 'triangle'
  | 'equilateral'
  | 'square'
  | 'parallelogram'
  | 'regularPolygon'
  | 'circle'
  | 'circumcircle'
  | 'incircle'
  | 'excircle'
  | 'ellipse'
  | 'hyperbola'
  | 'parabola'
  | 'conic'
  | 'locus'
  | 'slider'
  | 'translate'
  | 'rotate'
  | 'reflect'
  | 'dilate'
  | 'similarity'
  | 'project'
  | 'invert';

/** Evaluation context: absolute tolerance, scene size, previous value of the object (dragging). */
export interface CommandContext {
  readonly eps: number;
  readonly scale: number;
  readonly prev?: Shape;
}

type Kinds = readonly ShapeKind[];

export interface CommandSpec {
  /** One-line signature for help and error messages. */
  readonly usage: string;
  /** Allowed kinds per argument position (`number` = literal or slider). */
  readonly args: readonly Kinds[];
  /** Number of required arguments; missing optional ones take `defaults`. */
  readonly min: number;
  readonly defaults?: readonly (number | undefined)[];
  /** Static result kinds for the argument kinds, or an error message. */
  readonly out: (kinds: readonly Kinds[]) => Kinds | string;
  readonly compute: (a: readonly Shape[], ctx: CommandContext) => Shape;
}

const P: Kinds = ['point'];
const N: Kinds = ['number'];
const LIN: Kinds = LINEAR_KINDS;
const C: Kinds = ['circle'];
/** Kinds a transformation accepts. */
const FIG: Kinds = ['point', 'line', 'ray', 'segment', 'circle', 'polygon', 'conic', 'polyline'];
const has = (k: Kinds, kind: ShapeKind): boolean => k.includes(kind);
const only =
  (...k: ShapeKind[]) =>
  (): Kinds =>
    k;

// Accessors – the model has checked the kinds, so the casts are safe.
const pt = (s: Shape): Vec => (s as { p: Vec }).p;
const num = (s: Shape): number => (s as { value: number }).value;
const ptAt = (a: readonly Shape[], i: number): Vec => pt(a[i]);

/** Unit direction of a line-like shape. */
function direction(s: Shape): Vec | undefined {
  if (s.kind === 'line' || s.kind === 'ray') return s.d;
  if (s.kind === 'segment') return unit(sub(s.b, s.a));
  return undefined;
}

function throughWithDirection(p: Vec, d: Vec | undefined): Shape {
  return d ? { kind: 'line', p, d } : undef('the direction is undefined');
}

/** Similarity maps keep the kind of the transformed object. */
const sameKinds = (k: readonly Kinds[]): Kinds => k[0];

function ellipseConic(f1: Vec, f2: Vec, p: Vec, eps: number): Shape {
  const a = (dist(p, f1) + dist(p, f2)) / 2;
  const c = dist(f1, f2) / 2;
  const b2 = a * a - c * c;
  if (b2 <= eps * a) return undef('the point lies on the segment of the foci');
  const angle = Math.atan2(f2.y - f1.y, f2.x - f1.x);
  return { kind: 'conic', q: conicFromAxes(mid(f1, f2), angle, 1 / (a * a), 1 / b2, -1) };
}

function hyperbolaConic(f1: Vec, f2: Vec, p: Vec, eps: number): Shape {
  const c = dist(f1, f2) / 2;
  if (c <= eps) return undef('the foci coincide');
  const a = Math.abs(dist(p, f1) - dist(p, f2)) / 2;
  if (a <= eps) return undef('the point lies on the perpendicular bisector of the foci');
  const b2 = c * c - a * a;
  if (b2 <= eps * c) return undef('the point lies on the line of the foci');
  const angle = Math.atan2(f2.y - f1.y, f2.x - f1.x);
  return { kind: 'conic', q: conicFromAxes(mid(f1, f2), angle, 1 / (a * a), -1 / b2, -1) };
}

function projectOut(k: readonly Kinds[]): Kinds {
  const s = k[0];
  if (s.length === 1 && (s[0] === 'point' || s[0] === 'line' || s[0] === 'ray')) return s;
  return ['segment'];
}

function invertOut(k: readonly Kinds[]): Kinds {
  const s = k[0];
  if (s.length === 1 && s[0] === 'point') return P;
  if (s.every((x) => x === 'line' || x === 'circle')) return ['line', 'circle'];
  return ['polyline'];
}

export const COMMANDS: Readonly<Record<GeoCommand, CommandSpec>> = {
  point: {
    usage: 'point(x, y)',
    args: [N, N],
    min: 2,
    out: only('point'),
    compute: (a) => point(vec(num(a[0]), num(a[1]))),
  },
  pointOn: {
    usage: 'pointOn(object, t)',
    args: [['line', 'ray', 'segment', 'circle', 'polygon', 'conic'], N],
    min: 1,
    defaults: [undefined, 0],
    out: only('point'),
    compute: (a) => pointOn(a[0], num(a[1])),
  },
  midpoint: {
    usage: 'midpoint(A, B) | midpoint(segment)',
    args: [['point', 'segment'], P],
    min: 1,
    out: (k) =>
      has(k[0], 'segment')
        ? k.length === 1
          ? P
          : 'midpoint(segment) takes one argument'
        : k.length === 2
          ? P
          : 'midpoint needs two points',
    compute: (a) =>
      a[0].kind === 'segment' ? point(mid(a[0].a, a[0].b)) : point(mid(ptAt(a, 0), ptAt(a, 1))),
  },
  intersect: {
    usage: 'intersect(object1, object2, index)',
    args: [[...LIN, 'circle', 'conic'], [...LIN, 'circle', 'conic'], N],
    min: 2,
    defaults: [undefined, undefined, 1],
    out: (k) =>
      has(k[0], 'conic') && has(k[1], 'conic')
        ? 'two conics cannot be intersected'
        : (has(k[0], 'conic') && has(k[1], 'circle')) || (has(k[1], 'conic') && has(k[0], 'circle'))
          ? 'a circle and a conic cannot be intersected'
          : P,
    compute: (a, ctx) =>
      chooseIntersection(
        intersectionCandidates(a[0], a[1], ctx.eps),
        Math.round(num(a[2])),
        ctx.prev?.kind === 'point' ? ctx.prev.p : undefined,
      ),
  },
  segment: {
    usage: 'segment(A, B)',
    args: [P, P],
    min: 2,
    out: only('segment'),
    compute: (a) => ({ kind: 'segment', a: ptAt(a, 0), b: ptAt(a, 1) }),
  },
  ray: {
    usage: 'ray(A, B)',
    args: [P, P],
    min: 2,
    out: only('ray'),
    compute: (a) => lineThrough(ptAt(a, 0), ptAt(a, 1), 'ray'),
  },
  line: {
    usage: 'line(A, B)',
    args: [P, P],
    min: 2,
    out: only('line'),
    compute: (a) => lineThrough(ptAt(a, 0), ptAt(a, 1)),
  },
  parallel: {
    usage: 'parallel(P, line)',
    args: [P, LIN],
    min: 2,
    out: only('line'),
    compute: (a) => throughWithDirection(ptAt(a, 0), direction(a[1])),
  },
  perpendicular: {
    usage: 'perpendicular(P, line)',
    args: [P, LIN],
    min: 2,
    out: only('line'),
    compute: (a) => {
      const d = direction(a[1]);
      return throughWithDirection(ptAt(a, 0), d && perp(d));
    },
  },
  perpBisector: {
    usage: 'perpBisector(A, B) | perpBisector(segment)',
    args: [['point', 'segment'], P],
    min: 1,
    out: (k) =>
      has(k[0], 'segment') || k.length === 2 ? ['line'] : 'perpBisector needs two points',
    compute: (a) =>
      a[0].kind === 'segment'
        ? perpendicularBisector(a[0].a, a[0].b)
        : perpendicularBisector(ptAt(a, 0), ptAt(a, 1)),
  },
  angleBisector: {
    usage: 'angleBisector(A, B, C)  (vertex B)',
    args: [P, P, P],
    min: 3,
    out: only('line'),
    compute: (a) => angleBisector(ptAt(a, 0), ptAt(a, 1), ptAt(a, 2)),
  },
  tangent: {
    usage: 'tangent(P, circle, index)',
    args: [P, C, N],
    min: 2,
    defaults: [undefined, undefined, 1],
    out: only('line'),
    compute: (a, ctx) => {
      const c = a[1] as Extract<Shape, { kind: 'circle' }>;
      return tangentLine(ptAt(a, 0), c.c, c.r, Math.round(num(a[2])), ctx.eps);
    },
  },
  altitude: {
    usage: 'altitude(A, B, C)  (from A onto BC)',
    args: [P, P, P],
    min: 3,
    out: only('segment'),
    compute: (a) => {
      const f = foot(ptAt(a, 0), ptAt(a, 1), ptAt(a, 2));
      return f ? { kind: 'segment', a: ptAt(a, 0), b: f } : undef('B and C coincide');
    },
  },
  median: {
    usage: 'median(A, B, C)  (from A to the midpoint of BC)',
    args: [P, P, P],
    min: 3,
    out: only('segment'),
    compute: (a) => ({ kind: 'segment', a: ptAt(a, 0), b: mid(ptAt(a, 1), ptAt(a, 2)) }),
  },
  polygon: {
    usage: 'polygon(A, B, C, …)',
    args: [P, P, P],
    min: 3,
    out: only('polygon'),
    compute: (a) => ({ kind: 'polygon', pts: a.map(pt) }),
  },
  triangle: {
    usage: 'triangle(A, B, C)',
    args: [P, P, P],
    min: 3,
    out: only('polygon'),
    compute: (a) => ({ kind: 'polygon', pts: a.map(pt) }),
  },
  equilateral: {
    usage: 'equilateral(A, B)  (third vertex left of A → B)',
    args: [P, P],
    min: 2,
    out: only('polygon'),
    compute: (a) => equilateralTriangle(ptAt(a, 0), ptAt(a, 1)),
  },
  square: {
    usage: 'square(A, B)  (left of A → B)',
    args: [P, P],
    min: 2,
    out: only('polygon'),
    compute: (a) => square(ptAt(a, 0), ptAt(a, 1)),
  },
  parallelogram: {
    usage: 'parallelogram(A, B, C)',
    args: [P, P, P],
    min: 3,
    out: only('polygon'),
    compute: (a) => parallelogram(ptAt(a, 0), ptAt(a, 1), ptAt(a, 2)),
  },
  regularPolygon: {
    usage: 'regularPolygon(center, vertex, n)',
    args: [P, P, N],
    min: 3,
    out: only('polygon'),
    compute: (a) => regularPolygon(ptAt(a, 0), ptAt(a, 1), Math.round(num(a[2]))),
  },
  circle: {
    usage: 'circle(center, P) | circle(center, r) | circle(A, B, C)',
    args: [P, ['point', 'number'], P],
    min: 2,
    out: (k) => (k.length === 3 && !has(k[1], 'point') ? 'circle(A, B, C) needs three points' : C),
    compute: (a, ctx) => {
      if (a.length === 3) return circumcircle(ptAt(a, 0), ptAt(a, 1), ptAt(a, 2), ctx.eps);
      const r = a[1].kind === 'number' ? a[1].value : dist(ptAt(a, 0), ptAt(a, 1));
      return r > 0 ? { kind: 'circle', c: ptAt(a, 0), r } : undef('the radius must be positive');
    },
  },
  circumcircle: {
    usage: 'circumcircle(A, B, C)',
    args: [P, P, P],
    min: 3,
    out: only('circle'),
    compute: (a, ctx) => circumcircle(ptAt(a, 0), ptAt(a, 1), ptAt(a, 2), ctx.eps),
  },
  incircle: {
    usage: 'incircle(A, B, C)',
    args: [P, P, P],
    min: 3,
    out: only('circle'),
    compute: (a, ctx) => incircle(ptAt(a, 0), ptAt(a, 1), ptAt(a, 2), ctx.eps),
  },
  excircle: {
    usage: 'excircle(A, B, C, index)  (index 1–3: opposite A, B, C)',
    args: [P, P, P, N],
    min: 3,
    defaults: [undefined, undefined, undefined, 1],
    out: only('circle'),
    compute: (a, ctx) =>
      excircle(ptAt(a, 0), ptAt(a, 1), ptAt(a, 2), Math.round(num(a[3])), ctx.eps),
  },
  ellipse: {
    usage: 'ellipse(F1, F2, P)',
    args: [P, P, P],
    min: 3,
    out: only('conic'),
    compute: (a, ctx) => ellipseConic(ptAt(a, 0), ptAt(a, 1), ptAt(a, 2), ctx.eps),
  },
  hyperbola: {
    usage: 'hyperbola(F1, F2, P)',
    args: [P, P, P],
    min: 3,
    out: only('conic'),
    compute: (a, ctx) => hyperbolaConic(ptAt(a, 0), ptAt(a, 1), ptAt(a, 2), ctx.eps),
  },
  parabola: {
    usage: 'parabola(focus, directrix)',
    args: [P, LIN],
    min: 2,
    out: only('conic'),
    compute: (a, ctx) => {
      const l = asLinear(a[1]);
      const d = direction(a[1]);
      if (!l || !d) return undef('the directrix is degenerate');
      const f = ptAt(a, 0);
      const off = Math.abs((f.x - l.p.x) * d.y - (f.y - l.p.y) * d.x);
      if (off <= ctx.eps) return undef('the focus lies on the directrix');
      return { kind: 'conic', q: conicFromFocusDirectrix(f, l.p, d) };
    },
  },
  conic: {
    usage: 'conic(A, B, C, D, E)',
    args: [P, P, P, P, P],
    min: 5,
    out: only('conic'),
    compute: (a) => {
      const q = conicThroughFive(a.map(pt));
      return q ? { kind: 'conic', q } : undef('the five points do not determine a conic');
    },
  },
  locus: {
    usage: 'locus(P, Q)  (path of P while the point on object Q runs along its object)',
    args: [P, P],
    min: 2,
    out: only('polyline'),
    // Sampled by the model, which owns the dependency graph.
    compute: () => undef('the locus is computed by the construction'),
  },
  slider: {
    usage: 'slider(value, min, max)',
    args: [N, N, N],
    min: 1,
    defaults: [undefined, -5, 5],
    out: only('number'),
    compute: (a) => {
      const [v, lo, hi] = a.map(num);
      return lo <= hi
        ? { kind: 'number', value: Math.min(hi, Math.max(lo, v)) }
        : undef('min is greater than max');
    },
  },
  translate: {
    usage: 'translate(object, A, B) | translate(object, dx, dy)',
    args: [FIG, ['point', 'number'], ['point', 'number']],
    min: 3,
    out: sameKinds,
    compute: (a) => {
      const v =
        a[1].kind === 'point' && a[2].kind === 'point'
          ? sub(a[2].p, a[1].p)
          : a[1].kind === 'number' && a[2].kind === 'number'
            ? vec(a[1].value, a[2].value)
            : undefined;
      return v ? applyAffine(a[0], translation(v)) : undef('give two points or dx, dy');
    },
  },
  rotate: {
    usage: 'rotate(object, center, angle)',
    args: [FIG, P, N],
    min: 3,
    out: sameKinds,
    compute: (a) => applyAffine(a[0], rotation(ptAt(a, 1), num(a[2]))),
  },
  reflect: {
    usage: 'reflect(object, line | point)',
    args: [FIG, [...LIN, 'point']],
    min: 2,
    out: sameKinds,
    compute: (a) => {
      if (a[1].kind === 'point') return applyAffine(a[0], pointReflection(a[1].p));
      const l = asLinear(a[1]);
      const d = direction(a[1]);
      return l && d ? applyAffine(a[0], lineReflection(l.p, d)) : undef('the mirror is degenerate');
    },
  },
  dilate: {
    usage: 'dilate(object, center, factor)',
    args: [FIG, P, N],
    min: 3,
    out: sameKinds,
    compute: (a) =>
      num(a[2]) === 0
        ? undef('the factor must not be 0')
        : applyAffine(a[0], dilation(ptAt(a, 1), num(a[2]))),
  },
  similarity: {
    usage: 'similarity(object, center, factor, angle)',
    args: [FIG, P, N, N],
    min: 4,
    out: sameKinds,
    compute: (a) =>
      num(a[2]) === 0
        ? undef('the factor must not be 0')
        : applyAffine(a[0], similarity(ptAt(a, 1), num(a[2]), num(a[3]))),
  },
  project: {
    usage: 'project(object, line)',
    args: [FIG, LIN],
    min: 2,
    out: projectOut,
    compute: (a) => {
      const l = asLinear(a[1]);
      const d = direction(a[1]);
      return l && d ? project(a[0], l.p, d) : undef('the line is degenerate');
    },
  },
  invert: {
    usage: 'invert(object, circle)',
    args: [FIG, C],
    min: 2,
    out: invertOut,
    compute: (a, ctx) => {
      const c = a[1] as Extract<Shape, { kind: 'circle' }>;
      return invert(a[0], c.c, c.r, ctx.eps, 4 * ctx.scale);
    },
  },
};

/** Allowed kinds at argument position `i` (polygons are variadic: every extra argument is a point). */
export function allowedAt(cmd: GeoCommand, i: number): Kinds | undefined {
  const spec = COMMANDS[cmd];
  if (cmd === 'polygon') return P;
  return spec.args[i];
}

/** Maximum number of arguments (`Infinity` for polygons). */
export function maxArgs(cmd: GeoCommand): number {
  return cmd === 'polygon' ? Infinity : COMMANDS[cmd].args.length;
}

export const isCommand = (name: string): name is GeoCommand =>
  Object.prototype.hasOwnProperty.call(COMMANDS, name);
