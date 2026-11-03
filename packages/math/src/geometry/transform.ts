/**
 * Transformations (prompt 042): translation, rotation, reflection in a line or a point, dilation,
 * similarity (all as affine similarity maps), orthogonal projection onto a line and inversion in a
 * circle – applied to every shape kind where meaningful.
 */
import { type Affine, classifyConic, conicPoint, transformConic } from './conic';
import {
  type Shape,
  type Vec,
  add,
  cross,
  dist,
  dot,
  lerp,
  mid,
  mul,
  norm,
  perp,
  sub,
  undef,
  unit,
  vec,
} from './shapes';

export type { Affine } from './conic';

const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export const applyToVec = (t: Affine, p: Vec): Vec =>
  vec(t.a * p.x + t.b * p.y + t.e, t.c * p.x + t.d * p.y + t.f);

/** Linear part L applied around a fixed centre: x ↦ c + L(x − c). */
function aroundCenter(a: number, b: number, c: number, d: number, center: Vec): Affine {
  return {
    a,
    b,
    c,
    d,
    e: center.x - (a * center.x + b * center.y),
    f: center.y - (c * center.x + d * center.y),
  };
}

export const translation = (v: Vec): Affine => ({ ...IDENTITY, e: v.x, f: v.y });

/** Rotation by `angle` and scaling by `k` about `center` (spiral similarity). */
export function similarity(center: Vec, k: number, angle: number): Affine {
  const c = k * Math.cos(angle);
  const s = k * Math.sin(angle);
  return aroundCenter(c, -s, s, c, center);
}

export const rotation = (center: Vec, angle: number): Affine => similarity(center, 1, angle);
export const dilation = (center: Vec, k: number): Affine => aroundCenter(k, 0, 0, k, center);
export const pointReflection = (center: Vec): Affine => aroundCenter(-1, 0, 0, -1, center);

/** Reflection in the line through `p` with unit direction `d`. */
export function lineReflection(p: Vec, d: Vec): Affine {
  const xx = d.x * d.x - d.y * d.y;
  const xy = 2 * d.x * d.y;
  return aroundCenter(xx, xy, xy, -xx, p);
}

/** Image of a shape under a similarity map (circles stay circles, radii scale by √|det|). */
export function applyAffine(s: Shape, t: Affine): Shape {
  const f = (p: Vec): Vec => applyToVec(t, p);
  const dir = (p: Vec, d: Vec): Vec | undefined => unit(sub(f(add(p, d)), f(p)));
  switch (s.kind) {
    case 'point':
      return { kind: 'point', p: f(s.p) };
    case 'line':
    case 'ray': {
      const d = dir(s.p, s.d);
      return d ? { kind: s.kind, p: f(s.p), d } : undef('the map is degenerate');
    }
    case 'segment':
      return { kind: 'segment', a: f(s.a), b: f(s.b) };
    case 'circle':
      return { kind: 'circle', c: f(s.c), r: s.r * Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)) };
    case 'polygon':
      return { kind: 'polygon', pts: s.pts.map(f) };
    case 'polyline':
      return { kind: 'polyline', paths: s.paths.map((p) => p.map(f)), closed: s.closed };
    case 'conic': {
      const q = transformConic(s.q, t);
      return q ? { kind: 'conic', q } : undef('the map is degenerate');
    }
    default:
      return s;
  }
}

/**
 * Orthogonal projection onto the line (p, unit d): points → point, line → the line, ray → ray,
 * bounded figures → the segment they cover. A line or ray perpendicular to the target collapses
 * to a point and is reported as `undefined` (the object keeps its kind).
 */
