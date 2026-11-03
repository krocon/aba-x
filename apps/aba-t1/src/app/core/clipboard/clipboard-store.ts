import { Injectable, signal } from '@angular/core';

export interface Clip {
  latex: string;
  text: string;
}

/**
 * Copy (⇧View) and Paste (⇧Menu) between the views of ABA-T1 (prompt 029): keeps the LaTeX for
 * the entry lines and puts the plain text on the system clipboard as well (where allowed).
 */
@Injectable({ providedIn: 'root' })
export class ClipboardStore {
  readonly clip = signal<Clip | null>(null);

  copy(c: Clip): void {
    this.clip.set(c);
    void navigator.clipboard?.writeText(c.text).catch(() => undefined);
  }
}
