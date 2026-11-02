import { exprEquals } from '../ast/build';
import { toLatex, toText } from '../serializer';
import latexCases from './latex-parser.cases.json';
import textCases from './text-parser.cases.json';
import { parseLatex } from './latex-parser';
import { parseText } from './text-parser';

const text = (src: string) => {
  const r = parseText(src);
  if (!r.ok) throw new Error(`${src}: ${r.error.message}`);
  return r.value;
};
const latex = (src: string) => {
  const r = parseLatex(src);
  if (!r.ok) throw new Error(`${src}: ${r.error.message}`);
  return r.value;
};

describe('text parser', () => {
  it.each(textCases.ok)('%s → %s', (src, expected) => {
    expect(toText(text(src))).toBe(expected);
  });

  it.each(textCases.errors as [string, string, number][])(
    '%s fails with %s at %d',
    (src, code, at) => {
      const r = parseText(src);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe(code);
        expect(r.error.span?.start).toBe(at);
      }
    },
  );

  it('reads f(x) as a call when f is a known user function', () => {
    const r = parseText('f(2)+g(2)', { functions: new Set(['f']) });
    expect(r.ok && toText(r.value)).toBe('f(2) + g*2');
  });
});

describe('LaTeX parser', () => {
  it.each(latexCases.ok)('%s → %s', (src, expected) => {
    expect(toText(latex(src))).toBe(expected);
  });

  it.each(latexCases.errors)('%s fails with %s', (src, code) => {
    const r = parseLatex(src);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe(code);
      expect(r.error.span).toBeDefined();
    }
  });
});

describe('round trips', () => {
  const asts = [
    ...textCases.ok.map(([src]) => text(src)),
    ...latexCases.ok.map(([src]) => latex(src)),
  ];

  it('parseText(toText(e)) = e', () => {
    for (const e of asts) {
      const back = parseText(toText(e));
      expect(back.ok && exprEquals(back.value, e), toText(e)).toBe(true);
    }
  });

  it('parseLatex(toLatex(e)) = e (numbers without exponent)', () => {
    for (const e of asts) {
      const tex = toLatex(e);
      if (/e[+-]?\d/.test(toText(e))) continue;
      const back = parseLatex(tex);
      expect(
        back.ok && exprEquals(back.value, e),
        `${toText(e)} → ${tex} → ${back.ok ? toText(back.value) : back.error.message}`,
      ).toBe(true);
    }
  });
});
