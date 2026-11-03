import { Injectable, computed, inject, signal } from '@angular/core';
import { freeSymbols } from '@aba/math/ast/build';
import type { Expr } from '@aba/math/ast/nodes';
import {
  type PointOfInterest,
  area,
  extrema,
  intersections,
  roots,
  tangent,
} from '@aba/math/graph/analysis';
import { autoY } from '@aba/math/graph/sampler';
import {
  STANDARD_VIEW,
  TRIG_VIEW,
  type Viewport,
  pan,
  valid,
  zoom,
} from '@aba/math/graph/viewport';
import { compile } from '@aba/math/numeric/evaluate';
import { toText } from '@aba/math/serializer';
import { StorageApi } from '@aba/core/storage/storage-api';
import { CalculatorEngine } from '../calculator/calculator-engine';
import { formatNumber } from '../calculator/evaluation-logic';
import { SettingsStore } from '../settings/settings-store';
import { VarsStore } from '../vars/vars-store';

export const MAX_FUNCTIONS = 6;
const CONSTANTS = new Set(['pi', 'e']);

export interface PlotFunction {
  readonly id: number;
  readonly latex: string;
  readonly text: string;
  readonly f: (x: number) => number;
}

export interface AreaMark {
  readonly fn: number;
  readonly a: number;
  readonly b: number;
}

/**
 * Graph mode (prompts 014–016): functions, window, trace cursor, analysis marks. Functions and the
 * window are kept in the document `graph`.
 */
@Injectable({ providedIn: 'root' })
export class GraphStore {
  private readonly engine = inject(CalculatorEngine);
  private readonly vars = inject(VarsStore);
  private readonly settings = inject(SettingsStore);
  private readonly storage = inject(StorageApi);
  private nextId = 1;

  readonly functions = signal<PlotFunction[]>([]);
  readonly view = signal<Viewport>(STANDARD_VIEW);
  /** Selected function (index) for TRACE and analysis. */
  readonly selected = signal(0);
  readonly trace = signal<number | null>(null);
  readonly marks = signal<PointOfInterest[]>([]);
  readonly tangentAt = signal<{ x: number; y: number; slope: number } | null>(null);
  readonly areaMark = signal<AreaMark | null>(null);
  /** First bound while marking an area. */
  readonly areaStart = signal<number | null>(null);
  /** Readout line under the plot (coordinates, results). */
  readonly readout = signal<string>('');
  /** Y= list shown instead of the plot. */
  readonly listOpen = signal(false);

  readonly current = computed(() => this.functions()[this.selected()] ?? null);

  async restore(): Promise<void> {
    try {
      const doc = (await this.storage.load('graph')).value as {
        functions?: unknown;
        view?: unknown;
      } | null;
      const list = Array.isArray(doc?.functions)
        ? doc.functions.filter((x): x is string => typeof x === 'string')
        : [];
      for (const latex of list.slice(0, MAX_FUNCTIONS)) this.add(latex, false);
      const v = doc?.view as Viewport | undefined;
      if (v && valid(v)) this.view.set(v);
    } catch {
      /* the plot simply starts empty */
    }
  }

  /** Adds y = f(x) from the input line; returns an error message or null. */
  add(latex: string, persist = true): string | null {
    if (this.functions().length >= MAX_FUNCTIONS) return `at most ${MAX_FUNCTIONS} functions`;
    const ctx = this.context();
    const parsed = this.engine.parse(latex, ctx);
    if (!parsed.ok) return parsed.error.message;
    let e: Expr = parsed.value;
    // "y = …" or "f(x) = …" → the right-hand side
    if (e.type === 'rel' && e.op === '=') e = e.right;
    const prepared = this.engine.prepare(e, ctx);
    if (!prepared.ok) return prepared.error.message;
    const free = [...freeSymbols(prepared.value)].filter((s) => !CONSTANTS.has(s) && s !== 'x');
    if (free.length) return `unknown name(s) ${free.join(', ')} – plot functions of x`;
    const f = compile(prepared.value, 'x', { functions: ctx.functions });
    this.functions.update((l) => [...l, { id: this.nextId++, latex, text: toText(e), f }]);
    this.selected.set(this.functions().length - 1);
    this.clearMarks();
    if (persist) this.save();
    return null;
  }

  remove(index: number): void {
    this.functions.update((l) => l.filter((_, i) => i !== index));
    this.selected.set(Math.max(0, Math.min(this.selected(), this.functions().length - 1)));
    this.clearMarks();
    this.save();
  }

  clear(): void {
    this.functions.set([]);
    this.clearMarks();
    this.save();
  }

  clearMarks(): void {
    this.marks.set([]);
    this.tangentAt.set(null);
    this.areaMark.set(null);
    this.areaStart.set(null);
  }

  setView(v: Viewport): void {
    if (!valid(v)) return;
    this.view.set(v);
    this.save();
  }

  zoomBy(factor: number, cx?: number, cy?: number): void {
    this.setView(zoom(this.view(), factor, cx, cy));
  }

  panBy(dx: number, dy: number): void {
    this.setView(pan(this.view(), dx, dy));
  }

  standard(): void {
    this.setView(STANDARD_VIEW);
  }

  trig(): void {
    this.setView(TRIG_VIEW);
  }

