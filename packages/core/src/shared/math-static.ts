import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
} from '@angular/core';

interface MathSpanLike extends HTMLElement {
  render?: () => void;
}

/**
 * Static formula (MathLive `<math-span>`). MathLive renders on insertion but does not notice a
 * changed text node – Angular reuses elements (stack levels), so the span is rendered again
 * whenever the LaTeX changes. The text is set as text content, never as HTML.
 */
@Component({
  selector: 'app-math',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: `
    :host {
      display: inline-block;
    }
  `,
})
export class MathStatic {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly latex = input.required<string>();
  private span: MathSpanLike | null = null;

  constructor() {
    afterRenderEffect(() => {
      const latex = this.latex();
      if (!this.span) {
        this.span = document.createElement('math-span') as MathSpanLike;
        this.span.setAttribute('aria-hidden', 'true');
        this.host.nativeElement.appendChild(this.span);
      }
      if (this.span.textContent !== latex) {
        this.span.textContent = latex;
        this.span.render?.();
      }
    });
  }
}
