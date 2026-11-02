import { Injectable, inject, signal } from '@angular/core';
import { StorageApi } from '../../core/storage/storage-api';
import {
  type HistoryEntry,
  addEntry,
  clearKeepFavourites,
  historyDoc,
  loadHistory,
  remove,
  toggleFav,
} from './history-logic';

/** Calculation history (prompt 017), persisted in the document `history` (saving debounced). */
@Injectable({ providedIn: 'root' })
export class HistoryStore {
  private readonly storage = inject(StorageApi);
  private nextId = 1;
  private readOnly = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly entries = signal<HistoryEntry[]>([]);
  /** Selected entry id while the HIST view is open. */
  readonly selected = signal<number | null>(null);
  readonly problem = signal<string | null>(null);

  async restore(): Promise<void> {
    try {
      const r = loadHistory((await this.storage.load('history')).value);
      this.entries.set(r.list);
      this.nextId = r.list.length + 1;
      this.readOnly = r.readOnly;
    } catch {
      this.problem.set('History could not be loaded.');
    }
  }

  add(input: string, result: string, text: string): void {
    this.entries.update((l) =>
      addEntry(l, { id: this.nextId++, input, result, text, fav: false, at: Date.now() }),
    );
    this.save();
  }

  /** Appends imported entries (prompt 017 import). */
  append(entries: readonly Omit<HistoryEntry, 'id'>[]): void {
    let l = this.entries();
    for (const e of entries) l = addEntry(l, { ...e, id: this.nextId++ });
    this.entries.set(l);
    this.save();
  }

  toggleFav(id: number): void {
    this.entries.update((l) => toggleFav(l, id));
    this.save();
  }

  remove(id: number): void {
    const list = this.entries();
    const i = list.findIndex((x) => x.id === id);
    this.entries.set(remove(list, id));
    const rest = this.entries();
    this.selected.set(rest.length ? rest[Math.min(i, rest.length - 1)].id : null);
    this.save();
  }

  clear(): void {
    this.entries.update(clearKeepFavourites);
    this.selected.set(this.entries().at(-1)?.id ?? null);
    this.save();
  }

  /** Moves the selection (+1 = older, −1 = newer). */
  move(delta: number): void {
    const l = this.entries();
    if (l.length === 0) return;
    const i = l.findIndex((x) => x.id === this.selected());
    const at = i < 0 ? l.length - 1 : Math.min(l.length - 1, Math.max(0, i - delta));
    this.selected.set(l[at].id);
  }

  current(): HistoryEntry | null {
    return this.entries().find((x) => x.id === this.selected()) ?? null;
  }

  private save(): void {
    if (this.readOnly) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.storage
        .save('history', historyDoc(this.entries()))
        .catch(() => this.problem.set('History could not be saved.'));
    }, 300);
  }
}
