/**
 * Elementary constructions (prompt 042): intersections, special circles and lines of a triangle,
 * tangents, regular figures and points on objects. Pure functions on world coordinates; every
 * degenerate case yields a reason instead of a point.
 *
 * `eps` is an absolute length tolerance (the model passes 1e-9 × scene size).
 */
import { classifyConic, conicMatrix, conicPoint, normalizeConic } from './conic';
import {
  type ConicCoefficients,
  type Linear,
  type Shape,
  type Vec,
  add,
  asLinear,
  cross,
  dist,
  dot,
  footOnCarrier,
  lerp,
  mid,
  mul,
  norm,
  perp,
  projectParam,
  rotateVec,
  sub,
  undef,
  unit,
  vec,
} from './shapes';

/** One intersection on the full carriers; `valid` = it also lies on the bounded objects. */
export interface Candidate {
  readonly p: Vec;
  readonly valid: boolean;
}

/** Up to two candidates in canonical order, or why there is none. */
export type Candidates =
  | { readonly ok: true; readonly pts: readonly Candidate[] }
  | { readonly ok: false; readonly reason: string };

const none = (reason: string): Candidates => ({ ok: false, reason });

function inRange(l: Linear, t: number, eps: number): boolean {
  const et = eps / norm(l.d);
  return t >= l.tmin - et && t <= l.tmax + et;
}

const onLinear = (l: Linear, p: Vec, eps: number): boolean => inRange(l, projectParam(l, p), eps);

function linearLinear(l1: Linear, l2: Linear, eps: number): Candidates {
  const den = cross(l1.d, l2.d);
  if (Math.abs(den) <= 1e-12 * norm(l1.d) * norm(l2.d)) {
    const off = Math.abs(cross(sub(l2.p, l1.p), l1.d)) / norm(l1.d);
    return none(off <= eps ? 'the lines coincide' : 'the lines are parallel');
  }
  const w = sub(l2.p, l1.p);
  const t1 = cross(w, l2.d) / den;
  const t2 = cross(w, l1.d) / den;
  const p = add(l1.p, mul(l1.d, t1));
  return { ok: true, pts: [{ p, valid: inRange(l1, t1, eps) && inRange(l2, t2, eps) }] };
}

function linearCircle(l: Linear, c: Vec, r: number, eps: number): Candidates {
  const f = footOnCarrier(l, c);
  const h = dist(f, c);
  if (h > r + eps) return none('no intersection');
  if (Math.abs(h - r) <= eps) return { ok: true, pts: [{ p: f, valid: onLinear(l, f, eps) }] };
  const u = mul(l.d, 1 / norm(l.d));
  const s = Math.sqrt(r * r - h * h);
  const pts = [sub(f, mul(u, s)), add(f, mul(u, s))];
  return { ok: true, pts: pts.map((p) => ({ p, valid: onLinear(l, p, eps) })) };
}

function circleCircle(c1: Vec, r1: number, c2: Vec, r2: number, eps: number): Candidates {
  const d = dist(c1, c2);
  if (d <= eps) return none(Math.abs(r1 - r2) <= eps ? 'the circles coincide' : 'no intersection');
  if (d > r1 + r2 + eps || d < Math.abs(r1 - r2) - eps) return none('no intersection');
  const u = mul(sub(c2, c1), 1 / d);
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const base = add(c1, mul(u, a));
  if (Math.abs(d - r1 - r2) <= eps || Math.abs(d - Math.abs(r1 - r2)) <= eps)
    return { ok: true, pts: [{ p: base, valid: true }] };
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const n = perp(u);
  return {
    ok: true,
    pts: [
      { p: add(base, mul(n, h)), valid: true },
      { p: sub(base, mul(n, h)), valid: true },
    ],
  };
}

