import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { I18n } from '../../core/i18n/i18n';
import { type AppInfo, PlatformApi } from '@aba/core/platform/platform-api';
import { Modal } from '@aba/core/shared/modal';

/** About ABA-X1 (prompt 002): version, platform, licence, third-party notices. */
@Component({
  selector: 'app-about-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    <app-modal [heading]="i18n.t('about.title')" (closed)="closed.emit()">
      <p class="lead">
        <strong>ABA-X1</strong> – Advanced Browser Algebra · Scientific &amp; Symbolic Calculator
      </p>
      @if (info(); as i) {
        <dl>
          <dt>{{ i18n.t('about.version') }}</dt>
          <dd>{{ i.version }}</dd>
          <dt>{{ i18n.t('about.platform') }}</dt>
          <dd>{{ i.os === 'web' ? 'Web' : i.os + ' · ' + i.arch }}</dd>
        </dl>
      }
      <p>{{ i18n.t('about.licence') }}</p>
      <p class="muted">{{ i18n.t('about.independent') }}</p>
      <div class="dialog-actions">
        <button type="button" class="btn primary" (click)="closed.emit()">
          {{ i18n.t('dialog.ok') }}
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.25rem 1rem;
    }
    dt {
      color: var(--color-text-muted);
    }
    dd {
      margin: 0;
    }
    .muted {
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
  `,
})
export class AboutDialog {
  protected readonly i18n = inject(I18n);
  protected readonly info = signal<AppInfo | null>(null);
  readonly closed = output<void>();

  constructor() {
    inject(PlatformApi)
      .appInfo()
      .then((i) => this.info.set(i))
      .catch(() => undefined);
  }
}
