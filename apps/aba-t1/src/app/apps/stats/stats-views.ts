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
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import { type PlotFrame, drawAxes, drawLines, drawPoint, sx, sy } from '@aba/core/graph/plot-draw';
import { type Viewport, pan, toWorldX, toWorldY } from '@aba/math/graph/viewport';
import type { RegressionModel } from '@aba/math/stats/regression';
import { Rng } from '@aba/math/stats/random';
import { parseText } from '@aba/math/parser/text-parser';
import { evaluateValue } from '@aba/math/value/evaluate-value';
import { formatReal } from '@aba/math/value/format';
import { list, real } from '@aba/math/value/value';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { type Area, DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import { editFor } from '../../features/home/home-keys';
import { HomeStore } from '../../features/home/home-store';
import { SettingsStore } from '../../features/settings/settings-store';
import { AppStore } from '../app-store';
import { ColumnsEditor, type ColumnsMenuItem } from '../shared/columns-editor';
import { PlotMenu, type PlotMenuItem } from '../shared/plot-menu';
import { ZOOM_OPS, type ZoomOp, zoomView } from '../shared/plot-logic';
import { SetupForm, type SetupItem } from '../shared/setup-form';
import {
  type Analysis1,
  type Analysis2,
  type Chart,
  DIGITS,
  FITS,
  PLOTS_1,
  type Prim,
  type StatRow,
  type Stats1State,
  type Stats2State,
  type StatsState,
  type TracePoint,
  analysisColor,
  autoView,
  chart1,
  data1,
  data2,
  fit2,
  fitCurve,
  stats1Rows,
  stats2Rows,
} from './stats-logic';

type Kind = 'stats1' | 'stats2';

/** Kind and state of the running statistics app. */
function statsApp() {
  const apps = inject(AppStore);
  const kind = computed(() => apps.currentDef().id as Kind);
  const state = computed(() => apps.current().state as StatsState<Analysis1 | Analysis2>);
  const update = (f: (s: StatsState<Analysis1 | Analysis2>) => StatsState<Analysis1 | Analysis2>) =>
    apps.update(f);
  return { apps, kind, state, update };
}

const colName = (kind: Kind, j: number) => `${kind === 'stats1' ? 'D' : 'C'}${DIGITS[j]}`;
const anaName = (kind: Kind, i: number) => `${kind === 'stats1' ? 'H' : 'S'}${i + 1}`;
const on = (kind: Kind, a: Analysis1 | Analysis2) =>
  kind === 'stats1' ? (a as Analysis1).data >= 0 : (a as Analysis2).x >= 0;

/** Symbolic view: the analyses H1…H5 (data, frequency, chart) or S1…S5 (X, Y, fit). */
@Component({
  selector: 'app-stats-symb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form [title]="title()" [fields]="fields()" [close]="close" />`,
})
export class StatsSymb {
  protected readonly i18n = inject(I18n);
  private readonly app = statsApp();
  protected readonly title = computed(() =>
    this.i18n.t(this.app.kind() === 'stats1' ? 'stats.symb1' : 'stats.symb2'),
  );
  protected readonly close = () => this.app.apps.show('plot');
  protected readonly fields = computed<SetupItem[]>(() => {
    const kind = this.app.kind();
    const t = (k: TextKey) => this.i18n.t(k);
    const cols = (none: string) => [
      { value: '-1', label: none },
      ...DIGITS.map((_, j) => ({ value: String(j), label: colName(kind, j) })),
    ];
    const items: SetupItem[] = [];
    const set = (i: number, patch: Partial<Analysis1 & Analysis2>) =>
      this.app.update((s) => ({
        ...s,
        analyses: s.analyses.map((a, k) => (k === i ? { ...a, ...patch } : a)),
      }));
    const st = () => this.app.state();
    for (let i = 0; i < 5; i++) {
      const n = anaName(kind, i);
      if (kind === 'stats1') {
        const a = () => st().analyses[i] as Analysis1;
        items.push(
          {
            label: `${n} ${t('stats.data')}`,
            choices: cols(t('app.off')),
            value: () => String(a().data),
            set: (v: string) => set(i, { data: Number(v) }),
          },
          {
            label: `${n} ${t('stats.freq')}`,
            choices: cols('1'),
            value: () => String(a().freq),
            set: (v: string) => set(i, { freq: Number(v) }),
          },
          {
            label: `${n} ${t('stats.chart')}`,
            choices: PLOTS_1.map((p) => ({ value: p, label: t(`stats.p.${p}` as TextKey) })),
            value: () => a().plot,
            set: (v: string) => set(i, { plot: v as Analysis1['plot'] }),
          },
        );
      } else {
        const a = () => st().analyses[i] as Analysis2;
        items.push(
          {
            label: `${n} X`,
            choices: cols(t('app.off')),
            value: () => String(a().x),
            set: (v: string) => set(i, { x: Number(v) }),
          },
          {
            label: `${n} Y`,
            choices: cols('–').slice(1),
            value: () => String(a().y),
            set: (v: string) => set(i, { y: Number(v) }),
          },
          {
            label: `${n} ${t('stats.fit')}`,
            choices: FITS.map((f) => ({ value: f, label: t(`stats.f.${f}` as TextKey) })),
            value: () => a().fit,
            set: (v: string) => set(i, { fit: v as RegressionModel }),
          },
        );
      }
    }
    return items;
  });
}

/** Numeric view: the ten data columns, sorting, list import/export, random data, statistics. */
@Component({
  selector: 'app-stats-num',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColumnsEditor, PlotMenu],
  template: `
    <div class="num">
      <app-columns-editor
        [cols]="app.state().cols"
        [names]="names()"
        [label]="i18n.t(app.kind() === 'stats1' ? 'stats.num1' : 'stats.num2')"
        [save]="save"
        [extra]="extra()"
        help="stats"
      />
      @if (more() !== null) {
        <app-plot-menu
          [title]="i18n.t('stats.more')"
          [items]="moreItems()"
          [cursor]="more()!"
          (pick)="pickMore($event)"
        />
      }
      @if (table(); as t) {
        <div class="stats" tabindex="0" role="region" [attr.aria-label]="i18n.t('stats.stats')">
          <table>
            <thead>
              <tr>
                <th scope="col"></th>
                @for (h of t.heads; track h.name) {
                  <th scope="col" [style.border-bottom-color]="h.color">{{ h.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (r of t.rows; track r.name) {
                <tr>
                  <th scope="row">{{ r.name }}</th>
                  @for (v of r.values; track $index) {
                    <td>{{ v }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
          @for (e of t.notes; track $index) {
            <p class="note">{{ e }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .num {
      position: relative;
      height: 100%;
    }
    .stats {
      position: absolute;
      inset: 0;
      z-index: 4;
      overflow: auto;
      background: #fff;
      font-size: 3.6cqw;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 0.1em 0.4em;
      border-bottom: 1px solid #dde4df;
      text-align: right;
      white-space: nowrap;
    }
    tbody th {
      text-align: left;
      font-weight: 400;
    }
    thead th {
      background: #e8eeea;
      position: sticky;
      top: 0;
      border-bottom: 3px solid transparent;
    }
    .note {
      margin: 0.2em 0.4em;
      color: #3d514c;
    }
  `,
})
export class StatsNum implements OnDestroy {
  protected readonly i18n = inject(I18n);
  protected readonly app = statsApp();
  private readonly device = inject(DeviceStore);
  private readonly home = inject(HomeStore);
  private readonly settings = inject(SettingsStore);
  protected readonly names = computed(() => DIGITS.map((_, j) => colName(this.app.kind(), j)));
  protected readonly save = (cols: number[][]) => this.app.update((s) => ({ ...s, cols }));
  protected readonly more = signal<number | null>(null);
  private readonly showStats = signal(false);
  private col = 0;
  private popStats: (() => void) | null = null;

