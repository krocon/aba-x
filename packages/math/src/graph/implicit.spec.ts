import { describe, expect, it } from 'vitest';
import { LOGIC_FUNCTIONS } from '../interval/eval';
import { parseText } from '../parser/text-parser';
import { type ImplicitPlot, boundaryCrossings, plotRelation, traceBoundary } from './implicit';

const parse = (s: string) => {
  const p = parseText(s, { functions: LOGIC_FUNCTIONS });
  if (!p.ok) throw new Error(`${s}: ${p.error.message}`);
  return p.value;
};

const VIEW = { xmin: -4, xmax: 4, ymin: -3, ymax: 3 };
const SIZE = { width: 320, height: 240, timeBudgetMs: 10_000 };
const PIXEL = 8 / 320;

function plot(
  s: string,
  view = VIEW,
  o: Partial<typeof SIZE & { maxDepth: number; maxCells: number }> = {},
) {
  const r = plotRelation(parse(s), view, { ...SIZE, ...o });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Sample points inside every decided cell (corners and random interior points). */
function* samples(p: ImplicitPlot, truth: 'true' | 'false', perCell = 4) {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const c of p.cells) {
    if (c.truth !== truth) continue;
    yield [c.xmin, c.ymin] as const;
    yield [c.xmax, c.ymax] as const;
    for (let k = 0; k < perCell; k++) {
      yield [c.xmin + (c.xmax - c.xmin) * rand(), c.ymin + (c.ymax - c.ymin) * rand()] as const;
    }
  }
}

const area = (p: ImplicitPlot, truth: string) =>
  p.cells.filter((c) => c.truth === truth).reduce((s, c) => s + (c.i1 - c.i0) * (c.j1 - c.j0), 0);

