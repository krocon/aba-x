import { DOCUMENT, Injectable, OnDestroy, inject } from '@angular/core';
import { type Keymap, type Os, detectOs, resolve } from './chords';

/**
 * The one global keyboard listener for shortcuts (prompt 007, shared since prompt 026). Runs in the
 * capture phase, before inputs see the key, and only consumes chords of the keymap that have a
 * handler. Features register handlers per action id; each app derives an injectable dispatcher with
 * its own action ids and keymap.
 */
@Injectable()
export abstract class ActionDispatcher<A extends string> implements OnDestroy {
  protected readonly doc = inject(DOCUMENT);
  private readonly handlers = new Map<A, () => void>();
  readonly os: Os = detectOs(this.doc.defaultView?.navigator.platform ?? '');
  abstract readonly keymap: Keymap<A>;

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
  }

  /** Registers the handler of an action; returns a function that removes it again. */
  register(id: A, handler: () => void): () => void {
    this.handlers.set(id, handler);
    return () => {
      if (this.handlers.get(id) === handler) this.handlers.delete(id);
    };
  }

  run(id: A): void {
    this.handlers.get(id)?.();
  }

  has(id: A): boolean {
    return this.handlers.has(id);
  }

  ngOnDestroy(): void {
    this.doc.removeEventListener('keydown', this.listener, { capture: true });
  }
}
