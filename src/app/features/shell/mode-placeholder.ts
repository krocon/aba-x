import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Placeholder for modes that are not built yet (CAS: prompts 009–012, Graph: 014–016). */
@Component({
  selector: 'app-mode-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2>{{ title() }}</h2>
      <p>{{ text() }}</p>
    </section>
  `,
  styles: `
    p {
      color: var(--color-text-muted);
    }
  `,
})
export class ModePlaceholder {
  readonly title = input.required<string>();
  readonly text = input.required<string>();
}
