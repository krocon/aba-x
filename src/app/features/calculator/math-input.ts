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
export interface MathFieldLike extends HTMLElement {
  getValue(format?: 'latex' | 'ascii-math'): string;
  value: string;
}

/**
 * Creates a `<math-field>`. MathLive (~230 kB gzip) is loaded lazily on first use; fonts come
 * from the bundle (`/mathlive/fonts`, angular.json), never from a CDN – the desktop app and the
 * offline web build must work without network. Sounds are off.
 */
export type MathFieldFactory = () => Promise<MathFieldLike>;

export const MATH_FIELD_FACTORY = new InjectionToken<MathFieldFactory>('MATH_FIELD_FACTORY', {
  providedIn: 'root',
  factory: () => async () => {
    const { MathfieldElement } = await import('mathlive');
    MathfieldElement.fontsDirectory = new URL('mathlive/fonts', document.baseURI).href;
    MathfieldElement.soundsDirectory = null;
    return new MathfieldElement() as unknown as MathFieldLike;
  },
});

export interface MathInputValue {
  latex: string;
  ascii: string;
}

/** Natural-math input field (MathLive). Emits LaTeX and ASCII-Math on every change. */
@Component({
  selector: 'app-math-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="host" #host></div>
    @if (state() === 'loading') {
      <p class="hint">Loading the math editor…</p>
    } @else if (state() === 'failed') {
      <p class="hint error" role="alert">The math editor could not be loaded.</p>
    }
  `,
  styles: `
    .host {
      min-height: 3.5rem;
    }
    .host ::ng-deep math-field {
      display: block;
      width: 100%;
      box-sizing: border-box;
      font-size: 1.75rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      color: var(--color-text);
      --caret-color: var(--color-accent);
      --selection-background-color: var(--color-accent-soft);
      --contains-highlight-background-color: transparent;
    }
    .host ::ng-deep math-field:focus-within {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
    .hint {
      color: var(--color-text-muted);
      margin: 0.25rem 0 0;
    }
    .error {
      color: var(--color-danger);
    }
  `,
})
export class MathInput implements OnInit, OnDestroy {
  private readonly factory = inject(MATH_FIELD_FACTORY);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private field: MathFieldLike | null = null;

  readonly ariaLabel = input('Math input');
  readonly changed = output<MathInputValue>();
  readonly state = signal<'loading' | 'ready' | 'failed'>('loading');

  private readonly onInput = () => {
    if (!this.field) return;
    this.changed.emit({
      latex: this.field.getValue('latex'),
      ascii: this.field.getValue('ascii-math'),
    });
  };

  async ngOnInit(): Promise<void> {
    try {
      const field = await this.factory();
      field.setAttribute('aria-label', this.ariaLabel());
      field.addEventListener('input', this.onInput);
      this.host().nativeElement.appendChild(field);
      this.field = field;
      this.state.set('ready');
    } catch (e) {
      console.error(e);
      this.state.set('failed');
    }
  }

  focus(): void {
    this.field?.focus();
  }

  ngOnDestroy(): void {
    this.field?.removeEventListener('input', this.onInput);
  }
}