function linearConic(l: Linear, q0: ConicCoefficients, eps: number): Candidates {
  const q = normalizeConic(q0);
  const u = mul(l.d, 1 / norm(l.d));
  const s = conicMatrix(q);
  const P = [l.p.x, l.p.y, 1];
  const D = [u.x, u.y, 0];
  const form = (x: number[], y: number[]): number => {
    let v = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += x[i] * s[i][j] * y[j];
    return v;
  };
  const alpha = form(D, D);
  const beta = 2 * form(P, D);
  const gamma = form(P, P);
  const at = (t: number): Candidate => {
    const p = add(l.p, mul(u, t));
    return { p, valid: onLinear(l, p, eps) };
  };
  const big = Math.max(Math.abs(alpha), Math.abs(beta), Math.abs(gamma));
  if (Math.abs(alpha) <= 1e-12 * big) {
    if (Math.abs(beta) <= 1e-12 * big) return none('no intersection');
    return { ok: true, pts: [at(-gamma / beta)] };
  }
  const disc = beta * beta - 4 * alpha * gamma;
  const tol = 1e-10 * Math.max(beta * beta, Math.abs(4 * alpha * gamma));
  if (disc < -tol) return none('no intersection');
  if (disc <= tol) return { ok: true, pts: [at(-beta / (2 * alpha))] };
  const sq = Math.sqrt(disc);
  const t = [(-beta - sq) / (2 * alpha), (-beta + sq) / (2 * alpha)].sort((x, y) => x - y);
  return { ok: true, pts: t.map(at) };
}

/**
 * Intersections of two objects (line-likes, circles, line-like × conic) in canonical order:
 * along the line's direction; for two circles first the point left of centre₁ → centre₂.
 */
export function intersectionCandidates(a: Shape, b: Shape, eps: number): Candidates {
  const la = asLinear(a);
  const lb = asLinear(b);
  if (la && lb) return linearLinear(la, lb, eps);
  if (la && b.kind === 'circle') return linearCircle(la, b.c, b.r, eps);
  if (lb && a.kind === 'circle') return linearCircle(lb, a.c, a.r, eps);
  if (a.kind === 'circle' && b.kind === 'circle') return circleCircle(a.c, a.r, b.c, b.r, eps);
  if (la && b.kind === 'conic') return linearConic(la, b.q, eps);
  if (lb && a.kind === 'conic') return linearConic(lb, a.q, eps);
  if (a.kind === 'segment' || b.kind === 'segment') return none('degenerate segment');
  return none('unsupported intersection');
}

/**
 * Picks one candidate: with a previous position the nearest one (keeps the branch while dragging),
 * otherwise the `index`-th (1-based) in canonical order. A tangential double point serves both
 * indices. Candidates off the bounded objects give `undefined`.
 */
export function chooseIntersection(c: Candidates, index: number, prev?: Vec): Shape {
  if (!c.ok) return undef(c.reason);
  let pick: Candidate | undefined;
  if (c.pts.length === 1) pick = c.pts[0];
  else if (prev)
    pick = c.pts.reduce((best, x) => (dist(x.p, prev) < dist(best.p, prev) ? x : best));
  else pick = c.pts[index - 1];
  if (!pick) return undef(`there is no intersection number ${index}`);
  return pick.valid
    ? { kind: 'point', p: pick.p }
    : undef('the intersection lies outside the object');
}

/** Circle through three points; collinear points have none. */
export function circumcircle(a: Vec, b: Vec, c: Vec, eps: number): Shape {
  const ba = sub(b, a);
  const ca = sub(c, a);
  const d = 2 * cross(ba, ca);
  if (Math.abs(d) <= 2 * eps * Math.max(norm(ba), norm(ca), eps))
    return undef('the points are collinear');
  const b2 = dot(ba, ba);
  const c2 = dot(ca, ca);
  const center = add(a, vec((ca.y * b2 - ba.y * c2) / d, (ba.x * c2 - ca.x * b2) / d));
  return { kind: 'circle', c: center, r: dist(center, a) };
}

/** Side lengths opposite to A, B, C and the (unsigned) area; `undefined` when degenerate. */
function triangleData(
  a: Vec,
  b: Vec,
  c: Vec,
  eps: number,
): { la: number; lb: number; lc: number; area: number } | undefined {
  const area = Math.abs(cross(sub(b, a), sub(c, a))) / 2;
  const la = dist(b, c);
  const lb = dist(c, a);
  const lc = dist(a, b);
  if (area <= eps * Math.max(la, lb, lc, eps)) return undefined;
  return { la, lb, lc, area };
}

export function incircle(a: Vec, b: Vec, c: Vec, eps: number): Shape {
  const t = triangleData(a, b, c, eps);
  if (!t) return undef('the points are collinear');
  const p = t.la + t.lb + t.lc;
  const center = mul(add(add(mul(a, t.la), mul(b, t.lb)), mul(c, t.lc)), 1 / p);
  return { kind: 'circle', c: center, r: (2 * t.area) / p };
}

