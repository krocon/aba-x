/**
 * Drawing of the graphics commands of programs (prompt 043) into the screen canvases G0–G9
 * (320 × 240). Cartesian coordinates use a fixed window X −16 … 16, Y −12 … 12 (4:3, like the
 * screen); pixel coordinates (`…_P`) count from the top left.
 */
import { type GfxCommand, SCREEN_HEIGHT, SCREEN_WIDTH } from '@aba/ppl';

export const CARTESIAN = { xmin: -16, xmax: 16, ymin: -12, ymax: 12 };

const css = (c: number | undefined, fallback: string) =>
  c === undefined || c < 0 ? fallback : `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;

const FONTS = [12, 10, 12, 14, 16, 18, 20, 22];

/** Pixel position of a coordinate pair. */
export function toPixel(coords: 'pixel' | 'cartesian', x: number, y: number): [number, number] {
  if (coords === 'pixel') return [x, y];
  const w = CARTESIAN;
  return [
    ((x - w.xmin) / (w.xmax - w.xmin)) * SCREEN_WIDTH,
    ((w.ymax - y) / (w.ymax - w.ymin)) * SCREEN_HEIGHT,
  ];
}

export function drawCommand(
  cmd: GfxCommand,
  screen: (n: number) => HTMLCanvasElement | null,
): void {
  if (cmd.op === 'blit') {
    const src = screen(cmd.source);
    const dst = screen(cmd.target);
    const ctx = dst?.getContext('2d');
    if (!src || !ctx) return;
    const [sx1, sy1] = toPixel(cmd.coords, cmd.sx1 ?? 0, cmd.sy1 ?? 0);
    const [sx2, sy2] =
      cmd.sx2 === undefined
        ? [SCREEN_WIDTH, SCREEN_HEIGHT]
        : toPixel(cmd.coords, cmd.sx2, cmd.sy2 ?? 0);
    const [dx1, dy1] = toPixel(cmd.coords, cmd.dx1 ?? 0, cmd.dy1 ?? 0);
    const [dx2, dy2] =
      cmd.dx2 === undefined
        ? [dx1 + (sx2 - sx1), dy1 + (sy2 - sy1)]
        : toPixel(cmd.coords, cmd.dx2, cmd.dy2 ?? 0);
    ctx.drawImage(src, sx1, sy1, sx2 - sx1, sy2 - sy1, dx1, dy1, dx2 - dx1, dy2 - dy1);
    return;
  }
  const ctx = screen(cmd.screen)?.getContext('2d');
  if (!ctx) return;
  switch (cmd.op) {
    case 'rect': {
      if (cmd.x1 === undefined) {
        ctx.fillStyle = css(cmd.fill ?? cmd.edge, '#ffffff');
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        return;
      }
      const [x1, y1] = toPixel(cmd.coords, cmd.x1, cmd.y1 ?? 0);
      const [x2, y2] = toPixel(cmd.coords, cmd.x2 ?? cmd.x1, cmd.y2 ?? cmd.y1 ?? 0);
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      ctx.fillStyle = css(cmd.fill ?? cmd.edge, '#ffffff');
      ctx.fillRect(x, y, Math.abs(x2 - x1) + 1, Math.abs(y2 - y1) + 1);
      if (cmd.edge !== undefined) {
        ctx.strokeStyle = css(cmd.edge, '#000000');
        ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(x2 - x1), Math.abs(y2 - y1));
      }
      return;
    }
    case 'line': {
      const [x1, y1] = toPixel(cmd.coords, cmd.x1, cmd.y1);
      const [x2, y2] = toPixel(cmd.coords, cmd.x2, cmd.y2);
      ctx.strokeStyle = css(cmd.color, '#000000');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1 + 0.5, y1 + 0.5);
      ctx.lineTo(x2 + 0.5, y2 + 0.5);
      ctx.stroke();
      return;
    }
    case 'pixon': {
      const [x, y] = toPixel(cmd.coords, cmd.x, cmd.y);
      ctx.fillStyle = css(cmd.color, '#000000');
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      return;
    }
    case 'textout': {
      const [x, y] = toPixel(cmd.coords, cmd.x, cmd.y);
      const size = FONTS[cmd.font ?? 0] ?? 12;
      ctx.font = `${size}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      if (cmd.background !== undefined) {
        const w = Math.min(ctx.measureText(cmd.text).width, cmd.width ?? Infinity);
        ctx.fillStyle = css(cmd.background, '#ffffff');
        ctx.fillRect(x, y, w, size * 1.2);
      }
      ctx.fillStyle = css(cmd.color, '#000000');
      ctx.fillText(cmd.text, x, y, cmd.width);
      return;
    }
    case 'fillpoly': {
      if (!cmd.points.length) return;
      ctx.fillStyle = css(cmd.color, '#000000');
      ctx.beginPath();
      cmd.points.forEach(([px, py], k) => {
        const [x, y] = toPixel(cmd.coords, px, py);
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      return;
    }
  }
}
