/**
 * Plot operations shared by the graphing apps (prompt 034), pure: zoom variants of the zoom/view
 * menus and the function analysis near the cursor (root, intersection, slope, extremum, signed
 * area, tangent). Values the core cannot confirm (poles, kinks) are reported as missing, not guessed.
 */
import {
  area,
  extrema,
  intersections,
  roots,
  tangent,
  type PointOfInterest,
} from '@aba/math/graph/analysis';
import { type Polyline, autoY, sample } from '@aba/math/graph/sampler';
import { type Viewport, STANDARD_VIEW, zoom } from '@aba/math/graph/viewport';

type Fn = (x: number) => number;

export type ZoomOp =
  | 'in'
  | 'out'
  | 'xin'
  | 'xout'
  | 'yin'
  | 'yout'
  | 'square'
  | 'auto'
  | 'decimal'
  | 'integer'
  | 'trig'
  | 'standard';

export const ZOOM_OPS: ZoomOp[] = [
  'in',
  'out',
  'xin',
  'xout',
  'yin',
  'yout',
  'square',
  'auto',
  'decimal',
  'integer',
  'trig',
  'standard',
];

/** A zoomed view around the centre (cx, cy); `size` is the plot in pixels, `f` the traced function. */
export function zoomView(
  v: Viewport,
  op: ZoomOp,
  size: { width: number; height: number },
  cx = (v.xmin + v.xmax) / 2,
  cy = (v.ymin + v.ymax) / 2,
  f?: Fn,
): Viewport {
  const w = v.xmax - v.xmin;
  const h = v.ymax - v.ymin;
  const aspect = size.height / size.width;
  switch (op) {
    case 'in':
      return zoom(v, 0.5, cx, cy);
    case 'out':
      return zoom(v, 2, cx, cy);
    case 'xin':
      return { ...v, xmin: cx - w / 4, xmax: cx + w / 4 };
    case 'xout':
      return { ...v, xmin: cx - w, xmax: cx + w };
    case 'yin':
      return { ...v, ymin: cy - h / 4, ymax: cy + h / 4 };
    case 'yout':
      return { ...v, ymin: cy - h, ymax: cy + h };
    case 'square': {
      // equal units on both axes: keep the x range, fit y around its centre
      const ny = (w * aspect) / 2;
      const my = (v.ymin + v.ymax) / 2;
      return { ...v, ymin: my - ny, ymax: my + ny };
    }
    case 'auto': {
      const r = f && autoY(f, v.xmin, v.xmax);
      if (!r || !(r.ymax > r.ymin)) return v;
      const pad = (r.ymax - r.ymin) * 0.05;
      return { ...v, ymin: r.ymin - pad, ymax: r.ymax + pad };
    }
    case 'decimal': {
      // 0.1 per pixel, centred at the origin
      const hx = (size.width * 0.1) / 2;
      const hy = (size.height * 0.1) / 2;
      return { xmin: -hx, xmax: hx, ymin: -hy, ymax: hy };
    }
    case 'integer': {
      const hx = Math.round(size.width / 2);
      const hy = Math.round(size.height / 2);
      return { xmin: -hx, xmax: hx, ymin: -hy, ymax: hy };
    }
    case 'trig':
      return { xmin: -2 * Math.PI, xmax: 2 * Math.PI, ymin: -3, ymax: 3 };
    case 'standard':
      return STANDARD_VIEW;
  }
}

export type FcnOp = 'root' | 'intersection' | 'slope' | 'extremum' | 'area' | 'tangent';
export const FCN_OPS: FcnOp[] = ['root', 'intersection', 'slope', 'extremum', 'area', 'tangent'];

export type FcnResult =
  | { kind: 'point'; label: string; x: number; y: number }
  | { kind: 'slope'; x: number; y: number; slope: number }
  | { kind: 'tangent'; x: number; y: number; slope: number }
  | { kind: 'area'; a: number; b: number; value: number }
  | { kind: 'none'; message: string };

const nearest = (ps: PointOfInterest[], x: number) =>
  ps.reduce<PointOfInterest | null>(
    (best, p) => (!best || Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best),
    null,
  );

/** The analysis near the cursor x within the visible range. */
export function fcn(
  op: FcnOp,
  f: Fn,
  others: Fn[],
  x: number,
  v: Viewport,
  areaFrom?: number,
): FcnResult {
  switch (op) {
    case 'root': {
      const p = nearest(roots(f, v.xmin, v.xmax), x);
      return p
        ? { kind: 'point', label: 'root', x: p.x, y: 0 }
        : { kind: 'none', message: 'no root in view' };
    }
    case 'extremum': {
      const p = nearest(extrema(f, v.xmin, v.xmax), x);
      return p
        ? { kind: 'point', label: p.kind, x: p.x, y: p.y }
        : { kind: 'none', message: 'no extremum in view' };
    }
    case 'intersection': {
      const ps = others.flatMap((g) => intersections(f, g, v.xmin, v.xmax));
      const p = nearest(ps, x);
      return p
        ? { kind: 'point', label: 'intersection', x: p.x, y: p.y }
        : { kind: 'none', message: 'no intersection in view' };
    }
    case 'slope':
    case 'tangent': {
      const t = tangent(f, x);
      if (!t.ok) return { kind: 'none', message: t.error.message };
      return { kind: op, x: t.value.x, y: t.value.y, slope: t.value.slope };
    }
    case 'area': {
      if (areaFrom === undefined)
        return { kind: 'none', message: 'move to the other bound and press Enter' };
      const [a, b] = areaFrom <= x ? [areaFrom, x] : [x, areaFrom];
      const r = area(f, a, b);
      if (!r.ok) return { kind: 'none', message: r.error.message };
      return { kind: 'area', a: areaFrom, b: x, value: r.value.value };
    }
  }
}

/** Curve of y = f(x) by plot method: adaptive (gaps at jumps), segments (1 px steps), dots. */
export function curveLines(
  f: Fn,
  v: Viewport,
  size: { width: number; height: number },
  method: 'adaptive' | 'segments' | 'dots',
): Polyline[] {
  if (method === 'adaptive') return sample(f, v, size);
  const n = Math.max(2, Math.round(size.width));
  const lines: Polyline[] = [];
  let cur: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = v.xmin + ((v.xmax - v.xmin) * i) / n;
    const y = f(x);
    if (!Number.isFinite(y)) {
      if (cur.length) lines.push(cur);
      cur = [];
      continue;
    }
    if (method === 'dots') lines.push([[x, y]]);
    else cur.push([x, y]);
  }
  if (cur.length) lines.push(cur);
  return lines;
}
