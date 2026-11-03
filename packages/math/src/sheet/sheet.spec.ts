import { describe, expect, it } from 'vitest';
import { type CellValue, errorLabel } from './evaluate';
import { Sheet } from './sheet';

/** Builds a sheet from `{ A1: '1', B1: '=A1*2' }`. */
function sheet(cells: Record<string, string>, opts = {}): Sheet {
  const s = new Sheet(opts);
  s.setCells(Object.entries(cells));
  return s;
}

/** A cell as a number, text, `#ERR` label or '' (empty). */
function v(s: Sheet, key: string): number | string {
  const c: CellValue = s.value(key);
  if (c.kind === 'empty') return '';
  if (c.kind === 'text') return c.text;
  if (c.kind === 'error') return errorLabel(c.error.code);
  return c.value.kind === 'real' ? c.value.v : s.text(key);
}

describe('formulas', () => {
  it.each([
    ['=1+2*3', 7],
    ['=A1+B1', 5],
    ['=a1*b1', 6],
    ['=SUM(A1:C1)', 9],
    ['=sum(A1:C1)', 9],
    ['=AVERAGE(A1:C1)', 3],
    ['=MIN(A1:C1)', 2],
    ['=MAX(A1:C1, 10)', 10],
    ['=PRODUCT(A1:C1)', 24],
    ['=COUNT(A1:D1)', 3],
    ['=COUNTA(A1:D1)', 4],
    ['=MEDIAN(A1:C1, 100)', 3.5],
    ['=ROUND(2.675, 2)', 2.68],
    ['=ROUND(-1.5)', -2],
    ['=ABS(-3)', 3],
    ['=SQRT(B1*3)', 3],
    ['=IF(A1>B1, 1, 2)', 2],
    ['=AND(A1, B1)', 1],
    ['=OR(0, 0)', 0],
    ['=NOT(TRUE)', 0],
    ['=A1<>B1', 1],
    ['=SUM(A1:C1)/COUNT(A1:C1)', 3],
    ['=IFERROR(1/0, -1)', -1],
    ['=sumlist(A1:C1)', 9],
  ])('%s = %s', (f, out) => {
    const s = sheet({ A1: '2', B1: '3', C1: '4', D1: 'text', E1: f });
    expect(v(s, 'E1')).toBe(out);
  });

  it('a 1-D range is a list, a 2-D range a matrix', () => {
    const s = sheet({ A1: '1', A2: '2', B1: '3', B2: '4', C1: '=A1:A2^2', C2: '=det(A1:B2)' });
    expect(s.text('C1')).toBe('{1, 4}');
    expect(v(s, 'C2')).toBe(-2);
  });

  it('whole columns are bounded by the used area', () => {
    const s = sheet({ A1: '1', A2: '2', A3: '3', B1: '=SUM(A:A)', C5: 'x' });
    expect(v(s, 'B1')).toBe(6);
    s.setCell('A9', '10');
    expect(v(s, 'B1')).toBe(16);
  });

  it('empty cells are 0, text in arithmetic is #VALUE!', () => {
    const s = sheet({ A1: 'abc', B1: '=C1+1', B2: '=A1+1' });
    expect(v(s, 'B1')).toBe(1);
    expect(v(s, 'B2')).toBe('#VALUE!');
  });

  it('unknown names and syntax errors are cell errors', () => {
    const s = sheet({ A1: '=nope+1', A2: '=1+', A3: '=FOO(1)' });
    expect(v(s, 'A1')).toBe('#NAME?');
    expect(v(s, 'A2')).toBe('#SYNTAX!');
    expect(v(s, 'A3')).toBe('#NAME?');
  });

  it('IF is lazy: =IF(A1=0, 0, 1/A1) with A1 = 0 is 0', () => {
    const s = sheet({ A1: '0', B1: '=IF(A1=0, 0, 1/A1)' });
    expect(v(s, 'B1')).toBe(0);
    s.setCell('A1', '4');
    expect(v(s, 'B1')).toBe(0.25);
  });

  it('the decimal comma uses ; between arguments', () => {
    const s = sheet({ A1: '1,5', B1: '=ROUND(A1*2,25;1)' }, { decimal: ',' });
    expect(v(s, 'B1')).toBe(3.4);
    expect(s.text('A1')).toBe('1,5');
  });
});