  protected readonly extra = computed<ColumnsMenuItem[]>(() => [
    { label: this.i18n.t('stats.sort'), run: (c) => this.sortCol(c, 1) },
    {
      label: this.i18n.t('stats.more'),
      run: (c) => {
        this.col = c;
        this.openMore();
      },
    },
    { label: 'Stats', run: () => this.openStats() },
  ]);

  protected readonly moreItems = computed<PlotMenuItem[]>(() => {
    const t = (k: TextKey, p?: Record<string, string>) => this.i18n.t(k, p);
    const lists = [...this.home.variables()].filter(([, v]) => v.kind === 'list');
    return [
      { label: t('stats.sortDown'), run: () => this.sortCol(this.col, -1) },
      { label: t('stats.clear'), run: () => this.setCol(this.col, []) },
      { label: t('stats.random'), run: () => this.random(this.col) },
      ...lists.map(([n]) => ({
        label: t('stats.fromList', { name: n }),
        run: () => this.fromList(n),
      })),
      { label: t('stats.toList', { name: `L${DIGITS[this.col]}` }), run: () => this.toList() },
    ];
  });

  protected readonly table = computed(() => {
    if (!this.showStats()) return null;
    const kind = this.app.kind();
    const s = this.app.state();
    const f = this.settings.settings().format;
    const show = (v: number | null) => (v === null || !Number.isFinite(v) ? '—' : formatReal(v, f));
    const heads: { name: string; color: string }[] = [];
    const cols: StatRow[][] = [];
    const notes: string[] = [];
    s.analyses.forEach((a, i) => {
      if (!on(kind, a)) return;
      const name = anaName(kind, i);
      let rows;
      if (kind === 'stats1') {
        const d = data1(s as Stats1State, a as Analysis1);
        rows = d.ok ? stats1Rows(d.value.x, d.value.f) : d;
      } else {
        const d = data2(s as Stats2State, a as Analysis2);
        if (d.ok) {
          const fit = fit2(d.value.x, d.value.y, (a as Analysis2).fit);
          notes.push(`${name}: ${fit.ok ? fit.value.equation : fit.error.message}`);
          rows = stats2Rows(d.value.x, d.value.y, fit);
        } else rows = d;
      }
      if (!rows.ok) {
        notes.push(`${name}: ${rows.error.message}`);
        return;
      }
      heads.push({ name, color: analysisColor(i) });
      cols.push(rows.value);
    });
    const names = cols[0]?.map((r) => r.name) ?? [];
    return {
      heads,
      rows: names.map((name, k) => ({ name, values: cols.map((c) => show(c[k].value)) })),
      notes,
    };
  });

