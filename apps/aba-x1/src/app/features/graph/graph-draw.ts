/**
 * Draws the plot on a canvas (prompt 014) – used by the LCD view and by the PNG export, so both look
 * the same. LCD style: dark ink on green, functions told apart by line style, not colour.
 */
import type { PointOfInterest } from '@aba/math/graph/analysis';
import { type Polyline, sample } from '@aba/math/graph/sampler';
import { type Viewport, niceStep, ticks, toScreenX, toScreenY } from '@aba/math/graph/viewport';
import { DASHES } from './graph-export';
import type { AreaMark, PlotFunction } from './graph-store';

export interface PlotState {
  view: Viewport;
  functions: readonly PlotFunction[];
  selected: number;
  trace: number | null;
  marks: readonly PointOfInterest[];
  tangent: { x: number; y: number; slope: number } | null;
  area: AreaMark | null;
  areaStart: number | null;
}

export interface Palette {
  bg: string;
  ink: string;
  dim: string;
}

export const LCD_PALETTE: Palette = {
  bg: '#b0bc9d',
  ink: '#1d2417',
  dim: 'rgba(29, 36, 23, 0.18)',
};

export function curves(s: PlotState, width: number, height: number): Polyline[][] {
  return s.functions.map((f) => sample(f.f, s.view, { width, height }));
}

export function drawPlot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  s: PlotState,
  p: Palette = LCD_PALETTE,
): void {
  const v = s.view;
  const scr = { width, height };
  const X = (x: number) => toScreenX(v, scr, x);
  const Y = (y: number) => toScreenY(v, scr, y);
  ctx.save();
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, width, height);

  // grid
  const sx = niceStep(v.xmax - v.xmin, width / 60);
  const sy = niceStep(v.ymax - v.ymin, height / 45);
  ctx.strokeStyle = p.dim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const t of ticks(v.xmin, v.xmax, sx)) {
    ctx.moveTo(Math.round(X(t)) + 0.5, 0);
    ctx.lineTo(Math.round(X(t)) + 0.5, height);
  }
  for (const t of ticks(v.ymin, v.ymax, sy)) {
    ctx.moveTo(0, Math.round(Y(t)) + 0.5);
    ctx.lineTo(width, Math.round(Y(t)) + 0.5);
  }
  ctx.stroke();

  // axes + labels
  ctx.strokeStyle = p.ink;
  ctx.fillStyle = p.ink;
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
  const ax = v.xmin <= 0 && v.xmax >= 0 ? Math.round(X(0)) + 0.5 : null;
  const ay = v.ymin <= 0 && v.ymax >= 0 ? Math.round(Y(0)) + 0.5 : null;
  ctx.beginPath();
  if (ax !== null) {
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax, height);
  }
  if (ay !== null) {
    ctx.moveTo(0, ay);
    ctx.lineTo(width, ay);
  }
  ctx.stroke();
  const label = (t: number) => String(Number(t.toPrecision(6)));
  const labelY = Math.min(height - 3, Math.max(10, (ay ?? height - 3) + 11));
  ctx.textAlign = 'center';
  for (const t of ticks(v.xmin, v.xmax, sx * 2)) if (t !== 0) ctx.fillText(label(t), X(t), labelY);
  ctx.textAlign = 'left';
  const labelX = Math.min(width - 30, Math.max(2, (ax ?? 2) + 3));
  for (const t of ticks(v.ymin, v.ymax, sy * 2))
    if (t !== 0) ctx.fillText(label(t), labelX, Y(t) - 2);

  // area (prompt 016): above the axis solid, below hatched
  if (s.area) {
    const f = s.functions[s.area.fn]?.f;
    if (f) {
      const n = 300;
      for (const sign of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(X(s.area.a), Y(0));
        for (let i = 0; i <= n; i++) {
          const x = s.area.a + ((s.area.b - s.area.a) * i) / n;
          const y = f(x);
          const part = Number.isFinite(y) ? (sign > 0 ? Math.max(0, y) : Math.min(0, y)) : 0;
          ctx.lineTo(X(x), Y(part));
        }
        ctx.lineTo(X(s.area.b), Y(0));
        ctx.closePath();
        ctx.fillStyle =
          sign > 0 ? 'rgba(29, 36, 23, 0.35)' : (hatch(ctx, p.ink) ?? 'rgba(29, 36, 23, 0.15)');
        ctx.fill();
      }
    }
  }

  // functions
  const all = curves(s, width, height);
  all.forEach((lines, i) => {
    ctx.setLineDash(DASHES[i % DASHES.length]);
    ctx.lineWidth = i === s.selected ? 2.2 : 1.4;
    ctx.strokeStyle = p.ink;
    for (const l of lines) {
      ctx.beginPath();
      l.forEach(([x, y], k) => (k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      if (l.length === 1) ctx.rect(X(l[0][0]) - 1, Y(l[0][1]) - 1, 2, 2);
      ctx.stroke();
    }
  });
  ctx.setLineDash([]);

  // tangent
  if (s.tangent) {
    const t = s.tangent;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(X(v.xmin), Y(t.y + t.slope * (v.xmin - t.x)));
    ctx.lineTo(X(v.xmax), Y(t.y + t.slope * (v.xmax - t.x)));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // marks
  for (const m of s.marks) {
    ctx.fillStyle = p.ink;
    ctx.fillRect(X(m.x) - 3, Y(m.y) - 3, 6, 6);
  }

  // area start, trace cursor
  if (s.areaStart !== null) {
    ctx.beginPath();
    ctx.moveTo(X(s.areaStart) + 0.5, 0);
    ctx.lineTo(X(s.areaStart) + 0.5, height);
    ctx.stroke();
  }
  if (s.trace !== null) {
    const f = s.functions[s.selected]?.f;
    const x = X(s.trace);
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 2]);
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    const y = f?.(s.trace);
    if (y !== undefined && Number.isFinite(y)) {
      ctx.moveTo(0, Y(y) + 0.5);
      ctx.lineTo(width, Y(y) + 0.5);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (y !== undefined && Number.isFinite(y)) {
      ctx.beginPath();
      ctx.arc(x, Y(y), 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function hatch(ctx: CanvasRenderingContext2D, ink: string): CanvasPattern | null {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = 6;
  c.height = 6;
  const h = c.getContext('2d');
  if (!h) return null;
  h.strokeStyle = ink;
  h.lineWidth = 1;
  h.beginPath();
  h.moveTo(0, 6);
  h.lineTo(6, 0);
  h.stroke();
  return ctx.createPattern(c, 'repeat');
}
