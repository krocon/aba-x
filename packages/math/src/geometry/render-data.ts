/**
 * Drawable primitives of a construction (prompt 042) in world coordinates: the UI maps them to the
 * screen and draws them; infinite objects are given as point + direction and clipped by the UI.
 * Hyperbolas and parabolas are sampled for the visible window; ellipses come as parameters.
 */
import type { Viewport } from '../graph/viewport';
import { classifyConic, conicPoint } from './conic';
import type { Construction } from './model';
import { type Shape, type Vec, dist, vec } from './shapes';

export type RenderPrimitive =
  | { readonly type: 'point'; readonly at: Vec }
  | { readonly type: 'segment'; readonly from: Vec; readonly to: Vec }
  /** Ray from `from` in unit direction `dir`. */
  | { readonly type: 'ray'; readonly from: Vec; readonly dir: Vec }
  /** Infinite line through `through` with unit direction `dir`. */
  | { readonly type: 'line'; readonly through: Vec; readonly dir: Vec }
  | { readonly type: 'circle'; readonly center: Vec; readonly r: number }
  /** Ellipse with semi-axes a (along `angle`, radians) and b. */
  | {
      readonly type: 'ellipse';
      readonly center: Vec;
      readonly a: number;
      readonly b: number;
      readonly angle: number;
    }
  | { readonly type: 'polygon'; readonly points: readonly Vec[] }
  | {
      readonly type: 'polyline';
      readonly paths: readonly (readonly Vec[])[];
      readonly closed: boolean;
    }
  /** Nothing to draw (number, undefined object, degenerate conic). */
  | { readonly type: 'none'; readonly reason: string };

export interface RenderItem {
  readonly id: number;
  readonly name: string;
  readonly hidden: boolean;
  readonly primitive: RenderPrimitive;
}

/** Distance from `p` to the farthest corner of the window. */
function reach(view: Viewport, p: Vec): number {
  return Math.max(
    dist(p, vec(view.xmin, view.ymin)),
    dist(p, vec(view.xmin, view.ymax)),
    dist(p, vec(view.xmax, view.ymin)),
    dist(p, vec(view.xmax, view.ymax)),
  );
}

function sampleRange(f: (t: number) => Vec | undefined, lo: number, hi: number, n: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const p = f(lo + ((hi - lo) * i) / n);
    if (p) out.push(p);
  }
  return out;
}

/** Drawable primitive of a shape; `view` bounds the sampling of unbounded conics. */
export function renderData(s: Shape, view: Viewport, samples = 200): RenderPrimitive {
  switch (s.kind) {
    case 'point':
      return { type: 'point', at: s.p };
    case 'segment':
      return { type: 'segment', from: s.a, to: s.b };
    case 'ray':
      return { type: 'ray', from: s.p, dir: s.d };
    case 'line':
      return { type: 'line', through: s.p, dir: s.d };
    case 'circle':
      return { type: 'circle', center: s.c, r: s.r };
    case 'polygon':
      return { type: 'polygon', points: s.pts };
    case 'polyline':
      return { type: 'polyline', paths: s.paths, closed: s.closed };
    case 'number':
      return { type: 'none', reason: 'a number' };
    case 'undefined':
      return { type: 'none', reason: s.reason };
    case 'conic': {
      const f = classifyConic(s.q);
      switch (f.type) {
        case 'ellipse':
          return { type: 'ellipse', center: f.center, a: f.a, b: f.b, angle: f.angle };
        case 'hyperbola': {
          const u = Math.acosh(Math.max(1, reach(view, f.center) / f.a)) + 0.05;
          const branch = (b: 1 | -1): Vec[] =>
            sampleRange((t) => conicPoint(f, t, b), -u, u, samples);
          return { type: 'polyline', paths: [branch(1), branch(-1)], closed: false };
        }
        case 'parabola': {
          const r = reach(view, f.vertex);
          const x = Math.min(r, Math.sqrt(r / Math.abs(f.k))) * 1.05;
          return {
            type: 'polyline',
            paths: [sampleRange((t) => conicPoint(f, t), -x, x, samples)],
            closed: false,
          };
        }
        default:
          return { type: 'none', reason: f.reason };
      }
    }
  }
}

/** Primitives of all objects of a construction, in drawing (= creation) order. */
export function renderScene(c: Construction, view: Viewport): RenderItem[] {
  return c.objects().map((o) => ({
    id: o.id,
    name: o.name,
    hidden: o.hidden,
    primitive: renderData(o.value, view),
  }));
}
