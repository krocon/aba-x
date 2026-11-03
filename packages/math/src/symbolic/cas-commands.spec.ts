import { describe, expect, it } from 'vitest';
import type { Expr } from '../ast/nodes';
import { evaluateNumeric } from '../numeric/evaluate';
import { parseText } from '../parser/text-parser';
import { toText } from '../serializer';
import { CAS_COMMANDS, type CasOutput, type CasScope, runCas } from './cas-commands';

const fns = new Set<string>(CAS_COMMANDS);
function expr(src: string, extra: string[] = []): Expr {
  const p = parseText(src, { functions: new Set([...fns, ...extra]) });
  if (!p.ok) throw new Error(`${src}: ${p.error.message}`);
  return p.value;
}
function cas(src: string, scope: CasScope = {}, extra: string[] = []): CasOutput | string {
  const r = runCas(expr(src, extra), scope);
  return r.ok ? r.value : `${r.error.code}: ${r.error.message}`;
}
const text = (o: CasOutput | string) => {
  if (typeof o === 'string') return o;
  if (o.kind === 'value') return toText(o.value.expr);
  if (o.kind === 'list') return o.items.map((i) => toText(i.expr)).join(', ');
  if (o.kind === 'bool') return String(o.value);
  if (o.kind === 'solutions')
    return o.value.solutions
      .map((s) => toText(s.expr))
      .sort()
      .join(', ');
  return JSON.stringify(o.value);
};
/** numeric value of a value result (CAS forms vary, values do not) */
const at = (o: CasOutput | string, vars: Record<string, number> = {}) => {
  if (typeof o === 'string' || o.kind !== 'value') throw new Error(String(text(o)));
  const r = evaluateNumeric(o.value.expr, { variables: new Map(Object.entries(vars)) });
  return r.ok ? r.value : NaN;
};

describe('CAS commands', () => {
  it('algebra', () => {
    expect(at(cas('factor(x^2-5x+6)'), { x: 7 })).toBeCloseTo(20);
    expect(text(cas('factor(x^2-5x+6)'))).toMatch(/x - 2|x - 3/);
    expect(at(cas('expand((x+1)^3)'), { x: 2 })).toBeCloseTo(27);
    expect(at(cas('simplify((x^2-1)/(x-1))'), { x: 5 })).toBeCloseTo(6);
    expect(at(cas('partfrac(1/(x^2-1), x)'), { x: 3 })).toBeCloseTo(1 / 8);
    expect(at(cas('quo(x^3-1, x-1)'), { x: 2 })).toBeCloseTo(7);
    expect(at(cas('rem(x^3+2, x-1)'))).toBeCloseTo(3);
    expect(at(cas('quo(x^3+2, x-1)'), { x: 2 })).toBeCloseTo(7);
    expect(text(cas('degree(3x^5+2x, x)'))).toBe('5');
    expect(text(cas('coeff(3x^2+2x+1, x)'))).toBe('3, 2, 1');
    expect(at(cas('gcd(x^2-1, x^2-2x+1)'), { x: 4 })).toBeCloseTo(3);
    expect(text(cas('gcd(12, 18)'))).toBe('6');
  });

  it('solving', () => {
    expect(text(cas('solve(x^2-5x+6=0, x)'))).toBe('2, 3');
    const sys = cas('solve([x+y=3, x-y=1], [x, y])');
    expect(typeof sys !== 'string' && sys.kind === 'system' && sys.value.length).toBe(1);
    expect(at(cas('nsolve(cos(x)=x, x)'))).toBeCloseTo(0.739085133215, 9);
    expect(at(cas('nsolve(x^3-2, x, 0, 3)'))).toBeCloseTo(Math.cbrt(2), 10);
  });

  it('calculus', () => {
    expect(at(cas('diff(sin(x)^2, x)'), { x: 0.3 })).toBeCloseTo(Math.sin(0.6));
    expect(at(cas('integrate(x^2, x, 0, 1)'))).toBeCloseTo(1 / 3);
    expect(at(cas('limit(sin(x)/x, x, 0)'))).toBeCloseTo(1);
    expect(at(cas('sum(k^2, k, 1, n)'), { n: 10 })).toBeCloseTo(385);
    expect(at(cas('sum(k, k, 1, 100)'))).toBeCloseTo(5050);
    const t = cas('taylor(exp(x), x, 4)');
    expect(at(t, { x: 0.1 })).toBeCloseTo(1 + 0.1 + 0.01 / 2 + 0.001 / 6 + 0.0001 / 24, 12);
    expect(at(cas('taylor(sin(x), x, 3, 1)'), { x: 1 })).toBeCloseTo(Math.sin(1), 12);
    expect(at(cas('laplace(t^2, t, s)'), { s: 2 })).toBeCloseTo(0.25);
  });

  it('integers', () => {
    expect(text(cas('ifactor(360)'))).toBe('2^3*3^2*5');
    expect(text(cas('isprime(97)'))).toBe('true');
    expect(text(cas('nextprime(13)'))).toBe('17');
    expect(text(cas('euler(36)'))).toBe('12');
    expect(text(cas('divisors(12)'))).toBe('1, 2, 3, 4, 6, 12');
    expect(text(cas('iquo(17, 5)'))).toBe('3');
    expect(text(cas('irem(-17, 5)'))).toBe('3');
    expect(cas('ifactor(2.5)')).toMatch(/^domain/);
  });

  it('variables and user functions are inlined', () => {
    const scope: CasScope = {
      variables: new Map<string, Expr>([['a', expr('3')]]),
      functions: new Map([['f', { params: ['t'], body: expr('t^2+a') }]]),
    };
    expect(at(cas('f(x)+a', scope, ['f']), { x: 2 })).toBeCloseTo(10);
    expect(at(cas('diff(f(x), x)', scope, ['f']), { x: 2 })).toBeCloseTo(4);
  });

  it('refuses what it cannot do', () => {
    expect(cas('degree(sin(x), x)')).toMatch(/^unsupported|not-solvable/);
    expect(cas('taylor(exp(x), x, 40)')).toMatch(/^domain/);
    expect(cas('foo(x)', {}, ['foo'])).toMatch(/^unsupported/);
  });
});
