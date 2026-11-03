import { complex, real } from '@aba/math/value/value';
import { fromJson, parseTraceback, toJson } from './python-protocol';
import { pyIndent } from './python-views';

describe('python bridge', () => {
  it('converts calculator values to JSON and back', () => {
    expect(toJson(real(2))).toBe(2);
    expect(toJson(complex(1, -2))).toEqual({ re: 1, im: -2 });
    expect(toJson({ kind: 'list', items: [real(1), real(2)] })).toEqual([1, 2]);
    expect(
      toJson({
        kind: 'matrix',
        rows: [
          [1, 2],
          [3, 4],
        ],
      }),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(fromJson(3)).toEqual(real(3));
    expect(fromJson(true)).toEqual(real(1));
    expect(fromJson({ re: 0, im: 1 })).toEqual(complex(0, 1));
    expect(fromJson([1, 2])).toEqual({ kind: 'list', items: [real(1), real(2)] });
    expect(
      fromJson([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual({
      kind: 'matrix',
      rows: [
        [1, 2],
        [3, 4],
      ],
    });
    expect(fromJson('text')).toBeNull();
    expect(fromJson([[1], [2, 3]])).toBeNull();
    expect(fromJson({ a: 1 })).toBeNull();
  });

  it('finds the line of an error and its message', () => {
    const tb =
      'Traceback (most recent call last):\n  File "<stdin>", line 3, in <module>\n  File "<stdin>", line 7, in f\nZeroDivisionError: divide by zero\n';
    expect(parseTraceback(tb)).toEqual({ line: 7, message: 'ZeroDivisionError: divide by zero' });
  });

  it('indents after a colon', () => {
    expect(pyIndent('for k in range(3):')).toBe('    ');
    expect(pyIndent('    if x:  # note')).toBe('        ');
    expect(pyIndent('    x = 1')).toBe('    ');
  });
});