  /** y-range from the selected function (or all) over the current x-range. */
  auto(): void {
    const v = this.view();
    const fs = this.functions();
    let lo = Infinity;
    let hi = -Infinity;
    for (const f of fs) {
      const r = autoY(f.f, v.xmin, v.xmax);
      if (r) {
        lo = Math.min(lo, r.ymin);
        hi = Math.max(hi, r.ymax);
      }
    }
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo)
      this.setView({ ...v, ymin: lo, ymax: hi });
  }

  // ---------------------------------------------------------------- trace

  startTrace(): void {
    if (!this.current()) {
      this.readout.set('add a function first: type it and press ENTER');
      return;
    }
    const v = this.view();
    this.trace.set(this.trace() ?? (v.xmin + v.xmax) / 2);
    this.updateReadout();
  }

  /** Moves the trace cursor by pixels (steps of 1/100 of the window). */
  traceStep(steps: number): void {
    const v = this.view();
    const x = (this.trace() ?? (v.xmin + v.xmax) / 2) + ((v.xmax - v.xmin) / 100) * steps;
    this.traceTo(x);
  }

  traceTo(x: number): void {
    const v = this.view();
    // keep the cursor visible: scroll the window along
    if (x < v.xmin || x > v.xmax)
      this.setView(pan(v, (x < v.xmin ? x - v.xmin : x - v.xmax) / (v.xmax - v.xmin), 0));
    this.trace.set(x);
    this.updateReadout();
  }

  selectNext(delta: number): void {
    const n = this.functions().length;
    if (n === 0) return;
    this.selected.set((this.selected() + delta + n) % n);
    this.updateReadout();
  }

  endTrace(): void {
    this.trace.set(null);
    this.readout.set('');
  }

  private fmt(x: number): string {
    return formatNumber(x, Math.min(10, this.settings.digits())).text;
  }

  private updateReadout(): void {
    const fn = this.current();
    const x = this.trace();
    if (!fn || x === null) return;
    const y = fn.f(x);
    this.readout.set(
      `y${this.selected() + 1}: x = ${this.fmt(x)}   y = ${Number.isFinite(y) ? this.fmt(y) : 'undefined'}`,
    );
  }

  // ---------------------------------------------------------------- analysis (prompt 015/016)

  analyse(kind: 'root' | 'extr' | 'isect' | 'tang' | 'area'): void {
    const fn = this.current();
    if (!fn) {
      this.readout.set('add a function first');
      return;
    }
    const v = this.view();
    switch (kind) {
      case 'root': {
        const r = roots(fn.f, v.xmin, v.xmax);
        this.marks.set(r);
        this.readout.set(
          r.length
            ? `zeros: ${r.map((p) => `x = ${this.fmt(p.x)}`).join(', ')}`
            : 'no zeros in view',
        );
        break;
      }
      case 'extr': {
        const r = extrema(fn.f, v.xmin, v.xmax);
        this.marks.set(r);
        this.readout.set(
          r.length
            ? r.map((p) => `${p.kind} (${this.fmt(p.x)}, ${this.fmt(p.y)})`).join(', ')
            : 'no extrema in view',
        );
        break;
      }
      case 'isect': {
        const fs = this.functions();
        if (fs.length < 2) {
          this.readout.set('intersections need two functions');
          return;
        }
        const other = fs[(this.selected() + 1) % fs.length];
        const r = intersections(fn.f, other.f, v.xmin, v.xmax);
        this.marks.set(r);
        this.readout.set(
          r.length
            ? r.map((p) => `(${this.fmt(p.x)}, ${this.fmt(p.y)})`).join(', ')
            : 'no intersections in view',
        );
        break;
      }
      case 'tang': {
        const x = this.trace() ?? (v.xmin + v.xmax) / 2;
        const t = tangent(fn.f, x);
        if (!t.ok) {
          this.readout.set(t.error.message);
          return;
        }
        this.tangentAt.set(t.value);
        const b = t.value.y - t.value.slope * t.value.x;
        this.readout.set(
          `tangent: y = ${this.fmt(t.value.slope)}·x ${b < 0 ? '−' : '+'} ${this.fmt(Math.abs(b))}`,
        );
        break;
      }
      case 'area':
        this.markArea();
        break;
    }
  }

  /** ∫AREA: first press marks the lower bound at the trace cursor, the second the upper one. */
  private markArea(): void {
    if (this.trace() === null) {
      this.startTrace();
      this.readout.set('move to the lower bound (◀ ▶), then press ∫AREA');
      return;
    }
    const x = this.trace()!;
    if (this.areaStart() === null) {
      this.areaStart.set(x);
      this.areaMark.set(null);
      this.readout.set(`lower bound ${this.fmt(x)} – move to the upper bound, press ∫AREA`);
      return;
    }
    const a = Math.min(this.areaStart()!, x);
    const b = Math.max(this.areaStart()!, x);
    this.areaStart.set(null);
    const r = area(this.current()!.f, a, b);
    if (!r.ok) {
      this.readout.set(r.error.message);
      return;
    }
    this.areaMark.set({ fn: this.selected(), a, b });
    const { value, positive, negative } = r.value;
    this.readout.set(
      `∫ from ${this.fmt(a)} to ${this.fmt(b)} = ${this.fmt(value)}  (above: ${this.fmt(positive)}, below: ${this.fmt(negative)})`,
    );
  }

  private context() {
    return {
      angle: this.settings.angle(),
      approx: true,
      variables: this.vars.variables(),
      functions: this.vars.functions(),
    };
  }

  private save(): void {
    this.storage
      .save('graph', {
        schemaVersion: 1,
        functions: this.functions().map((f) => f.latex),
        view: this.view(),
      })
      .catch(() => undefined);
  }
}
