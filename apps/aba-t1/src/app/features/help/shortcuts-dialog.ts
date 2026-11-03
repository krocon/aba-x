import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { formatChord } from '@aba/core/actions/chords';
import { Modal } from '@aba/core/shared/modal';
import { CHORDS } from '../../core/actions/keymap';
import { T1Keyboard } from '../../core/actions/t1-keyboard';

/** Overview of the PC keyboard of ABA-T1 (prompt 026), per OS. */
@Component({
  selector: 'app-shortcuts-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    <app-modal heading="Keyboard" (closed)="closed.emit()">
      <p class="hint">
        Digits, operators, letters, Enter, Backspace, Esc and the arrow keys work like the device
        keys. Shift + arrow = rocker with shift.
      </p>
      <table>
        <tbody>
          @for (b of chords; track b.action) {
            <tr>
              <td>
                <kbd>{{ fmt(b.chord) }}</kbd>
              </td>
              <td>{{ b.title }}</td>
            </tr>
          }
        </tbody>
      </table>
      <div class="dialog-actions">
        <button type="button" class="btn primary" (click)="closed.emit()">Close</button>
      </div>
    </app-modal>
  `,
  styles: `
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    td {
      padding: 0.15rem 0.4rem;
      border-bottom: 1px solid var(--color-border);
    }
    kbd {
      font-family: var(--font-mono);
    }
    .hint {
      margin-top: 0;
      color: var(--color-text-muted);
      font-size: 0.9rem;
    }
  `,
})
export class ShortcutsDialog {
  private readonly keyboard = inject(T1Keyboard);
  readonly closed = output();
  protected readonly chords = CHORDS;
  protected fmt = (c: (typeof CHORDS)[number]['chord']) => formatChord(c, this.keyboard.os);
}
