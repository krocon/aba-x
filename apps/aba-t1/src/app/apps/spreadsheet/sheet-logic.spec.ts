import { MAX_ROWS } from '@aba/math/sheet/refs';
import { Sheet } from '@aba/math/sheet/sheet';
import { describe, expect, it } from 'vitest';
import {
  applyFormat,
  clipToUsed,
  columnsFrom,
  columnsToLists,
  follow,
  followCols,
  initSheetState,
  move,
  namesToPublish,
  rangeText,
  resize,
  selection,
  target,
} from './sheet-logic';

describe('spreadsheet logic', () => {
  it('a fresh state is an empty sheet that survives JSON', () => {
    const s = initSheetState();
    const r = Sheet.fromJSON(JSON.parse(JSON.stringify(s.sheet)));
    expect(r.ok && r.value.keys()).toEqual([]);
  });

  it('cursor moves stay inside the sheet', () => {
    expect(move({ row: 0, col: 0 }, 'up')).toEqual({ row: 0, col: 0 });
    expect(move({ row: 0, col: 0 }, 'right', 3)).toEqual({ row: 0, col: 3 });
    expect(move({ row: MAX_ROWS - 1, col: 0 }, 'down')).toEqual({ row: MAX_ROWS - 1, col: 0 });
  });

  it('selection and range text', () => {
    const q = selection({ row: 0, col: 1 }, { row: 2, col: 0 });
    expect(q).toEqual({ r0: 0, c0: 0, r1: 2, c1: 1 });
    expect(rangeText(q)).toBe('A1:B3');
    expect(rangeText(selection({ row: 4, col: 2 }, null))).toBe('C5');
    expect(rangeText({ r0: 0, c0: 1, r1: MAX_ROWS - 1, c1: 1 })).toBe('B:B');
  });

  it('Go To targets: cells, ranges, names', () => {
    const sh = new Sheet();
    sh.defineName('data', 'B2:B4');
    expect(target('c7', sh)).toEqual({ r0: 6, c0: 2, r1: 6, c1: 2 });
    expect(target('data', sh)).toEqual({ r0: 1, c0: 1, r1: 3, c1: 1 });
    expect(target('nonsense!', sh)).toBeNull();
    expect(clipToUsed({ r0: 0, c0: 0, r1: MAX_ROWS - 1, c1: 0 }, { rows: 3, cols: 1 })).toEqual({
      r0: 0,
      c0: 0,
      r1: 2,
      c1: 0,
    });
  });

  it('the window follows the cursor with the smallest move', () => {
    expect(follow(0, 5, 10)).toBe(0);
    expect(follow(0, 12, 10)).toBe(3);
    expect(follow(8, 2, 10)).toBe(2);
    const w = (c: number) => (c === 1 ? 10 : 5);
    expect(columnsFrom(0, 20, w)).toEqual([0, 1, 2]);
    expect(followCols(0, 4, 20, w)).toBe(2);
    expect(followCols(3, 1, 20, w)).toBe(1);
  });

  it('column widths are clamped, defaults are not stored', () => {
    const s = initSheetState();
    expect(resize(s, 0, 1, 2)).toEqual({ A: 7, B: 7 });
    expect(resize({ ...s, widths: { A: 7 } }, 0, 0, -2)).toEqual({});
    expect(resize(s, 0, 0, 100)).toEqual({ A: 20 });
  });

  it('formats toggle and vanish when empty', () => {
    const f = applyFormat(undefined, { kind: 'bold' });
    expect(f).toEqual({ bold: true });
    expect(applyFormat(f, { kind: 'bold' })).toBeUndefined();
    expect(applyFormat({ align: 'left' }, { kind: 'color', color: '#b42318' })).toEqual({
      align: 'left',
      color: '#b42318',
    });
  });

  it('names go to the home view, unchanged values are not written again', () => {
    const sh = new Sheet();
    sh.setCells([
      ['A1', '1'],
      ['A2', '2'],
      ['B1', '=SUM(A1:A2)'],
    ]);
    sh.defineName('total', 'B1');
    sh.defineName('xs', 'A1:A2');
    const out = namesToPublish(sh, new Map());
    expect(out.map(([n]) => n)).toEqual(['total', 'xs']);
    expect(out[0][1]).toEqual({ kind: 'real', v: 3 });
    expect(namesToPublish(sh, new Map(out))).toEqual([]);
  });

  it('columns become lists; text is refused', () => {
    const sh = new Sheet();
    sh.setCells([
      ['A1', '1'],
      ['A3', '3'],
      ['B1', '=A1*2'],
      ['B3', '=A3*2'],
    ]);
    const r = columnsToLists(sh, { r0: 0, c0: 0, r1: 2, c1: 1 });
    expect(r).toEqual([
      {
        kind: 'list',
        items: [
          { kind: 'real', v: 1 },
          { kind: 'real', v: 3 },
        ],
      },
      {
        kind: 'list',
        items: [
          { kind: 'real', v: 2 },
          { kind: 'real', v: 6 },
        ],
      },
    ]);
    sh.setCell('A2', 'x');
    expect(columnsToLists(sh, { r0: 0, c0: 0, r1: 2, c1: 0 })).toBe('A2 is not a real number');
  });
});
