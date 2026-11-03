import { Injectable, signal } from '@angular/core';
import { ActionDispatcher } from '@aba/core/actions/dispatcher';
import { type ActionId, keymapFor } from './keymap';

/**
 * The keyboard shortcuts of ABA-X1 (prompt 007) on the shared dispatcher of `@aba/core`
 * (prompt 026). Features register handlers.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardDispatcher extends ActionDispatcher<ActionId> {
  readonly keymap = keymapFor(this.os);
  /** Keyboard-shortcut overview open? */
  readonly helpOpen = signal(false);

  constructor() {
    super();
    this.register('shortcuts', () => this.helpOpen.update((o) => !o));
  }
}
