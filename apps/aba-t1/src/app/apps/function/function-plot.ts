import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import type { Gesture } from '@aba/core/actions/gestures';
import { PlotCanvas, type PlotPainter } from '@aba/core/graph/plot-canvas';
import { drawAxes, drawLines } from '@aba/core/graph/plot-draw';
import { sample } from '@aba/math/graph/sampler';
import { type Viewport, pan, toWorldX, toWorldY, zoom } from '@aba/math/graph/viewport';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { type Area, DeviceStore, type RockerDir } from '../../core/device/device-store';
import { I18n } from '../../core/i18n/i18n';
import { AppStore } from '../app-store';
import { injectAppScope } from '../shared/app-scope';
import { type FunctionState, plottables } from './function-logic';

/**
 * Plot view of the function app (prompt 033: curves, pan and zoom; 034 adds trace and analysis).
 * Drag pans, pinch and +/− zoom, a double tap zooms in at the point, the rocker pans.
 */
@Component({
  selector: 'app-function-plot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlotCanvas],
  template: `<app-plot-canvas [view]="view()" [painter]="painter()" [label]="label()" />`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class FunctionPlot implements OnInit, OnDestroy {
  private readonly i18n = inject(I18n);
  private readonly apps = inject(AppStore);
  private readonly device = inject(DeviceStore);
  private readonly scope = injectAppScope();
  private readonly canvas = viewChild(PlotCanvas);
  private readonly state = computed(() => this.apps.current().state as FunctionState);
  protected readonly view = computed(() => this.state().view);
  private readonly fns = computed(() => plottables(this.state().fns, this.scope()));
  protected readonly label = computed(
    () =>
      `${this.i18n.t('app.functionPlot')}: ${
        this.fns()
          .map((f) => f.name)
          .join(', ') || '–'
      }`,
  );
  protected readonly painter = computed<PlotPainter>(() => {
    const fns = this.fns();
    return (frame) => {
      drawAxes(frame);
      for (const f of fns) drawLines(frame, sample(f.f, frame.view, frame), f.color, 2);
    };
  });
  private pop: (() => void) | null = null;

  ngOnInit(): void {
    this.pop = this.device.push({
      id: 'function-plot',
      title: () => this.i18n.t('app.functionPlot'),
      menu: () => [
        { label: 'Zoom +' },
        { label: 'Zoom −' },
        { label: '' },
        { label: '' },
        { label: '' },
        { label: '' },
      ],
      key: (p) => this.key(p),
      menuPress: (i) => {
        if (i === 0) this.setView(zoom(this.view(), 0.5));
        if (i === 1) this.setView(zoom(this.view(), 2));
      },
      rocker: (d) => this.rocker(d),
      gesture: (g, area) => this.gesture(g, area),
      help: 'function',
    });
  }

  ngOnDestroy(): void {
    this.pop?.();
  }

  private setView(v: Viewport): void {
    this.apps.update<FunctionState>((s) => ({ ...s, view: v }));
  }

  private key(p: KeyPress): boolean {
    if (p.id === 'add') this.setView(zoom(this.view(), 0.5));
    else if (p.id === 'sub') this.setView(zoom(this.view(), 2));
    else return false;
    return true;
  }

  private rocker(d: RockerDir): boolean {
    const v = this.view();
    const w = (v.xmax - v.xmin) / 10;
    const h = (v.ymax - v.ymin) / 10;
    const delta: Record<RockerDir, [number, number]> = {
      left: [-w, 0],
      right: [w, 0],
      up: [0, h],
      down: [0, -h],
    };
    this.setView(pan(v, ...delta[d]));
    return true;
  }

  private gesture(g: Gesture, area: Area): void {
    const v = this.view();
    const scr = this.canvas()?.area() ?? area;
    if (g.kind === 'drag' && g.phase === 'move') {
      const dx = (-g.dx * (v.xmax - v.xmin)) / scr.width;
      const dy = (g.dy * (v.ymax - v.ymin)) / scr.height;
      this.setView(pan(v, dx, dy));
    } else if (g.kind === 'pinch' && g.phase === 'move' && g.scale > 0) {
      this.setView(zoom(v, 1 / g.scale, toWorldX(v, scr, g.cx), toWorldY(v, scr, g.cy)));
    } else if (g.kind === 'doubleTap') {
      this.setView(zoom(v, 0.5, toWorldX(v, scr, g.x), toWorldY(v, scr, g.y)));
    }
  }
}
