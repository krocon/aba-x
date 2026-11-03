import { describe, expect, it } from 'vitest';
import { parseCsv, writeCsv } from './csv';
import { compileFormula, isValidName, parseInput, shiftFormula } from './formula';
import {
  colIndex,
  colName,
  deleteMap,
  formatRef,
  insertMap,
  parseCellRef,
  parseRef,
  remapRef,
  shiftRef,
} from './refs';

describe('references', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [27, 'AB'],
    [701, 'ZZ'],
  ])('column %i is %s', (i, s) => {
    expect(colName(i)).toBe(s);
    expect(colIndex(s)).toBe(i);
  });

  it.each([
    ['A1', 'A1'],
    ['b7', 'B7'],
    ['$A$1', '$A$1'],
    ['A$1', 'A$1'],
    ['$zz9999', '$ZZ9999'],
    ['B9:A1', 'A1:B9'],
    ['$B9:A$1', 'A$1:$B9'],
    ['C:A', 'A:C'],
    ['$3:5', '$3:5'],
  ])('%s reads as %s', (src, out) => {
    const r = parseRef(src);
    expect(r && formatRef(r)).toBe(out);
  });

  it.each(['A0', 'A10000', 'AAA1', 'A', '1', 'A1:B', 'x', ''])('%s is no reference', (s) => {
    expect(parseRef(s)).toBeNull();
  });

  it('parses the absolute parts', () => {
    expect(parseCellRef('$C4')).toEqual({ row: 3, col: 2, absRow: false, absCol: true });
  });

  it.each([
    ['A1', 1, 1, 'B2'],
    ['$A1', 1, 1, '$A2'],
    ['A$1', 1, 1, 'B$1'],
    ['$A$1', 5, 5, '$A$1'],
    ['A1:B2', 2, 0, 'A3:B4'],
    ['A:A', 0, 2, 'C:C'],
    ['1:1', 3, 0, '4:4'],
  ])('%s copied by (%i, %i) is %s', (src, dr, dc, out) => {
    const r = shiftRef(parseRef(src)!, dr, dc);
    expect(r && formatRef(r)).toBe(out);
  });

  it('a reference that leaves the sheet is null', () => {
    expect(shiftRef(parseRef('A1')!, -1, 0)).toBeNull();
    expect(shiftRef(parseRef('ZZ1')!, 0, 1)).toBeNull();
  });

  it('insert and delete remap absolute and relative parts, ranges shrink', () => {
    const f = (s: string, m: Parameters<typeof remapRef>[1]) => {
      const r = remapRef(parseRef(s)!, m);
      return r && formatRef(r);
    };
    expect(f('$A$3', insertMap('row', 1, 2))).toBe('$A$5');
    expect(f('A1', insertMap('row', 1, 2))).toBe('A1');
    expect(f('A1:A5', insertMap('row', 2, 1))).toBe('A1:A6');
    expect(f('A3', deleteMap('row', 2, 1))).toBeNull();
    expect(f('A1:A5', deleteMap('row', 0, 2))).toBe('A1:A3');
    expect(f('A2:A3', deleteMap('row', 0, 4))).toBeNull();
    expect(f('C1', deleteMap('col', 0, 1))).toBe('B1');
  });
});

describe('inputs and formulas', () => {
  it.each([
    ['', { kind: 'empty' }],
    ['12', { kind: 'number', value: 12 }],
    [' -1.5E3 ', { kind: 'number', value: -1500 }],
    ["'12", { kind: 'text', text: '12' }],
    ['abc', { kind: 'text', text: 'abc' }],
    ['1,5', { kind: 'text', text: '1,5' }],
    ['=A1+1', { kind: 'formula', src: 'A1+1' }],
  ])('%j', (src, out) => {
    expect(parseInput(src)).toEqual(out);
  });

  it('reads the decimal comma when asked', () => {
    expect(parseInput('1,5', ',')).toEqual({ kind: 'number', value: 1.5 });
  });

  it('replaces references by placeholders and keeps names', () => {
    const c = compileFormula('SUM(A1:A3)*rate+A1+a1');
    expect(c.ok && c.value.refs.map((r) => r && formatRef(r))).toEqual(['A1:A3', 'A1']);
    expect(c.ok && c.value.names).toEqual(['rate']);
  });

  it('1E5 is a number, not cell E5', () => {
    const c = compileFormula('1E5+E5');
    expect(c.ok && c.value.refs.length).toBe(1);
  });

  it('rejects text literals and stray $', () => {
    expect(compileFormula('"x"').ok).toBe(false);
    expect(compileFormula('$+1').ok).toBe(false);
  });

  it('shifts only references, keeps the rest as typed', () => {
    expect(shiftFormula('=sum(A1:A3) + $B$1*c2 + 1E5', 1, 1)).toBe('=sum(B2:B4) + $B$1*D3 + 1E5');
    expect(shiftFormula('=A1', -1, 0)).toBe('=#REF!');
    expect(shiftFormula('plain A1', 1, 1)).toBe('plain A1');
  });

  it('names may not look like cells or functions', () => {
    expect(isValidName('rate')).toBe(true);
    expect(isValidName('Total_2')).toBe(true);
    expect(isValidName('A1')).toBe(false);
    expect(isValidName('sum')).toBe(false);
    expect(isValidName('sin')).toBe(false);
    expect(isValidName('pi')).toBe(false);
    expect(isValidName('TRUE')).toBe(false);
  });
});

describe('CSV', () => {
  it('quotes separators, quotes and line breaks (RFC 4180)', () => {
    const rows = [
      ['a', 'b,c', 'say "hi"'],
      ['line\nbreak', '', ' x'],
    ];
    const text = writeCsv(rows);
    expect(text).toBe('a,"b,c","say ""hi"""\r\n"line\nbreak",," x"\r\n');
    expect(parseCsv(text)).toEqual(rows);
  });

  it('reads LF line ends and semicolons', () => {
    expect(parseCsv('1;2\n3;"4;5"\n', ';')).toEqual([
      ['1', '2'],
      ['3', '4;5'],
    ]);
  });
});