describe('errors and cycles', () => {
  it('errors propagate to dependants', () => {
    const s = sheet({ A1: '0', B1: '=1/A1', C1: '=B1+1', D1: '=SUM(B1:C1)' });
    expect(v(s, 'B1')).toBe('#DIV/0!');
    expect(v(s, 'C1')).toBe('#DIV/0!');
    expect(v(s, 'D1')).toBe('#DIV/0!');
    s.setCell('A1', '2');
    expect(v(s, 'D1')).toBe(2);
  });

  it('a cycle A1 → B1 → A1 marks both cells, no hang', () => {
    const s = sheet({ A1: '=B1+1', B1: '=A1+1', C1: '=A1*2' });
    expect(v(s, 'A1')).toBe('#CYCLE!');
    expect(v(s, 'B1')).toBe('#CYCLE!');
    expect(v(s, 'C1')).toBe('#CYCLE!');
    s.setCell('B1', '5');
    expect(v(s, 'A1')).toBe(6);
    expect(v(s, 'C1')).toBe(12);
  });

  it('a cell reading itself is a cycle', () => {
    const s = sheet({ A1: '=A1+1', B1: '=SUM(A1:A3)' });
    expect(v(s, 'A1')).toBe('#CYCLE!');
    expect(v(s, 'B1')).toBe('#CYCLE!');
  });

  it('a range that contains the formula is a cycle', () => {
    expect(v(sheet({ A1: '1', A3: '=SUM(A1:A3)' }), 'A3')).toBe('#CYCLE!');
  });

  it('a long chain is evaluated without stack overflow', () => {
    const cells: Record<string, string> = { A1: '1' };
    for (let r = 2; r <= 5000; r++) cells[`A${r}`] = `=A${r - 1}+1`;
    const s = sheet(cells);
    expect(v(s, 'A5000')).toBe(5000);
    const changed = s.setCell('A1', '2');
    expect(changed.size).toBe(5000);
    expect(v(s, 'A5000')).toBe(5001);
  });
});

describe('recalculation', () => {
  it('touches only the changed cell and its dependants', () => {
    const s = sheet({
      A1: '1',
      A2: '2',
      B1: '=A1*2',
      C1: '=B1+1',
      B2: '=A2*2',
      C2: '=SUM(B2:B3)',
      D1: '=5',
    });
    const changed = s.setCell('A1', '10');
    expect([...changed].sort()).toEqual(['A1', 'B1', 'C1']);
    expect(v(s, 'C1')).toBe(21);
    expect(s.setCell('B3', '1').size).toBe(2); // B3 and C2
    expect(v(s, 'C2')).toBe(5);
  });

  it('evaluates in dependency order whatever the input order', () => {
    const s = sheet({ C1: '=B1*2', B1: '=A1+1', A1: '1' });
    expect(v(s, 'C1')).toBe(4);
  });

  it('clearing a cell recalculates its readers', () => {
    const s = sheet({ A1: '5', B1: '=A1+1' });
    s.setCell('A1', '');
    expect(v(s, 'B1')).toBe(1);
  });
});

