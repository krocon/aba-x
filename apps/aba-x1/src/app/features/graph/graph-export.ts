/** SVG export of a plot (prompt 014): the same polylines the canvas draws, as a standalone file. */
import type { Polyline } from '@aba/math/graph/sampler';
import { type Viewport, niceStep, ticks, toScreenX, toScreenY } from '@aba/math/graph/viewport';

export const DASHES: readonly number[][] = [[], [7, 4], [2, 3], [9, 3, 2, 3], [1, 2], [12, 5]];

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

export function plotSvg(
  v: Viewport,
  curves: readonly { lines: readonly Polyline[]; label: string }[],
  width = 640,
  height = 400,
): string {
  const s = { width, height };
  const X = (x: number) => toScreenX(v, s, x).toFixed(2);
  const Y = (y: number) => toScreenY(v, s, y).toFixed(2);
  const grid: string[] = [];
  const sx = niceStep(v.xmax - v.xmin);
  const sy = niceStep(v.ymax - v.ymin);
  for (const t of ticks(v.xmin, v.xmax, sx))
    grid.push(`<line x1="${X(t)}" y1="0" x2="${X(t)}" y2="${height}"/>`);
  for (const t of ticks(v.ymin, v.ymax, sy))
    grid.push(`<line x1="0" y1="${Y(t)}" x2="${width}" y2="${Y(t)}"/>`);
  const axes: string[] = [];
  if (v.xmin <= 0 && v.xmax >= 0)
    axes.push(`<line x1="${X(0)}" y1="0" x2="${X(0)}" y2="${height}"/>`);
  if (v.ymin <= 0 && v.ymax >= 0)
    axes.push(`<line x1="0" y1="${Y(0)}" x2="${width}" y2="${Y(0)}"/>`);
  const paths = curves.map((c, i) => {
    const d = c.lines
      .filter((l) => l.length > 1)
      .map((l) => l.map(([x, y], k) => `${k ? 'L' : 'M'}${X(x)} ${Y(y)}`).join(''))
      .join('');
    const dash = DASHES[i % DASHES.length].join(' ');
    return `<path d="${d}" stroke-dasharray="${dash}"><title>${esc(c.label)}</title></path>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<g stroke="#d5d9e0" stroke-width="1">${grid.join('')}</g>`,
    `<g stroke="#555" stroke-width="1.2">${axes.join('')}</g>`,
    `<g fill="none" stroke="#1d2417" stroke-width="2" stroke-linejoin="round">${paths.join('')}</g>`,
    '</svg>',
  ].join('\n');
}
