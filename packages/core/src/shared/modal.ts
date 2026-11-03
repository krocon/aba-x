import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * Modal dialog frame: backdrop, `role="dialog"`, focus moves in and back to the opener, Esc and the
 * backdrop close it, Tab stays inside.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="closed.emit()" aria-hidden="true"></div>
    <div
      #box
      class="dialog"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      tabindex="-1"
      (keydown.escape)="closed.emit()"
      (keydown.tab)="trap($event)"
    >
      <h2 [id]="titleId">{{ heading() }}</h2>
      <ng-content />
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 10;
      background: rgb(0 0 0 / 0.45);
    }
    .dialog {
      position: fixed;
      z-index: 11;
      inset: 50% auto auto 50%;
      transform: translate(-50%, -50%);
      width: min(34rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow: auto;
      box-sizing: border-box;
      padding: 1rem 1.25rem;
      border-radius: var(--radius);
      background: var(--color-surface);
      color: var(--color-text);
      box-shadow: 0 12px 40px var(--color-shadow);
    }
    .dialog:focus-visible {
      outline: 2px solid var(--color-focus);
    }
    h2 {
      margin: 0 0 0.75rem;
      font-size: 1.1rem;
    }
  `,
})
export class Modal implements OnDestroy {
  private static next = 1;
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private readonly opener = document.activeElement as HTMLElement | null;
  protected readonly titleId = `modal-title-${Modal.next++}`;

  readonly heading = input.required<string>();
  readonly closed = output<void>();

  constructor() {
    afterNextRender(() => this.box().nativeElement.focus());
  }

  protected trap(e: Event): void {
    const ev = e as KeyboardEvent;
    const focusable = [
      ...this.box().nativeElement.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea',
      ),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  ngOnDestroy(): void {
    this.opener?.focus?.();
  }
}