/** Excircle opposite to vertex `index` (1 = A, 2 = B, 3 = C). */
export function excircle(a: Vec, b: Vec, c: Vec, index: number, eps: number): Shape {
  const t = triangleData(a, b, c, eps);
  if (!t) return undef('the points are collinear');
  if (![1, 2, 3].includes(index)) return undef('the excircle index must be 1, 2 or 3');
  const w = [index === 1 ? -t.la : t.la, index === 2 ? -t.lb : t.lb, index === 3 ? -t.lc : t.lc];
  const sum = w[0] + w[1] + w[2];
  const center = mul(add(add(mul(a, w[0]), mul(b, w[1])), mul(c, w[2])), 1 / sum);
  const s = (t.la + t.lb + t.lc) / 2;
  const opposite = [t.la, t.lb, t.lc][index - 1];
  return { kind: 'circle', c: center, r: t.area / (s - opposite) };
}

/** Tangent from `p` to the circle (centre `c`, radius `r`); index 1 or 2 picks the touch point. */
export function tangentLine(p: Vec, c: Vec, r: number, index: number, eps: number): Shape {
  const d = dist(p, c);
  if (d < r - eps) return undef('the point lies inside the circle');
  const u = unit(sub(p, c));
  if (!u) return undef('the point lies inside the circle');
  if (Math.abs(d - r) <= eps) return { kind: 'line', p, d: perp(u) };
  if (index !== 1 && index !== 2) return undef('the tangent index must be 1 or 2');
  const alpha = Math.acos(r / d) * (index === 1 ? 1 : -1);
  const touch = add(c, mul(rotateVec(u, alpha), r));
  const dir = unit(sub(touch, p));
  return dir ? { kind: 'line', p, d: dir } : undef('degenerate tangent');
}

/** Bisector of the angle ABC (vertex B) as a line. */
export function angleBisector(a: Vec, b: Vec, c: Vec): Shape {
  const u = unit(sub(a, b));
  const v = unit(sub(c, b));
  if (!u || !v) return undef('a side of the angle has length 0');
  const dir = unit(add(u, v)) ?? perp(u);
  return { kind: 'line', p: b, d: dir };
}

/** Perpendicular bisector of AB. */
export function perpendicularBisector(a: Vec, b: Vec): Shape {
  const u = unit(sub(b, a));
  return u ? { kind: 'line', p: mid(a, b), d: perp(u) } : undef('the two points coincide');
}

/** Foot of the perpendicular from `p` onto the line through a and b. */
export function foot(p: Vec, a: Vec, b: Vec): Vec | undefined {
  const d = sub(b, a);
  if (!(norm(d) > 0)) return undefined;
  return footOnCarrier({ p: a, d, tmin: -Infinity, tmax: Infinity }, p);
}

/** Regular n-gon with centre `c` and first vertex `v`, counter-clockwise. */
export function regularPolygon(c: Vec, v: Vec, n: number): Shape {
  if (!Number.isInteger(n) || n < 3 || n > 1000)
    return undef('n must be an integer from 3 to 1000');
  if (dist(c, v) === 0) return undef('the vertex coincides with the centre');
  const r = sub(v, c);
  const pts = Array.from({ length: n }, (_, k) => add(c, rotateVec(r, (2 * Math.PI * k) / n)));
  return { kind: 'polygon', pts };
}

/** Equilateral triangle on AB (third vertex to the left of A → B). */
export function equilateralTriangle(a: Vec, b: Vec): Shape {
  if (dist(a, b) === 0) return undef('the two points coincide');
  return { kind: 'polygon', pts: [a, b, add(a, rotateVec(sub(b, a), Math.PI / 3))] };
}

/** Square on AB (to the left of A → B). */
export function square(a: Vec, b: Vec): Shape {
  if (dist(a, b) === 0) return undef('the two points coincide');
  const n = perp(sub(b, a));
  return { kind: 'polygon', pts: [a, b, add(b, n), add(a, n)] };
}

/** Parallelogram A, B, C, D with D = A + C − B. */
export function parallelogram(a: Vec, b: Vec, c: Vec): Shape {
  return { kind: 'polygon', pts: [a, b, c, sub(add(a, c), b)] };
}

/** Perimeter-length positions of the vertices of a closed polygon (cumulative, last = total). */
function polygonLengths(pts: readonly Vec[]): number[] {
  const out = [0];
  for (let i = 0; i < pts.length; i++) out.push(out[i] + dist(pts[i], pts[(i + 1) % pts.length]));
  return out;
}

