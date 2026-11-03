import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import { type PlotFrame, drawAxes, drawLines, sx, sy } from '@aba/core/graph/plot-draw';
import type { Viewport } from '@aba/math/graph/viewport';
import { chiSquare, normal, studentT } from '@aba/math/stats/distributions';
import type { Alternative } from '@aba/math/stats/inference';
import { formatReal } from '@aba/math/value/format';
import { DeviceStore } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import { HomeStore } from '../../features/home/home-store';
import { SettingsStore } from '../../features/settings/settings-store';
import { AppStore } from '../app-store';
import { PlotMenu, type PlotMenuItem } from '../shared/plot-menu';
import { SetupForm, type SetupItem } from '../shared/setup-form';
import type { Stats1State } from '../stats/stats-logic';
import {
  type DataSource,
  type InferencePlot,
  type InferenceState,
  METHODS,
  type MethodId,
  importSummary,
  methodOf,
  runInference,
  slotName,
} from './inference-logic';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function inferenceApp() {
  const apps = inject(AppStore);
  const home = inject(HomeStore);
  const state = computed(() => apps.current().state as InferenceState);
  const update = (f: (s: InferenceState) => InferenceState) => apps.update<InferenceState>(f);
  const data: DataSource = {
    list: (d) => {
      const v = home.variables().get(slotName('list', d));
      if (v?.kind !== 'list') return null;
      const xs = v.items.map((x) => (x.kind === 'real' ? x.v : NaN));
      return xs.every(Number.isFinite) ? xs : null;
    },
    matrix: (d) => {
      const v = home.variables().get(slotName('matrix', d));
      return v?.kind === 'matrix' ? v.rows.map((r) => [...r]) : null;
    },
  };
  const result = computed(() => {
    home.variables();
    return runInference(state(), data);
  });
  return { apps, state, update, result };
}

const methodLabel = (i18n: I18n, id: MethodId) => i18n.t(`inf.m.${id}` as TextKey);

