/**
 * Dependency graph of the spreadsheet (prompt 041): which formula reads which cells. Precedents are
 * rectangles (a single cell is a 1×1 rectangle); single cells are indexed, wider ranges are scanned.
 * Evaluation order by Tarjan's algorithm (iterative – long chains do not overflow the stack): it
 * yields precedents first and finds the cycles (strongly connected components) on the way. Pure.
 */
import { type Rect, cellKey, inRect, parseKey } from './refs';

export interface OrderedCell {
  readonly key: string;
  /** part of a reference cycle (or reads itself) */
  readonly cycle: boolean;
}

const single = (q: Rect) => q.r0 === q.r1 && q.c0 === q.c1;

export class DependencyGraph {
  private readonly precedents = new Map<string, readonly Rect[]>();
  /** cell key → formulas that read exactly this cell */
  private readonly readers = new Map<string, Set<string>>();
  /** formulas that read at least one range of more than one cell */
  private readonly wide = new Set<string>();

  /** Replaces the precedents of `key` (an empty list removes it from the graph). */
  set(key: string, rects: readonly Rect[]): void {
    this.delete(key);
    if (!rects.length) return;
    this.precedents.set(key, rects);
    for (const q of rects) {
      if (!single(q)) {
        this.wide.add(key);
        continue;
      }
      const k = cellKey(q.r0, q.c0);
      let s = this.readers.get(k);
      if (!s) this.readers.set(k, (s = new Set()));
      s.add(key);
    }
  }

  delete(key: string): void {
    for (const q of this.precedents.get(key) ?? []) {
      if (single(q)) this.readers.get(cellKey(q.r0, q.c0))?.delete(key);
    }
    this.precedents.delete(key);
    this.wide.delete(key);
  }

  clear(): void {
    this.precedents.clear();
    this.readers.clear();
    this.wide.clear();
  }

  precedentsOf(key: string): readonly Rect[] {
    return this.precedents.get(key) ?? [];
  }

  /** Formulas that read the cell directly. */
  dependentsOf(key: string): Set<string> {
    const out = new Set(this.readers.get(key));
    const at = parseKey(key);
    if (!at) return out;
    for (const w of this.wide) {
      if (this.precedents.get(w)!.some((q) => inRect(q, at.row, at.col))) out.add(w);
    }
    return out;
  }

  /** The cells and everything that depends on them, directly or indirectly. */
  affected(keys: Iterable<string>): Set<string> {
    const out = new Set<string>();
    const todo = [...keys];
    while (todo.length) {
      const k = todo.pop()!;
      if (out.has(k)) continue;
      out.add(k);
      for (const d of this.dependentsOf(k)) if (!out.has(d)) todo.push(d);
    }
    return out;
  }

  /** Precedents of `key` inside `subset`. */
  private edges(key: string, subset: ReadonlySet<string>): string[] {
    const out = new Set<string>();
    for (const q of this.precedents.get(key) ?? []) {
      const area = (q.r1 - q.r0 + 1) * (q.c1 - q.c0 + 1);
      if (area <= subset.size) {
        for (let r = q.r0; r <= q.r1; r++) {
          for (let c = q.c0; c <= q.c1; c++) {
            const k = cellKey(r, c);
            if (subset.has(k)) out.add(k);
          }
        }
      } else {
        for (const k of subset) {
          const p = parseKey(k);
          if (p && inRect(q, p.row, p.col)) out.add(k);
        }
      }
    }
    return [...out];
  }

  /** Evaluation order of `subset`: precedents first; cells of cycles are marked. */
  order(subset: ReadonlySet<string>): OrderedCell[] {
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const out: OrderedCell[] = [];
    let next = 0;
    for (const root of subset) {
      if (index.has(root)) continue;
      const frames: { key: string; edges: string[]; i: number }[] = [];
      const open = (key: string) => {
        index.set(key, next);
        low.set(key, next++);
        stack.push(key);
        onStack.add(key);
        frames.push({ key, edges: this.edges(key, subset), i: 0 });
      };
      open(root);
      while (frames.length) {
        const f = frames[frames.length - 1];
        if (f.i < f.edges.length) {
          const w = f.edges[f.i++];
          if (!index.has(w)) open(w);
          else if (onStack.has(w)) low.set(f.key, Math.min(low.get(f.key)!, index.get(w)!));
          continue;
        }
        frames.pop();
        const parent = frames[frames.length - 1];
        if (parent) low.set(parent.key, Math.min(low.get(parent.key)!, low.get(f.key)!));
        if (low.get(f.key) !== index.get(f.key)) continue;
        const scc: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
        } while (w !== f.key);
        const cycle = scc.length > 1 || f.edges.includes(f.key);
        for (const k of scc.reverse()) out.push({ key: k, cycle });
      }
    }
    return out;
  }
}
