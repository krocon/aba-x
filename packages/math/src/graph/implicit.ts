/**
 * Implicit plotting of relations in X and Y (prompt 036): equations (`X²+Y²=4`, `sin(X·Y)=0.5`),
 * inequalities (`Y>X²`) and their connectives (`and(X²+Y²<9, Y>0)`, see `interval/eval.ts`).
 *
 * Method:
 * 1. A quadtree over the pixel grid of the view: every cell is decided with interval arithmetic
 *    (`'true'` – the relation holds on the whole cell, `'false'` – nowhere, `'unknown'`). Only
 *    unknown cells are split, down to single pixels. The decisions are guaranteed (outward
 *    rounding), so a cell marked true or false is never wrong; what cannot be decided stays
 *    `'unknown'` and must be drawn as such (never as part of the region).
 * 2. Boundaries: on the unknown pixels, marching squares on the sign of left − right of every
 *    relation that is undecided on that pixel, with the edge crossings refined by false
 *    position; the segments are joined into polylines. Pixels where the interval evaluation
 *    cannot prove continuity (poles, jumps) get no line, so `1/X = 0` draws nothing at X = 0.
 *    Boundary lines are numerical (sign changes); tangential solutions without sign change
 *    (`(X²+Y²−4)² = 0`) only show as unknown pixels.
 * 3. A time and size budget stops the refinement; the remaining cells come back as unknown and
 *    `complete` is false – the caller can show "refining" and run again.
 *
 * Pixel convention: column i (0 … width−1) from xmin, row j (0 … height−1) from ymax downwards,
 * as on screen; cells are half-open pixel ranges [i0, i1) × [j0, j1).
 */
import type { Expr, RelationOp } from '../ast/nodes';
import * as I from '../interval/interval';
import {
  type CompiledRelation,
  type RelationEvalOptions,
  type Truth,
  compareIntervals,
  compileRelation,
} from '../interval/eval';
import { rootsIn } from '../numeric/roots';
import { type MathResult, fail, ok } from '../result';
import type { Viewport } from './viewport';

export interface ImplicitOptions extends RelationEvalOptions {
  /** Pixel width of the plot (≥ 1). */
  readonly width: number;
  /** Pixel height of the plot (≥ 1). */
  readonly height: number;
  /** Time budget for the quadtree in ms (default 300). */
  readonly timeBudgetMs?: number;
  /** Maximal quadtree depth (default: down to single pixels). */
  readonly maxDepth?: number;
  /** Maximal number of evaluated cells (default 2 000 000). */
  readonly maxCells?: number;
}

/** A decided (or undecided) rectangle of the view, in pixels and in world coordinates. */
export interface RelationCell {
  readonly i0: number;
  readonly i1: number;
  readonly j0: number;
  readonly j1: number;
  readonly xmin: number;
  readonly xmax: number;
  readonly ymin: number;
  readonly ymax: number;
  readonly truth: Truth;
}

/** A boundary polyline in world coordinates. */
export interface BoundaryLine {
  /** Index of the relation (atom) of the formula this line belongs to. */
  readonly atom: number;
  readonly op: RelationOp;
  /** `'curve'` for `=` / `!=` (the solution set), `'border'` for an inequality's edge. */
  readonly kind: 'curve' | 'border';
  /** True for `<` / `>` (the border itself does not belong to the region – draw dashed). */
  readonly strict: boolean;
  readonly points: readonly (readonly [number, number])[];
  readonly closed: boolean;
}

export interface ImplicitPlot {
  readonly cells: readonly RelationCell[];
  readonly boundaries: readonly BoundaryLine[];
  /** False if the budget (time, cells, depth) stopped refinement before pixel size. */
  readonly complete: boolean;
  readonly stats: {
    readonly evaluatedCells: number;
    readonly unknownPixels: number;
    readonly ms: number;
  };
}

/** Monotonic clock where available (browsers, workers, Node), else the wall clock. */
const clock = (globalThis as { performance?: { now(): number } }).performance;
const now = (): number => (clock ? clock.now() : Date.now());

/** World coordinate of a pixel corner (exact ends at the view border). */
function axes(view: Viewport, width: number, height: number) {
  const dx = (view.xmax - view.xmin) / width;
  const dy = (view.ymax - view.ymin) / height;
  return {
    xAt: (ci: number) => (ci === width ? view.xmax : view.xmin + ci * dx),
    yAt: (cj: number) => (cj === height ? view.ymin : view.ymax - cj * dy),
  };
}

/**
 * Plots a relation over a view: quadtree cells with guaranteed truth, boundary polylines and a
 * completeness flag. Errors (unknown names, no relation) come back as values.
 */
