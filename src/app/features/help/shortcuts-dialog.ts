import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { KeyboardDispatcher } from '../../core/actions/keyboard-dispatcher';
import { ACTIONS, formatChord } from '../../core/actions/keymap';

/** Fixed keys of the input line (handled by the math field, not the keymap). */
const LINE_KEYS: readonly [string, string][] = [
  ['Enter', 'ENTER – evaluate, push onto the stack (empty line: duplicate level 1)'],
  ['Esc', 'Clear the input line / cancel a running computation / leave the stack'],
  ['↑ on an empty line', 'Browse the stack (↑ ↓, Enter = recall, Delete = drop)'],
  ['Tab', 'Next placeholder in a fraction, root, integral …'],
  ['/  ^  _', 'Fraction, power, subscript'],
];

/** Keyboard shortcut overview (prompt 007), opened with Mod+/ or from the menu. */
@Component({
  selector: 'app-shortcuts-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="close()" aria-hidden="true"></div>
    <div
      #dialog
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      tabindex="-1"
      (keydown.escape)="close()"
    >
      <h2 id="shortcuts-title">Keyboard shortcuts</h2>
      <table>
        <tbody>
          @for (row of rows; track row[0]) {
            <tr>
              <th scope="row">
                <kbd>{{ row[0] }}</kbd>
              </th>
              <td>{{ row[1] }}</td>
            </tr>
          }
        </tbody>
      </table>
      <button type="button" class="close" (click)="close()">Close</button>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.45);
    }
    .dialog {
      position: fixed;
      inset: 50% auto auto 50%;
      transform: translate(-50%, -50%);
      width: min(34rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow: auto;
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
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 0.875rem;
    }
    th {
      text-align: left;
      padding: 0.25rem 1rem 0.25rem 0;
      white-space: nowrap;
      vertical-align: top;
      font-weight: normal;
    }
    td {
      padding: 0.25rem 0;
      color: var(--color-text-muted);
    }
    kbd {
      font-family: var(--font-mono);
      padding: 0.05rem 0.35rem;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-surface-2);
    }
    .close {
      margin-top: 0.75rem;
      font: inherit;
      padding: 0.3rem 0.9rem;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface-2);
      color: var(--color-text);
      cursor: pointer;
    }
  `,
})
export class ShortcutsDialog {
  private readonly keys = inject(KeyboardDispatcher);
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');
  private readonly opener = document.activeElement as HTMLElement | null;

  protected readonly rows: [string, string][] = [
    ...LINE_KEYS,
    ...this.keys.keymap.map(
      (b) =>
        [
          formatChord(b.chord, this.keys.os),
          ACTIONS.find((a) => a.id === b.action)?.title ?? b.action,
        ] as [string, string],
    ),
  ];

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.focus());
  }

  close(): void {
    this.keys.helpOpen.set(false);
    this.opener?.focus?.();
  }
}
