import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import { drawAxes, drawLines } from '@aba/core/graph/plot-draw';
import { MathStatic } from '@aba/core/shared/math-static';
import {
  DEFAULTS,
  type ExplorerKind,
  PARAMS,
  clampParam,
  evaluate,
  facts,
  matches,
  rng,
  task,
} from '@aba/math/explore/generator';
import { sample } from '@aba/math/graph/sampler';
import type { Viewport } from '@aba/math/graph/viewport';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { type Area, DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import type { TextKey } from '../../core/i18n/texts';
import type { MenuButton } from '../../features/device/t1-device';
import { AppStore } from '../app-store';

export interface ExplorerState {
  params: number[];
  test: { target: number[]; score: number; total: number; seed: number } | null;
}

export const initExplorer = (kind: ExplorerKind): ExplorerState => ({
  params: [...DEFAULTS[kind]],
  test: null,
});

const VIEW: Viewport = { xmin: -8, xmax: 8, ymin: -6, ymax: 6 };
/** index of the parameter that a vertical / horizontal drag changes */
const VERTICAL: Record<ExplorerKind, number> = { linear: 1, quadratic: 2, trig: 3 };
const HORIZONTAL: Record<ExplorerKind, number | null> = { linear: null, quadratic: 1, trig: 2 };

/**
 * Explorer apps (prompt 040): move the graph and watch the equation. The menu buttons choose a
 * parameter, ↑↓ change it, ←→ choose the next one; dragging moves the graph. Test: match a random
 * graph (dashed) and press Enter.
 */
@Component({
  selector: 'app-explorer-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas, MathStatic],
  template: `
    <div class="ex">
      <div class="eq" aria-live="polite">
        <app-math [latex]="info().latex" />
        <span class="det">{{ info().details.join(' · ') }}</span>
      </div>
      <div class="plot">
        <app-plot-canvas [view]="view" [painter]="painter()" [label]="label()" />
        @if (message()) {
          <div class="msg" role="status">{{ message() }}</div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .ex {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 100%;
    }
    .eq {
      padding: 0.1em 0.4em;
      font-size: 4cqw;
      border-bottom: 1px solid #dde4df;
      background: #fff;
      white-space: nowrap;
      overflow: hidden;
    }
    .det {
      margin-left: 0.6em;
      color: #3d514c;
      font-size: 0.8em;
    }
    .plot {
      position: relative;
      min-height: 0;
    }
    .msg {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0.05em 0.4em;
      background: rgb(255 255 255 / 0.9);
      font-size: 3.4cqw;
    }
  `,
})
export class ExplorerView implements OnInit, OnDestroy {
  private readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  private readonly device = inject(DeviceStore);
  protected readonly view = VIEW;
  private readonly kind = computed(
    () => this.apps.currentDef().id.replace('Explorer', '') as ExplorerKind,
  );
  private readonly state = computed(() => this.apps.current().state as ExplorerState);
  protected readonly info = computed(() => facts(this.kind(), this.state().params));
  private readonly sel = signal(0);
  protected readonly message = signal<string | null>(null);
  protected readonly label = computed(
    () => `${this.info().latex}. ${this.info().details.join(', ')}`,
  );
  protected readonly painter = computed<PlotPainter>(() => {
    const kind = this.kind();
    const p = this.state().params;
    const t = this.state().test?.target;
    return (frame) => {
      drawAxes(frame);
      if (t)
        drawLines(
          frame,
          sample((x) => evaluate(kind, t, x), frame.view, frame),
          '#5a6c67',
          2,
          [6, 5],
        );
      drawLines(
        frame,
        sample((x) => evaluate(kind, p, x), frame.view, frame),
        '#d1495b',
        2.5,
      );
    };
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'explorer',
      title: () => this.title(),
      menu: () => this.menu(),
      key: (p) => this.key(p),
      menuPress: (i) => this.press(i),
      rocker: (d) => this.rocker(d),
      gesture: (g, a) => this.gesture(g, a),
      help: 'explorer',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private title(): string {
    const t = this.state().test;
    const name = this.apps.current().name;
    return t ? `${name} · ${this.i18n.t('explorer.score')} ${t.score}/${t.total}` : name;
  }

  private menu(): MenuButton[] {
    const defs = PARAMS[this.kind()];
    const buttons: MenuButton[] = defs.map((d, i) => ({ label: d.name, active: this.sel() === i }));
    while (buttons.length < 4) buttons.push({ label: '' });
    const test = !!this.state().test;
    buttons.push({ label: this.i18n.t(test ? 'explorer.graph' : 'explorer.test'), active: test });
    buttons.push({ label: test ? this.i18n.t('explorer.check') : this.i18n.t('app.reset') });
    return buttons;
  }

  private set(params: number[]): void {
    this.apps.update<ExplorerState>((s) => ({ ...s, params }));
  }

  private change(i: number, delta: number): void {
    const p = [...this.state().params];
    p[i] = clampParam(this.kind(), i, p[i] + delta);
    this.set(p);
    this.message.set(null);
  }

  private press(i: number): void {
    const n = PARAMS[this.kind()].length;
    if (i < n) this.sel.set(i);
    if (i === 4) this.toggleTest();
    if (i === 5) {
      if (this.state().test) this.check();
      else this.set([...DEFAULTS[this.kind()]]);
    }
  }

  private toggleTest(): void {
    this.message.set(null);
    if (this.state().test) {
      this.apps.update<ExplorerState>((s) => ({ ...s, test: null }));
      return;
    }
    const seed = Math.floor(Math.random() * 1e9);
    this.apps.update<ExplorerState>(() => ({
      params: [...DEFAULTS[this.kind()]],
      test: { target: task(this.kind(), rng(seed)), score: 0, total: 0, seed },
    }));
  }

  private check(): void {
    const t = this.state().test;
    if (!t) return;
    const ok = matches(this.kind(), this.state().params, t.target);
    const seed = t.seed + 1;
    this.message.set(this.i18n.t(ok ? 'explorer.right' : 'explorer.wrong'));
    this.apps.update<ExplorerState>((s) => ({
      params: ok ? [...DEFAULTS[this.kind()]] : s.params,
      test: {
        target: ok ? task(this.kind(), rng(seed)) : t.target,
        score: t.score + (ok ? 1 : 0),
        total: t.total + 1,
        seed: ok ? seed : t.seed,
      },
    }));
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'enter') {
      if (this.state().test) this.check();
      return true;
    }
    if (p.id === 'add' || p.id === 'sub') {
      this.change(this.sel(), (p.id === 'add' ? 1 : -1) * PARAMS[this.kind()][this.sel()].step);
      return true;
    }
    return false;
  }

  private rocker(d: RockerDir): boolean {
    const n = PARAMS[this.kind()].length;
    if (d === 'left') this.sel.update((s) => (s + n - 1) % n);
    if (d === 'right') this.sel.update((s) => (s + 1) % n);
    const step = PARAMS[this.kind()][this.sel()].step;
    if (d === 'up') this.change(this.sel(), step);
    if (d === 'down') this.change(this.sel(), -step);
    return true;
  }

  /** dragging the graph: vertical shift, and horizontal shift where the family has one */
  private dragRest = { x: 0, y: 0 };
  private gesture(g: Gesture, a: Area): void {
    if (g.kind !== 'drag') return;
    if (g.phase === 'start') this.dragRest = { x: 0, y: 0 };
    if (g.phase !== 'move') return;
    const kind = this.kind();
    this.dragRest.x += (g.dx * (VIEW.xmax - VIEW.xmin)) / a.width;
    this.dragRest.y -= (g.dy * (VIEW.ymax - VIEW.ymin)) / a.height;
    const vi = VERTICAL[kind];
    const vs = PARAMS[kind][vi].step;
    if (Math.abs(this.dragRest.y) >= vs) {
      const k = Math.trunc(this.dragRest.y / vs);
      this.change(vi, k * vs);
      this.dragRest.y -= k * vs;
    }
    const hi = HORIZONTAL[kind];
    if (hi === null) return;
    const hs = PARAMS[kind][hi].step;
    // trig: moving right by s means c → c − b·s
    const factor = kind === 'trig' ? -this.state().params[1] : 1;
    if (Math.abs(this.dragRest.x) >= hs / Math.abs(factor)) {
      const k = Math.trunc((this.dragRest.x * Math.abs(factor)) / hs);
      this.change(hi, Math.sign(factor) * k * hs);
      this.dragRest.x -= (k * hs) / Math.abs(factor);
    }
  }
}

export const EXPLORER_TITLES: Record<ExplorerKind, TextKey> = {
  linear: 'explorer.linear',
  quadratic: 'explorer.quadratic',
  trig: 'explorer.trig',
};
