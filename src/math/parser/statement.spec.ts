import { toText } from '../serializer';
import { isFreeName, parseLatexStatement, parseTextStatement } from './statement';

const show = (r: ReturnType<typeof parseTextStatement>) => {
  if (!r.ok) return `error: ${r.error.message}`;
  const s = r.value;
  if (s.kind === 'expr') return `expr ${toText(s.expr)}`;
  if (s.kind === 'assign') return `assign ${s.name} := ${toText(s.value)}`;
  return `define ${s.name}(${s.params.join(', ')}) := ${toText(s.body)}`;
};

describe('statements', () => {
  it.each([
    ['a = 5', 'assign a := 5'],
    ['f(x) = x^2 - 3x + 2', 'define f(x) := x^2 - 3*x + 2'],
    ['g(x, y) = x*y + g(x, 1)', 'define g(x, y) := x*y + g(x, 1)'],
    ['x^2 = 4', 'expr x^2 = 4'],
    ['pi = 3', 'expr pi = 3'],
    ['sin(x) = 1', 'expr sin(x) = 1'],
    ['2a + 1', 'expr 2*a + 1'],
  ])('text %s → %s', (src, expected) => {
    expect(show(parseTextStatement(src))).toBe(expected);
  });

  it.each([
    ['a=5', 'assign a := 5'],
    ['f(x)=x^2-3x+2', 'define f(x) := x^2 - 3*x + 2'],
    ['f\\left(x,y\\right)=x+y', 'define f(x, y) := x + y'],
    ['x^2-4=0', 'expr x^2 - 4 = 0'],
  ])('LaTeX %s → %s', (src, expected) => {
    expect(show(parseLatexStatement(src))).toBe(expected);
  });

  it('refuses duplicate parameters and reserved names', () => {
    expect(show(parseTextStatement('f(x, x) = x'))).toMatch(/^error/);
    expect(isFreeName('Ans')).toBe(false);
    expect(isFreeName('ln')).toBe(false);
    expect(isFreeName('x_1')).toBe(true);
  });
});
