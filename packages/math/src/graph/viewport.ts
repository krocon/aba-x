/** Plot window maths (prompt 014): world ⇄ screen, nice tick steps, zoom and pan. Pure. */

export interface Viewport {
  readonly xmin: number;
  readonly xmax: number;
  readonly ymin: number;
  readonly ymax: number;
}

export const STANDARD_VIEW: Viewport = { xmin: -10, xmax: 10, ymin: -6.5, ymax: 6.5 };
export const TRIG_VIEW: Viewport = { xmin: -2 * Math.PI, xmax: 2 * Math.PI, ymin: -2, ymax: 2 };

/** 1, 2 or 5 × 10ⁿ – the step closest to range / target. */
export function niceStep(range: number, target = 8): number {
  const raw = Math.abs(range) / target;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** Tick positions within [a, b] for a step. */
export function ticks(a: number, b: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(a / step) * step;
  for (let t = first; t <= b + step * 1e-9 && out.length < 200; t += step) {
    out.push(Math.abs(t) < step * 1e-9 ? 0 : Number(t.toPrecision(12)));
  }
  return out;
}

/** Zoom by `factor` (< 1 = in) around the world point (cx, cy). */
export function zoom(
  v: Viewport,
  factor: number,
  cx = (v.xmin + v.xmax) / 2,
  cy = (v.ymin + v.ymax) / 2,
): Viewport {
  return {
    xmin: cx - (cx - v.xmin) * factor,
    xmax: cx + (v.xmax - cx) * factor,
    ymin: cy - (cy - v.ymin) * factor,
    ymax: cy + (v.ymax - cy) * factor,
  };
}

/** Moves the window by a fraction of its size (dx = 0.1 → 10 % to the right). */
export function pan(v: Viewport, dx: number, dy: number): Viewport {
  const w = (v.xmax - v.xmin) * dx;
  const h = (v.ymax - v.ymin) * dy;
  return { xmin: v.xmin + w, xmax: v.xmax + w, ymin: v.ymin + h, ymax: v.ymax + h };
}

export interface Screen {
  readonly width: number;
  readonly height: number;
}

export const toScreenX = (v: Viewport, s: Screen, x: number) =>
  ((x - v.xmin) / (v.xmax - v.xmin)) * s.width;
export const toScreenY = (v: Viewport, s: Screen, y: number) =>
  ((v.ymax - y) / (v.ymax - v.ymin)) * s.height;
export const toWorldX = (v: Viewport, s: Screen, px: number) =>
  v.xmin + (px / s.width) * (v.xmax - v.xmin);
export const toWorldY = (v: Viewport, s: Screen, py: number) =>
  v.ymax - (py / s.height) * (v.ymax - v.ymin);

/** A usable window: finite, non-empty, not absurdly small or large. */
export function valid(v: Viewport): boolean {
  const w = v.xmax - v.xmin;
  const h = v.ymax - v.ymin;
  return (
    [v.xmin, v.xmax, v.ymin, v.ymax].every(Number.isFinite) &&
    w > 1e-12 &&
    h > 1e-12 &&
    w < 1e12 &&
    h < 1e12
  );
}
