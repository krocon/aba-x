/**
 * Parametric and polar curves (prompt 035), pure. `sampleParametric` walks the parameter range in
 * the given step and refines a step while the chord leaves the curve by more than half a pixel;
 * it breaks the line where the curve is undefined or jumps (no lines across a pole). Polar curves
 * are parametric curves x = r(θ)·cos θ, y = r(θ)·sin θ.
 */
import type { Polyline } from './sampler';
import type { Viewport } from './viewport';

export type Param2 = (t: number) => readonly [number, number];

export interface ParamOptions {
  tmin: number;
  tmax: number;
  /** base step of the parameter */
  tstep: number;
  width: number;
  height: number;
  maxDepth?: number;
}

export function sampleParametric(c: Param2, v: Viewport, o: ParamOptions): Polyline[] {
  const steps = Math.min(
    20000,
    Math.max(1, Math.ceil(Math.abs(o.tmax - o.tmin) / Math.abs(o.tstep || 1))),
  );
  const pxX = (v.xmax - v.xmin) / o.width;
  const pxY = (v.ymax - v.ymin) / o.height;
  const maxDepth = o.maxDepth ?? 6;
  const far = 20 * Math.max(v.xmax - v.xmin, v.ymax - v.ymin);
  const ok = (p: readonly [number, number]) => Number.isFinite(p[0]) && Number.isFinite(p[1]);
  const lines: Polyline[] = [];
  let cur: [number, number][] = [];
  const flush = () => {
    if (cur.length) lines.push(cur);
    cur = [];
  };
  /** between two defined points: refine, or break when the curve jumps */
  const segment = (
    t0: number,
    p0: readonly [number, number],
    t1: number,
    p1: readonly [number, number],
    depth: number,
  ) => {
    const tm = (t0 + t1) / 2;
    const pm = c(tm);
    const dist = Math.hypot((p1[0] - p0[0]) / pxX, (p1[1] - p0[1]) / pxY);
    if (!ok(pm)) {
      if (depth >= maxDepth) {
        flush();
        cur.push([p1[0], p1[1]]);
        return;
      }
      segment(t0, p0, tm, pm, depth + 1);
      return;
    }
    // deviation of the midpoint from the chord, in pixels
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    const dev = Math.hypot((pm[0] - mx) / pxX, (pm[1] - my) / pxY);
    if ((dev > 0.5 || dist > 40) && depth < maxDepth) {
      segment(t0, p0, tm, pm, depth + 1);
      segment(tm, pm, t1, p1, depth + 1);
      return;
    }
    if (
      dist > 40 &&
      (Math.abs(p1[0] - p0[0]) > far || Math.abs(p1[1] - p0[1]) > far || dev > dist)
    ) {
      flush(); // a jump through infinity (a pole)
    }
    cur.push([p1[0], p1[1]]);
  };
  let tPrev = o.tmin;
  let pPrev = c(tPrev);
  if (ok(pPrev)) cur.push([pPrev[0], pPrev[1]]);
  for (let k = 1; k <= steps; k++) {
    const t = k === steps ? o.tmax : o.tmin + (k * (o.tmax - o.tmin)) / steps;
    const p = c(t);
    if (!ok(p)) {
      flush();
    } else if (!ok(pPrev)) {
      cur.push([p[0], p[1]]);
    } else {
      segment(tPrev, pPrev, t, p, 0);
    }
    tPrev = t;
    pPrev = p;
  }
  flush();
  return lines;
}

/** A polar curve r(θ) as a parametric curve; θ in radians. */
export function polar(r: (theta: number) => number): Param2 {
  return (t) => {
    const rr = r(t);
    return [rr * Math.cos(t), rr * Math.sin(t)];
  };
}