export function plotRelation(
  e: Expr,
  view: Viewport,
  o: ImplicitOptions,
): MathResult<ImplicitPlot> {
  const W = Math.floor(o.width);
  const H = Math.floor(o.height);
  if (!(W >= 1 && H >= 1)) return fail('domain', 'the plot needs at least one pixel');
  if (
    ![view.xmin, view.xmax, view.ymin, view.ymax].every(Number.isFinite) ||
    view.xmax <= view.xmin ||
    view.ymax <= view.ymin
  ) {
    return fail('domain', 'invalid view');
  }
  const compiled = compileRelation(e, o);
  if (!compiled.ok) return compiled;
  try {
    return ok(run(compiled.value, view, W, H, o));
  } catch (err) {
    return fail('not-evaluable', err instanceof Error ? err.message : String(err));
  }
}

function run(
  rel: CompiledRelation,
  view: Viewport,
  W: number,
  H: number,
  o: ImplicitOptions,
): ImplicitPlot {
  const t0 = now();
  const budget = o.timeBudgetMs ?? 300;
  const maxDepth = o.maxDepth ?? Infinity;
  const maxCells = o.maxCells ?? 2_000_000;
  const { xAt, yAt } = axes(view, W, H);

  const cells: RelationCell[] = [];
  const pixels: number[] = []; // unknown single pixels: i, j pairs
  const emit = (i0: number, i1: number, j0: number, j1: number, truth: Truth) => {
    cells.push({
      i0,
      i1,
      j0,
      j1,
      xmin: xAt(i0),
      xmax: xAt(i1),
      ymin: yAt(j1),
      ymax: yAt(j0),
      truth,
    });
    if (truth === 'unknown' && i1 - i0 === 1 && j1 - j0 === 1) pixels.push(i0, j0);
  };

  // breadth-first quadtree: a budget stop leaves an evenly refined picture
  const queue: number[] = [0, W, 0, H, 0];
  let head = 0;
  let evaluated = 0;
  let complete = true;
  while (head < queue.length) {
    if ((evaluated & 255) === 0 && evaluated > 0 && now() - t0 > budget) break;
    if (evaluated >= maxCells) break;
    const i0 = queue[head++];
    const i1 = queue[head++];
    const j0 = queue[head++];
    const j1 = queue[head++];
    const depth = queue[head++];
    evaluated++;
    const x = I.make(xAt(i0), xAt(i1));
    const y = I.make(yAt(j1), yAt(j0));
    const truth = rel.truth(x, y);
    const pixel = i1 - i0 === 1 && j1 - j0 === 1;
    if (truth !== 'unknown' || pixel) {
      emit(i0, i1, j0, j1, truth);
      continue;
    }
    if (depth >= maxDepth) {
      complete = false;
      emit(i0, i1, j0, j1, 'unknown');
      continue;
    }
    const im = i1 - i0 > 1 ? (i0 + i1) >> 1 : i1;
    const jm = j1 - j0 > 1 ? (j0 + j1) >> 1 : j1;
    for (const [a, b] of im < i1
      ? [
          [i0, im],
          [im, i1],
        ]
      : [[i0, i1]]) {
      for (const [c, d] of jm < j1
        ? [
            [j0, jm],
            [jm, j1],
          ]
        : [[j0, j1]]) {
        queue.push(a, b, c, d, depth + 1);
      }
    }
  }
  if (head < queue.length) {
    complete = false;
    while (head < queue.length) {
      emit(queue[head], queue[head + 1], queue[head + 2], queue[head + 3], 'unknown');
      head += 5;
    }
  }

  const boundaries = traceBoundaries(rel, pixels, W, H, xAt, yAt);
  return {
    cells,
    boundaries,
    complete,
    stats: { evaluatedCells: evaluated, unknownPixels: pixels.length / 2, ms: now() - t0 },
  };
}

// ---------------------------------------------------------------------------------------------
// marching squares

/** Crossing of f on the segment a → b (fa, fb of opposite sign), refined by Illinois steps. */
function edgeCrossing(
  f: (x: number, y: number) => number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  fa: number,
  fb: number,
): [number, number] {
  if (fa === 0) return [ax, ay];
  if (fb === 0) return [bx, by];
  let t0 = 0;
  let t1 = 1;
  let f0 = fa;
  let f1 = fb;
  let side = 0;
  let t = f0 / (f0 - f1);
  for (let k = 0; k < 12; k++) {
    t = (t0 * f1 - t1 * f0) / (f1 - f0);
    if (!(t >= t0 && t <= t1)) t = (t0 + t1) / 2;
    if (t1 - t0 < 1e-15) break;
    const ft = f(ax + t * (bx - ax), ay + t * (by - ay));
    if (!Number.isFinite(ft) || ft === 0) break;
    if (ft > 0 === f0 > 0) {
      t0 = t;
      f0 = ft;
      if (side === -1) f1 /= 2;
      side = -1;
    } else {
      t1 = t;
      f1 = ft;
      if (side === 1) f0 /= 2;
      side = 1;
    }
  }
  return [ax + t * (bx - ax), ay + t * (by - ay)];
}

