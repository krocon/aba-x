import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { Viewport } from '@aba/math/graph/viewport';
import type { PlotFrame } from './plot-draw';

/** What a plot draws, called with a frame in CSS pixels (the canvas is scaled for HiDPI). */
export type PlotPainter = (frame: PlotFrame) => void;

/**
 * A canvas that fills its container (prompt 033): sharp on HiDPI screens, redraws when the view,
 * the painter or its size changes. Gestures and keys stay with the owner; `label` is the text
 * alternative for screen readers.
 */
@Component({
  selector: 'app-plot-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas role="img" [attr.aria-label]="label()"></canvas>`,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class PlotCanvas implements OnDestroy {
  readonly view = input.required<Viewport>();
  readonly painter = input.required<PlotPainter>();
  readonly label = input('Plot');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly size = signal({ width: 0, height: 0 });
  private observer: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      const el = this.canvas().nativeElement;
      const measure = () => this.size.set({ width: el.clientWidth, height: el.clientHeight });
      measure();
      this.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
      this.observer?.observe(el);
    });
    effect(() => {
      const { width, height } = this.size();
      const view = this.view();
      const paint = this.painter();
      if (!width || !height) return;
      const el = this.canvas().nativeElement;
      const dpr = globalThis.devicePixelRatio || 1;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      const ctx = el.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint({ ctx, width, height, view });
    });
  }

  /** Size in CSS pixels (for gesture → world conversion). */
  area(): { width: number; height: number } {
    return this.size();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