describe('plotRelation', () => {
  it('cells tile the whole pixel grid exactly once', () => {
    const p = plot('X^2+Y^2<4');
    const seen = new Uint8Array(320 * 240);
    for (const c of p.cells)
      for (let j = c.j0; j < c.j1; j++) for (let i = c.i0; i < c.i1; i++) seen[j * 320 + i]++;
    expect(seen.every((v) => v === 1)).toBe(true);
    expect(p.complete).toBe(true);
  });

  it('circle X²+Y²=4: boundary points lie on the circle within a pixel, one closed line', () => {
    const p = plot('X^2+Y^2=4');
    expect(p.complete).toBe(true);
    expect(area(p, 'true')).toBe(0);
    expect(p.boundaries.length).toBe(1);
    const line = p.boundaries[0];
    expect(line.closed).toBe(true);
    expect(line.kind).toBe('curve');
    expect(line.points.length).toBeGreaterThan(200);
    for (const [x, y] of line.points) expect(Math.abs(Math.hypot(x, y) - 2)).toBeLessThan(PIXEL);
    // the refined crossings are much better than a pixel
    const worst = Math.max(...line.points.map(([x, y]) => Math.abs(Math.hypot(x, y) - 2)));
    expect(worst).toBeLessThan(1e-9);
    // unknown pixels hug the circle
    for (const c of p.cells.filter((c) => c.truth === 'unknown')) {
      const r = Math.hypot((c.xmin + c.xmax) / 2, (c.ymin + c.ymax) / 2);
      expect(Math.abs(r - 2)).toBeLessThan(2 * PIXEL);
    }
  });

  it('measures the circle on a 320×240 grid', () => {
    const t0 = Date.now();
    const p = plot('X^2+Y^2=4');
    const ms = Date.now() - t0;
    expect(p.stats.evaluatedCells).toBeLessThan(20_000);
    expect(ms).toBeLessThan(2_000);
  });

  it('Y > X²: true cells are above the parabola, false cells below', () => {
    const p = plot('Y>X^2');
    expect(area(p, 'true')).toBeGreaterThan(0);
    expect(area(p, 'false')).toBeGreaterThan(0);
    for (const [x, y] of samples(p, 'true')) expect(y).toBeGreaterThan(x * x);
    for (const [x, y] of samples(p, 'false')) expect(y).toBeLessThanOrEqual(x * x);
    // the border is a dashed (strict) line on the parabola
    expect(p.boundaries.length).toBeGreaterThan(0);
    for (const b of p.boundaries) {
      expect(b.kind).toBe('border');
      expect(b.strict).toBe(true);
      for (const [x, y] of b.points) expect(Math.abs(y - x * x)).toBeLessThan(1e-9);
    }
    // nearly all pixels are decided
    expect(area(p, 'unknown')).toBeLessThan(0.02 * 320 * 240);
  });

  it('sin(X)·sin(Y) > 0 gives a checkerboard', () => {
    const view = { xmin: -6, xmax: 6, ymin: -6, ymax: 6 };
    const p = plot('sin(X)*sin(Y)>0', view, { width: 240, height: 240 });
    for (const [x, y] of samples(p, 'true')) expect(Math.sin(x) * Math.sin(y)).toBeGreaterThan(0);
    for (const [x, y] of samples(p, 'false'))
      expect(Math.sin(x) * Math.sin(y)).toBeLessThanOrEqual(0);
    // centres of the squares
    const at = (x: number, y: number) =>
      p.cells.find((c) => c.xmin <= x && x <= c.xmax && c.ymin <= y && y <= c.ymax)!.truth;
    expect(at(Math.PI / 2, Math.PI / 2)).toBe('true');
    expect(at(-Math.PI / 2, Math.PI / 2)).toBe('false');
    expect(at(-Math.PI / 2, -Math.PI / 2)).toBe('true');
    expect(at(Math.PI / 2, -Math.PI / 2)).toBe('false');
    expect(area(p, 'true')).toBeGreaterThan(0.4 * 240 * 240);
  });

  it('X = 2 is a vertical line', () => {
    const p = plot('X=2');
    expect(area(p, 'true')).toBe(0);
    expect(p.boundaries.length).toBe(1);
    const line = p.boundaries[0];
    for (const [x] of line.points) expect(x).toBeCloseTo(2, 12);
    const ys = line.points.map(([, y]) => y);
    expect(Math.min(...ys)).toBeCloseTo(-3, 10);
    expect(Math.max(...ys)).toBeCloseTo(3, 10);
    for (const c of p.cells.filter((c) => c.truth === 'unknown')) {
      expect(c.xmin).toBeLessThanOrEqual(2 + PIXEL);
      expect(c.xmax).toBeGreaterThanOrEqual(2 - PIXEL);
    }
  });

  it('a relation without solutions gives no true and no unknown cells', () => {
    const p = plot('X^2+Y^2<-1');
    expect(area(p, 'true')).toBe(0);
    expect(area(p, 'unknown')).toBe(0);
    expect(p.boundaries.length).toBe(0);
    expect(p.cells.length).toBe(1);
  });

  it('division by zero never yields true cells and no line through the pole', () => {
    const p = plot('1/X>0');
    for (const c of p.cells.filter((c) => c.truth === 'true'))
      expect(c.xmin).toBeGreaterThanOrEqual(0);
    for (const [x] of samples(p, 'true')) expect(1 / x).toBeGreaterThan(0);
    const q = plot('1/X=0');
    expect(area(q, 'true')).toBe(0);
    expect(q.boundaries.length).toBe(0);
    const t = plot('tan(X)=Y', { xmin: -3, xmax: 3, ymin: -3, ymax: 3 });
    // no vertical line along the poles ±π/2
    for (const b of t.boundaries)
      for (const [x, y] of b.points) expect(Math.abs(Math.tan(x) - y)).toBeLessThan(1e-6);
  });

  it('connectives: upper half disc', () => {
    const p = plot('and(X^2+Y^2<9, Y>0)');
    for (const [x, y] of samples(p, 'true')) {
      expect(x * x + y * y).toBeLessThan(9);
      expect(y).toBeGreaterThan(0);
    }
    for (const [x, y] of samples(p, 'false')) expect(x * x + y * y >= 9 || y <= 0).toBe(true);
    // no boundary in the lower half plane or on the x axis outside the disc
    for (const b of p.boundaries)
      for (const [x, y] of b.points) {
        expect(y).toBeGreaterThan(-PIXEL);
        expect(Math.hypot(x, y)).toBeLessThan(3 + 1.5 * PIXEL);
      }
    const n = plot('not(Y>X^2)');
    for (const [x, y] of samples(n, 'true')) expect(y).toBeLessThanOrEqual(x * x);
    const xo = plot('xor(X>0, Y>0)');
    for (const [x, y] of samples(xo, 'true')) expect(x > 0 !== y > 0).toBe(true);
  });

  it('a budget stop sets complete = false and leaves the rest unknown', () => {
    const p = plot('sin(X*Y)=0.5', { xmin: -10, xmax: 10, ymin: -10, ymax: 10 }, { maxCells: 200 });
    expect(p.complete).toBe(false);
    expect(p.stats.evaluatedCells).toBe(200);
    expect(area(p, 'unknown')).toBeGreaterThan(0);
    const seen = p.cells.reduce((s, c) => s + (c.i1 - c.i0) * (c.j1 - c.j0), 0);
    expect(seen).toBe(320 * 240);
    expect(plot('X^2+Y^2=4', VIEW, { maxDepth: 3 }).complete).toBe(false);
    const timed = plotRelation(
      parse('sin(X*Y)=0.5'),
      { xmin: -30, xmax: 30, ymin: -30, ymax: 30 },
      {
        width: 2000,
        height: 2000,
        timeBudgetMs: 0,
      },
    );
    expect(timed.ok && timed.value.complete).toBe(false);
  });

  it('errors are values', () => {
    expect(plotRelation(parse('Z>1'), VIEW, SIZE)).toMatchObject({ ok: false });
    expect(plotRelation(parse('X>1'), { ...VIEW, xmax: -5 }, SIZE)).toMatchObject({ ok: false });
    expect(plotRelation(parse('X>1'), VIEW, { width: 0, height: 10 })).toMatchObject({ ok: false });
  });

  it('degree mode', () => {
    const p = plot('Y<sin(X)', { xmin: -360, xmax: 360, ymin: -2, ymax: 2 }, {
      angle: 'deg',
    } as never);
    for (const [x, y] of samples(p, 'true')) expect(y).toBeLessThan(Math.sin((x * Math.PI) / 180));
  });
});

