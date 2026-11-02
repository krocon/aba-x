import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MathInput, MathInputValue } from './math-input';

/**
 * Standard mode. Walking skeleton (prompt 001): natural input with MathLive and the raw formats
 * it produces – evaluation follows with the expression core (prompts 003–005).
 */
@Component({
  selector: 'app-calculator-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathInput],
  template: `
    <section class="panel" aria-labelledby="calc-title">
      <h2 id="calc-title" class="visually-hidden">Standard calculator</h2>
      <app-math-input ariaLabel="Expression" (changed)="value.set($event)" />
      <dl class="formats">
        <dt>LaTeX</dt>
        <dd>
          <code>{{ value().latex || '–' }}</code>
        </dd>
        <dt>ASCII-Math</dt>
        <dd>
          <code>{{ value().ascii || '–' }}</code>
        </dd>
      </dl>
      <p class="note">Evaluation is not implemented yet – this build checks input and platforms.</p>
    </section>
  `,
  styles: `
    .formats {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.25rem 1rem;
      margin: 1rem 0;
    }
    dt {
      color: var(--color-text-muted);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .note {
      color: var(--color-text-muted);
    }
  `,
})
export class CalculatorPage {
  readonly value = signal<MathInputValue>({ latex: '', ascii: '' });
}