export function project(s: Shape, p: Vec, d: Vec): Shape {
  const param = (x: Vec): number => dot(sub(x, p), d);
  const at = (t: number): Vec => add(p, mul(d, t));
  const cover = (ts: number[]): Shape => ({
    kind: 'segment',
    a: at(Math.min(...ts)),
    b: at(Math.max(...ts)),
  });
  switch (s.kind) {
    case 'point':
      return { kind: 'point', p: at(param(s.p)) };
    case 'line':
    case 'ray': {
      const c = dot(s.d, d);
      if (Math.abs(c) < 1e-12) return undef('the projection is a single point');
      return s.kind === 'line'
        ? { kind: 'line', p: at(param(s.p)), d }
        : { kind: 'ray', p: at(param(s.p)), d: mul(d, Math.sign(c)) };
    }
    case 'segment':
      return cover([param(s.a), param(s.b)]);
    case 'polygon':
      return cover(s.pts.map(param));
    case 'polyline': {
      const all = s.paths.flat();
      return all.length ? cover(all.map(param)) : undef('the curve is empty');
    }
    case 'circle':
      return cover([param(s.c) - s.r, param(s.c) + s.r]);
    case 'conic': {
      const form = classifyConic(s.q);
      if (form.type !== 'ellipse') return undef('the projection is unbounded');
      const phi = Math.atan2(d.y, d.x) - form.angle;
      const half = Math.hypot(form.a * Math.cos(phi), form.b * Math.sin(phi));
      const t = param(form.center);
      return cover([t - half, t + half]);
    }
    default:
      return undef('cannot project this object');
  }
}

/** Number of samples per edge / curve when an inverted figure becomes a polyline. */
const SAMPLES = 256;

/**
 * Inversion in the circle (o, r): points, lines and circles map exactly (a line or circle through
 * the centre swaps kind); other figures are sampled into a polyline. `reach` bounds the sampled
 * part of rays. The centre itself has no image.
 */
export function invert(s: Shape, o: Vec, r: number, eps: number, reach = 100): Shape {
  const inv = (p: Vec): Vec | undefined => {
    const v = sub(p, o);
    const n2 = dot(v, v);
    return n2 > eps * eps ? add(o, mul(v, (r * r) / n2)) : undefined;
  };
  const sampled = (pts: Vec[], closed: boolean): Shape => {
    const paths: Vec[][] = [];
    let cur: Vec[] = [];
    for (const p of pts) {
      const q = inv(p);
      if (q && Number.isFinite(q.x) && Number.isFinite(q.y)) cur.push(q);
      else if (cur.length) {
        paths.push(cur);
        cur = [];
      }
    }
    if (cur.length) paths.push(cur);
    return paths.length ? { kind: 'polyline', paths, closed } : undef('the image is empty');
  };
  const edge = (a: Vec, b: Vec): Vec[] =>
    Array.from({ length: SAMPLES + 1 }, (_, i) => lerp(a, b, i / SAMPLES));
  switch (s.kind) {
    case 'point': {
      const q = inv(s.p);
      return q ? { kind: 'point', p: q } : undef('the centre of inversion has no image');
    }
    case 'line': {
      const f = add(s.p, mul(s.d, dot(sub(o, s.p), s.d)));
      if (dist(f, o) <= eps) return s;
      const g = inv(f);
      return g ? { kind: 'circle', c: mid(o, g), r: dist(o, g) / 2 } : undef('degenerate');
    }
    case 'circle': {
      const u = unit(sub(s.c, o)) ?? vec(1, 0);
      const far = inv(add(s.c, mul(u, s.r)));
      if (Math.abs(dist(s.c, o) - s.r) <= eps) {
        return far ? { kind: 'line', p: far, d: perp(u) } : undef('degenerate');
      }
      const near = inv(sub(s.c, mul(u, s.r)));
      if (!far || !near) return undef('degenerate');
      return { kind: 'circle', c: mid(far, near), r: dist(far, near) / 2 };
    }
    case 'segment':
      return sampled(edge(s.a, s.b), false);
    case 'ray':
      return sampled(edge(s.p, add(s.p, mul(s.d, reach))), false);
    case 'polygon':
      return sampled(
        s.pts.flatMap((p, i) => edge(p, s.pts[(i + 1) % s.pts.length]).slice(0, -1)),
        true,
      );
    case 'polyline':
      return s.paths.length === 1
        ? sampled([...s.paths[0]], s.closed)
        : undef('cannot invert a broken curve');
    case 'conic': {
      const form = classifyConic(s.q);
      if (form.type !== 'ellipse') return undef('only ellipses can be inverted');
      const pts = Array.from(
        { length: SAMPLES },
        (_, i) => conicPoint(form, (2 * Math.PI * i) / SAMPLES) ?? o,
      );
      return sampled(pts, true);
    }
    default:
      return undef('cannot invert this object');
  }
}

/** Whether two directions are parallel (|sin| below a tolerance). */
export const parallelDirections = (u: Vec, v: Vec, tol = 1e-9): boolean =>
  Math.abs(cross(u, v)) <= tol * norm(u) * norm(v);
