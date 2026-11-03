import { parseText } from './parser/text-parser';
import { prettify } from './pretty';
import { toText } from './serializer';
import { checkEqual } from './symbolic/verify';

const p = (s: string) => {
  const r = parseText(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('prettify', () => {
  it.each([
    ['2*2^(1/2)', '2*sqrt(2)'],
    ['x^(1/3)', 'root(x, 3)'],
    ['x^-1', '1/x'],
    ['x^-2 - x^-2*log(x)', '1/x^2 - log(x)/x^2'],
    ['(1/3)*x^3', 'x^3/3'],
    ['(2/3)*3^(1/2)', '2*sqrt(3)/3'],
    ['-1+x', 'x - 1'],
    ['1 + sin(x)', 'sin(x) + 1'],
    ['3 - x^3 + x', '-x^3 + x + 3'],
    ['1+2*x+x^2', 'x^2 + 2*x + 1'],
    ['1+x', 'x + 1'],
    ['x+(-1/2)*y', 'x - y/2'],
    ['(-1)*x', '-x'],
    ['1*x', 'x'],
    ['--x', 'x'],
    ['a-(-b)', 'a + b'],
  ])('%s → %s', (src, expected) => {
    const out = prettify(p(src));
    expect(toText(out)).toBe(expected);
    expect(checkEqual(out, p(src))).not.toBe('mismatch');
  });
});
