import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import { FilesApi } from '@aba/core/files/files-api';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import {
  type PlotFrame,
  drawAxes,
  drawCrosshair,
  drawLines,
  drawPoint,
} from '@aba/core/graph/plot-draw';
import { type Viewport, pan, toWorldX, toWorldY } from '@aba/math/graph/viewport';
import { parseText } from '@aba/math/parser/text-parser';
import { evaluateValue } from '@aba/math/value/evaluate-value';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { type Area, DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import type { MenuButton } from '../../features/device/t1-device';
import { editFor } from '../../features/home/home-keys';
import { HomeStore } from '../../features/home/home-store';
import { AppStore } from '../app-store';
import { injectAppScope } from '../shared/app-scope';
import { PlotMenu, type PlotMenuItem } from '../shared/plot-menu';
import {
  FCN_OPS,
  type FcnOp,
  type FcnResult,
  ZOOM_OPS,
  type ZoomOp,
  curveLines,
  fcn,
  zoomView,
} from '../shared/plot-logic';
import { type FunctionState, plottables, table } from './function-logic';

type MenuKind = 'zoom' | 'fcn' | 'view';

/**
 * Plot view of the function app (prompts 033/034). Trace follows the selected curve (←→ move by a
 * pixel, ↑↓ switch the curve), without trace a free cursor. Zoom, Fcn (root, intersection, slope,
 * extremum, signed area, tangent), Go To, Defn and the views menu (split screen, export) sit on the
 * menu buttons. Drag pans, pinch and +/− zoom, a double tap zooms in.
 */
@Component({
  selector: 'app-function-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas, PlotMenu],
  template: `
    <div class="wrap" [class.split]="split()">
      <div class="plot">
        <app-plot-canvas [view]="view()" [painter]="painter()" [label]="label()" />
        @if (menu(); as m) {
          <app-plot-menu
            [title]="m.kind"
            [items]="menuItems()"
            [cursor]="m.cursor"
            (pick)="pickMenu($event)"
          />
        }
        <div class="bar" aria-live="polite">
          @if (goTo()) {
            <label>
              X =
              <input
                #goto
                type="text"
                spellcheck="false"
                (keydown.enter)="doGoTo()"
                (keydown.escape)="goTo.set(false)"
              />
            </label>
          } @else {
            {{ bar() }}
          }
        </div>
      </div>
      @if (split()) {
        <table class="side">
          <thead>
            <tr>
              <th>X</th>
              <th [style.border-bottom-color]="traced()?.color">{{ traced()?.name ?? '' }}</th>
            </tr>
          </thead>
          <tbody>
            @for (r of sideRows(); track r.x) {
              <tr [class.cur]="r.cur">
                <td>{{ r.x }}</td>
                <td>{{ r.y }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .wrap {
      height: 100%;
      display: grid;
      grid-template-columns: 1fr;
    }
    .wrap.split {
      grid-template-columns: 1fr 34%;
    }
    .plot {
      position: relative;
      min-width: 0;
    }
    .bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0.05em 0.4em;
      background: rgb(255 255 255 / 0.85);
      font-size: 3.3cqw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar input {
      width: 40%;
      font: inherit;
    }
    .side {
      border-collapse: collapse;
      font-size: 3.2cqw;
      font-variant-numeric: tabular-nums;
      align-self: start;
    }
    .side th,
    .side td {
      padding: 0 0.3em;
      text-align: right;
      border-bottom: 1px solid #dde4df;
    }
    .side tr.cur {
      background: #ffe2d8;
    }
  `,
})
export class FunctionPlot implements OnInit, OnDestroy {
  private readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  private readonly device = inject(DeviceStore);
  private readonly home = inject(HomeStore);
  private readonly files = inject(FilesApi);
  private readonly scope = injectAppScope();
  private readonly canvas = viewChild(PlotCanvas);
  private readonly gotoEl = viewChild<ElementRef<HTMLInputElement>>('goto');

  private readonly state = computed(() => this.apps.current().state as FunctionState);
  protected readonly view = computed(() => this.state().view);
  private readonly fns = computed(() => plottables(this.state().fns, this.scope()));

  protected readonly trace = signal(true);
  private readonly traceIdx = signal(0);
  private readonly cx = signal<number | null>(null);
  private readonly cy = signal(0);
  protected readonly menu = signal<{ kind: MenuKind; cursor: number } | null>(null);
  private readonly result = signal<FcnResult | null>(null);
  private readonly areaFrom = signal<number | undefined>(undefined);
  private readonly pendingArea = signal(false);
  private readonly showDefn = signal(false);
  protected readonly goTo = signal(false);
  protected readonly split = signal(false);
  private readonly undo: Viewport[] = [];
  private pop: (() => void) | null = null;

  protected readonly traced = computed(() => {
    const fs = this.fns();
    return fs.length ? fs[Math.min(this.traceIdx(), fs.length - 1)] : null;
  });

  /** cursor position in world coordinates */
  private readonly cursor = computed(() => {
    const v = this.view();
    const x = this.cx() ?? (v.xmin + v.xmax) / 2;
    const t = this.traced();
    const y = this.trace() && t ? t.f(x) : this.cy();
    return { x, y };
  });

  private size(): { width: number; height: number } {
    const a = this.canvas()?.area();
    return a?.width ? a : { width: 320, height: 200 };
  }

  private fmt(x: number): string {
    return Number.isFinite(x) ? formatReal(x, { mode: 'standard', digits: 0, decimal: '.' }) : '—';
  }

  protected readonly bar = computed(() => {
    const r = this.result();
    const t = this.traced();
    if (this.showDefn() && t) {
      return `${t.name}(X) = ${this.state().fns[t.index].latex.replace(/\\left|\\right|\\/g, '')}`;
    }
    if (this.pendingArea()) return this.i18n.t('app.areaHint');
    if (r) {
      switch (r.kind) {
        case 'point':
          return `${this.i18n.t(`fcn.${r.label}` as TextKey)}: X=${this.fmt(r.x)} Y=${this.fmt(r.y)}`;
        case 'slope':
        case 'tangent':
          return `${this.i18n.t('fcn.slope')}: ${this.fmt(r.slope)} (X=${this.fmt(r.x)})`;
        case 'area':
          return `∫ = ${this.fmt(r.value)}`;
        case 'none':
          return r.message;
      }
    }
    const { x, y } = this.cursor();
    const name = this.trace() && t ? `${t.name} ` : '';
    return `${name}X: ${this.fmt(x)}  Y: ${this.fmt(y)}`;
  });

  protected readonly label = computed(
    () =>
      `${this.i18n.t('app.functionPlot')}: ${
        this.fns()
          .map((f) => f.name)
          .join(', ') || '–'
      }. ${this.bar()}`,
  );

  protected readonly painter = computed<PlotPainter>(() => {
    const fns = this.fns();
    const opt = this.state().plot;
    const cur = this.cursor();
    const r = this.result();
    const t = this.traced();
    const from = this.areaFrom();
    return (frame) => this.paint(frame, fns, opt, cur, r, t, from);
  });

  protected readonly sideRows = computed(() => {
    const t = this.traced();
    if (!t) return [];
    const step = this.state().numStep;
    const x0 = Math.round(this.cursor().x / step) * step;
    return table([t], x0 - 4 * step, step, 9).map((row, k) => ({
      x: this.fmt(row.x),
      y: this.fmt(row.ys[0]),
      cur: k === 4,
    }));
  });

  private paint(
    frame: PlotFrame,
    fns: ReturnType<typeof plottables>,
    opt: FunctionState['plot'],
    cur: { x: number; y: number },
    r: FcnResult | null,
    t: ReturnType<typeof plottables>[number] | null,
    from: number | undefined,
  ): void {
    drawAxes(frame, undefined, opt);
    // signed area: shading between the curve and the x axis
    if (r?.kind === 'area' && t) this.shade(frame, t.f, r.a, r.b, t.color);
    for (const f of fns)
      drawLines(frame, curveLines(f.f, frame.view, frame, opt.method), f.color, 2);
    if (r?.kind === 'tangent') {
      const v = frame.view;
      const line = (x: number) => r.y + r.slope * (x - r.x);
      drawLines(
        frame,
        [
          [
            [v.xmin, line(v.xmin)],
            [v.xmax, line(v.xmax)],
          ],
        ],
        '#1b3533',
        1,
        [6, 4],
      );
    }
    if (r?.kind === 'point' || r?.kind === 'slope' || r?.kind === 'tangent')
      drawPoint(frame, r.x, r.y, '#1b3533');
    if (from !== undefined && t) drawPoint(frame, from, t.f(from), '#e8603f');
    if (Number.isFinite(cur.y)) {
      if (this.trace() && t) drawPoint(frame, cur.x, cur.y, t.color);
      else drawCrosshair(frame, cur.x, cur.y);
    }
  }

  private shade(
    frame: PlotFrame,
    f: (x: number) => number,
    a: number,
    b: number,
    color: string,
  ): void {
    const { ctx } = frame;
    const v = frame.view;
    const X = (x: number) => ((x - v.xmin) / (v.xmax - v.xmin)) * frame.width;
    const Y = (y: number) => frame.height - ((y - v.ymin) / (v.ymax - v.ymin)) * frame.height;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const n = 200;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(X(lo), Y(0));
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n;
      const y = f(x);
      ctx.lineTo(X(x), Y(Number.isFinite(y) ? Math.max(v.ymin - 1, Math.min(v.ymax + 1, y)) : 0));
    }
    ctx.lineTo(X(hi), Y(0));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'function-plot',
      title: () => this.i18n.t('app.functionPlot'),
      menu: () => this.buttons(),
      key: (p) => this.key(p),
      menuPress: (i) => this.press(i),
      rocker: (d, shift) => this.rocker(d, shift),
      gesture: (g, area) => this.gesture(g, area),
      help: 'function',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private buttons(): MenuButton[] {
    const t = (k: TextKey) => this.i18n.t(k);
    return [
      { label: 'Zoom' },
      { label: 'Trace', active: this.trace() },
      { label: t('app.goTo') },
      { label: 'Fcn' },
      { label: t('app.defn'), active: this.showDefn() },
      { label: t('app.views') },
    ];
  }

  private press(i: number): void {
    this.result.set(null);
    switch (i) {
      case 0:
        this.menu.set({ kind: 'zoom', cursor: 0 });
        break;
      case 1:
        this.trace.update((t) => !t);
        if (!this.trace()) this.cy.set(this.cursor().y || 0);
        break;
      case 2:
        this.goTo.set(true);
        queueMicrotask(() => this.gotoEl()?.nativeElement.focus());
        break;
      case 3:
        this.menu.set({ kind: 'fcn', cursor: 0 });
        break;
      case 4:
        this.showDefn.update((d) => !d);
        break;
      case 5:
        this.menu.set({ kind: 'view', cursor: 0 });
        break;
    }
  }

  protected readonly menuItems = computed<PlotMenuItem[]>(() => {
    const m = this.menu();
    const t = (k: string) => this.i18n.t(k as TextKey);
    if (!m) return [];
    if (m.kind === 'zoom') {
      return [
        ...ZOOM_OPS.map((op) => ({ label: t(`zoom.${op}`), run: () => this.zoom(op) })),
        { label: t('zoom.undo'), run: () => this.undoZoom() },
      ];
    }
    if (m.kind === 'fcn')
      return FCN_OPS.map((op) => ({ label: t(`fcn.${op}`), run: () => this.analyse(op) }));
    return [
      { label: t('view.split'), run: () => this.split.update((s) => !s) },
      { label: t('zoom.auto'), run: () => this.zoom('auto') },
      { label: t('zoom.decimal'), run: () => this.zoom('decimal') },
      { label: t('zoom.integer'), run: () => this.zoom('integer') },
      { label: t('zoom.trig'), run: () => this.zoom('trig') },
      { label: t('view.png'), run: () => void this.exportPng() },
    ];
  });

  protected pickMenu(i: number): void {
    const item = this.menuItems()[i];
    this.menu.set(null);
    item?.run();
  }

  private setView(v: Viewport, remember = true): void {
    if (remember) {
      this.undo.push(this.view());
      if (this.undo.length > 20) this.undo.shift();
    }
    this.apps.update<FunctionState>((s) => ({ ...s, view: v }));
  }

  private zoom(op: ZoomOp): void {
    const c = this.cursor();
    const f = this.traced()?.f;
    const y = Number.isFinite(c.y) ? c.y : undefined;
    this.setView(zoomView(this.view(), op, this.size(), c.x, y, f));
  }

  private undoZoom(): void {
    const v = this.undo.pop();
    if (v) this.setView(v, false);
  }

  private analyse(op: FcnOp): void {
    const t = this.traced();
    if (!t) {
      this.result.set({ kind: 'none', message: this.i18n.t('app.noFunction') });
      return;
    }
    const x = this.cursor().x;
    if (op === 'area') {
      this.areaFrom.set(x);
      this.pendingArea.set(true);
      this.trace.set(true);
      return;
    }
    const others = this.fns()
      .filter((f) => f !== t)
      .map((f) => f.f);
    const r = fcn(op, t.f, others, x, this.view());
    this.result.set(r);
    if (r.kind === 'point') this.cx.set(r.x);
  }

  protected doGoTo(): void {
    const src = this.gotoEl()?.nativeElement.value ?? '';
    const p = parseText(src);
    const r = p.ok ? evaluateValue(p.value, this.home.scope()) : p;
    this.goTo.set(false);
    if (!r.ok || r.value.kind !== 'real') return;
    const x = r.value.v;
    this.cx.set(x);
    const v = this.view();
    if (x < v.xmin || x > v.xmax) {
      const w = (v.xmax - v.xmin) / 2;
      this.setView({ ...v, xmin: x - w, xmax: x + w });
    }
  }

  private async exportPng(): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.painter()({ ctx, width: 640, height: 480, view: this.view() });
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await this.files.saveBytes('function-plot.png', bytes, { name: 'PNG', extensions: ['png'] });
  }

  private key(p: KeyPress): boolean {
    const m = this.menu();
    if (this.goTo()) {
      if (p.id === 'enter') this.doGoTo();
      else if (p.id === 'esc') this.goTo.set(false);
      else {
        const a = editFor(p);
        const el = this.gotoEl()?.nativeElement;
        if (a?.kind === 'insert' && el) el.value += a.text;
        else if (p.id === 'bksp' && el) el.value = el.value.slice(0, -1);
      }
      return true;
    }
    if (m) {
      if (p.id === 'enter') this.pickMenu(m.cursor);
      else if (p.id === 'esc') this.menu.set(null);
      else if (p.layer === 'main' && /^d[1-9]$/.test(p.id))
        this.pickMenu(Number(p.id.slice(1)) - 1);
      return true;
    }
    if (p.id === 'enter' && this.pendingArea()) {
      const t = this.traced();
      if (t) this.result.set(fcn('area', t.f, [], this.cursor().x, this.view(), this.areaFrom()));
      this.pendingArea.set(false);
      this.areaFrom.set(undefined);
      return true;
    }
    if (p.id === 'esc') {
      this.result.set(null);
      this.pendingArea.set(false);
      this.areaFrom.set(undefined);
      this.showDefn.set(false);
      return true;
    }
    if (p.id === 'view' && p.layer === 'main') {
      this.menu.set({ kind: 'view', cursor: 0 });
      return true;
    }
    if (p.id === 'add') this.zoom('in');
    else if (p.id === 'sub') this.zoom('out');
    else return false;
    return true;
  }

  private rocker(d: RockerDir, shift: boolean): boolean {
    const m = this.menu();
    if (m) {
      const n = this.menuItems().length;
      if (d === 'up' || d === 'down')
        this.menu.set({ ...m, cursor: (m.cursor + (d === 'down' ? 1 : n - 1)) % n });
      if (d === 'left') this.menu.set(null);
      return true;
    }
    this.result.set(null);
    const v = this.view();
    const px = (v.xmax - v.xmin) / this.size().width;
    const py = (v.ymax - v.ymin) / this.size().height;
    const step = shift ? 10 : 1;
    const fs = this.fns();
    if (this.trace() && (d === 'up' || d === 'down') && fs.length) {
      this.traceIdx.update(
        (i) => (Math.min(i, fs.length - 1) + (d === 'up' ? 1 : fs.length - 1)) % fs.length,
      );
      return true;
    }
    const c = this.cursor();
    if (d === 'left' || d === 'right') {
      const x = c.x + (d === 'right' ? step : -step) * px;
      this.cx.set(x);
      if (x < v.xmin || x > v.xmax)
        this.setView(pan(v, x < v.xmin ? x - v.xmin : x - v.xmax, 0), false);
    } else {
      const y = c.y + (d === 'up' ? step : -step) * py;
      this.cy.set(y);
      if (y < v.ymin || y > v.ymax)
        this.setView(pan(v, 0, y < v.ymin ? y - v.ymin : y - v.ymax), false);
    }
    // keep the traced point in view vertically
    const t = this.traced();
    if (this.trace() && t) {
      const y = t.f(this.cursor().x);
      if (Number.isFinite(y) && (y < v.ymin || y > v.ymax)) {
        const h = (v.ymax - v.ymin) / 2;
        this.setView({ ...this.view(), ymin: y - h, ymax: y + h }, false);
      }
    }
    return true;
  }

  private gesture(g: Gesture, area: Area): void {
    const v = this.view();
    const scr = this.canvas()?.area() ?? area;
    if (g.kind === 'tap') {
      this.result.set(null);
      this.cx.set(toWorldX(v, scr, g.x));
      this.cy.set(toWorldY(v, scr, g.y));
    } else if (g.kind === 'drag' && g.phase === 'move') {
      const dx = (-g.dx * (v.xmax - v.xmin)) / scr.width;
      const dy = (g.dy * (v.ymax - v.ymin)) / scr.height;
      this.setView(pan(v, dx, dy), false);
    } else if (g.kind === 'drag' && g.phase === 'start') {
      this.undo.push(v);
    } else if (g.kind === 'pinch' && g.phase === 'move' && g.scale > 0) {
      const f = 1 / g.scale;
      const cx = toWorldX(v, scr, g.cx);
      const cy = toWorldY(v, scr, g.cy);
      this.setView(
        {
          xmin: cx - (cx - v.xmin) * f,
          xmax: cx + (v.xmax - cx) * f,
          ymin: cy - (cy - v.ymin) * f,
          ymax: cy + (v.ymax - cy) * f,
        },
        false,
      );
    } else if (g.kind === 'doubleTap') {
      this.setView(zoomView(v, 'in', scr, toWorldX(v, scr, g.x), toWorldY(v, scr, g.y)));
    }
  }
}