describe('trace and table', () => {
  it('projects a point onto the circle', () => {
    const r = traceBoundary(parse('X^2+Y^2=4'), 1.5, 1.6);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Math.hypot(r.value.x, r.value.y)).toBeCloseTo(2, 10);
    const b = traceBoundary(parse('and(X^2+Y^2<9, Y>0)'), 0.5, 0.1);
    expect(b.ok && b.value.atom).toBe(1);
    if (b.ok) expect(b.value.y).toBeCloseTo(0, 12);
    expect(traceBoundary(parse('X^2+Y^2=-1'), 1, 1).ok).toBe(false);
  });

  it('lists the boundary crossings on a vertical line', () => {
    const r = boundaryCrossings(parse('X^2+Y^2=4'), 1, -3, 3);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.map((p) => p.y)).toHaveLength(2);
      expect(r.value[0].y).toBeCloseTo(-Math.sqrt(3), 10);
      expect(r.value[1].y).toBeCloseTo(Math.sqrt(3), 10);
    }
    // half disc: the lower circle arc is no boundary, the x axis is
    const h = boundaryCrossings(parse('and(X^2+Y^2<9, Y>0)'), 1, -4, 4);
    expect(h.ok && h.value.map((p) => Math.round(p.y * 1e6) / 1e6)).toEqual([
      0,
      Math.round(Math.sqrt(8) * 1e6) / 1e6,
    ]);
    // a pole is no crossing
    const pole = boundaryCrossings(parse('Y=1/(Y-1)+0*X'), 0, -3, 3);
    expect(pole.ok && pole.value.every((p) => Math.abs(p.y - 1) > 1e-3)).toBe(true);
  });
});