function traceBoundaries(
  rel: CompiledRelation,
  pixels: readonly number[],
  W: number,
  H: number,
  xAt: (ci: number) => number,
  yAt: (cj: number) => number,
): BoundaryLine[] {
  const lines: BoundaryLine[] = [];
  if (pixels.length === 0) return lines;
  const stride = W + 1;
  for (const atom of rel.atoms) {
    const f = atom.diff;
    const values = new Float64Array(stride * (H + 1));
    const known = new Uint8Array(stride * (H + 1));
    const corner = (ci: number, cj: number) => {
      const k = cj * stride + ci;
      if (!known[k]) {
        known[k] = 1;
        values[k] = f(xAt(ci), yAt(cj));
      }
      return values[k];
    };
    const points = new Map<number, [number, number]>();
    /** Edge key and its crossing point; horizontal edge (ci,cj)–(ci+1,cj), vertical (ci,cj)–(ci,cj+1). */
    const edge = (ci: number, cj: number, vertical: boolean): number => {
      const key = (cj * stride + ci) * 2 + (vertical ? 1 : 0);
      if (!points.has(key)) {
        const bi = vertical ? ci : ci + 1;
        const bj = vertical ? cj + 1 : cj;
        points.set(
          key,
          edgeCrossing(f, xAt(ci), yAt(cj), xAt(bi), yAt(bj), corner(ci, cj), corner(bi, bj)),
        );
      }
      return key;
    };
    const segments: number[] = [];
    for (let p = 0; p < pixels.length; p += 2) {
      const i = pixels[p];
      const j = pixels[p + 1];
      const x = I.make(xAt(i), xAt(i + 1));
      const y = I.make(yAt(j + 1), yAt(j));
      const L = atom.left(x, y);
      const R = atom.right(x, y);
      if (compareIntervals(L, R, atom.op) !== 'unknown' || !L.cont || !R.cont) continue;
      const v0 = corner(i, j); // top-left
      const v1 = corner(i + 1, j); // top-right
      const v2 = corner(i + 1, j + 1); // bottom-right
      const v3 = corner(i, j + 1); // bottom-left
      if (!(
        Number.isFinite(v0) &&
        Number.isFinite(v1) &&
        Number.isFinite(v2) &&
        Number.isFinite(v3)
      ))
        continue;
      const s0 = v0 > 0;
      const s1 = v1 > 0;
      const s2 = v2 > 0;
      const s3 = v3 > 0;
      const crossed: number[] = [];
      if (s0 !== s1) crossed.push(edge(i, j, false)); // top
      if (s1 !== s2) crossed.push(edge(i + 1, j, true)); // right
      if (s3 !== s2) crossed.push(edge(i, j + 1, false)); // bottom
      if (s0 !== s3) crossed.push(edge(i, j, true)); // left
      if (crossed.length === 2) segments.push(crossed[0], crossed[1]);
      else if (crossed.length === 4) {
        // saddle: the centre decides which corners are connected
        const [top, right, bottom, left] = crossed;
        const c = f((xAt(i) + xAt(i + 1)) / 2, (yAt(j) + yAt(j + 1)) / 2);
        if (c > 0 === s0) segments.push(top, right, bottom, left);
        else segments.push(top, left, right, bottom);
      }
    }
    for (const chain of joinSegments(segments)) {
      lines.push({
        atom: atom.index,
        op: atom.op,
        kind: atom.op === '=' || atom.op === '!=' ? 'curve' : 'border',
        strict: atom.op === '<' || atom.op === '>',
        points: chain.keys.map((k) => points.get(k)!),
        closed: chain.closed,
      });
    }
  }
  return lines;
}

/** Joins segments (pairs of edge keys) into chains; every edge key joins at most two segments. */
function joinSegments(segments: readonly number[]): { keys: number[]; closed: boolean }[] {
  const n = segments.length / 2;
  const at = new Map<number, number[]>();
  for (let s = 0; s < n; s++) {
    for (const k of [segments[2 * s], segments[2 * s + 1]]) {
      const list = at.get(k);
      if (list) list.push(s);
      else at.set(k, [s]);
    }
  }
  const used = new Uint8Array(n);
  const chains: { keys: number[]; closed: boolean }[] = [];
  const extend = (keys: number[]) => {
    for (;;) {
      const end = keys[keys.length - 1];
      const next = at.get(end)?.find((s) => !used[s]);
      if (next === undefined) return;
      used[next] = 1;
      const a = segments[2 * next];
      keys.push(a === end ? segments[2 * next + 1] : a);
    }
  };
  for (let s = 0; s < n; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const forward = [segments[2 * s], segments[2 * s + 1]];
    extend(forward);
    const closed = forward.length > 2 && forward[0] === forward[forward.length - 1];
    if (closed) {
      chains.push({ keys: forward, closed });
      continue;
    }
    const backward = [forward[0]];
    extend(backward);
    chains.push({ keys: [...backward.reverse(), ...forward.slice(1)], closed: false });
  }
  return chains;
}