describe('names', () => {
  it('a named range in SUM', () => {
    const s = sheet({ A1: '1', A2: '2', A3: '3', B1: '=SUM(data)*rate', C1: '0.5' });
    expect(v(s, 'B1')).toBe('#NAME?');
    expect(s.defineName('data', 'A1:A3').ok).toBe(true);
    s.defineName('rate', '$C$1');
    expect(v(s, 'B1')).toBe(3);
    expect(s.setCell('A2', '12').has('B1')).toBe(true);
    expect(v(s, 'B1')).toBe(8);
  });

  it('names are case-sensitive and checked', () => {
    const s = sheet({ A1: '7', B1: '=Rate' });
    s.defineName('rate', 'A1');
    expect(v(s, 'B1')).toBe('#NAME?');
    expect(s.defineName('B2', 'A1').ok).toBe(false);
    expect(s.defineName('x', 'nowhere').ok).toBe(false);
  });

  it('the value of a name for other views', () => {
    const s = sheet({ A1: '1', A2: '2' });
    s.defineName('xs', 'A1:A2');
    const nv = s.nameValue('xs');
    expect(nv.kind === 'value' && nv.value).toEqual({
      kind: 'list',
      items: [
        { kind: 'real', v: 1 },
        { kind: 'real', v: 2 },
      ],
    });
  });

  it('home variables are read by name; sheet names win; only their readers recalculate', () => {
    const s = sheet({ A1: '2', B1: '=A1*rate', C1: '=A1+1', D1: '=rate' });
    expect(v(s, 'B1')).toBe('#NAME?');
    const changed = s.setVariables(new Map([['rate', { kind: 'real', v: 3 } as const]]));
    expect(v(s, 'B1')).toBe(6);
    expect([...changed].sort()).toEqual(['B1', 'D1']);
    s.defineName('rate', 'A1');
    expect(v(s, 'D1')).toBe(2);
    s.removeName('rate');
    expect(v(s, 'D1')).toBe(3);
  });
});

describe('copy, paste, fill', () => {
  it('relative references move, absolute ones stay', () => {
    const s = sheet({ A1: '1', A2: '2', B1: '=A1*$A$1+A$1' });
    s.paste(s.copy('B1')!, 'C2');
    expect(s.input('C2')).toBe('=B2*$A$1+B$1');
    s.paste(s.copy('B1')!, 'B2');
    expect(s.input('B2')).toBe('=A2*$A$1+A$1');
    expect(v(s, 'B2')).toBe(3);
  });

  it('a copied reference that leaves the sheet becomes #REF!', () => {
    const s = sheet({ B2: '=A1' });
    s.paste(s.copy('B2')!, 'A1');
    expect(s.input('A1')).toBe('=#REF!');
    expect(v(s, 'A1')).toBe('#REF!');
  });

  it('paste values and formats', () => {
    const s = sheet({ A1: '3', B1: '=A1*2' });
    s.setFormat('B1', { bold: true });
    s.paste(s.copy('B1')!, 'C1', 'values');
    expect(s.input('C1')).toBe('6');
    s.paste(s.copy('B1')!, 'D1', 'formats');
    expect(s.data('D1')).toEqual({ input: '', format: { bold: true } });
  });

  it('fill down and right', () => {
    const s = sheet({ A1: '1', A2: '2', A3: '3', B1: '=A1^2' });
    s.fillDown('B1:B3');
    expect([v(s, 'B1'), v(s, 'B2'), v(s, 'B3')]).toEqual([1, 4, 9]);
    s.setCells([
      ['A5', '1'],
      ['B5', '=A5+1'],
    ]);
    s.fillRight('B5:D5');
    expect(s.input('D5')).toBe('=C5+1');
    expect(v(s, 'D5')).toBe(4);
  });
});

