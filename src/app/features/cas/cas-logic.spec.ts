import { parseText } from '../../../math/parser/text-parser';
import { pickVariable, solutionsDisplay, variablesOf, withConstant } from './cas-logic';
import { toText } from '../../../math/serializer';

const p = (s: string) => {
  const r = parseText(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('cas-logic', () => {
  it('picks x, else the only free name', () => {
    expect(pickVariable(p('a*x^2 + b'))).toBe('x');
    expect(pickVariable(p('t^2 + pi'))).toBe('t');
    expect(pickVariable(p('a + b'))).toBeNull();
    expect(variablesOf(p('[x + y = 3, x - y = 1]'))).toEqual(['x', 'y']);
  });

  it('formats solutions and notes', () => {
    const d = solutionsDisplay({
      variable: 'x',
      solutions: [
        { expr: p('-2'), approximate: false, verified: true },
        { expr: p('2'), approximate: false, verified: true },
      ],
    });
    expect(d.latex).toBe('x=-2,\\;x=2');
    expect(d.note).toBeNull();
    const g = solutionsDisplay({
      variable: 'x',
      parameter: 'n',
      solutions: [{ expr: p('pi/6 + 2*n*pi'), approximate: false, verified: false }],
    });
    expect(g.note).toBe('n ∈ ℤ · not all solutions could be checked');
    expect(toText(withConstant(p('x^2')))).toBe('x^2 + C');
  });
});
