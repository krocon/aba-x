import { Injectable, inject, signal } from '@angular/core';
import { StorageApi } from '@aba/core/storage/storage-api';
import { type Note, newNote, titleOf } from './notes-logic';

const DOC_VERSION = 1;

/** Notes (prompt 045): stored as one document, newest first. */
@Injectable({ providedIn: 'root' })
export class NotesStore {
  private readonly storage = inject(StorageApi);
  readonly notes = signal<Note[]>([]);

  async load(): Promise<void> {
    try {
      const d = (await this.storage.load<{ version: number; notes: Note[] }>('notes')).value;
      if (d?.version === DOC_VERSION && Array.isArray(d.notes)) this.notes.set(d.notes);
    } catch (e) {
      console.error(e);
    }
  }

  create(text = ''): Note {
    const n = { ...newNote(), text, title: titleOf(text) };
    this.notes.update((l) => [n, ...l]);
    this.save();
    return n;
  }

  update(id: string, text: string): void {
    this.notes.update((l) =>
      l.map((n) => (n.id === id ? { ...n, text, title: titleOf(text), updated: Date.now() } : n)),
    );
    this.save();
  }

  remove(id: string): void {
    this.notes.update((l) => l.filter((n) => n.id !== id));
    this.save();
  }

  clear(): void {
    this.notes.set([]);
    this.save();
  }

  private save(): void {
    void this.storage
      .save('notes', { version: DOC_VERSION, notes: this.notes() })
      .catch((e) => console.error(e));
  }
}
