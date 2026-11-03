import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { type AppInfo, PlatformApi } from '@aba/core/platform/platform-api';
import { Modal } from '@aba/core/shared/modal';
import { I18n } from '../../core/i18n/i18n';

/** About ABA-T1 (prompt 045): name, version, platform, licence. */
@Component({
  selector: 'app-about-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    <app-modal [heading]="i18n.t('menuItem.about')" (closed)="closed.emit()">
      <p><strong>ABA-T1</strong> – {{ i18n.t('about.tagline') }}</p>
      @if (info(); as a) {
        <p>Version {{ a.version }} · {{ a.os }}{{ a.arch ? ' ' + a.arch : '' }}</p>
      }
      <p>{{ i18n.t('about.licence') }}</p>
      <div class="dialog-actions">
        <button type="button" class="btn primary" (click)="closed.emit()">OK</button>
      </div>
    </app-modal>
  `,
})
export class AboutDialog implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly platform = inject(PlatformApi);
  readonly closed = output();
  protected readonly info = signal<AppInfo | null>(null);

  async ngOnInit(): Promise<void> {
    this.info.set(await this.platform.appInfo().catch(() => null));
  }
}
