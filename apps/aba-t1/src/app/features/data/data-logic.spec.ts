import { list, matrix, real } from '@aba/math/value/value';
import {
  cells,
  deleteColumn,
  deleteRow,
  insertColumn,
  insertRow,
  setCell,
  sizeText,
  toValue,
} from './data-logic';

describe('list and matrix tables', () => {
  it('converts between values and tables', () => {
    expect(cells(list([real(1), real(2)]), 'list')).toEqual([[1], [2]]);
    expect(toValue([[1], [2]], 'list')).toEqual(list([real(1), real(2)]));
    expect(cells(matrix([[1, 2]]), 'matrix')).toEqual([[1, 2]]);
    expect(
      sizeText(
        matrix([
          [1, 2],
          [3, 4],
        ]),
      ),
    ).toBe('2×2');
    expect(cells(undefined, 'list')).toEqual([]);
  });

  it('grows when editing past the end, inserts and deletes rows and columns', () => {
    expect(setCell([], 2, 0, 5)).toEqual([[0], [0], [5]]);
    expect(setCell([[1, 2]], 1, 2, 9)).toEqual([
      [1, 2, 0],
      [0, 0, 9],
    ]);
    expect(insertRow([[1], [2]], 1)).toEqual([[1], [0], [2]]);
    expect(deleteRow([[1], [2]], 0)).toEqual([[2]]);
    expect(insertColumn([[1, 2]], 1)).toEqual([[1, 0, 2]]);
    expect(deleteColumn([[1]], 0)).toEqual([]);
  });
});
