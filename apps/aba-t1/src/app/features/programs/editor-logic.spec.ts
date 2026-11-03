import {
  TEMPLATES,
  findNext,
  highlight,
  indentAfter,
  insertTemplate,
  lineOf,
  offsetOf,
  reindent,
  replaceAll,
} from './editor-logic';

describe('program editor logic', () => {
  it('highlights keywords, numbers, strings and comments without losing text', () => {
    const src = 'EXPORT f(n)\nBEGIN // c\n  PRINT("x" + 12);\nEND;';
    const spans = highlight(src);
    expect(spans.map((s) => s.text).join('')).toBe(src);
    expect(spans.find((s) => s.text === 'EXPORT')?.cls).toBe('kw');
    expect(spans.find((s) => s.text === '12')?.cls).toBe('num');
    expect(spans.find((s) => s.text.startsWith('"'))?.cls).toBe('str');
    expect(spans.find((s) => s.text.startsWith('//'))?.cls).toBe('cmt');
  });

  it('indents after openers and re-indents blocks', () => {
    expect(indentAfter('  FOR k FROM 1 TO 3 DO')).toBe('    ');
    expect(indentAfter('  x := 1;')).toBe('  ');
    expect(reindent('EXPORT f()\nBEGIN\nIF 1 THEN\nPRINT(1);\nELSE\nPRINT(2);\nEND;\nEND;')).toBe(
      'EXPORT f()\nBEGIN\n  IF 1 THEN\n    PRINT(1);\n  ELSE\n    PRINT(2);\n  END;\nEND;',
    );
  });

  it('templates keep the indentation and place the cursor', () => {
    const t = TEMPLATES.find((x) => x.label === 'WHILE DO')!;
    const r = insertTemplate('  ', 2, t);
    expect(r.text).toBe('  WHILE  DO\n    \n  END;');
    expect(r.cursor).toBe(8);
  });

  it('positions, find and replace', () => {
    const src = 'ab\ncd\nef';
    expect(offsetOf(src, 2, 2)).toBe(4);
    expect(lineOf(src, 7)).toBe(3);
    expect(findNext(src, 'CD', 0)).toBe(3);
    expect(findNext(src, 'ab', 5)).toBe(0);
    expect(replaceAll('a.a.A', 'a', 'x')).toEqual({ text: 'x.x.x', count: 3 });
  });
});