  ngOnDestroy(): void {
    this.popStats?.();
  }

  private setCol(c: number, values: number[]): void {
    this.app.update((s) => ({ ...s, cols: s.cols.map((x, k) => (k === c ? values : x)) }));
  }

  private sortCol(c: number, dir: 1 | -1): void {
    this.setCol(
      c,
      [...this.app.state().cols[c]].sort((a, b) => dir * (a - b)),
    );
  }

  private random(c: number): void {
    const r = Rng.seeded(Date.now() % 2147483647);
    if (!r.ok) return;
    this.setCol(
      c,
      Array.from({ length: 20 }, () => {
        const v = r.value.normal(50, 10);
        return v.ok ? Math.round(v.value * 10) / 10 : 50;
      }),
    );
  }

  private fromList(name: string): void {
    const v = this.home.variables().get(name);
    if (v?.kind !== 'list') return;
    this.setCol(
      this.col,
      v.items.map((x) => (x.kind === 'real' ? x.v : NaN)).filter(Number.isFinite),
    );
  }

  private toList(): void {
    this.home.store(`L${DIGITS[this.col]}`, list(this.app.state().cols[this.col].map(real)));
  }

  private openMore(): void {
    this.more.set(0);
    const pop = this.device.push({
      id: 'stats-more',
      title: () => this.i18n.t('stats.more'),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      key: (p) => {
        if (p.id === 'enter') this.pickMore(this.more() ?? 0);
        else if (p.id === 'esc') this.closeMore();
        return true;
      },
      menuPress: (i) => {
        if (i === 5) this.pickMore(this.more() ?? 0);
      },
      rocker: (d) => {
        const n = this.moreItems().length;
        const m = this.more() ?? 0;
        if (d === 'up' || d === 'down') this.more.set((m + (d === 'down' ? 1 : n - 1)) % n);
        if (d === 'left') this.closeMore();
        return true;
      },
      help: 'stats',
    });
    this.closeMore = () => {
      pop();
      this.more.set(null);
    };
  }

  private closeMore = () => this.more.set(null);

  protected pickMore(i: number): void {
    const item = this.moreItems()[i];
    this.closeMore();
    item?.run();
  }

