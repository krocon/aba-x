import type { Expr } from '../ast/nodes';
import { parseText } from '../parser/text-parser';
import { toText } from '../serializer';
import { NerdamerEngine } from './nerdamer-engine';
import { fromNerdamer, toNerdamer } from './nerdamer-syntax';
import { checkDerivative, checkEqual } from './verify';

const cas = new NerdamerEngine();
const p = (s: string): Expr => {
  const r = parseText(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const value = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
/** Equivalent as functions (CAS output may differ textually from the reference). */
const same = (a: Expr, b: string) => expect(checkEqual(a, p(b)), `${toText(a)} vs ${b}`).toBe('ok');

describe('Nerdamer syntax bridge', () => {
  it('maps our names and refuses unknown functions before Nerdamer sees them', () => {
    expect(toNerdamer(p('ln(x)/x'))).toBe('(log((x)))/(x)'.replace('((x))', '(x)'));
    expect(toNerdamer(p('log(x)'))).toBe('log10(x)');
    expect(toNerdamer(p('arcsin(x)'))).toBe('asin(x)');
    expect(() => toNerdamer(p('nCr(5,2)'))).not.toThrow();
  });

  it('reads results back and flags what it cannot show', () => {
    expect(toText(value(fromNerdamer('x^-2-x^-2*log(x)')).expr)).toBe('1/x^2 - ln(x)/x^2');
    expect(value(fromNerdamer('cbrt(2)')).expr).toEqual(p('root(2, 3)'));
    expect(value(fromNerdamer('1.1673')).approximate).toBe(true);
    expect(fromNerdamer('Si(x)')).toMatchObject({ ok: false, error: { code: 'unsupported' } });
    expect(fromNerdamer('integrate(x^x, x)')).toMatchObject({
      ok: false,
      error: { code: 'not-solvable' },
    });
    expect(fromNerdamer('limit(x^-1, x, 0, both)')).toMatchObject({ ok: false });
  });
});

describe('master prompt §6.2 reference cases', () => {
  it('(x + 1)^2 → x^2 + 2x + 1', () => {
    const r = value(cas.expand(p('(x+1)^2')));
    same(r.expr, 'x^2 + 2*x + 1');
    expect(toText(r.expr)).not.toContain('(');
    expect(r.verified).toBe(true);
  });

  it('d/dx sin(x^2) → 2x cos(x^2)', () => {
    same(value(cas.differentiate(p('sin(x^2)'), 'x')).expr, '2*x*cos(x^2)');
  });

  it('∫ x^2 dx → x^3/3', () => {
    const r = value(cas.integrate(p('x^2'), 'x'));
    same(r.expr, 'x^3/3');
    expect(r.approximate).toBe(false);
  });

  it('solve x^2 − 4 = 0 → x = −2, x = 2', () => {
    const r = value(cas.solve(p('x^2 - 4 = 0'), 'x'));
    expect(r.solutions.map((s) => toText(s.expr)).sort()).toEqual(['-2', '2']);
    expect(r.solutions.every((s) => s.verified)).toBe(true);
  });

  it('∫₀¹ x^2 dx → 1/3 exactly', () => {
    const r = value(cas.integrateDefinite(p('x^2'), 'x', p('0'), p('1')));
    expect(toText(r.expr)).toBe('1/3');
    expect(r.approximate).toBe(false);
    expect(r.verified).toBe(true);
  });
});

describe('regressions from the technical evaluation', () => {
  it('d/dx ln(x)/x is not 0', () => {
    const r = value(cas.differentiate(p('ln(x)/x'), 'x'));
    same(r.expr, '(1 - ln(x))/x^2');
  });

  it('higher derivatives', () => {
    same(value(cas.differentiate(p('x^4'), 'x', 2)).expr, '12*x^2');
  });

  it('log base 10 and base b', () => {
    same(value(cas.differentiate(p('log(x)'), 'x')).expr, '1/(x*ln(10))');
    same(value(cas.simplify(p('log(8, 2)'))).expr, '3');
  });

  it('factor, simplify, exact numbers', () => {
    same(value(cas.factor(p('x^3-6*x^2+11*x-6'))).expr, '(x-1)*(x-2)*(x-3)');
    same(value(cas.simplify(p('(x^2-1)/(x-1)'))).expr, 'x + 1');
    expect(toText(value(cas.simplify(p('sin(x)^2+cos(x)^2'))).expr)).toBe('1');
    expect(toText(value(cas.simplify(p('1/3+1/6'))).expr)).toBe('1/2');
    same(value(cas.simplify(p('sqrt(8)'))).expr, '2*sqrt(2)');
    expect(toText(value(cas.simplify(p('sin(pi/6)'))).expr)).toBe('1/2');
  });

  it('solutions: symbolic, general (integer parameter), none, approximate', () => {
    expect(toText(value(cas.solve(p('e^x - 2 = 0'), 'x')).solutions[0].expr)).toBe('ln(2)');
    const general = value(cas.solve(p('sin(x) = 1/2'), 'x'));
    expect(general.parameter).toBe('n');
    expect(general.solutions.length).toBe(2);
    expect(value(cas.solve(p('sqrt(x) + 2 = 0'), 'x')).solutions).toEqual([]);
    const quintic = value(cas.solve(p('x^5 - x - 1 = 0'), 'x'));
    const real = quintic.solutions.filter((s) => s.verified);
    expect(real.length).toBe(1);
    expect(real[0].approximate).toBe(true);
  });

  it('systems of equations', () => {
    const r = value(cas.solveSystem([p('x + y = 3'), p('x - y = 1')], ['x', 'y']));
    expect(r.length).toBe(1);
    expect(r[0].assignments.map((a) => `${a.variable}=${toText(a.value.expr)}`).sort()).toEqual([
      'x=2',
      'y=1',
    ]);
  });

  it('limits, and honest failure when there is none', () => {
    expect(toText(value(cas.limit(p('sin(x)/x'), 'x', p('0'))).expr)).toBe('1');
    expect(toText(value(cas.limit(p('(1+1/x)^x'), 'x', p('inf'))).expr)).toBe('e');
    expect(cas.limit(p('1/x'), 'x', p('0')).ok).toBe(false);
  });

  it('integrals: non-elementary and divergent ones are not faked', () => {
    expect(cas.integrate(p('x^x'), 'x').ok).toBe(false);
    expect(cas.integrate(p('sin(x)/x'), 'x')).toMatchObject({
      ok: false,
      error: { code: 'unsupported' },
    });
    expect(cas.integrateDefinite(p('1/x^2'), 'x', p('-1'), p('1')).ok).toBe(false);
    expect(cas.integrateDefinite(p('1/x'), 'x', p('-1'), p('1')).ok).toBe(false);
    const erf = value(cas.integrate(p('e^(-x^2)'), 'x'));
    expect(checkDerivative(erf.expr, p('e^(-x^2)'), 'x')).toBe('ok');
  });

  it('definite integrals fall back to verified numbers when no antiderivative exists', () => {
    const r = value(cas.integrateDefinite(p('sin(x)/x'), 'x', p('1'), p('2')));
    expect(r.approximate).toBe(true);
    expect(Number(toText(r.expr))).toBeCloseTo(0.6593299064355118, 10);
  });

  it('∫₀^π sin = 2 and an improper integral', () => {
    expect(toText(value(cas.integrateDefinite(p('sin(x)'), 'x', p('0'), p('pi'))).expr)).toBe('2');
    const r = value(cas.integrateDefinite(p('1/x^2'), 'x', p('1'), p('inf')));
    expect(Number(toText(r.expr))).toBeCloseTo(1, 8);
  });

  it('refuses what it cannot represent', () => {
    expect(cas.simplify(p('[1, 2]'))).toMatchObject({ ok: false, error: { code: 'unsupported' } });
    expect(cas.simplify(p('1/0'))).toMatchObject({ ok: false });
  });
});

describe('definite integrals inside expressions', () => {
  it('are resolved exactly before simplifying', () => {
    expect(toText(value(cas.simplify(p('integrate(x^2, x, 0, 1) + 1'))).expr)).toBe('4/3');
    expect(cas.simplify(p('integrate(1/x, x, -1, 1)')).ok).toBe(false);
  });
});

describe('operator nodes inside expressions are computed and verified', () => {
  it('d/dx, indefinite ∫ and lim', () => {
    same(value(cas.simplify(p('diff(x^3, x) + 1'))).expr, '3*x^2 + 1');
    same(value(cas.simplify(p('integrate(2*x, x)'))).expr, 'x^2');
    expect(toText(value(cas.simplify(p('limit(sin(x)/x, x, 0) + 1'))).expr)).toBe('2');
    expect(cas.simplify(p('limit(1/x, x, 0)')).ok).toBe(false);
    same(value(cas.simplify(p('diff(x^2*y^3, y)'))).expr, '3*x^2*y^2');
  });
});