/**
 * Point of an object for a parameter: line/ray = signed distance from the base point, segment =
 * fraction t ∈ [0, 1], circle and ellipse = angle (rad), polygon = fraction of the perimeter,
 * parabola = abscissa along the axis frame, hyperbola = u on the first branch.
 */
export function pointOn(carrier: Shape, t: number): Shape {
  switch (carrier.kind) {
    case 'line':
      return { kind: 'point', p: add(carrier.p, mul(carrier.d, t)) };
    case 'ray':
      return { kind: 'point', p: add(carrier.p, mul(carrier.d, Math.max(0, t))) };
    case 'segment':
      return { kind: 'point', p: lerp(carrier.a, carrier.b, Math.min(1, Math.max(0, t))) };
    case 'circle':
      return {
        kind: 'point',
        p: add(carrier.c, vec(carrier.r * Math.cos(t), carrier.r * Math.sin(t))),
      };
    case 'polygon': {
      const len = polygonLengths(carrier.pts);
      const total = len[len.length - 1];
      if (!(total > 0)) return { kind: 'point', p: carrier.pts[0] };
      const s = (((t % 1) + 1) % 1) * total;
      let i = 0;
      while (i < carrier.pts.length - 1 && len[i + 1] < s) i++;
      const seg = len[i + 1] - len[i];
      const a = carrier.pts[i];
      const b = carrier.pts[(i + 1) % carrier.pts.length];
      return { kind: 'point', p: seg > 0 ? lerp(a, b, (s - len[i]) / seg) : a };
    }
    case 'conic': {
      const p = conicPoint(classifyConic(carrier.q), t);
      return p ? { kind: 'point', p } : undef('the conic is degenerate');
    }
    default:
      return undef('a point cannot lie on this object');
  }
}

/** Parameter of the point of `carrier` nearest to `q` (inverse of `pointOn`, for dragging). */
export function nearestParameter(carrier: Shape, q: Vec): number | undefined {
  switch (carrier.kind) {
    case 'line':
      return dot(sub(q, carrier.p), carrier.d);
    case 'ray':
      return Math.max(0, dot(sub(q, carrier.p), carrier.d));
    case 'segment': {
      const l = asLinear(carrier);
      return l ? Math.min(1, Math.max(0, projectParam(l, q))) : 0;
    }
    case 'circle':
      return Math.atan2(q.y - carrier.c.y, q.x - carrier.c.x);
    case 'polygon': {
      const pts = carrier.pts;
      const len = polygonLengths(pts);
      const total = len[len.length - 1];
      if (!(total > 0)) return 0;
      let best = Infinity;
      let at = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const l = asLinear({ kind: 'segment', a, b });
        const t = l ? Math.min(1, Math.max(0, projectParam(l, q))) : 0;
        const d = dist(lerp(a, b, t), q);
        if (d < best) {
          best = d;
          at = (len[i] + t * (len[i + 1] - len[i])) / total;
        }
      }
      return at;
    }
    case 'conic': {
      const form = classifyConic(carrier.q);
      if (form.type === 'degenerate') return undefined;
      const anchor = form.type === 'parabola' ? form.vertex : form.center;
      const reach = dist(q, anchor) + 1;
      const [lo, hi] =
        form.type === 'ellipse'
          ? [-Math.PI, Math.PI]
          : form.type === 'hyperbola'
            ? [-Math.acosh(reach / form.a + 1), Math.acosh(reach / form.a + 1)]
            : [-reach, reach];
      return minimise(
        (t) => {
          const p = conicPoint(form, t);
          return p ? dist(p, q) : Infinity;
        },
        lo,
        hi,
      );
    }
    default:
      return undefined;
  }
}

/** Global minimum of a 1-D function on [lo, hi]: coarse scan, then golden-section refinement. */
function minimise(f: (t: number) => number, lo: number, hi: number): number {
  const n = 720;
  let bi = 0;
  let bv = Infinity;
  for (let i = 0; i <= n; i++) {
    const v = f(lo + ((hi - lo) * i) / n);
    if (v < bv) {
      bv = v;
      bi = i;
    }
  }
  let a = lo + ((hi - lo) * Math.max(0, bi - 1)) / n;
  let b = lo + ((hi - lo) * Math.min(n, bi + 1)) / n;
  const g = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 80; k++) {
    const x1 = b - g * (b - a);
    const x2 = a + g * (b - a);
    if (f(x1) < f(x2)) b = x2;
    else a = x1;
  }
  return (a + b) / 2;
}
