import { tokenize } from './lexer';

const kinds = (s: string) => tokenize(s).map((t) => `${t.kind}:${t.value}`);

describe('tokenize', () => {
  it('classifies keywords (any case), names, numbers, operators and punctuation', () => {
    expect(kinds('export Sq(x) Begin RETURN x^2; end;')).toEqual([
      'keyword:EXPORT',
      'identifier:Sq',
      'punctuation:(',
      'identifier:x',
      'punctuation:)',
      'keyword:BEGIN',
      'keyword:RETURN',
      'identifier:x',
      'operator:^',
      'number:2',
      'punctuation:;',
      'keyword:END',
      'punctuation:;',
    ]);
  });

  it('normalises operator spellings', () => {
    expect(kinds('a<>b <= >= = == ≠ := −').map((k) => k.slice(k.indexOf(':') + 1))).toEqual([
      'a',
      '≠',
      'b',
      '≤',
      '≥',
      '==',
      '==',
      '≠',
      ':=',
      '-',
    ]);
  });

  it('keeps comments and reports positions', () => {
    const t = tokenize('x := 1; // set x\n  y');
    const comment = t.find((x) => x.kind === 'comment');
    expect(comment?.value).toBe(' set x');
    const y = t[t.length - 1];
    expect([y.line, y.column, y.text]).toEqual([2, 3, 'y']);
  });

  it('reads numbers with fraction and exponent', () => {
    expect(kinds('3 .5 1.25e-3 2E+4 7ᴇ2')).toEqual([
      'number:3',
      'number:.5',
      'number:1.25e-3',
      'number:2E+4',
      'number:7e2',
    ]);
  });

  it('resolves string escapes', () => {
    const [s] = tokenize('"a\\"b\\\\c\\nd"');
    expect(s.kind).toBe('string');
    expect(s.value).toBe('a"b\\c\nd');
  });

  it('marks broken input as invalid instead of throwing', () => {
    const t = tokenize('x := "open\ny := 2 @');
    expect(t[2]).toMatchObject({ kind: 'invalid', message: 'unterminated string' });
    expect(t[t.length - 1]).toMatchObject({ kind: 'invalid', text: '@', line: 2 });
  });
});