// ---------------------------------------------------------------------------------------------
// trace and table

export interface BoundaryPoint {
  readonly x: number;
  readonly y: number;
  /** Index of the relation (atom) whose boundary the point lies on. */
  readonly atom: number;
}

export interface TraceOptions extends RelationEvalOptions {
  /** Only this atom (default: the one whose boundary is nearest to the start point). */
  readonly atom?: number;
  /** Reject a projection that moves farther than this (world units). */
  readonly maxDistance?: number;
}

/** Central-difference gradient of f at (x, y). */
function gradient(f: (x: number, y: number) => number, x: number, y: number): [number, number] {
  const hx = 1e-7 * Math.max(1, Math.abs(x));
  const hy = 1e-7 * Math.max(1, Math.abs(y));
  return [(f(x + hx, y) - f(x - hx, y)) / (2 * hx), (f(x, y + hy) - f(x, y - hy)) / (2 * hy)];
}

/**
 * Projects a point near a boundary onto the curve left − right = 0 (Newton steps along the
 * gradient) – the trace cursor on a relation's edge. Numerical, not guaranteed.
 */
export function traceBoundary(
  e: Expr,
  x: number,
  y: number,
  o: TraceOptions = {},
): MathResult<BoundaryPoint> {
  const compiled = compileRelation(e, o);
  if (!compiled.ok) return compiled;
  const atoms = compiled.value.atoms;
  if (o.atom !== undefined && !atoms[o.atom]) return fail('domain', `no relation ${o.atom}`);
  // nearest boundary first (first-order distance |d| / |∇d|)
  const order = (o.atom !== undefined ? [atoms[o.atom]] : [...atoms])
    .map((a) => {
      const d = a.diff(x, y);
      const [gx, gy] = gradient(a.diff, x, y);
      const dist = Math.abs(d) / Math.hypot(gx, gy);
      return { a, dist: Number.isFinite(dist) ? dist : Infinity };
    })
    .sort((p, q) => p.dist - q.dist);
  for (const { a } of order) {
    let px = x;
    let py = y;
    let converged = false;
    for (let k = 0; k < 60; k++) {
      const d = a.diff(px, py);
      if (d === 0) {
        converged = true;
        break;
      }
      const [gx, gy] = gradient(a.diff, px, py);
      const g2 = gx * gx + gy * gy;
      if (!Number.isFinite(d) || !Number.isFinite(g2) || g2 === 0) break;
      const sx = (d * gx) / g2;
      const sy = (d * gy) / g2;
      px -= sx;
      py -= sy;
      if (Math.hypot(sx, sy) <= 1e-13 * Math.max(1, Math.abs(px), Math.abs(py))) {
        converged = true;
        break;
      }
    }
    if (!converged || !Number.isFinite(px) || !Number.isFinite(py)) continue;
    if (o.maxDistance !== undefined && Math.hypot(px - x, py - y) > o.maxDistance) continue;
    return ok({ x: px, y: py, atom: a.index });
  }
  return fail('no-convergence', 'no boundary found near this point');
}

export interface CrossingOptions extends RelationEvalOptions {
  /** Grid points of the scan along the vertical line (default 1000). */
  readonly samples?: number;
}

/**
 * Boundary points on the vertical line X = x within [ymin, ymax] (the numeric table): the Y
 * values where a relation's left − right changes sign (or touches 0), kept only where that
 * relation decides the formula there (forcing it true or false changes the result), sorted by Y.
 */
export function boundaryCrossings(
  e: Expr,
  x: number,
  ymin: number,
  ymax: number,
  o: CrossingOptions = {},
): MathResult<BoundaryPoint[]> {
  if (!(Number.isFinite(x) && Number.isFinite(ymin) && Number.isFinite(ymax) && ymax > ymin)) {
    return fail('domain', 'invalid line');
  }
  const compiled = compileRelation(e, o);
  if (!compiled.ok) return compiled;
  const rel = compiled.value;
  const out: BoundaryPoint[] = [];
  for (const atom of rel.atoms) {
    for (const y of rootsIn((t) => atom.diff(x, t), ymin, ymax, o.samples ?? 1000)) {
      const on = rel.pointTruthWith(x, y, new Map([[atom.index, true]]));
      const off = rel.pointTruthWith(x, y, new Map([[atom.index, false]]));
      if (on !== off) out.push({ x, y, atom: atom.index });
    }
  }
  return ok(out.sort((p, q) => p.y - q.y || p.atom - q.atom));
}
