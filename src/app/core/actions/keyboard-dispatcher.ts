import { DOCUMENT, Injectable, OnDestroy, inject, signal } from '@angular/core';
import { type ActionId, type Os, detectOs, keymapFor, resolve } from './keymap';

/**
 * The one global keyboard listener for shortcuts (prompt 007). Runs in the capture phase, before the
 * math field sees the key, and only consumes chords from the keymap. Features register handlers.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardDispatcher implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly handlers = new Map<ActionId, () => void>();
  readonly os: Os = detectOs(this.doc.defaultView?.navigator.platform ?? '');
  readonly keymap = keymapFor(this.os);
  /** Keyboard-shortcut overview open? */
  readonly helpOpen = signal(false);

  private readonly listener = (e: KeyboardEvent) => {
    const id = resolve(this.keymap, e, this.os);
    if (!id) return;
    const handler = this.handlers.get(id);
    if (!handler) return;
    e.preventDefault();
    e.stopPropagation();
    handler();
  };

  constructor() {
    this.doc.addEventListener('keydown', this.listener, { capture: true });
    this.register('shortcuts', () => this.helpOpen.update((o) => !o));
  }

  /** Registers the handler of an action; returns a function that removes it again. */
  register(id: ActionId, handler: () => void): () => void {
    this.handlers.set(id, handler);
    return () => {
      if (this.handlers.get(id) === handler) this.handlers.delete(id);
    };
  }

  run(id: ActionId): void {
    this.handlers.get(id)?.();
  }

  ngOnDestroy(): void {
    this.doc.removeEventListener('keydown', this.listener, { capture: true });
  }
}
