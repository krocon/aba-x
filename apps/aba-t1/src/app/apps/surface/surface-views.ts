import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import type { PlotFrame } from '@aba/core/graph/plot-draw';
import type { Expr } from '@aba/math/ast/nodes';
import { type Camera, type Range3, faces, project, sampleSurface } from '@aba/math/graph/surface';
import { compile } from '@aba/math/numeric/evaluate';
import { parseLatex } from '@aba/math/parser/latex-parser';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { type Area, DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import { catalogNames, markCommands, markSlots } from '../../core/latex/typed-names';
import { SettingsStore } from '../../features/settings/settings-store';
import { AppStore } from '../app-store';
import type { CurveState } from '../curve/curve-logic';
import { rowColor } from '../curve/curve-logic';
import { injectAppScope } from '../shared/app-scope';
import { SetupForm, type SetupItem } from '../shared/setup-form';

interface Surface {
  name: string;
  color: string;
  f: (x: number, y: number) => number;
}

/** The enabled surfaces as real functions of X and Y. */
function surfaces(
  s: CurveState,
  scope: { angle: 'rad' | 'deg'; variables: ReadonlyMap<string, number> },
): Surface[] {
  const out: Surface[] = [];
  s.rows.forEach((r, i) => {
    if (!r.on || !r.fields[0].trim()) return;
    const p = parseLatex(markSlots(markCommands(r.fields[0], catalogNames())));
    if (!p.ok) return;
    const vars = new Map(scope.variables);
    const fx = compile(p.value as Expr, 'X', { angle: scope.angle, variables: vars });
    const d = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'][i];
    out.push({
      name: `FZ${d}`,
      color: rowColor(i),
      f: (x, y) => {
        vars.set('Y', y);
        return fx(x);
      },
    });
  });
  return out;
}

/** height colour: teal (low) → sand → coral (high) */
function heat(t: number, alpha = 1): string {
  const c = (a: number, b: number) => Math.round(a + (b - a) * t);
  return t < 0.5
    ? `rgba(${c(34, 237)},${c(130, 174)},${c(140, 73)},${alpha})`
    : `rgba(${c(237, 209)},${c(174, 73)},${c(73, 91)},${alpha})`;
}

const app3d = () => {
  const apps = inject(AppStore);
  const state = computed(() => apps.current().state as CurveState);
  return { apps, state };
};

/**
 * 3D plot (prompt 046): the surfaces as shaded quadrilaterals (painter's algorithm on a 2D canvas –
 * the same in every web view, no WebGL needed). Drag or the rocker rotates, pinch and +/− zoom.
 */
@Component({
  selector: 'app-surface-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas],
  template: `<app-plot-canvas [view]="dummy" [painter]="painter()" [label]="label()" />`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class SurfacePlot implements OnInit, OnDestroy {
  private readonly i18n = inject(I18n);
  private readonly app = app3d();
  private readonly device = inject(DeviceStore);
  private readonly scope = injectAppScope();
  protected readonly dummy = { xmin: -1, xmax: 1, ymin: -1, ymax: 1 };
  private readonly list = computed(() => surfaces(this.app.state(), this.scope()));
  protected readonly label = computed(
    () =>
      `${this.i18n.t('surface.plot')}: ${
        this.list()
          .map((s) => s.name)
          .join(', ') || '–'
      }`,
  );
  protected readonly painter = computed<PlotPainter>(() => {
    const s = this.app.state();
    const list = this.list();
    return (frame) => this.paint(frame, s, list);
  });
  private pop: (() => void) | null = null;

  private paint(frame: PlotFrame, s: CurveState, list: Surface[]): void {
    const { ctx, width, height } = frame;
    const r = s.range3!;
    const cam = s.camera!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    const size = { width, height };
    const p = project(r, cam, size);
    const all = list.flatMap((sf) => faces(sampleSurface(sf.f, r, s.gridN ?? 30), r, cam, size));
    all.sort((a, b) => b.depth - a.depth);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    for (const f of all) {
      ctx.beginPath();
      f.points.forEach((q, k) => (k ? ctx.lineTo(q.sx, q.sy) : ctx.moveTo(q.sx, q.sy)));
      ctx.closePath();
      ctx.fillStyle = heat(f.t, 0.92);
      ctx.fill();
      ctx.stroke();
    }
    if (s.box !== false) {
      // the box edges and the axis labels
      const c = [r.xmin, r.xmax];
      const d = [r.ymin, r.ymax];
      const e = [r.zmin, r.zmax];
      ctx.strokeStyle = '#9aa0a6';
      ctx.lineWidth = 1;
      const edge = (a: [number, number, number], b: [number, number, number]) => {
        const pa = p(...a);
        const pb = p(...b);
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      };
      for (const y of d) for (const z of e) edge([c[0], y, z], [c[1], y, z]);
      for (const x of c) for (const z of e) edge([x, d[0], z], [x, d[1], z]);
      for (const x of c) for (const y of d) edge([x, y, e[0]], [x, y, e[1]]);
      ctx.fillStyle = '#b9bec4';
      ctx.font = '11px system-ui, sans-serif';
      const lx = p(r.xmax, r.ymin, r.zmin);
      const ly = p(r.xmin, r.ymax, r.zmin);
      const lz = p(r.xmin, r.ymin, r.zmax);
      ctx.fillText('X', lx.sx + 4, lx.sy);
      ctx.fillText('Y', ly.sx + 4, ly.sy);
      ctx.fillText('Z', lz.sx + 4, lz.sy);
    }
  }

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'surface-plot',
      title: () => this.i18n.t('surface.plot'),
      menu: () => [
        { label: 'Zoom +' },
        { label: 'Zoom −' },
        { label: this.i18n.t('surface.reset') },
        { label: '' },
        { label: 'Box', active: this.app.state().box !== false },
        { label: '' },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (i === 0) this.zoom(1.25);
        if (i === 1) this.zoom(0.8);
        if (i === 2) this.cam(() => ({ azimuth: -Math.PI / 4, elevation: Math.PI / 6, zoom: 1 }));
        if (i === 4) this.app.apps.update<CurveState>((s) => ({ ...s, box: s.box === false }));
      },
      rocker: (d) => this.rocker(d),
      gesture: (g, a) => this.gesture(g, a),
      help: 'surface',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private cam(f: (c: Camera) => Camera): void {
    this.app.apps.update<CurveState>((s) => ({ ...s, camera: f(s.camera!) }));
  }

  private zoom(k: number): void {
    this.cam((c) => ({ ...c, zoom: Math.min(8, Math.max(0.2, c.zoom * k)) }));
  }

  private rotate(da: number, de: number): void {
    this.cam((c) => ({
      ...c,
      azimuth: c.azimuth + da,
      elevation: Math.min(Math.PI / 2, Math.max(-Math.PI / 2, c.elevation + de)),
    }));
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'add') this.zoom(1.25);
    else if (p.id === 'sub') this.zoom(0.8);
    else return false;
    return true;
  }

  private rocker(d: RockerDir): boolean {
    const step = Math.PI / 24;
    if (d === 'left') this.rotate(-step, 0);
    if (d === 'right') this.rotate(step, 0);
    if (d === 'up') this.rotate(0, step);
    if (d === 'down') this.rotate(0, -step);
    return true;
  }

  private gesture(g: Gesture, a: Area): void {
    if (g.kind === 'drag' && g.phase === 'move')
      this.rotate((g.dx / a.width) * Math.PI, (g.dy / a.height) * Math.PI);
    if (g.kind === 'pinch' && g.phase === 'move' && g.scale > 0) this.zoom(g.scale);
    if (g.kind === 'doubleTap') this.zoom(1.25);
  }
}

/** Numeric view: X, Y and every surface on the grid of the plot range. */
@Component({
  selector: 'app-surface-num',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { tabindex: '0', role: 'region', '[attr.aria-label]': 'title()' },
  template: `
    <table class="num">
      <thead>
        <tr>
          <th scope="col">X</th>
          <th scope="col">Y</th>
          @for (s of list(); track s.name) {
            <th scope="col" [style.border-bottom-color]="s.color">{{ s.name }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (r of rows(); track $index) {
          <tr>
            <td>{{ r.x }}</td>
            <td>{{ r.y }}</td>
            @for (z of r.zs; track $index) {
              <td>{{ z }}</td>
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
    }
    thead th {
      background: var(--lcd-head);
      position: sticky;
      top: 0;
      border-bottom: 3px solid transparent;
    }
  `,
})
export class SurfaceNum implements OnInit, OnDestroy {
  private readonly i18n = inject(I18n);
  private readonly app = app3d();
  private readonly device = inject(DeviceStore);
  private readonly settings = inject(SettingsStore);
  private readonly scope = injectAppScope();
  protected readonly title = () => this.i18n.t('surface.num');
  protected readonly list = computed(() => surfaces(this.app.state(), this.scope()));
  protected readonly rows = computed(() => {
    const s = this.app.state();
    const r = s.range3!;
    const f = this.settings.settings().format;
    const show = (v: number) => (Number.isFinite(v) ? formatReal(v, f) : '—');
    const n = 4;
    const out: { x: string; y: string; zs: string[] }[] = [];
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const x = r.xmin + ((r.xmax - r.xmin) * i) / n;
        const y = r.ymin + ((r.ymax - r.ymin) * j) / n;
        out.push({ x: show(x), y: show(y), zs: this.list().map((sf) => show(sf.f(x, y))) });
      }
    }
    return out;
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'surface-num',
      title: () => this.title(),
      menu: () => [
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
      ],
      help: 'surface',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }
}

/** Plot setup: X, Y, Z ranges and grid size. */
@Component({
  selector: 'app-surface-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SetupForm],
  template: `<app-setup-form
    [title]="i18n.t('app.plotSetup')"
    [fields]="fields()"
    [close]="close"
  />`,
})
export class SurfaceSetup {
  protected readonly i18n = inject(I18n);
  private readonly app = app3d();
  protected readonly close = () => this.app.apps.show('plot');
  protected readonly fields = computed<SetupItem[]>(() => {
    const s = () => this.app.state();
    const field = (k: keyof Range3, label: string) => ({
      label,
      value: () => s().range3![k],
      set: (x: number) => {
        const next = { ...s().range3!, [k]: x };
        if (next.xmin >= next.xmax || next.ymin >= next.ymax || next.zmin >= next.zmax) {
          return 'min must be smaller than max';
        }
        this.app.apps.update<CurveState>((st) => ({ ...st, range3: next }));
        return null;
      },
    });
    return [
      field('xmin', 'X min'),
      field('xmax', 'X max'),
      field('ymin', 'Y min'),
      field('ymax', 'Y max'),
      field('zmin', 'Z min'),
      field('zmax', 'Z max'),
      {
        label: this.i18n.t('surface.grid' as TextKey),
        value: () => s().gridN ?? 30,
        set: (x: number) => {
          if (!Number.isInteger(x) || x < 5 || x > 80) return 'grid: 5 … 80';
          this.app.apps.update<CurveState>((st) => ({ ...st, gridN: x }));
          return null;
        },
      },
    ];
  });
}
