import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import type { PlotFrame } from '@aba/core/graph/plot-draw';
import type { Triangle } from '@aba/math/geometry/triangle';
import { formatReal } from '@aba/math/value/format';
import { DeviceStore } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import type { MenuButton } from '../../features/device/t1-device';
import { AppStore } from '../app-store';
import { FieldForm, type FormItem } from '../shared/field-form';
import {
  TRI_KEYS,
  type TriKey,
  type TriangleState,
  corners,
  initTriangle,
  rightAngle,
  setGiven,
  shown,
  solve,
} from './triangle-logic';

const fmt = (x: number) => formatReal(x, { mode: 'standard', digits: 0, decimal: '.' });

function triangleApp() {
  const apps = inject(AppStore);
  const i18n = inject(I18n);
  const state = computed(() => {
    const s = apps.current().state as TriangleState;
    return s?.given ? s : initTriangle();
  });
  const result = computed(() => solve(state()));
  const triangle = computed(() => shown(state(), result()));
  const count = computed(() => {
    const r = result();
    return r?.ok ? r.value.triangles.length : 0;
  });
  const status = computed(() => {
    const r = result();
    const t = (k: TextKey, p: Record<string, string | number> = {}) => i18n.t(k, p);
    if (!r) return t('tri.need');
    if (!r.ok) return r.error.message;
    const n = r.value.triangles.length;
    if (n === 0) return t('tri.none', { c: r.value.case });
    if (n === 2) return t('tri.two', { c: r.value.case, k: Math.min(state().pick, 1) + 1 });
    return t('tri.one', { c: r.value.case });
  });
  return { apps, i18n, state, result, triangle, count, status };
}

/**
 * Triangle solver (prompt 039): enter any three of a, b, c, A, B, C (at least one side) – the
 * others appear in italics. SSA with two triangles: “Sol 1/2” switches. Empty entry removes a
 * value; Right fixes C = 90°.
 */