describe('insert and delete', () => {
  it('inserting rows updates references in all formulas', () => {
    const s = sheet({ A1: '1', A2: '2', A3: '=SUM(A1:A2)', B1: '=$A$2*10' });
    expect(s.insertRows(1, 2).ok).toBe(true);
    expect(s.input('A5')).toBe('=SUM(A1:A4)');
    expect(s.input('B1')).toBe('=$A$4*10');
    expect(v(s, 'A5')).toBe(3);
    expect(v(s, 'B1')).toBe(20);
  });

  it('deleting rows gives #REF! for deleted cells and shrinks ranges', () => {
    const s = sheet({ A1: '1', A2: '2', A3: '3', B1: '=A2', B2: '=SUM(A1:A3)', B3: '=A3' });
    s.deleteRows(1);
    expect(s.input('B1')).toBe('=#REF!');
    expect(v(s, 'B1')).toBe('#REF!');
    expect(s.input('B2')).toBe('=A2');
    expect(v(s, 'B2')).toBe(3); // B3 moved up and reads the moved A3
    expect(s.value('B3').kind).toBe('empty');
  });

  it('deleting rows keeps a shrunk range', () => {
    const s = sheet({ A1: '1', A2: '2', A3: '3', C1: '=SUM(A1:A3)' });
    s.deleteRows(1);
    expect(s.input('C1')).toBe('=SUM(A1:A2)');
    expect(v(s, 'C1')).toBe(4);
  });

  it('inserting and deleting columns', () => {
    const s = sheet({ A1: '1', B1: '2', C1: '=A1+B1' });
    s.insertCols(1);
    expect(s.input('D1')).toBe('=A1+C1');
    expect(v(s, 'D1')).toBe(3);
    s.deleteCols(0);
    expect(s.input('C1')).toBe('=#REF!+B1');
  });

  it('names follow structural changes', () => {
    const s = sheet({ A2: '5', B1: '=n*2' });
    s.defineName('n', 'A2');
    s.insertRows(0);
    expect(s.nameList()).toEqual([['n', 'A3']]);
    expect(v(s, 'B2')).toBe(10);
  });
});

describe('sort', () => {
  it('sorts rows by a column; numbers, text, then empty', () => {
    const s = sheet({ A1: '3', B1: 'c', A2: 'x', B2: 'a', A3: '1', B3: 'b', A4: '', B4: 'z' });
    expect(s.sort('A1:B4', 'A').ok).toBe(true);
    expect([1, 2, 3, 4].map((r) => v(s, `B${r}`))).toEqual(['b', 'c', 'a', 'z']);
    s.sort('A1:B3', 'B', true);
    expect([1, 2, 3].map((r) => v(s, `B${r}`))).toEqual(['c', 'b', 'a']);
  });

  it('formulas move with their row (relative references shifted)', () => {
    const s = sheet({ A1: '2', A2: '1', B1: '=A1*10', B2: '=A2*10' });
    s.sort('A1:B2', 0);
    expect(s.input('B1')).toBe('=A1*10');
    expect([v(s, 'A1'), v(s, 'B1'), v(s, 'B2')]).toEqual([1, 10, 20]);
  });
});

describe('CSV and JSON', () => {
  it('CSV round trip with quotes, separators and decimal comma', () => {
    const s = sheet({ A1: 'name; "quoted"', B1: '1.5', A2: 'x,y', B2: '=B1*2', C2: 'ok' });
    for (const opts of [
      { separator: ',' as const, decimal: '.' as const },
      { separator: ';' as const, decimal: ',' as const },
    ]) {
      const csv = s.toCsv(opts);
      const t = new Sheet();
      t.importCsv(csv, opts);
      expect(v(t, 'A1')).toBe('name; "quoted"');
      expect(v(t, 'B1')).toBe(1.5);
      expect(v(t, 'A2')).toBe('x,y');
      expect(v(t, 'B2')).toBe(3);
      expect(v(t, 'C2')).toBe('ok');
    }
    expect(s.toCsv({ separator: ';', decimal: ',' })).toBe(
      '"name; ""quoted""";1,5;\r\nx,y;3;ok\r\n',
    );
  });

  it('CSV of inputs keeps formulas', () => {
    const s = sheet({ A1: '2', B1: '=A1+1' });
    const t = new Sheet();
    t.importCsv(s.toCsv({ content: 'inputs' }), { formulas: true });
    expect(v(t, 'B1')).toBe(3);
  });

  it('JSON round trip with formats and names', () => {
    const s = sheet({ A1: '2', A2: '=A1*k' });
    s.setFormat('A1', { align: 'right' });
    s.setCell('B1', '4');
    s.defineName('k', 'B1');
    const json = JSON.parse(JSON.stringify(s.toJSON()));
    const r = Sheet.fromJSON(json);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(v(r.value, 'A2')).toBe(8);
    expect(r.value.data('A1')).toEqual({ input: '2', format: { align: 'right' } });
    expect(Sheet.fromJSON({ version: 2 }).ok).toBe(false);
  });
});
