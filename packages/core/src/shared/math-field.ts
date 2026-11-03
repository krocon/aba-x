import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** The parts of a MathLive `<math-field>` this component uses. */
export interface MathFieldElementLike extends HTMLElement {
  getValue(format?: 'latex' | 'ascii-math'): string;
  value: string;
  insert(latex: string, options?: Record<string, unknown>): boolean;
  executeCommand(command: string | [string, ...unknown[]]): boolean;
}

/**
 * Creates a `<math-field>` (prompt 027, shared). MathLive is loaded lazily; fonts come from the
 * bundle (`mathlive/fonts`, angular.json), never from a CDN. Sounds and MathLive's own virtual
 * keyboard are off – the apps have their own keypads.
 */
export const MATH_FIELD_ELEMENT = new InjectionToken<() => Promise<MathFieldElementLike>>(
  'MATH_FIELD_ELEMENT',
  {
    providedIn: 'root',
    factory: () => async () => {
      const { MathfieldElement } = await import('mathlive');
      MathfieldElement.fontsDirectory = new URL('mathlive/fonts', document.baseURI).href;
      MathfieldElement.soundsDirectory = null;
      const field = new MathfieldElement();
      field.mathVirtualKeyboardPolicy = 'manual';
      field.smartFence = true;
      return field as unknown as MathFieldElementLike;
    },
  },
);

/**
 * A math input line (MathLive) without app logic: the owner inserts LaTeX, runs editing commands
 * and decides what keys mean (`keyHook` sees every keydown first; returning true consumes it).
 */
@Component({
  selector: 'app-math-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="host" #host></div>
    @if (state() === 'loading') {
      <span class="hint">…</span>
    } @else if (state() === 'failed') {
      <span class="hint" role="alert">The math editor could not be loaded.</span>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .host ::ng-deep math-field {
      display: block;
      width: 100%;
      box-sizing: border-box;
      border: 0;
      outline: none;
      background: transparent;
      font-size: inherit;
      color: inherit;
      --caret-color: currentColor;
      --primary-color: currentColor;
      --contains-highlight-background-color: transparent;
    }
    .host ::ng-deep math-field::part(virtual-keyboard-toggle),
    .host ::ng-deep math-field::part(menu-toggle) {
      display: none;
    }
    .hint {
      opacity: 0.6;
    }
  `,
})
export class MathField implements OnInit, OnDestroy {
  private readonly create = inject(MATH_FIELD_ELEMENT);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private field: MathFieldElementLike | null = null;

  readonly ariaLabel = input('Math input');
  readonly keyHook = input<(e: KeyboardEvent) => boolean>(() => false);
  readonly changed = output<string>();
  readonly ready = output<void>();
  readonly state = signal<'loading' | 'ready' | 'failed'>('loading');

  private readonly onInput = () => this.changed.emit(this.latex());

  private readonly onKeydown = (e: KeyboardEvent) => {
    if (this.keyHook()(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  async ngOnInit(): Promise<void> {
    try {
      const field = await this.create();
      field.setAttribute('aria-label', this.ariaLabel());
      field.addEventListener('input', this.onInput);
      field.addEventListener('keydown', this.onKeydown, { capture: true });
      this.host().nativeElement.appendChild(field);
      this.field = field;
      this.state.set('ready');
      this.ready.emit();
      field.focus();
    } catch (e) {
      console.error(e);
      this.state.set('failed');
    }
  }

  insert(latex: string): void {
    this.field?.insert(latex, { format: 'latex', selectionMode: 'placeholder', focus: true });
    this.onInput();
  }

  command(command: string): void {
    this.field?.executeCommand(command);
    this.onInput();
  }

  latex(): string {
    return this.field?.getValue('latex') ?? '';
  }

  setLatex(latex: string): void {
    if (!this.field) return;
    this.field.value = latex;
    this.field.executeCommand('moveToMathfieldEnd');
    this.onInput();
  }

  clear(): void {
    this.setLatex('');
  }

  focus(): void {
    this.field?.focus();
  }

  ngOnDestroy(): void {
    this.field?.removeEventListener('input', this.onInput);
    this.field?.removeEventListener('keydown', this.onKeydown, { capture: true });
  }
}
