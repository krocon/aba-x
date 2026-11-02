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
import { CalculatorStore, MathEditor } from './calculator-store';
import { EditCommand } from './keypad/keypad-model';

/** The parts of a MathLive `<math-field>` this component uses. */
export interface MathFieldLike extends HTMLElement {
  getValue(format?: 'latex' | 'ascii-math'): string;
  value: string;
  insert(latex: string, options?: Record<string, unknown>): boolean;
  executeCommand(command: string): boolean;
}

/**
 * Creates a `<math-field>`. MathLive (~190 kB gzip) is loaded lazily on first use; fonts come
 * from the bundle (`/mathlive/fonts`, angular.json), never from a CDN – the desktop app and the
 * offline web build must work without network. Sounds and MathLive's own virtual keyboard are
 * off: ABA-X1 has its own keypad.
 */
export type MathFieldFactory = () => Promise<MathFieldLike>;

export const MATH_FIELD_FACTORY = new InjectionToken<MathFieldFactory>('MATH_FIELD_FACTORY', {
  providedIn: 'root',
  factory: () => async () => {
    const { MathfieldElement } = await import('mathlive');
    MathfieldElement.fontsDirectory = new URL('mathlive/fonts', document.baseURI).href;
    MathfieldElement.soundsDirectory = null;
    const field = new MathfieldElement();
    field.mathVirtualKeyboardPolicy = 'manual';
    field.smartFence = true;
    return field as unknown as MathFieldLike;
  },
});

export interface MathInputValue {
  latex: string;
  ascii: string;
}

/**
 * Input line of the display (MathLive). Takes the hardware keyboard directly; ENTER pushes the
 * line onto the stack, Escape clears it. Registers itself as the editor of the keypad.
 */
@Component({
  selector: 'app-math-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="host" #host></div>
    @if (state() === 'loading') {
      <p class="hint">Loading…</p>
    } @else if (state() === 'failed') {
      <p class="hint" role="alert">The math editor could not be loaded.</p>
    }
  `,
  styles: `
    .host ::ng-deep math-field {
      display: block;
      width: 100%;
      box-sizing: border-box;
      font-size: 1.2rem;
      padding: 0.1rem 0.25rem;
      min-height: 3.3rem;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--lcd-ink);
      --caret-color: var(--lcd-ink);
      --selection-background-color: var(--lcd-select);
      --selection-color: var(--lcd-ink);
      --contains-highlight-background-color: transparent;
      --placeholder-color: var(--lcd-ink);
      --primary-color: var(--lcd-ink);
    }
    .host ::ng-deep math-field::part(virtual-keyboard-toggle),
    .host ::ng-deep math-field::part(menu-toggle) {
      display: none;
    }
    .hint {
      margin: 0;
      color: var(--lcd-ink);
    }
  `,
})
export class MathInput implements OnInit, OnDestroy, MathEditor {
  private readonly factory = inject(MATH_FIELD_FACTORY);
  private readonly store = inject(CalculatorStore);
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

  private readonly onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      void this.store.enter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.store.run({ kind: 'clear' });
    }
  };

  async ngOnInit(): Promise<void> {
    try {
      const field = await this.factory();
      field.setAttribute('aria-label', this.ariaLabel());
      field.addEventListener('input', this.onInput);
      field.addEventListener('keydown', this.onKeydown, { capture: true });
      this.host().nativeElement.appendChild(field);
      this.field = field;
      this.state.set('ready');
      this.store.attach(this);
      field.focus();
    } catch (e) {
      console.error(e);
      this.state.set('failed');
    }
  }

  insert(latex: string): void {
    this.field?.insert(latex, { format: 'latex', selectionMode: 'placeholder' });
    this.onInput();
  }

  command(command: EditCommand): void {
    this.field?.executeCommand(command);
    this.onInput();
  }

  latex(): string {
    return this.field?.getValue('latex') ?? '';
  }

  clear(): void {
    if (!this.field) return;
    this.field.value = '';
    this.onInput();
  }

  focus(): void {
    this.field?.focus();
  }

  ngOnDestroy(): void {
    this.field?.removeEventListener('input', this.onInput);
    this.field?.removeEventListener('keydown', this.onKeydown, { capture: true });
    this.store.attach(null);
  }
}
