import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import {
  type PlotFrame,
  drawAxes,
  drawLines,
  drawPoint,
  DARK_PLOT,
} from '@aba/core/graph/plot-draw';
import type { Expr } from '@aba/math/ast/nodes';
import {
  type ImplicitPlot,
  boundaryCrossings,
  plotRelation,
  traceBoundary,
} from '@aba/math/graph/implicit';
import { type Viewport, pan, toWorldX, toWorldY } from '@aba/math/graph/viewport';
import { compileRelation } from '@aba/math/interval/eval';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { type Area, DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import { SettingsStore } from '../../features/settings/settings-store';
import { AppStore } from '../app-store';
import {
  type CurveScope,
  type CurveState,
  type Relation,
  relationScope,
  relations,
} from '../curve/curve-logic';
import { injectAppScope } from '../shared/app-scope';
import { PlotMenu, type PlotMenuItem } from '../shared/plot-menu';
import { ZOOM_OPS, type ZoomOp, zoomView } from '../shared/plot-logic';

/** Example relations of the gallery (LaTeX as MathLive writes it). */
export const GALLERY: { name: string; latex: string }[] = [
  { name: 'X²+Y²=9', latex: 'X^2+Y^2=9' },
  {
    name: 'and(4≤X²+Y²≤9)',
    latex: '\\operatorname{and}\\left(X^2+Y^2\\le9,X^2+Y^2\\ge4\\right)',
  },
  { name: 'Y>X²−4', latex: 'Y>X^2-4' },
  { name: 'sin(X·Y)=0.5', latex: '\\sin\\left(X\\cdot Y\\right)=0.5' },
  { name: 'sin X · sin Y>0', latex: '\\sin\\left(X\\right)\\cdot\\sin\\left(Y\\right)>0' },
  { name: '(X²+Y²−1)³≤X²Y³', latex: '\\left(X^2+Y^2-1\\right)^3\\le X^2Y^3' },
  {
    name: 'or(Y<−X, X²+Y²<4)',
    latex: '\\operatorname{or}\\left(Y<-X,X^2+Y^2<4\\right)',
  },
];

const fmt = (x: number) =>
  Number.isFinite(x) ? formatReal(x, { mode: 'standard', digits: 0, decimal: '.' }) : '—';

function relationApp() {
  const apps = inject(AppStore);
  const state = computed(() => apps.current().state as CurveState);
  return { apps, state };
}

/** Fill colour of a region: the relation's colour, translucent. */
function translucent(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Plot of the advanced graphing app (prompt 036): every relation as guaranteed regions (interval
 * quadtree), grey undecided pixels and its boundary lines (dashed where strict). The trace walks
 * along a boundary; Gallery loads examples.
 */
@Component({
  selector: 'app-relation-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas, PlotMenu],
  template: `
    <div class="plot">
      <app-plot-canvas [view]="view()" [painter]="painter()" [label]="label()" />
      @if (menu(); as m) {
        <app-plot-menu
          [title]="menuKind() === 'zoom' ? 'Zoom' : i18n.t('rel.gallery')"
          [items]="items()"
          [cursor]="m"
          (pick)="pickMenu($event)"
        />
      }
      <div class="bar" aria-live="polite">{{ bar() }}</div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .plot {
      position: relative;
      height: 100%;
    }
    .bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0.05em 0.4em;
      background: var(--lcd-overlay);
      font-size: 3.3cqw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class RelationPlot implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly app = relationApp();
  private readonly device = inject(DeviceStore);
  private readonly appScope = injectAppScope();
  private readonly canvas = viewChild(PlotCanvas);
  protected readonly view = computed(() => this.app.state().view);
  private readonly scope = computed(() => relationScope(this.appScope()));
  protected readonly list = computed(() => relations(this.app.state().rows));
  private readonly traceIdx = signal(0);
  private readonly cursor = signal<{ x: number; y: number } | null>(null);
  /** direction of the trace along the boundary (+1 / −1) */
  private dir = 1;
  protected readonly menu = signal<number | null>(null);
  protected readonly menuKind = signal<'zoom' | 'gallery'>('zoom');
  /** last complete flag of the painted relations */
  private readonly partial = signal(false);
  private readonly cache = new Map<string, ImplicitPlot | null>();
  private pop: (() => void) | null = null;

  private readonly traced = computed<Relation | null>(() => {
    const l = this.list();
    return l.length ? l[Math.min(this.traceIdx(), l.length - 1)] : null;
  });

  protected readonly bar = computed(() => {
    const r = this.traced();
    if (!r) return this.i18n.t('app.noFunction');
    const c = this.cursor();
    const pos = c ? `  X: ${fmt(c.x)}  Y: ${fmt(c.y)}` : '';
    return `${r.name}${pos}${this.partial() ? ` – ${this.i18n.t('rel.partial')}` : ''}`;
  });

  protected readonly label = computed(() => `${this.i18n.t('rel.plot')}. ${this.bar()}`);

  protected readonly painter = computed<PlotPainter>(() => {
    const s = this.app.state();
    const list = this.list();
    const scope = this.scope();
    const cur = this.cursor();
    const tr = this.traced();
    return (frame) => this.paint(frame, s, list, scope, cur, tr);
  });

  /** The plot of one relation at the frame's pixel grid (cached by formula, view and size). */
  private plotOf(r: Relation, frame: PlotFrame, scope: CurveScope, budget: number) {
    const key = JSON.stringify([
      r.row,
      r.expr,
      frame.view,
      Math.round(frame.width),
      Math.round(frame.height),
      scope.angle,
      [...scope.variables],
    ]);
    if (!this.cache.has(key)) {
      if (this.cache.size > 40) this.cache.clear();
      const p = plotRelation(r.expr, frame.view, {
        width: Math.max(1, Math.round(frame.width)),
        height: Math.max(1, Math.round(frame.height)),
        timeBudgetMs: budget,
        angle: scope.angle,
        variables: scope.variables,
      });
      this.cache.set(key, p.ok ? p.value : null);
    }
    return this.cache.get(key) ?? null;
  }

  private paint(
    frame: PlotFrame,
    s: CurveState,
    list: Relation[],
    scope: CurveScope,
    cur: { x: number; y: number } | null,
    tr: Relation | null,
  ): void {
    drawAxes(frame, DARK_PLOT, s.plot);
    const { ctx } = frame;
    const kx = frame.width / Math.max(1, Math.round(frame.width));
    const ky = frame.height / Math.max(1, Math.round(frame.height));
    const budget = Math.max(80, Math.round(600 / Math.max(1, list.length)));
    let partial = false;
    for (const r of list) {
      const p = this.plotOf(r, frame, scope, budget);
      if (!p) continue;
      if (!p.complete) partial = true;
      const fill = translucent(r.color, 0.3);
      for (const c of p.cells) {
        if (c.truth === 'false') continue;
        ctx.fillStyle = c.truth === 'true' ? fill : 'rgba(120,130,128,0.28)';
        ctx.fillRect(c.i0 * kx, c.j0 * ky, (c.i1 - c.i0) * kx, (c.j1 - c.j0) * ky);
      }
      for (const b of p.boundaries) {
        drawLines(frame, [b.points as [number, number][]], r.color, 2, b.strict ? [5, 4] : []);
      }
    }
    queueMicrotask(() => this.partial.set(partial));
    if (tr && cur) drawPoint(frame, cur.x, cur.y, tr.color);
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'relation-plot',
      title: () => this.i18n.t('rel.plot'),
      menu: () => [
        { label: 'Zoom' },
        { label: 'Trace', active: this.cursor() !== null },
        { label: '' },
        { label: this.i18n.t('rel.gallery') },
        { label: '' },
        { label: '' },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (i === 0) this.openMenu('zoom');
        if (i === 1) {
          if (this.cursor()) this.cursor.set(null);
          else this.startTrace();
        }
        if (i === 3) this.openMenu('gallery');
      },
      rocker: (d, shift) => this.rocker(d, shift),
      gesture: (g, area) => this.gesture(g, area),
      help: 'relation',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected readonly items = computed<PlotMenuItem[]>(() =>
    this.menuKind() === 'zoom'
      ? ZOOM_OPS.filter((op) => op !== 'auto').map((op) => ({
          label: this.i18n.t(`zoom.${op}` as TextKey),
          run: () => this.zoom(op),
        }))
      : GALLERY.map((g) => ({ label: g.name, run: () => this.load(g.latex) })),
  );

  private openMenu(kind: 'zoom' | 'gallery'): void {
    this.menuKind.set(kind);
    this.menu.set(0);
  }

  protected pickMenu(i: number): void {
    this.menu.set(null);
    this.items()[i]?.run();
  }

  /** A gallery example goes into the first empty row (or V1). */
  private load(latex: string): void {
    this.app.apps.update<CurveState>((s) => {
      const free = s.rows.findIndex((r) => !r.fields[0].trim());
      const at = free < 0 ? 0 : free;
      return {
        ...s,
        rows: s.rows.map((r, k) => (k === at ? { fields: [latex], on: true } : r)),
      };
    });
    this.cursor.set(null);
  }

  private setView(v: Viewport): void {
    this.app.apps.update<CurveState>((s) => ({ ...s, view: v }));
  }

  private size() {
    const a = this.canvas()?.area();
    return a?.width ? a : { width: 320, height: 200 };
  }

  private zoom(op: ZoomOp): void {
    const c = this.cursor();
    this.setView(zoomView(this.view(), op, this.size(), c?.x, c?.y));
  }

  /** Puts the trace cursor on a boundary of the traced relation (near the view centre). */
  private startTrace(): void {
    const r = this.traced();
    if (!r) return;
    const v = this.view();
    const o = { angle: this.scope().angle, variables: this.scope().variables };
    const cx = (v.xmin + v.xmax) / 2;
    const cross = boundaryCrossings(r.expr, cx, v.ymin, v.ymax, o);
    if (cross.ok && cross.value.length) {
      const mid = (v.ymin + v.ymax) / 2;
      const best = [...cross.value].sort((a, b) => Math.abs(a.y - mid) - Math.abs(b.y - mid))[0];
      this.cursor.set({ x: best.x, y: best.y });
      return;
    }
    const p = traceBoundary(r.expr, cx, (v.ymin + v.ymax) / 2, o);
    if (p.ok) this.cursor.set({ x: p.value.x, y: p.value.y });
  }

  /** One trace step along the boundary: tangent step, then back onto the curve. */
  private step(expr: Expr, sign: number, shift: boolean): void {
    const c = this.cursor();
    if (!c) return this.startTrace();
    const o = { angle: this.scope().angle, variables: this.scope().variables };
    const rel = compileRelation(expr, o);
    if (!rel.ok) return;
    const near = traceBoundary(expr, c.x, c.y, o);
    const atom = near.ok ? rel.value.atoms[near.value.atom] : rel.value.atoms[0];
    const v = this.view();
    const h = ((v.xmax - v.xmin) / 80) * (shift ? 5 : 1);
    const e = 1e-6 * Math.max(1, Math.abs(c.x), Math.abs(c.y));
    const gx = (atom.diff(c.x + e, c.y) - atom.diff(c.x - e, c.y)) / (2 * e);
    const gy = (atom.diff(c.x, c.y + e) - atom.diff(c.x, c.y - e)) / (2 * e);
    let tx = -gy;
    let ty = gx;
    const n = Math.hypot(tx, ty);
    if (!Number.isFinite(n) || n === 0) return;
    tx /= n;
    ty /= n;
    // → walks towards growing X (along a vertical edge: the direction kept from before)
    if (Math.abs(tx) > 1e-9) this.dir = tx > 0 ? 1 : -1;
    const d = sign * this.dir;
    const next = traceBoundary(expr, c.x + d * h * tx, c.y + d * h * ty, {
      ...o,
      atom: atom.index,
      maxDistance: 3 * h,
    });
    if (!next.ok) return;
    this.cursor.set({ x: next.value.x, y: next.value.y });
    const p = next.value;
    if (p.x < v.xmin || p.x > v.xmax || p.y < v.ymin || p.y > v.ymax) {
      const w = (v.xmax - v.xmin) / 2;
      const hh = (v.ymax - v.ymin) / 2;
      this.setView({ xmin: p.x - w, xmax: p.x + w, ymin: p.y - hh, ymax: p.y + hh });
    }
  }

  private key(p: KeyPress): boolean {
    const m = this.menu();
    if (m !== null) {
      if (p.id === 'enter') this.pickMenu(m);
      else if (p.id === 'esc') this.menu.set(null);
      return true;
    }
    if (p.id === 'add') this.zoom('in');
    else if (p.id === 'sub') this.zoom('out');
    else if (p.id === 'esc') this.cursor.set(null);
    else return false;
    return true;
  }

  private rocker(d: RockerDir, shift: boolean): boolean {
    const m = this.menu();
    if (m !== null) {
      const n = this.items().length;
      if (d === 'up' || d === 'down') this.menu.set((m + (d === 'down' ? 1 : n - 1)) % n);
      if (d === 'left') this.menu.set(null);
      return true;
    }
    const l = this.list();
    if ((d === 'up' || d === 'down') && l.length) {
      this.traceIdx.update(
        (i) => (Math.min(i, l.length - 1) + (d === 'up' ? 1 : l.length - 1)) % l.length,
      );
      this.cursor.set(null);
      this.startTrace();
      return true;
    }
    const r = this.traced();
    if (r && (d === 'left' || d === 'right')) this.step(r.expr, d === 'right' ? 1 : -1, shift);
    return true;
  }

  private gesture(g: Gesture, area: Area): void {
    const v = this.view();
    const scr = this.canvas()?.area() ?? area;
    if (g.kind === 'drag' && g.phase === 'move') {
      this.setView(
        pan(v, (-g.dx * (v.xmax - v.xmin)) / scr.width, (g.dy * (v.ymax - v.ymin)) / scr.height),
      );
    } else if (g.kind === 'pinch' && g.phase === 'move' && g.scale > 0) {
      const f = 1 / g.scale;
      const cx = toWorldX(v, scr, g.cx);
      const cy = toWorldY(v, scr, g.cy);
      this.setView({
        xmin: cx - (cx - v.xmin) * f,
        xmax: cx + (v.xmax - cx) * f,
        ymin: cy - (cy - v.ymin) * f,
        ymax: cy + (v.ymax - cy) * f,
      });
    } else if (g.kind === 'doubleTap') {
      this.setView(zoomView(v, 'in', scr, toWorldX(v, scr, g.x), toWorldY(v, scr, g.y)));
    }
  }
}

/**
 * Numeric view (prompt 036): for each X of the table the boundary Y values of every relation
 * within the plot's Y range (numerical sign changes, see `boundaryCrossings`).
 */
@Component({
  selector: 'app-relation-num',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { tabindex: '0', role: 'region', '[attr.aria-label]': 'title()' },
  template: `
    <table class="num">
      <caption class="visually-hidden">
        {{
          i18n.t('rel.boundary')
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">X</th>
          @for (r of list(); track r.row) {
            <th scope="col" [style.border-bottom-color]="r.color">{{ r.name }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track $index) {
          <tr>
            <th scope="row">{{ row.x }}</th>
            @for (y of row.ys; track $index) {
              <td>{{ y }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }
    .num {
      width: 100%;
      border-collapse: collapse;
      font-size: 3.6cqw;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 0.1em 0.3em;
      border-bottom: 1px solid var(--lcd-line);
      text-align: right;
      white-space: nowrap;
    }
    thead th {
      background: var(--lcd-head);
      position: sticky;
      top: 0;
      border-bottom: 3px solid transparent;
    }
  `,
})
export class RelationNum implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly app = relationApp();
  private readonly device = inject(DeviceStore);
  private readonly settings = inject(SettingsStore);
  private readonly appScope = injectAppScope();
  protected readonly title = () => this.i18n.t('rel.num');
  protected readonly list = computed(() => relations(this.app.state().rows));
  protected readonly rows = computed(() => {
    const s = this.app.state();
    const scope = relationScope(this.appScope());
    const f = this.settings.settings().format;
    const show = (v: number) => (Number.isFinite(v) ? formatReal(v, f) : '—');
    return Array.from({ length: 9 }, (_, k) => {
      const x = Number((s.numStart + k * s.numStep).toPrecision(12));
      const ys = this.list().map((r) => {
        const c = boundaryCrossings(r.expr, x, s.view.ymin, s.view.ymax, scope);
        if (!c.ok) return '—';
        return c.value.length ? c.value.map((p) => show(p.y)).join('; ') : this.i18n.t('rel.none');
      });
      return { x: show(x), ys };
    });
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'relation-num',
      title: () => this.title(),
      menu: () => [
        { label: 'Zoom +' },
        { label: 'Zoom −' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
      ],
      menuPress: (i) => {
        if (i === 0) this.scale(0.5);
        if (i === 1) this.scale(2);
      },
      rocker: (d) => {
        const s = this.app.state();
        if (d === 'up' || d === 'down') {
          const by = (d === 'down' ? 1 : -1) * s.numStep;
          this.app.apps.update<CurveState>((t) => ({ ...t, numStart: t.numStart + by }));
        }
        return true;
      },
      help: 'relation',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private scale(f: number): void {
    this.app.apps.update<CurveState>((s) => ({ ...s, numStep: s.numStep * f }));
  }
}