/** Symbolic view: method, alternative hypothesis and pooling. */
@Component({
  selector: 'app-inference-symb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form
    [title]="i18n.t('inf.symb')"
    [fields]="fields()"
    [close]="close"
    help="inference"
  />`,
})
export class InferenceSymb {
  protected readonly i18n = inject(I18n);
  private readonly app = inferenceApp();
  protected readonly close = () => this.app.apps.show('num');
  protected readonly fields = computed<SetupItem[]>(() => {
    const t = (k: TextKey) => this.i18n.t(k);
    const m = methodOf(this.app.state().method);
    const s = () => this.app.state();
    const items: SetupItem[] = [
      {
        label: t('inf.method'),
        choices: METHODS.map((x) => ({ value: x.id, label: methodLabel(this.i18n, x.id) })),
        value: () => s().method,
        set: (v: string) => this.app.update((st) => ({ ...st, method: v as MethodId })),
      },
    ];
    if (m.alternative) {
      const h0 = m.group === 'regression' ? 'β' : m.id.includes('prop') ? 'p' : 'μ';
      items.push({
        label: t('inf.alt'),
        choices: (['<', '>', '≠'] as Alternative[]).map((a) => ({
          value: a,
          label: `${h0} ${a} ${h0}₀`,
        })),
        value: () => s().alternative,
        set: (v: string) => this.app.update((st) => ({ ...st, alternative: v as Alternative })),
      });
    }
    if (m.pooled) {
      items.push({
        label: t('inf.pooled'),
        choices: [
          { value: 'no', label: t('app.off') },
          { value: 'yes', label: t('app.on') },
        ],
        value: () => (s().pooled ? 'yes' : 'no'),
        set: (v: string) => this.app.update((st) => ({ ...st, pooled: v === 'yes' })),
      });
    }
    return items;
  });
}

/**
 * Numeric view: the inputs of the method and, below them, the results (computed while typing).
 * Import fills x̄, s and n from a data column of Statistics 1Var.
 */
@Component({
  selector: 'app-inference-num',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm, PlotMenu],
  template: `
    <div class="num">
      <div class="inputs">
        <app-setup-form
          [title]="title()"
          [fields]="fields()"
          [close]="close"
          [extra]="extra()"
          help="inference"
        />
      </div>
      <div class="results" tabindex="0" role="region" [attr.aria-label]="i18n.t('inf.results')">
        @if (rows(); as r) {
          <table>
            <tbody>
              @for (x of r; track x.name) {
                <tr>
                  <th scope="row">{{ x.name }}</th>
                  <td [class.decision]="x.decision">{{ x.value }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="err" role="status">{{ error() }}</p>
        }
      </div>
      @if (importing() !== null) {
        <app-plot-menu
          [title]="i18n.t('inf.import')"
          [items]="importItems()"
          [cursor]="importing()!"
          (pick)="pickImport($event)"
        />
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
      display: grid;
      grid-template-rows: minmax(0, 1fr) minmax(0, auto);
      height: 100%;
    }
    .inputs {
      overflow: auto;
      min-height: 0;
    }
    .results {
      max-height: 45cqw;
      overflow: auto;
      border-top: 2px solid #1b3533;
      font-size: 3.6cqw;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 0.05em 0.5em;
      border-bottom: 1px solid #dde4df;
      text-align: right;
    }
    th {
      text-align: left;
      font-weight: 400;
    }
    .decision {
      font-weight: 600;
    }
    .err {
      margin: 0.3em 0.5em;
      color: #b42318;
    }
  `,
})
export class InferenceNum implements OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly app = inferenceApp();
  private readonly device = inject(DeviceStore);
  private readonly settings = inject(SettingsStore);
  protected readonly close = () => this.app.apps.show('plot');
  protected readonly title = computed(() => methodLabel(this.i18n, this.app.state().method));
  protected readonly importing = signal<number | null>(null);
  private sample: 1 | 2 = 1;
  private popImport: (() => void) | null = null;

  protected readonly fields = computed<SetupItem[]>(() => {
    const m = methodOf(this.app.state().method);
    const s = () => this.app.state();
    return m.fields.map((f): SetupItem => {
      if (f.slot) {
        return {
          label: f.label,
          choices: DIGITS.map((d) => ({ value: d, label: slotName(f.slot!, Number(d)) })),
          value: () => String(s().inputs[f.key]),
          set: (v: string) =>
            this.app.update((st) => ({ ...st, inputs: { ...st.inputs, [f.key]: Number(v) } })),
        };
      }
      return {
        label: f.label,
        value: () => s().inputs[f.key],
        set: (v: number) => {
          this.app.update((st) => ({ ...st, inputs: { ...st.inputs, [f.key]: v } }));
          return null;
        },
      };
    });
  });

  protected readonly extra = computed(() => {
    const m = methodOf(this.app.state().method);
    const out: { label: string; run: () => void }[] = [];
    if (m.imports) {
      out.push({ label: this.i18n.t('inf.import'), run: () => this.openImport(1) });
      if (m.imports === 2)
        out.push({ label: `${this.i18n.t('inf.import')} 2`, run: () => this.openImport(2) });
    }
    return out;
  });

  protected readonly rows = computed(() => {
    const r = this.app.result();
    if (!r.ok) return null;
    const f = this.settings.settings().format;
    return r.value.rows.map((x) => ({
      name: x.name === 'Result' ? this.i18n.t('inf.result') : x.name,
      decision: typeof x.value === 'string',
      value:
        x.value === '@reject'
          ? this.i18n.t('inf.reject')
          : x.value === '@keep'
            ? this.i18n.t('inf.keep')
            : typeof x.value === 'number'
              ? formatReal(x.value, f)
              : (x.value ?? '—'),
    }));
  });

  protected readonly error = computed(() => {
    const r = this.app.result();
    return r.ok ? '' : r.error.message;
  });

  /** the non-empty data columns of Statistics 1Var */
  private readonly columns = computed(() => {
    const inst = this.app.apps.instances().find((i) => i.app === 'stats1' && !i.copy);
    const cols = (inst?.state as Stats1State | undefined)?.cols ?? [];
    return cols.map((c, j) => ({ name: `D${DIGITS[j]}`, data: c })).filter((c) => c.data.length);
  });

  protected readonly importItems = computed<PlotMenuItem[]>(() =>
    this.columns().map((c) => ({
      label: `${c.name} (n = ${c.data.length})`,
      run: () => this.fill(c.data),
    })),
  );

  ngOnDestroy(): void {
    this.popImport?.();
  }

  private openImport(sample: 1 | 2): void {
    if (!this.columns().length) return;
    this.sample = sample;
    this.importing.set(0);
    this.popImport = this.device.push({
      id: 'inference-import',
      title: () => this.i18n.t('inf.import'),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: 'OK' },
      ],
      key: (p) => {
        if (p.id === 'enter') this.pickImport(this.importing() ?? 0);
        else if (p.id === 'esc') this.closeImport();
        return true;
      },
      menuPress: (i) => {
        if (i === 5) this.pickImport(this.importing() ?? 0);
      },
      rocker: (d) => {
        const n = this.importItems().length;
        const c = this.importing() ?? 0;
        if (d === 'up' || d === 'down') this.importing.set((c + (d === 'down' ? 1 : n - 1)) % n);
        if (d === 'left') this.closeImport();
        return true;
      },
      help: 'inference',
    });
  }

  private closeImport(): void {
    this.popImport?.();
    this.popImport = null;
    this.importing.set(null);
  }

  protected pickImport(i: number): void {
    const item = this.importItems()[i];
    this.closeImport();
    item?.run();
  }

  /** x̄, s and n (σ := s for Z methods) of the chosen column into sample 1 or 2. */
  private fill(data: number[]): void {
    const r = importSummary(data);
    if (!r.ok) return;
    const { mean, s, n } = r.value;
    const k = methodOf(this.app.state().method).imports === 2 ? String(this.sample) : '';
    this.app.update((st) => ({
      ...st,
      inputs: { ...st.inputs, [`mean${k}`]: mean, [`s${k}`]: s, [`sigma${k}`]: s, [`n${k}`]: n },
    }));
  }
}

const fmt = (x: number) =>
  Number.isFinite(x) ? formatReal(x, { mode: 'standard', digits: 0, decimal: '.' }) : '—';

/** Plot: the distribution of the statistic with the critical region (or the interval) shaded. */
@Component({
  selector: 'app-inference-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas],
  template: `
    <div class="plot">
      <app-plot-canvas [view]="view()" [painter]="painter()" [label]="label()" />
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
      background: rgb(255 255 255 / 0.85);
      font-size: 3.3cqw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class InferencePlotView implements OnInit, OnDestroy {
  private readonly i18n = inject(I18n);
  private readonly app = inferenceApp();
  private readonly device = inject(DeviceStore);
  private pop: (() => void) | null = null;

  private readonly plot = computed<InferencePlot | null>(() => {
    const r = this.app.result();
    return r.ok ? r.value.plot : null;
  });

  private readonly density = computed(() => {
    const p = this.plot();
    if (!p) return null;
    const d =
      p.dist === 'normal' ? normal() : p.dist === 't' ? studentT(p.df ?? 1) : chiSquare(p.df ?? 1);
    if (!d.ok) return null;
    return (x: number) => {
      const r = d.value.pdf(x);
      return r.ok ? r.value : NaN;
    };
  });

  protected readonly view = computed<Viewport>(() => {
    const p = this.plot();
    const f = this.density();
    if (!p || !f) return { xmin: -4, xmax: 4, ymin: -0.05, ymax: 0.5 };
    const stat = p.statistic ?? 0;
    let xmin: number;
    let xmax: number;
    if (p.dist === 'chi2') {
      xmin = 0;
      xmax = Math.max(p.critical[0] * 1.6, stat * 1.2, 4);
    } else {
      xmin = Math.min(-4, stat - 0.5);
      xmax = Math.max(4, stat + 0.5);
    }
    let top = 0;
    for (let i = 0; i <= 200; i++) {
      const y = f(xmin + ((xmax - xmin) * i) / 200);
      if (Number.isFinite(y)) top = Math.max(top, y);
    }
    top = Math.min(top, 2);
    return { xmin, xmax, ymin: -top * 0.12, ymax: top * 1.15 };
  });

  protected readonly bar = computed(() => {
    const r = this.app.result();
    if (!r.ok) return r.error.message;
    const p = r.value.plot;
    const P = r.value.rows.find((x) => x.name === 'P');
    if (p.alternative === 'central')
      return `${this.i18n.t('inf.interval')}: ±${fmt(p.critical[1])}`;
    return `${p.dist === 'chi2' ? 'χ²' : p.dist === 'normal' ? 'Z' : 'T'} = ${fmt(p.statistic ?? NaN)}  P = ${fmt(
      Number(P?.value),
    )}`;
  });

  protected readonly label = computed(() => `${this.i18n.t('inf.plot')}. ${this.bar()}`);

  protected readonly painter = computed<PlotPainter>(() => {
    const p = this.plot();
    const f = this.density();
    return (frame) => this.paint(frame, p, f);
  });

  private paint(
    frame: PlotFrame,
    p: InferencePlot | null,
    f: ((x: number) => number) | null,
  ): void {
    drawAxes(frame, undefined, { grid: false });
    if (!p || !f) return;
    const { ctx, view } = frame;
    const inside = (x: number): boolean => {
      const c = p.critical;
      switch (p.alternative) {
        case '<':
          return x <= c[0];
        case '>':
          return x >= c[0];
        case '≠':
          return x <= Math.min(...c) || x >= Math.max(...c);
        case 'chi':
          return x >= c[0];
        case 'central':
          return x >= c[0] && x <= c[1];
      }
    };
    // shaded area under the curve column by column
    ctx.fillStyle = 'rgba(232, 96, 63, 0.35)';
    const n = Math.max(2, Math.round(frame.width));
    for (let i = 0; i < n; i++) {
      const x = view.xmin + ((view.xmax - view.xmin) * (i + 0.5)) / n;
      if (!inside(x)) continue;
      const y = f(x);
      if (!Number.isFinite(y)) continue;
      const top = sy(frame, y);
      const base = sy(frame, 0);
      ctx.fillRect(sx(frame, x) - frame.width / n / 2, top, frame.width / n + 0.5, base - top);
    }
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const x = view.xmin + ((view.xmax - view.xmin) * i) / 300;
      const y = f(x);
      if (Number.isFinite(y)) pts.push([x, y]);
    }
    drawLines(frame, [pts], '#00798c', 2);
    if (p.statistic !== null && Number.isFinite(p.statistic)) {
      drawLines(
        frame,
        [
          [
            [p.statistic, 0],
            [p.statistic, view.ymax],
          ],
        ],
        '#10201d',
        1.5,
        [4, 3],
      );
    }
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'inference-plot',
      title: () => this.i18n.t('inf.plot'),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
      ],
      help: 'inference',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }
}
