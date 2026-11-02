import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toWorldX, toWorldY } from '../../../math/graph/viewport';
import { drawPlot } from './graph-draw';
import { GraphStore } from './graph-store';

/**
 * The plot in the display (prompt 014). Mouse/touch: drag = pan, wheel/pinch = zoom at the pointer,
 * click = trace cursor there, double-click = zoom in. Keyboard: see the device (arrows, + −).
 */
@Component({
  selector: 'app-graph-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas
    #canvas
    role="img"
    [attr.aria-label]="label()"
    (pointerdown)="down($event)"
    (pointermove)="move($event)"
    (pointerup)="up($event)"
    (pointercancel)="up($event)"
    (wheel)="wheel($event)"
    (dblclick)="dbl($event)"
  ></canvas>`,
  styles: `
    :host {
      display: block;
      min-height: 0;
      position: relative;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      cursor: crosshair;
    }
  `,
})
export class GraphView implements OnDestroy {
  protected readonly graph = inject(GraphStore);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly size = signal({ width: 0, height: 0 });
  private observer: ResizeObserver | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragged = false;
  private pinch: number | null = null;

  protected readonly label = () =>
    this.graph.functions().length
      ? `Plot of ${this.graph
          .functions()
          .map((f, i) => `y${i + 1} = ${f.text}`)
          .join('; ')}`
      : 'Empty plot';

  constructor() {
    afterNextRender(() => {
      const el = this.host.nativeElement as HTMLElement;
      const measure = () => this.size.set({ width: el.clientWidth, height: el.clientHeight });
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(measure);
        this.observer.observe(el);
      }
    });
    effect(() => {
      const { width, height } = this.size();
      const state = {
        view: this.graph.view(),
        functions: this.graph.functions(),
        selected: this.graph.selected(),
        trace: this.graph.trace(),
        marks: this.graph.marks(),
        tangent: this.graph.tangentAt(),
        area: this.graph.areaMark(),
        areaStart: this.graph.areaStart(),
      };
      if (!width || !height) return;
      const c = this.canvas().nativeElement;
      const dpr = globalThis.devicePixelRatio || 1;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPlot(ctx, width, height, state);
    });
  }

  private world(e: PointerEvent | WheelEvent | MouseEvent) {
    const r = this.canvas().nativeElement.getBoundingClientRect();
    const s = { width: r.width, height: r.height };
    return {
      x: toWorldX(this.graph.view(), s, e.clientX - r.left),
      y: toWorldY(this.graph.view(), s, e.clientY - r.top),
      s,
    };
  }

  protected down(e: PointerEvent): void {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dragged = false;
    this.pinch = this.pointers.size === 2 ? this.distance() : null;
  }

  protected move(e: PointerEvent): void {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const r = this.canvas().nativeElement.getBoundingClientRect();
    if (this.pointers.size === 2) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = this.distance();
      if (this.pinch && d > 0) {
        const w = this.world(e);
        this.graph.zoomBy(this.pinch / d, w.x, w.y);
        this.pinch = d;
      }
      return;
    }
    const dx = (e.clientX - prev.x) / r.width;
    const dy = (e.clientY - prev.y) / r.height;
    if (Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y) > 2) this.dragged = true;
    this.graph.panBy(-dx, dy);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  protected up(e: PointerEvent): void {
    const wasDrag = this.dragged;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (!wasDrag && e.type === 'pointerup' && this.graph.functions().length) {
      this.graph.traceTo(this.world(e).x);
    }
  }

  protected wheel(e: WheelEvent): void {
    e.preventDefault();
    const w = this.world(e);
    this.graph.zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15, w.x, w.y);
  }

  protected dbl(e: MouseEvent): void {
    const w = this.world(e);
    this.graph.zoomBy(0.5, w.x, w.y);
  }

  private distance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
