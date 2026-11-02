/**
 * Calculation history (prompt 017): pure list operations and the document `history`.
 * Favourites survive CLEAR and the size limit.
 */
export const HISTORY_SCHEMA = 1;
export const HISTORY_LIMIT = 500;

export interface HistoryEntry {
  readonly id: number;
  /** What was typed (LaTeX). */
  readonly input: string;
  /** Result (LaTeX), for display and re-use. */
  readonly result: string;
  /** Result as text (screen reader, export). */
  readonly text: string;
  readonly fav: boolean;
  /** Epoch milliseconds. */
  readonly at: number;
}

export interface HistoryDoc {
  schemaVersion: number;
  items: Omit<HistoryEntry, 'id'>[];
}

/** Newest last; beyond the limit the oldest non-favourites go first. */
export function addEntry(
  list: readonly HistoryEntry[],
  e: HistoryEntry,
  limit = HISTORY_LIMIT,
): HistoryEntry[] {
  const next = [...list, e];
  let excess = next.length - limit;
  if (excess <= 0) return next;
  return next.filter((x) => {
    if (excess > 0 && !x.fav) {
      excess--;
      return false;
    }
    return true;
  });
}

export function toggleFav(list: readonly HistoryEntry[], id: number): HistoryEntry[] {
  return list.map((x) => (x.id === id ? { ...x, fav: !x.fav } : x));
}

export function remove(list: readonly HistoryEntry[], id: number): HistoryEntry[] {
  return list.filter((x) => x.id !== id);
}

/** CLEAR keeps favourites. */
export function clearKeepFavourites(list: readonly HistoryEntry[]): HistoryEntry[] {
  return list.filter((x) => x.fav);
}

const str = (v: unknown): v is string => typeof v === 'string';

/** Reads a stored or imported document; broken items are skipped. */
export function loadHistory(
  raw: unknown,
  firstId = 1,
): { list: HistoryEntry[]; readOnly: boolean; skipped: number } {
  const doc = raw as Partial<HistoryDoc> | null;
  const items = Array.isArray(doc?.items) ? doc.items : [];
  let id = firstId;
  const list: HistoryEntry[] = [];
  for (const i of items as Partial<HistoryEntry>[]) {
    if (!i || !str(i.input) || !str(i.result)) continue;
    list.push({
      id: id++,
      input: i.input,
      result: i.result,
      text: str(i.text) ? i.text : i.result,
      fav: i.fav === true,
      at: typeof i.at === 'number' ? i.at : 0,
    });
  }
  return {
    list: list.slice(-HISTORY_LIMIT),
    readOnly: typeof doc?.schemaVersion === 'number' && doc.schemaVersion > HISTORY_SCHEMA,
    skipped: items.length - list.length,
  };
}

/** An entry without its session id (ids are not stored). */
export function withoutId(e: HistoryEntry): Omit<HistoryEntry, 'id'> {
  return { input: e.input, result: e.result, text: e.text, fav: e.fav, at: e.at };
}

export function historyDoc(list: readonly HistoryEntry[]): HistoryDoc {
  return { schemaVersion: HISTORY_SCHEMA, items: list.map(withoutId) };
}
