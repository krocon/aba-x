import {
  addEntry,
  clearKeepFavourites,
  historyDoc,
  loadHistory,
  toggleFav,
  type HistoryEntry,
} from './history-logic';

const e = (id: number, fav = false): HistoryEntry => ({
  id,
  input: `${id}`,
  result: `${id}`,
  text: `${id}`,
  fav,
  at: id,
});

describe('history-logic', () => {
  it('drops the oldest non-favourites beyond the limit', () => {
    let l = [e(1, true), e(2), e(3)];
    l = addEntry(l, e(4), 3);
    expect(l.map((x) => x.id)).toEqual([1, 3, 4]);
  });

  it('CLEAR keeps favourites; toggle', () => {
    const l = toggleFav([e(1), e(2)], 2);
    expect(clearKeepFavourites(l).map((x) => x.id)).toEqual([2]);
  });

  it('round-trips its document, skips broken items, keeps newer documents read-only', () => {
    const doc = historyDoc([e(1, true), e(2)]);
    expect(loadHistory(doc).list.map((x) => [x.input, x.fav])).toEqual([
      ['1', true],
      ['2', false],
    ]);
    const r = loadHistory({
      schemaVersion: 9,
      items: [{ input: 'x' }, { input: 'a', result: 'b' }],
    });
    expect(r.list.length).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.readOnly).toBe(true);
  });
});
