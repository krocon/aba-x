import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { I18n } from '../../core/i18n/i18n';
import { Modal } from '../../shared/modal';
import { BackupStore } from './backup-store';

/** Confirms an import (prompt 017): what is in the file and what happens to existing data. */
@Component({
  selector: 'app-import-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    @if (backup.pending(); as p) {
      <app-modal [heading]="i18n.t('import.title')" (closed)="backup.cancelImport()">
        <p>{{ i18n.t('import.contains', { name: p.name }) }}</p>
        <ul>
          <li>{{ i18n.t('import.variables', { n: p.summary.variables }) }}</li>
          <li>{{ i18n.t('import.functions', { n: p.summary.functions }) }}</li>
          <li>{{ i18n.t('import.history', { n: p.summary.history }) }}</li>
          @if (p.summary.settings) {
            <li>{{ i18n.t('import.settings') }}</li>
          }
        </ul>
        <p class="muted">{{ i18n.t('import.rule') }}</p>
        <div class="dialog-actions">
          <button type="button" class="btn" (click)="backup.cancelImport()">
            {{ i18n.t('dialog.cancel') }}
          </button>
          <button type="button" class="btn primary" (click)="confirm.emit()">
            {{ i18n.t('import.do') }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .muted {
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
  `,
})
export class ImportDialog {
  protected readonly backup = inject(BackupStore);
  protected readonly i18n = inject(I18n);
  /** The host applies the import (it knows how to apply settings). */
  readonly confirm = output<void>();
}
