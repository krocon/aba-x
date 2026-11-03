import { runCas } from '@aba/math/symbolic/cas-commands';
import { real } from '@aba/math/value/value';
import { STANDARD_FORMAT } from '@aba/math/value/format';
import { answerOf, casScope, markCommands, parseCasInput } from './cas-logic';

const D = { format: STANDARD_FORMAT };

function answer(src: string, approx = false) {
  const p = parseCasInput(src, new Set());
  if (!p.ok || p.value.kind !== 'expr') throw new Error('parse');
  const r = runCas(p.value.expr, casScope(new Map(), new Map(), new Map([['A', real(2)]])));
  if (!r.ok) return r.error.message;
  return answerOf(r.value, approx, D, 'no solution');
}

describe('CAS view logic', () => {
  it('marks typed command words', () => {
    expect(markCommands('solve(x^2=4,x)', ['solve'])).toBe('\\operatorname{solve}(x^2=4,x)');
    expect(markCommands('factor\\left(x\\right)+sx(2)', ['factor', 'sx', 'f'])).toBe(
      '\\operatorname{factor}\\left(x\\right)+\\operatorname{sx}(2)',
    );
    expect(markCommands('\\operatorname{solve}(x)', ['solve'])).toBe('\\operatorname{solve}(x)');
    expect(markCommands('resolve(x)', ['solve'])).toBe('resolve(x)');
    expect(markCommands('\\operatorname{\\mathrm{solve}}\\left(x\\right)', ['solve'])).toBe(
      '\\operatorname{solve}\\left(x\\right)',
    );
    expect(parseCasInput('solve(x^2=4,x)', new Set())).toMatchObject({
      ok: true,
      value: { expr: { name: 'solve' } },
    });
  });

  it('reads commands, assignments and definitions', () => {
    expect(parseCasInput('\\operatorname{factor}(x^2-1)', new Set())).toMatchObject({
      ok: true,
      value: { kind: 'expr', expr: { type: 'call', name: 'factor' } },
    });
    expect(parseCasInput('a:=x+1', new Set())).toMatchObject({
      ok: true,
      value: { kind: 'assign', name: 'a' },
    });
    expect(parseCasInput('f(x)\\coloneq x^2', new Set())).toMatchObject({
      ok: true,
      value: { kind: 'define', name: 'f' },
    });
  });

  it('shows exact and approximate answers, solutions and booleans', () => {
    expect(answer('\\frac{1}{3}+\\frac{1}{6}')).toMatchObject({
      latex: '\\frac{1}{2}',
      approximate: false,
    });
    expect(answer('\\frac{1}{3}+\\frac{1}{6}', true)).toMatchObject({
      text: '0.5',
      approximate: true,
    });
    expect(answer('\\operatorname{solve}(x^2=4,x)')).toMatchObject({ text: 'x=-2, x=2' });
    expect(answer('\\operatorname{isprime}(7)')).toMatchObject({ text: 'true' });
    expect(answer('A\\cdot x+A')).toMatchObject({ expr: expect.anything() });
  });
});
