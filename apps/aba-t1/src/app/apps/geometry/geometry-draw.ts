/**
 * Drawing of a geometry scene (prompt 042) on the shared plot surface: the render primitives of
 * `@aba/math/geometry/render-data` mapped to the canvas. Infinite lines and rays are clipped by
 * drawing them far beyond the window; circles and ellipses are sampled so that they also follow
 * a window without equal units.
 */
import { type PlotFrame, sx, sy } from '@aba/core/graph/plot-draw';
import type { RenderPrimitive } from '@aba/math/geometry/render-data';
import type { Vec } from '@aba/math/geometry/shapes';

export interface DrawItem {
  name: string;
  primitive: RenderPrimitive;
  color: string;
  /** free point (draggable) */
  free: boolean;
  /** selected or picked by the current tool */
  marked: boolean;
}

const HIGHLIGHT = 'rgba(255, 196, 0, 0.55)';

function reach(f: PlotFrame, p: Vec): number {
  const v = f.view;
  const cx = (v.xmin + v.xmax) / 2;
  const cy = (v.ymin + v.ymax) / 2;
  return Math.hypot(p.x - cx, p.y - cy) + 2 * Math.hypot(v.xmax - v.xmin, v.ymax - v.ymin);
}

/** World polylines of a non-point primitive (closed curves repeat their first point). */
export function outline(f: PlotFrame, p: RenderPrimitive): Vec[][] {
  switch (p.type) {
    case 'segment':
      return [[p.from, p.to]];
    case 'ray': {
      const r = reach(f, p.from);
      return [[p.from, { x: p.from.x + p.dir.x * r, y: p.from.y + p.dir.y * r }]];
    }
    case 'line': {
      const r = reach(f, p.through);
      return [
        [
          { x: p.through.x - p.dir.x * r, y: p.through.y - p.dir.y * r },
          { x: p.through.x + p.dir.x * r, y: p.through.y + p.dir.y * r },
        ],
      ];
    }
    case 'circle':
    case 'ellipse': {
      const a = p.type === 'circle' ? p.r : p.a;
      const b = p.type === 'circle' ? p.r : p.b;
      const th = p.type === 'circle' ? 0 : p.angle;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const pts: Vec[] = [];
      for (let i = 0; i <= 180; i++) {
        const t = (i / 180) * 2 * Math.PI;
        const u = a * Math.cos(t);
        const w = b * Math.sin(t);
        pts.push({ x: p.center.x + u * c - w * s, y: p.center.y + u * s + w * c });
      }
      return [pts];
    }
    case 'polygon':
      return p.points.length ? [[...p.points, p.points[0]]] : [];
    case 'polyline':
      return p.paths.map((path) => (p.closed && path.length ? [...path, path[0]] : [...path]));
    default:
      return [];
  }
}

function stroke(f: PlotFrame, paths: Vec[][], color: string, width: number): void {
  const { ctx } = f;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const path of paths) {
    if (path.length < 2) continue;
    ctx.beginPath();
    path.forEach((q, i) =>
      i ? ctx.lineTo(sx(f, q.x), sy(f, q.y)) : ctx.moveTo(sx(f, q.x), sy(f, q.y)),
    );
    ctx.stroke();
  }
}

const order = (p: RenderPrimitive): number =>
  p.type === 'polygon' ? 0 : p.type === 'point' ? 2 : 1;

/** Draws the scene: filled polygons first, then curves, then points with their names. */
export function drawScene(f: PlotFrame, items: readonly DrawItem[]): void {
  const { ctx } = f;
  ctx.save();
  const sorted = [...items].sort((a, b) => order(a.primitive) - order(b.primitive));
  for (const it of sorted) {
    const p = it.primitive;
    if (p.type === 'none') continue;
    if (p.type === 'point') {
      const x = sx(f, p.at.x);
      const y = sy(f, p.at.y);
      if (it.marked) {
        ctx.fillStyle = HIGHLIGHT;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = it.free ? it.color : '#ffffff';
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, it.free ? 4.5 : 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1b3533';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillText(it.name, x + 6, y - 4);
      continue;
    }
    const paths = outline(f, p);
    if (p.type === 'polygon' && paths.length) {
      ctx.fillStyle = it.color;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      paths[0].forEach((q, i) =>
        i ? ctx.lineTo(sx(f, q.x), sy(f, q.y)) : ctx.moveTo(sx(f, q.x), sy(f, q.y)),
      );
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (it.marked) stroke(f, paths, HIGHLIGHT, 7);
    stroke(f, paths, it.color, 2);
  }
  ctx.restore();
}

/** Traces of points (thin lines of their earlier positions). */
export function drawTraces(f: PlotFrame, traces: readonly { color: string; pts: Vec[] }[]): void {
  f.ctx.save();
  for (const t of traces) stroke(f, [t.pts], t.color, 1);
  f.ctx.restore();
}

/** Keyboard cursor: a small cross. */
export function drawCursor(f: PlotFrame, at: Vec): void {
  const { ctx } = f;
  const x = sx(f, at.x);
  const y = sy(f, at.y);
  ctx.save();
  ctx.strokeStyle = '#e8603f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x, y + 8);
  ctx.stroke();
  ctx.restore();
}
