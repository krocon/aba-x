import { describe, expect, it } from 'vitest';
import { parseLatex } from '../parser/latex-parser';
import { parseText } from '../parser/text-parser';
import { type ValueScope, evaluateValue } from './evaluate-value';
import { formatValue, valueInput, valueLatex } from './format';
import type { Value } from './value';

const F = { format: { mode: 'standard' as const, digits: 0, decimal: '.' as const } };
function ev(src: string, scope: ValueScope = {}): Value | string {
  const p = parseText(src);
  if (!p.ok) return `parse: ${p.error.message}`;
  const r = evaluateValue(p.value, scope);
  return r.ok ? r.value : `${r.error.code}: ${r.error.message}`;
}
const show = (src: string, scope: ValueScope = {}) => {
  const v = ev(src, scope);
  return typeof v === 'string' ? v : formatValue(v, F);
};

describe('lists', () => {
  it.each([
    ['{1, 2, 3}+1', '{2, 3, 4}'],
    ['{1, 2, 3}*{4, 5, 6}', '{4, 10, 18}'],
    ['2^{1, 2, 3}', '{2, 4, 8}'],
    ['sin({0, pi/2})', '{0, 1}'],
    ['{1, 2, 3}!', '{1, 2, 6}'],
    ['-{1, 2}', '{-1, -2}'],
    ['size({5, 6, 7})', '3'],
    ['sumlist({1, 2, 3, 4})', '10'],
    ['prodlist({1, 2, 3, 4})', '24'],
    ['deltalist({1, 4, 9, 16})', '{3, 5, 7}'],
    ['sort({3, 1, 2})', '{1, 2, 3}'],
    ['reverse({1, 2, 3})', '{3, 2, 1}'],
    ['concat({1}, {2, 3})', '{1, 2, 3}'],
    ['pos({4, 5, 6}, 5)', '2'],
    ['get({4, 5, 6}, 3)', '6'],
    ['makelist(k^2, k, 1, 5)', '{1, 4, 9, 16, 25}'],
    ['makelist(k, k, 0, 1, 0.25)', '{0, 0.25, 0.5, 0.75, 1}'],
    ['{1, 2, 3}>1', '{0, 1, 1}'],
    ['dot({1, 2, 3}, {4, 5, 6})', '32'],
    ['cross({1, 0, 0}, {0, 1, 0})', '{0, 0, 1}'],
  ])('%s = %s', (src, want) => expect(show(src)).toBe(want));

  it('reports mismatched lengths and bad indices', () => {
    expect(show('{1, 2}+{1, 2, 3}')).toMatch(/^domain/);
    expect(show('get({1}, 2)')).toMatch(/^domain/);
    expect(show('makelist(k, k, 1, 5, -1)')).toMatch(/^domain/);
  });
});

describe('matrices', () => {
  it.each([
    ['[[1, 2], [3, 4]]+[[1, 1], [1, 1]]', '[[2, 3], [4, 5]]'],
    ['[[1, 2], [3, 4]]*[[5, 6], [7, 8]]', '[[19, 22], [43, 50]]'],
    ['2*[[1, 2], [3, 4]]', '[[2, 4], [6, 8]]'],
    ['[[1, 2], [3, 4]]^2', '[[7, 10], [15, 22]]'],
    ['[[1, 2], [3, 4]]^(-1)', '[[-2, 1], [1.5, -0.5]]'],
    ['[[1, 2], [3, 4]]*{1, 1}', '{3, 7}'],
    ['det([[1, 2], [3, 4]])', '-2'],
    ['inv([[2, 0], [0, 4]])', '[[0.5, 0], [0, 0.25]]'],
    ['trn([[1, 2, 3], [4, 5, 6]])', '[[1, 4], [2, 5], [3, 6]]'],
    ['rref([[1, 2, 3], [4, 5, 6]])', '[[1, 0, -1], [0, 1, 2]]'],
    ['rank([[1, 2], [2, 4]])', '1'],
    ['trace([[1, 2], [3, 4]])', '5'],
    ['size([[1, 2, 3], [4, 5, 6]])', '{2, 3}'],
    ['identity(2)', '[[1, 0], [0, 1]]'],
    ['eigval([[2, 1], [1, 2]])', '{1, 3}'],
    ['eigval([[0, -1], [1, 0]])', '{-i, i}'],
    ['linsolve([[2, 1], [1, 3]], {3, 5})', '{0.8, 1.4}'],
    ['get([[1, 2], [3, 4]], 2, 1)', '3'],
  ])('%s = %s', (src, want) => expect(show(src)).toBe(want));

  it('reports dimension errors and singular matrices', () => {
    expect(show('[[1, 2]]+[[1], [2]]')).toMatch(/^domain/);
    expect(show('[[1, 2], [3, 4]]*[[1, 2, 3]]')).toMatch(/^domain/);
    expect(show('inv([[1, 2], [2, 4]])')).toMatch(/^domain: the matrix is singular/);
    expect(show('sin([[1]])')).toMatch(/^domain/);
    expect(show('[[1, i]]')).toMatch(/^unsupported/);
  });

  it('reads lists and matrices from LaTeX and writes them back', () => {
    const l = parseLatex('\\left\\lbrace1,2\\right\\rbrace+\\lbrace3,4\\rbrace');
    expect(l.ok && evaluateValue(l.value)).toMatchObject({ ok: true, value: { kind: 'list' } });
    const m = parseLatex('\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}');
    expect(m.ok && evaluateValue(m.value)).toMatchObject({ ok: true, value: { kind: 'matrix' } });
    for (const src of ['{1, 2.5, -3}', '[[1, 2], [3, 4]]']) {
      const v = ev(src) as Value;
      expect(ev(valueInput(v))).toEqual(v);
    }
    expect(valueLatex(ev('[[1, 2], [3, 4]]') as Value, F)).toBe(
      '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}',
    );
  });
});
