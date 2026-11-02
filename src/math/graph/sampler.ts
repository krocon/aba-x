/**
 * Adaptive sampling of y = f(x) for plotting (prompt 014). Returns polylines: a gap wherever f is
 * undefined, and wherever the curve jumps (a pole like tan x or 1/x, a step like floor x) – never a
 * vertical line across a discontinuity. Curved parts are refined until the chord is within half a pixel.
 */
import type { Viewport } from './viewport';

export type Point = readonly [number, number];
export type Polyline = Point[];

export interface SampleOptions {
  /** Plot width in pixels (sets the base resolution). */
  readonly width: number;
  readonly height: number;
  readonly maxDepth?: number;
}

export function sample(f: (x: number) => number, v: Viewport, o: SampleOptions): Polyline[] {
  const n = Math.max(50, Math.round(o.width));
  const yRange = v.ymax - v.ymin;
  const tol = (yRange / o.height) * 0.5;
  const maxDepth = o.maxDepth ?? 8;
  const clampLimit = yRange * 20;
  const clamp = (y: number) => Math.max(v.ymin - clampLimit, Math.min(v.ymax + clampLimit, y));
  const at = (x: number) => {
    const y = f(x);
    return Number.isFinite(y) ? y : NaN;
  };

  const lines: Polyline[] = [];
  let cur: Point[] = [];
  const flush = () => {
    if (cur.length > 1) lines.push(cur);
    else if (cur.length === 1) lines.push(cur); // isolated point (e.g. removable gap neighbours)
    cur = [];
  };

  /**
   * Is f continuous between the two points? Bisection follows the half that holds most of the
   * change: if the change stays concentrated while the interval shrinks to nothing, it is a jump
   * (floor x) or a pole (tan x); if it spreads out, the curve is just steep.
   */
  const jumpTol = (yRange / o.height) * 2;
  const continuous = (x0: number, y0: number, x1: number, y1: number, depth: number): boolean => {
    const dy = Math.abs(y1 - y0);
    if (dy <= jumpTol) return true;
    if (depth >= 40) return false;
    const xm = (x0 + x1) / 2;
    if (xm <= x0 || xm >= x1) return false;
    const ym = at(xm);
    if (Number.isNaN(ym)) return false;
    // the midpoint further out than both ends on the same side: a pole
    if ((ym - y0) * (ym - y1) > 0 && Math.abs(ym - (y0 + y1) / 2) > dy) return false;
    const left = Math.abs(ym - y0);
    const right = Math.abs(y1 - ym);
    if (left > 0.75 * dy) return continuous(x0, y0, xm, ym, depth + 1);
    if (right > 0.75 * dy) return continuous(xm, ym, x1, y1, depth + 1);
    return true;
  };

  const refine = (x0: number, y0: number, x1: number, y1: number, depth: number) => {
    if (depth >= maxDepth) return;
    const xm = (x0 + x1) / 2;
    const ym = at(xm);
    if (Number.isNaN(ym)) return;
    const lin = (y0 + y1) / 2;
    const offView =
      (y0 > v.ymax && y1 > v.ymax && ym > v.ymax) || (y0 < v.ymin && y1 < v.ymin && ym < v.ymin);
    if (Math.abs(ym - lin) <= tol || offView) return;
    refine(x0, y0, xm, ym, depth + 1);
    cur.push([xm, clamp(ym)]);
    refine(xm, ym, x1, y1, depth + 1);
  };

  let px = NaN;
  let py = NaN;
  for (let i = 0; i <= n; i++) {
    const x = v.xmin + ((v.xmax - v.xmin) * i) / n;
    const y = at(x);
    if (Number.isNaN(y)) {
      flush();
      px = NaN;
      continue;
    }
    if (!Number.isNaN(px)) {
      if (!continuous(px, py, x, y, 0)) {
        flush();
      } else {
        refine(px, py, x, y, 0);
      }
    }
    cur.push([x, clamp(y)]);
    px = x;
    py = y;
  }
  flush();
  return lines;
}

/** Robust automatic y-range: 5 %–95 % of the sampled values, padded; null if nothing is defined. */
export function autoY(
  f: (x: number) => number,
  xmin: number,
  xmax: number,
  n = 400,
): { ymin: number; ymax: number } | null {
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const y = f(xmin + ((xmax - xmin) * i) / n);
    if (Number.isFinite(y)) ys.push(y);
  }
  if (ys.length === 0) return null;
  ys.sort((a, b) => a - b);
  const lo = ys[Math.floor(ys.length * 0.05)];
  const hi = ys[Math.ceil(ys.length * 0.95) - 1];
  const pad = (hi - lo) * 0.15 || Math.max(1, Math.abs(lo) * 0.5);
  return { ymin: lo - pad, ymax: hi + pad };
}
