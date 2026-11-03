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
  drawAxes,
  drawCrosshair,
  drawLines,
  drawPoint,
  DARK_PLOT,
} from '@aba/core/graph/plot-draw';
import { autoY, sample } from '@aba/math/graph/sampler';
import { type Viewport, toWorldX, toWorldY, zoom } from '@aba/math/graph/viewport';
import { compile } from '@aba/math/numeric/evaluate';
import { formatReal } from '@aba/math/value/format';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { type Area, DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { MenuButton } from '../../features/device/t1-device';
import { AppStore } from '../app-store';
import type { CurveState } from '../curve/curve-logic';
import { injectAppScope } from '../shared/app-scope';
import { FieldForm, type FormItem } from '../shared/field-form';
import { type SolveStatus, plotEquation, solveStep, variables } from './solve-logic';

const fmt = (x: number) => formatReal(x, { mode: 'standard', digits: 0, decimal: '.' });

/** State, scope and the shared solve action of the running solve app. */
function solveApp() {
  const apps = inject(AppStore);
  const i18n = inject(I18n);
  const scope = injectAppScope();
  const state = computed(() => apps.current().state as CurveState);
  const vars = computed(() => variables(state(), scope().variables));
  const status = signal<string | null>(null);
  const describe = (s: SolveStatus): string => {
    switch (s.kind) {
      case 'error':
        return s.message;
      case 'zero':
        return i18n.t('solve.zero', { v: s.variable, x: fmt(s.x) });
      case 'sign-change':
        return i18n.t('solve.sign', { v: s.variable, x: fmt(s.x), f: fmt(s.fx) });
      case 'extremum':
        return i18n.t('solve.extremum', { v: s.variable, x: fmt(s.x), f: fmt(s.fx) });
      case 'system':
        return i18n.t('solve.system', { v: s.variables.join(', '), r: fmt(s.residual) });
    }
  };
  const solve = (cursorVar: string | null): SolveStatus => {
    const sc = scope();
    const step = solveStep(state(), cursorVar, sc, sc.variables);
    if (step.status.kind !== 'error') {
      const sel = step.status.kind === 'system' ? step.status.variables[0] : step.status.variable;
      apps.update<CurveState>((s) => ({ ...s, values: step.values, selected: sel }));
    }
    status.set(describe(step.status));
    return step.status;
  };
  const setValue = (name: string, v: number | null) =>
    apps.update<CurveState>((s) => {
      const values = { ...(s.values ?? {}) };
      if (v === null) delete values[name];
      else values[name] = v;
      return { ...s, values };
    });
  return { apps, i18n, scope, state, vars, status, solve, setValue };
}

/**
 * Numeric view of the solve app (prompt 039): every variable of the enabled equations with its
 * value. Mark chooses unknowns (none marked: the variable under the cursor); Solve solves – one
 * unknown numerically from its value as start value, several as a system (Newton).
 */
@Component({
  selector: 'app-solve-num',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldForm],
  template: `<app-field-form
    [title]="app.i18n.t('solve.num')"
    help="solve"
    [items]="items()"
    [menu]="menu"
    [menuPress]="press"
    [status]="status()"
  />`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class SolveNum {
  protected readonly app = solveApp();
  private readonly form = viewChild(FieldForm);
  protected readonly status = computed(
    () =>
      this.app.status() ?? (this.app.vars().length ? null : this.app.i18n.t('solve.noEquations')),
  );
  protected readonly items = computed<FormItem[]>(() =>
    this.app.vars().map((v) => ({
      label: v.name,
      value: () => this.app.vars().find((w) => w.name === v.name)?.value ?? 0,
      set: (x: number | null) => {
        this.app.setValue(v.name, x);
        return null;
      },
      marked: () => (this.app.state().unknowns ?? []).includes(v.name),
    })),
  );

  private cursorVar(i = this.form()?.cursor() ?? 0): string | null {
    return this.app.vars()[i]?.name ?? null;
  }

  protected readonly menu = (): MenuButton[] => {
    const v = this.cursorVar();
    const t = (k: Parameters<I18n['t']>[0]) => this.app.i18n.t(k);
    return [
      { label: t('solve.mark'), active: !!v && (this.app.state().unknowns ?? []).includes(v) },
      { label: t('solve.unmark') },
      { label: '' },
      { label: '' },
      { label: '' },
      { label: t('solve.solve') },
    ];
  };

  protected readonly press = (i: number, cursor: number): void => {
    const v = this.cursorVar(cursor);
    if (i === 0 && v) {
      this.app.apps.update<CurveState>((s) => {
        const u = s.unknowns ?? [];
        return { ...s, unknowns: u.includes(v) ? u.filter((x) => x !== v) : [...u, v] };
      });
    }
    if (i === 1) this.app.apps.update<CurveState>((s) => ({ ...s, unknowns: [] }));
    if (i === 5) {
      this.app.solve(v);
      this.form()?.focus();
    }
  };
}

/**
 * Plot view of the solve app: both sides of the first equation that contains the selected
 * variable, as functions of it (the others fixed). Intersections are solutions. Tap or ←→ set the
 * start value, Solve solves from there; drag pans, pinch and +/− zoom.
 */
@Component({
  selector: 'app-solve-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas],
  template: `
    <div class="plot">
      <app-plot-canvas [view]="view()" [painter]="painter()" [label]="label()" />
      <p class="bar" role="status">{{ bar() }}</p>
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
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--lcd-text);
    }
  `,
})
export class SolvePlot implements OnInit, OnDestroy {
  private readonly app = solveApp();
  private readonly device = inject(DeviceStore);
  private readonly canvas = viewChild(PlotCanvas);
  protected readonly view = computed(() => this.app.state().view);
  protected readonly variable = computed(() => {
    const names = this.app.vars().map((v) => v.name);
    const sel = this.app.state().selected;
    return sel && names.includes(sel) ? sel : (names[0] ?? null);
  });
  private readonly value = computed(
    () => this.app.vars().find((v) => v.name === this.variable())?.value ?? 0,
  );
  /** left and right side as functions of the selected variable */
  private readonly sides = computed(() => {
    const v = this.variable();
    if (!v) return null;
    const p = plotEquation(this.app.state(), v);
    if (!p) return null;
    const sc = this.app.scope();
    const variables = new Map(sc.variables);
    for (const w of this.app.vars()) if (w.name !== v) variables.set(w.name, w.value);
    const s = { angle: sc.angle, variables };
    return { name: p.eq.name, left: compile(p.left, v, s), right: compile(p.right, v, s) };
  });
  protected readonly label = computed(() => {
    const s = this.sides();
    return s ? `${this.app.i18n.t('solve.plot')}: ${s.name}, ${this.variable()}` : '–';
  });
  protected readonly bar = computed(() => {
    const v = this.variable();
    if (!v) return this.app.i18n.t('solve.noEquations');
    return `${this.sides()?.name ?? ''} ${v} = ${fmt(this.value())}${
      this.app.status() ? ' · ' + this.app.status() : ''
    }`;
  });
  protected readonly painter = computed<PlotPainter>(() => {
    const s = this.sides();
    const x = this.value();
    return (frame) => {
      drawAxes(frame, DARK_PLOT);
      if (!s) return;
      drawLines(frame, sample(s.left, frame.view, frame), '#5cb8ea', 2);
      drawLines(frame, sample(s.right, frame.view, frame), '#d1495b', 2);
      const y = s.left(x);
      drawCrosshair(frame, x, Number.isFinite(y) ? y : 0, '#9aa0a6');
      if (Number.isFinite(y) && Math.abs(y - s.right(x)) <= 1e-9 * (1 + Math.abs(y)))
        drawPoint(frame, x, y, '#f2f2f2', `${this.variable()} = ${fmt(x)}`);
    };
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'solve-plot',
      title: () => this.app.i18n.t('solve.plot'),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.press(i),
      rocker: (d, shift) => this.rocker(d, shift),
      gesture: (g, a) => this.gesture(g, a),
      help: 'solve',
    });
    if (!this.sides()) return;
    // centre the window on the start value when it is outside
    const v = this.view();
    const x = this.value();
    if (x < v.xmin || x > v.xmax) this.auto();
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private menu(): MenuButton[] {
    const t = (k: Parameters<I18n['t']>[0]) => this.app.i18n.t(k);
    return [
      { label: 'Zoom +' },
      { label: 'Zoom −' },
      { label: t('solve.auto') },
      { label: this.variable() ?? '' },
      { label: '' },
      { label: t('solve.solve') },
    ];
  }

  private setView(v: Viewport): void {
    if (v.xmax > v.xmin && v.ymax > v.ymin)
      this.app.apps.update<CurveState>((s) => ({ ...s, view: v }));
  }

  private auto(): void {
    const s = this.sides();
    const x = this.value();
    const w = Math.max(10, Math.abs(x) * 0.5);
    const xmin = x - w;
    const xmax = x + w;
    const a = s ? autoY(s.left, xmin, xmax) : null;
    const b = s ? autoY(s.right, xmin, xmax) : null;
    const ys = [a, b].filter((r): r is { ymin: number; ymax: number } => !!r);
    const ymin = ys.length ? Math.min(...ys.map((r) => r.ymin)) : -6.5;
    const ymax = ys.length ? Math.max(...ys.map((r) => r.ymax)) : 6.5;
    this.setView({ xmin, xmax, ymin, ymax: ymax > ymin ? ymax : ymin + 1 });
  }

  private press(i: number): void {
    if (i === 0) this.setView(zoom(this.view(), 0.5, this.value()));
    if (i === 1) this.setView(zoom(this.view(), 2, this.value()));
    if (i === 2) this.auto();
    if (i === 3) {
      // the next variable
      const names = this.app.vars().map((v) => v.name);
      if (!names.length) return;
      const k = names.indexOf(this.variable() ?? '');
      const next = names[(k + 1) % names.length];
      this.app.apps.update<CurveState>((s) => ({ ...s, selected: next }));
    }
    if (i === 5) this.app.solve(this.variable());
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'add') this.press(0);
    else if (p.id === 'sub') this.press(1);
    else if (p.id === 'enter') this.press(5);
    else return false;
    return true;
  }

  private rocker(d: RockerDir, shift: boolean): boolean {
    const v = this.variable();
    if (!v) return true;
    const view = this.view();
    const w = this.canvas()?.area().width || 300;
    const step = ((view.xmax - view.xmin) / w) * (shift ? 10 : 1);
    if (d === 'left' || d === 'right')
      this.app.setValue(v, this.value() + (d === 'right' ? step : -step));
    return true;
  }

  private gesture(g: Gesture, area: Area): void {
    const v = this.view();
    const scr = this.canvas()?.area() ?? area;
    if (g.kind === 'tap') {
      const name = this.variable();
      if (name) this.app.setValue(name, toWorldX(v, scr, g.x));
    } else if (g.kind === 'drag' && g.phase === 'move') {
      const dx = (-g.dx * (v.xmax - v.xmin)) / scr.width;
      const dy = (g.dy * (v.ymax - v.ymin)) / scr.height;
      this.setView({ xmin: v.xmin + dx, xmax: v.xmax + dx, ymin: v.ymin + dy, ymax: v.ymax + dy });
    } else if (g.kind === 'pinch' && g.phase === 'move' && g.scale > 0) {
      this.setView(zoom(v, 1 / g.scale, toWorldX(v, scr, g.cx), toWorldY(v, scr, g.cy)));
    } else if (g.kind === 'doubleTap') {
      this.setView(zoom(v, 0.5, toWorldX(v, scr, g.x), toWorldY(v, scr, g.y)));
    }
  }
}