@Component({
  selector: 'app-triangle-num',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldForm],
  template: `<app-field-form
    [title]="app.i18n.t('tri.title')"
    help="triangle"
    [items]="items()"
    [menu]="menu"
    [menuPress]="press"
    [status]="app.status()"
  />`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class TriangleNum {
  protected readonly app = triangleApp();
  protected readonly items = computed<FormItem[]>(() => {
    const t = (k: TextKey) => this.app.i18n.t(k);
    const s = () => this.app.state();
    const field = (k: TriKey): FormItem => ({
      label: `${k}${k === k.toUpperCase() ? (s().unit === 'deg' ? ' (°)' : ' (rad)') : ''}`,
      value: () => {
        if (s().right && k === 'C') return rightAngle(s().unit);
        return s().given[k] ?? this.app.triangle()?.[k] ?? null;
      },
      computed: () => s().given[k] === null && !(s().right && k === 'C'),
      set: (v) => {
        const next = setGiven(s(), k, v);
        if (typeof next === 'string') return next;
        this.app.apps.update<TriangleState>(() => next);
        return null;
      },
    });
    return [
      ...TRI_KEYS.map(field),
      {
        kind: 'choice',
        label: t('tri.mode'),
        choices: [
          { value: 'general', label: t('tri.general') },
          { value: 'right', label: t('tri.right') },
        ],
        value: () => (s().right ? 'right' : 'general'),
        set: (v: string) =>
          this.app.apps.update<TriangleState>((st) => ({
            ...(st?.given ? st : initTriangle()),
            right: v === 'right',
            pick: 0,
          })),
      },
      {
        kind: 'choice',
        label: t('tri.unit'),
        choices: [
          { value: 'deg', label: t('tri.deg') },
          { value: 'rad', label: t('tri.rad') },
        ],
        value: () => s().unit,
        set: (v: string) => this.changeUnit(v === 'rad' ? 'rad' : 'deg'),
      },
      {
        kind: 'output',
        label: t('tri.area'),
        output: () => {
          const tr = this.app.triangle();
          return tr ? fmt(tr.area) : '—';
        },
      },
      {
        kind: 'output',
        label: t('tri.perimeter'),
        output: () => {
          const tr = this.app.triangle();
          return tr ? fmt(tr.perimeter) : '—';
        },
      },
    ];
  });

  /** Changing the unit converts the given angles. */
  private changeUnit(unit: 'deg' | 'rad'): void {
    this.app.apps.update<TriangleState>((st0) => {
      const st = st0?.given ? st0 : initTriangle();
      if (st.unit === unit) return st;
      const f = unit === 'rad' ? Math.PI / 180 : 180 / Math.PI;
      const given = { ...st.given };
      for (const k of ['A', 'B', 'C'] as const) if (given[k] !== null) given[k] = given[k]! * f;
      return { ...st, unit, given };
    });
  }

  protected readonly menu = (): MenuButton[] => {
    const t = (k: TextKey) => this.app.i18n.t(k);
    const two = this.app.count() === 2;
    return [
      { label: t('tri.del') },
      { label: t('tri.clear') },
      { label: '' },
      { label: '' },
      { label: two ? `${t('tri.sol')} ${Math.min(this.app.state().pick, 1) + 1}/2` : '' },
      { label: '' },
    ];
  };

  protected readonly press = (i: number, cursor: number): void => {
    const k = TRI_KEYS[cursor];
    if (i === 0 && k) {
      const next = setGiven(this.app.state(), k, null);
      if (typeof next !== 'string') this.app.apps.update<TriangleState>(() => next);
    }
    if (i === 1)
      this.app.apps.update<TriangleState>((st) => ({
        ...initTriangle(),
        right: !!st?.right,
        unit: st?.unit ?? 'deg',
      }));
    if (i === 4 && this.app.count() === 2)
      this.app.apps.update<TriangleState>((st) => ({ ...st, pick: st.pick ? 0 : 1 }));
  };
}

/** Plot view: the triangle to scale with its corners and sides; a second SSA solution dashed. */
@Component({
  selector: 'app-triangle-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas],
  template: `
    <div class="plot">
      <app-plot-canvas [view]="view" [painter]="painter()" [label]="label()" />
      <p class="bar" role="status">{{ app.status() }}</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .plot {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100%;
    }
    .bar {
      margin: 0;
      padding: 0.05em 0.4em;
      font-size: 3.4cqw;
      background: var(--lcd-bg);
      border-top: 1px solid var(--lcd-line);
      color: var(--lcd-text);
    }
  `,
})
export class TrianglePlot implements OnInit, OnDestroy {
  protected readonly app = triangleApp();
  private readonly device = inject(DeviceStore);
  protected readonly view = { xmin: 0, xmax: 1, ymin: 0, ymax: 1 };
  protected readonly label = computed(() => {
    const t = this.app.triangle();
    return t
      ? `${this.app.i18n.t('tri.plot')}: a = ${fmt(t.a)}, b = ${fmt(t.b)}, c = ${fmt(t.c)}`
      : this.app.status();
  });
  protected readonly painter = computed<PlotPainter>(() => {
    const r = this.app.result();
    const all = r?.ok ? r.value.triangles : [];
    const pick = Math.min(this.app.state().pick, Math.max(0, all.length - 1));
    const unit = this.app.state().unit;
    return (frame) => this.paint(frame, all, pick, unit);
  });
  private pop: (() => void) | null = null;

  private paint(frame: PlotFrame, all: Triangle[], pick: number, unit: 'deg' | 'rad'): void {
    const { ctx, width, height } = frame;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    if (!all.length) return;
    const pts = all.map((t) => corners(t, unit));
    const xs = pts.flat().map((p) => p[0]);
    const ys = pts.flat().map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const padX = 56;
    const padY = 24;
    const k = Math.min((width - 2 * padX) / (x1 - x0 || 1), (height - 2 * padY) / (y1 - y0 || 1));
    const ox = (width - k * (x1 - x0)) / 2;
    const oy = (height + k * (y1 - y0)) / 2;
    const P = ([x, y]: [number, number]): [number, number] => [
      ox + (x - x0) * k,
      oy - (y - y0) * k,
    ];
    const draw = (q: [number, number][], main: boolean) => {
      ctx.save();
      ctx.beginPath();
      q.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      if (main) {
        ctx.fillStyle = 'rgba(26,95,122,0.12)';
        ctx.fill();
      }
      ctx.strokeStyle = main ? '#5cb8ea' : '#9aa0a6';
      ctx.lineWidth = main ? 2.5 : 1.5;
      ctx.setLineDash(main ? [] : [6, 5]);
      ctx.stroke();
      ctx.restore();
    };
    pts.forEach((q, i) => i !== pick && draw(q, false));
    draw(pts[pick], true);
    const t = all[pick];
    const q = pts[pick].map(P);
    const cx = (q[0][0] + q[1][0] + q[2][0]) / 3;
    const cy = (q[0][1] + q[1][1] + q[2][1]) / 3;
    ctx.fillStyle = '#f2f2f2';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const deg = unit === 'deg' ? '°' : '';
    const away = (x: number, y: number, d: number): [number, number] => {
      const dx = x - cx;
      const dy = y - cy;
      const l = Math.hypot(dx, dy) || 1;
      return [x + (dx / l) * d, y + (dy / l) * d];
    };
    /** a label kept inside the canvas */
    const text = (s: string, x: number, y: number) => {
      const w = ctx.measureText(s).width / 2 + 2;
      ctx.fillText(s, Math.min(width - w, Math.max(w, x)), Math.min(height - 8, Math.max(8, y)));
    };
    (['A', 'B', 'C'] as const).forEach((name, i) => {
      const [x, y] = away(q[i][0], q[i][1], 14);
      text(`${name} ${fmt(Number(t[name].toPrecision(5)))}${deg}`, x, y);
    });
    // side a is opposite A: between B and C, etc.
    const sides: [string, number, number, number][] = [
      ['a', t.a, 1, 2],
      ['b', t.b, 0, 2],
      ['c', t.c, 0, 1],
    ];
    ctx.fillStyle = '#5cb8ea';
    for (const [name, v, i, j] of sides) {
      const [x, y] = away((q[i][0] + q[j][0]) / 2, (q[i][1] + q[j][1]) / 2, 12);
      text(`${name} ${fmt(Number(v.toPrecision(5)))}`, x, y);
    }
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'triangle-plot',
      title: () => this.app.i18n.t('tri.plot'),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        {
          label:
            this.app.count() === 2
              ? `${this.app.i18n.t('tri.sol')} ${Math.min(this.app.state().pick, 1) + 1}/2`
              : '',
        },
        { label: '' },
      ],
      menuPress: (i) => {
        if (i === 4 && this.app.count() === 2)
          this.app.apps.update<TriangleState>((st) => ({ ...st, pick: st.pick ? 0 : 1 }));
      },
      help: 'triangle',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }
}
