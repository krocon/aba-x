/**
 * Drawing helpers of the shared plot surface (prompt 033): axes, grid, tick labels, curves and
 * points on a canvas in world coordinates. Pure functions over a 2D context – used by every app of
 * ABA-T1 (function, parametric, statistics, geometry …).
 */
import type { Polyline } from '@aba/math/graph/sampler';
import { type Viewport, niceStep, ticks, toScreenX, toScreenY } from '@aba/math/graph/viewport';

export interface PlotPalette {
  bg: string;
  grid: string;
  axis: string;
  label: string;
}

export const LIGHT_PLOT: PlotPalette = {
  bg: '#ffffff',
  grid: '#e3e9e5',
  axis: '#5a6c67',
  label: '#3d514c',
};

export interface PlotFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  view: Viewport;
}

export const sx = (f: PlotFrame, x: number) => toScreenX(f.view, f, x);
export const sy = (f: PlotFrame, y: number) => toScreenY(f.view, f, y);

function label(x: number, step: number): string {
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  return Number(x.toFixed(Math.min(digits, 10))).toString();
}

/** Background, grid, axes and tick labels. */
export function drawAxes(
  f: PlotFrame,
  p: PlotPalette = LIGHT_PLOT,
  opt = { grid: true, labels: true },
): void {
  const { ctx, width, height, view: v } = f;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, width, height);
  const stepX = niceStep(v.xmax - v.xmin, width / 55);
  const stepY = niceStep(v.ymax - v.ymin, height / 40);
  if (opt.grid) {
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of ticks(v.xmin, v.xmax, stepX)) {
      const x = Math.round(sx(f, t)) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (const t of ticks(v.ymin, v.ymax, stepY)) {
      const y = Math.round(sy(f, t)) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }
  // axes (at 0 if visible, else at the edge)
  const ax = Math.round(Math.min(Math.max(sy(f, 0), 0), height - 1)) + 0.5;
  const ay = Math.round(Math.min(Math.max(sx(f, 0), 0), width - 1)) + 0.5;
  ctx.strokeStyle = p.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ax);
  ctx.lineTo(width, ax);
  ctx.moveTo(ay, 0);
  ctx.lineTo(ay, height);
  ctx.stroke();
  if (!opt.labels) return;
  ctx.fillStyle = p.label;
  ctx.font = `${Math.max(9, Math.round(height / 22))}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const lx = ticks(v.xmin, v.xmax, stepX * 2);
  for (const t of lx) {
    if (t === 0) continue;
    const x = sx(f, t);
    ctx.fillText(label(t, stepX), x, Math.min(ax + 3, height - 14));
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const t of ticks(v.ymin, v.ymax, stepY * 2)) {
    if (t === 0) continue;
    ctx.fillText(label(t, stepY), Math.min(ay + 3, width - 30), sy(f, t));
  }
}

/** Polylines in world coordinates. */
export function drawLines(
  f: PlotFrame,
  lines: readonly Polyline[],
  color: string,
  width = 2,
  dash: number[] = [],
): void {
  const { ctx } = f;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  for (const line of lines) {
    if (line.length === 1) {
      ctx.beginPath();
      ctx.arc(sx(f, line[0][0]), sy(f, line[0][1]), width, 0, 2 * Math.PI);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    line.forEach(([x, y], i) =>
      i ? ctx.lineTo(sx(f, x), sy(f, y)) : ctx.moveTo(sx(f, x), sy(f, y)),
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** Marked points (roots, cursor …): a ring with an optional label. */
export function drawPoint(f: PlotFrame, x: number, y: number, color: string, text?: string): void {
  const { ctx } = f;
  const px = sx(f, x);
  const py = sy(f, y);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, 2 * Math.PI);
  ctx.stroke();
  if (text) {
    ctx.fillStyle = color;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, px + 6, py - 4);
  }
  ctx.restore();
}

/** Crosshair cursor over the whole plot. */
export function drawCrosshair(f: PlotFrame, x: number, y: number, color = '#e8603f'): void {
  const { ctx, width, height } = f;
  const px = Math.round(sx(f, x)) + 0.5;
  const py = Math.round(sy(f, y)) + 0.5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, height);
  ctx.moveTo(0, py);
  ctx.lineTo(width, py);
  ctx.stroke();
  ctx.restore();
}