  private openStats(): void {
    this.showStats.set(true);
    this.popStats = this.device.push({
      id: 'stats-table',
      title: () => this.i18n.t('stats.stats'),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      key: (p) => {
        if (p.id === 'esc' || p.id === 'enter') this.closeStats();
        return true;
      },
      menuPress: (i) => {
        if (i === 5) this.closeStats();
      },
      rocker: () => true,
      help: 'stats',
    });
  }

  private closeStats(): void {
    this.popStats?.();
    this.popStats = null;
    this.showStats.set(false);
  }
}

interface Drawn {
  index: number;
  name: string;
  color: string;
  chart: Chart;
  /** 2 Var: the fitted curve */
  curve?: [number, number][][];
  fit?: { f: (x: number) => number; predictX?: (y: number) => number | null; eq: string };
}

const fmt = (x: number) =>
  Number.isFinite(x) ? formatReal(x, { mode: 'standard', digits: 0, decimal: '.' }) : '—';

/**
 * Plot of both statistics apps: the charts of the enabled analyses (1 Var) or scatter plots with
 * their fitted curves (2 Var). ←→ trace over classes/points, ↑↓ switch analysis; 2 Var: Pred
 * evaluates the fit at an X (or, with Pred X, finds X for a Y).
 */
@Component({
  selector: 'app-stats-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas, PlotMenu],
  template: `
    <div class="plot">
      <app-plot-canvas [view]="view()" [painter]="painter()" [label]="label()" />
      @if (text(); as lines) {
        <pre class="stem" tabindex="0" [attr.aria-label]="i18n.t('stats.p.stemleaf')">{{
          lines.join(
            '
'
          )
        }}</pre>
      }
      @if (menu(); as m) {
        <app-plot-menu title="Zoom" [items]="items()" [cursor]="m" (pick)="pickMenu($event)" />
      }
      <div class="bar" aria-live="polite">
        @if (pred(); as p) {
          <label>
            {{ p === 'x' ? 'X' : 'Y' }} =
            <input
              #predIn
              type="text"
              spellcheck="false"
              (keydown.enter)="doPred()"
              (keydown.escape)="pred.set(null)"
            />
          </label>
        } @else {
          {{ bar() }}
        }
      </div>
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
    .stem {
      position: absolute;
      inset: 0 0 1.4em 0;
      margin: 0;
      padding: 0.3em 0.6em;
      overflow: auto;
      background: #fff;
      font-size: 3.8cqw;
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
  `,
})
export class StatsPlot implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly app = statsApp();
  private readonly device = inject(DeviceStore);
  private readonly home = inject(HomeStore);
  private readonly canvas = viewChild(PlotCanvas);
  private readonly predEl = viewChild<ElementRef<HTMLInputElement>>('predIn');
  protected readonly view = computed(() => this.app.state().view);
  private readonly traceIdx = signal(0);
  private readonly pos = signal(0);
  protected readonly menu = signal<number | null>(null);
  protected readonly pred = signal<'x' | 'y' | null>(null);
  private readonly predicted = signal<string | null>(null);
  private pop: (() => void) | null = null;

  /** charts of the enabled analyses, or an error message per analysis */
  private readonly drawn = computed(() => {
    const kind = this.app.kind();
    const s = this.app.state();
    const out: Drawn[] = [];
    const errors: string[] = [];
    let band = 0;
    s.analyses.forEach((a, i) => {
      if (!on(kind, a)) return;
      const name = anaName(kind, i);
      const color = analysisColor(i);
      if (kind === 'stats1') {
        const a1 = a as Analysis1;
        const d = data1(s as Stats1State, a1);
        const c = d.ok
          ? chart1(a1.plot, d.value.x, d.value.f, color, a1.plot === 'box' ? band++ : 0, s.hist)
          : d;
        if (!c.ok) errors.push(`${name}: ${c.error.message}`);
        else out.push({ index: i, name, color, chart: c.value });
        return;
      }
      const a2 = a as Analysis2;
      const d = data2(s as Stats2State, a2);
      if (!d.ok) {
        errors.push(`${name}: ${d.error.message}`);
        return;
      }
      const prims: Prim[] = [];
      const trace: TracePoint[] = d.value.x.map((x, k) => ({
        x,
        y: d.value.y[k],
        label: `${k + 1}: (${fmt(x)}, ${fmt(d.value.y[k])})`,
      }));
      for (const p of trace) prims.push({ kind: 'dot', x: p.x, y: p.y, color });
      const fit = fit2(d.value.x, d.value.y, a2.fit);
      if (!fit.ok) errors.push(`${name}: ${fit.error.message}`);
      const xs = d.value.x;
      const ys = d.value.y;
      out.push({
        index: i,
        name,
        color,
        chart: {
          prims,
          trace,
          box: {
            xmin: Math.min(...xs),
            xmax: Math.max(...xs),
            ymin: Math.min(...ys),
            ymax: Math.max(...ys),
          },
        },
        curve: fit.ok ? fitCurve(fit.value, s.view) : undefined,
        fit: fit.ok
          ? {
              f: fit.value.f,
              eq: fit.value.equation,
              predictX: fit.value.predictX
                ? (y: number) => {
                    const r = fit.value.predictX!(y);
                    return r.ok ? r.value : null;
                  }
                : undefined,
            }
          : undefined,
      });
    });
    return { out, errors };
  });

  private readonly traced = computed<Drawn | null>(() => {
    const l = this.drawn().out;
    return l.length ? l[Math.min(this.traceIdx(), l.length - 1)] : null;
  });

  private readonly point = computed<TracePoint | null>(() => {
    const t = this.traced()?.chart.trace ?? [];
    return t.length ? t[Math.min(this.pos(), t.length - 1)] : null;
  });

  protected readonly text = computed(() => this.drawn().out.find((d) => d.chart.text)?.chart.text);

  protected readonly bar = computed(() => {
    const { errors } = this.drawn();
    const d = this.traced();
    if (this.predicted()) return this.predicted();
    if (!d) return errors[0] ?? this.i18n.t('stats.noData');
    const p = this.point();
    const fit = d.fit ? `  ${d.fit.eq}` : '';
    return `${d.name} ${p?.label ?? ''}${fit}${errors.length ? ` – ${errors[0]}` : ''}`;
  });

  protected readonly label = computed(() => `${this.i18n.t('stats.plot')}. ${this.bar()}`);

  protected readonly painter = computed<PlotPainter>(() => {
    const s = this.app.state();
    const list = this.drawn().out;
    const p = this.point();
    const tr = this.traced();
    return (frame) => this.paint(frame, s, list, p, tr);
  });

  private paint(
    frame: PlotFrame,
    s: StatsState<unknown>,
    list: Drawn[],
    p: TracePoint | null,
    tr: Drawn | null,
  ): void {
    const pie = list.find((d) => d.chart.pie);
    if (pie) return this.paintPie(frame, pie, p);
    drawAxes(frame, undefined, s.plot);
    const { ctx } = frame;
    for (const d of list) {
      for (const q of d.chart.prims) {
        if (q.kind === 'rect') {
          const x0 = sx(frame, q.x0);
          const x1 = sx(frame, q.x1);
          const y0 = sy(frame, q.y0);
          const y1 = sy(frame, q.y1);
          ctx.fillStyle = q.color + '66';
          ctx.strokeStyle = q.color;
          ctx.lineWidth = 1;
          ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
          ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        } else if (q.kind === 'line') {
          drawLines(frame, [q.pts], q.color, 1.5, q.dash ? [5, 4] : []);
        } else if (q.kind === 'dot') {
          ctx.fillStyle = q.color;
          ctx.beginPath();
          ctx.arc(sx(frame, q.x), sy(frame, q.y), 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      if (d.curve) drawLines(frame, d.curve, d.color, 2);
    }
    if (p && tr) drawPoint(frame, p.x, p.y, '#e8603f');
  }

  private paintPie(frame: PlotFrame, d: Drawn, p: TracePoint | null): void {
    const { ctx, width, height } = frame;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    const r = Math.min(width, height) * 0.4;
    const cx = width / 2;
    const cy = height / 2 - 6;
    ctx.font = '11px system-ui, sans-serif';
    for (const q of d.chart.prims) {
      if (q.kind !== 'wedge') continue;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, -q.a1, -q.a0);
      ctx.closePath();
      ctx.fillStyle = q.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      const m = (q.a0 + q.a1) / 2;
      ctx.fillStyle = '#10201d';
      ctx.fillText(q.label, cx + Math.cos(m) * r * 1.05, cy - Math.sin(m) * r * 1.05);
    }
    if (p) {
      ctx.strokeStyle = '#e8603f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + p.x * r, cy - p.y * r, 4, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  ngOnInit(): void {
    if (this.app.state().view && (this.app.state() as { auto?: boolean }).auto !== false)
      this.autoscale();
    this.pop = this.device.push({
      id: 'stats-plot',
      title: () => this.i18n.t('stats.plot'),
      menu: () => [
        { label: 'Zoom' },
        { label: 'Trace', active: true },
        { label: this.i18n.t('stats.auto') },
        { label: this.app.kind() === 'stats2' ? 'Pred Y' : '' },
        { label: this.app.kind() === 'stats2' ? 'Pred X' : '' },
        { label: '' },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (i === 0) this.menu.set(0);
        if (i === 2) this.autoscale();
        if ((i === 3 || i === 4) && this.app.kind() === 'stats2') {
          this.pred.set(i === 3 ? 'x' : 'y');
          queueMicrotask(() => this.predEl()?.nativeElement.focus());
        }
      },
      rocker: (d, shift) => this.rocker(d, shift),
      gesture: (g, a) => this.gesture(g, a),
      help: 'stats',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  protected readonly items = computed<PlotMenuItem[]>(() =>
    ZOOM_OPS.filter((op) => op !== 'auto').map((op) => ({
      label: this.i18n.t(`zoom.${op}` as TextKey),
      run: () => this.zoom(op),
    })),
  );

  protected pickMenu(i: number): void {
    this.menu.set(null);
    this.items()[i]?.run();
  }

  private setView(v: Viewport, auto = false): void {
    this.app.update((s) => ({ ...s, view: v, auto }) as StatsState<Analysis1 | Analysis2>);
  }

  private autoscale(): void {
    const list = this.drawn().out.filter((d) => !d.chart.pie && !d.chart.text);
    if (!list.length) return;
    const zero =
      this.app.kind() === 'stats1' &&
      list.some((d) => d.chart.prims.some((p) => p.kind === 'rect'));
    this.setView(
      autoView(
        list.map((d) => d.chart.box),
        zero,
      ),
      true,
    );
  }

  private size() {
    const a = this.canvas()?.area();
    return a?.width ? a : { width: 320, height: 200 };
  }

  private zoom(op: ZoomOp): void {
    const p = this.point();
    this.setView(zoomView(this.view(), op, this.size(), p?.x, p?.y));
  }

  /** Pred Y: the fit at X; Pred X: the X of a Y (where the model can be inverted). */
  protected doPred(): void {
    const mode = this.pred();
    const src = this.predEl()?.nativeElement.value ?? '';
    this.pred.set(null);
    const d = this.traced();
    if (!mode || !d?.fit) return;
    const p = parseText(src);
    const r = p.ok ? evaluateValue(p.value, this.home.scope()) : p;
    if (!r.ok || r.value.kind !== 'real') {
      this.predicted.set(r.ok ? 'a real number is needed' : r.error.message);
      return;
    }
    const v = r.value.v;
    if (mode === 'x') this.predicted.set(`${d.name} X: ${fmt(v)} → Y: ${fmt(d.fit.f(v))}`);
    else {
      const x = d.fit.predictX?.(v) ?? null;
      this.predicted.set(
        x === null
          ? `${d.name}: ${this.i18n.t('stats.noPredX')}`
          : `${d.name} Y: ${fmt(v)} → X: ${fmt(x)}`,
      );
    }
  }

  private key(p: KeyPress): boolean {
    const m = this.menu();
    if (this.pred()) {
      const el = this.predEl()?.nativeElement;
      if (p.id === 'enter') this.doPred();
      else if (p.id === 'esc') this.pred.set(null);
      else if (p.id === 'bksp' && el) el.value = el.value.slice(0, -1);
      else {
        const a = editFor(p);
        if (a?.kind === 'insert' && el) el.value += a.text;
      }
      return true;
    }
    if (m !== null) {
      if (p.id === 'enter') this.pickMenu(m);
      else if (p.id === 'esc') this.menu.set(null);
      return true;
    }
    if (p.id === 'add') this.zoom('in');
    else if (p.id === 'sub') this.zoom('out');
    else if (p.id === 'esc') this.predicted.set(null);
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
    this.predicted.set(null);
    const l = this.drawn().out;
    if ((d === 'up' || d === 'down') && l.length) {
      this.traceIdx.update(
        (i) => (Math.min(i, l.length - 1) + (d === 'up' ? 1 : l.length - 1)) % l.length,
      );
      this.pos.set(0);
      return true;
    }
    const n = this.traced()?.chart.trace.length ?? 0;
    if (!n) return true;
    const step = shift ? 5 : 1;
    this.pos.update((p) => {
      const cur = Math.min(p, n - 1);
      return d === 'right' ? Math.min(n - 1, cur + step) : Math.max(0, cur - step);
    });
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
    } else if (g.kind === 'tap') {
      // the nearest trace point of the traced analysis
      const t = this.traced()?.chart.trace ?? [];
      const x = toWorldX(v, scr, g.x);
      const y = toWorldY(v, scr, g.y);
      const sxk = scr.width / (v.xmax - v.xmin);
      const syk = scr.height / (v.ymax - v.ymin);
      let best = -1;
      let bd = Infinity;
      t.forEach((p, k) => {
        const dd = Math.hypot((p.x - x) * sxk, (p.y - y) * syk);
        if (dd < bd) {
          bd = dd;
          best = k;
        }
      });
      if (best >= 0 && bd < 30) this.pos.set(best);
    }
  }
}

/** Plot setup: view, histogram classes, grid and axes. */
@Component({
  selector: 'app-stats-plot-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form
    [title]="i18n.t('app.plotSetup')"
    [fields]="fields()"
    [close]="close"
  />`,
})
export class StatsPlotSetup {
  protected readonly i18n = inject(I18n);
  private readonly app = statsApp();
  protected readonly close = () => this.app.apps.show('plot');
  protected readonly fields = computed<SetupItem[]>(() => {
    const s = () => this.app.state();
    const upd = this.app.update;
    const t = (k: TextKey) => this.i18n.t(k);
    const view = (k: keyof Viewport) => ({
      label: { xmin: 'X min', xmax: 'X max', ymin: 'Y min', ymax: 'Y max' }[k],
      value: () => s().view[k],
      set: (x: number) => {
        const next = { ...s().view, [k]: x };
        if (next.xmin >= next.xmax || next.ymin >= next.ymax) return 'min must be smaller than max';
        upd((st) => ({ ...st, view: next, auto: false }) as typeof st);
        return null;
      },
    });
    const onOff = [
      { value: 'on', label: t('app.on') },
      { value: 'off', label: t('app.off') },
    ];
    const items: SetupItem[] = [view('xmin'), view('xmax'), view('ymin'), view('ymax')];
    if (this.app.kind() === 'stats1') {
      items.push(
        {
          label: t('stats.histStart'),
          value: () => s().hist?.start ?? NaN,
          set: (x: number) => {
            upd((st) => ({ ...st, hist: { start: x, width: st.hist?.width ?? 1 } }));
            return null;
          },
        },
        {
          label: t('stats.histWidth'),
          value: () => s().hist?.width ?? NaN,
          set: (x: number) => {
            if (!(x > 0)) return 'the width must be positive';
            upd((st) => ({ ...st, hist: { start: st.hist?.start ?? 0, width: x } }));
            return null;
          },
        },
        {
          label: t('stats.histAuto'),
          choices: onOff,
          value: () => (s().hist ? 'off' : 'on'),
          set: (x: string) =>
            upd((st) => ({ ...st, hist: x === 'on' ? null : (st.hist ?? { start: 0, width: 1 }) })),
        },
      );
    }
    items.push(
      {
        label: t('app.grid'),
        choices: onOff,
        value: () => (s().plot.grid ? 'on' : 'off'),
        set: (x: string) => upd((st) => ({ ...st, plot: { ...st.plot, grid: x === 'on' } })),
      },
      {
        label: t('app.axes'),
        choices: onOff,
        value: () => (s().plot.axes ? 'on' : 'off'),
        set: (x: string) => upd((st) => ({ ...st, plot: { ...st.plot, axes: x === 'on' } })),
      },
    );
    return items;
  });
}
