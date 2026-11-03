import { describe, expect, it } from 'vitest';
import { parseText } from '../parser/text-parser';
import { evaluateValue, type ValueScope } from './evaluate-value';
import { type NumberFormat, formatReal, formatValue, valueLatex } from './format';
import { type Value, complex, real } from './value';

function ev(src: string, scope: ValueScope = {}): Value | string {
  const p = parseText(src, { functions: new Set(scope.functions?.keys() ?? []) });
  if (!p.ok) throw new Error(p.error.message);
  const r = evaluateValue(p.value, scope);
  return r.ok ? r.value : r.error.code;
}

function expr(src: string) {
  const p = parseText(src);
  if (!p.ok) throw new Error(p.error.message);
  return p.value;
}

const close = (v: Value | string, re: number, im = 0) => {
  expect(typeof v).not.toBe('string');
  const c = v as Value;
  const [r, i] = c.kind === 'complex' ? [c.re, c.im] : c.kind === 'real' ? [c.v, 0] : [NaN, NaN];
  expect(r).toBeCloseTo(re, 12);
  expect(i).toBeCloseTo(im, 12);
};

const ON: ValueScope = { complexResults: true };

describe('evaluateValue – reals like the real evaluator', () => {
  it.each([
    ['2+3*4', 14],
    ['2^10', 1024],
    ['(-8)^(1/3)', -2],
    ['5!', 120],
    ['sqrt(16)', 4],
    ['ln(e)', 1],
  ])('%s = %d', (src, want) => close(ev(src), want));

  it('uses degrees exactly', () => {
    expect(ev('sin(30)', { angle: 'deg' })).toEqual(real(0.5));
    expect(ev('tan(90)', { angle: 'deg', complexResults: true })).toBe('domain');
  });

  it('keeps real errors without complex results', () => {
    expect(ev('sqrt(-4)')).toBe('domain');
    const r = evaluateValue({ type: 'call', name: 'sqrt', args: [{ type: 'num', value: '-4' }] });
    expect(!r.ok && r.error.message).toBe('the result is complex (complex results are off)');
    expect(ev('ln(-1)')).toBe('domain');
    expect(ev('1/0', ON)).toBe('division-by-zero');
    expect(ev('0^(-1)', ON)).toBe('division-by-zero');
    expect(ev('(-1)!', ON)).toBe('domain');
    expect(ev('foo')).toBe('unknown-symbol');
  });
});

describe('evaluateValue – complex numbers', () => {
  it('typing i always gives complex values', () => {
    expect(ev('i^2')).toEqual(real(-1));
    expect(ev('(3+4i)*(3-4i)')).toEqual(real(25));
    close(ev('(1+2i)/(3-4i)'), -0.2, 0.4);
    expect(ev('abs(3+4i)')).toEqual(real(5));
    expect(ev('conj(1+2i)')).toEqual(complex(1, -2));
    expect(ev('re(5-2i)')).toEqual(real(5));
    expect(ev('im(5-2i)')).toEqual(real(-2));
    close(ev('arg(i)'), Math.PI / 2);
    close(ev('arg(i)', { angle: 'deg' }), 90);
  });

  it('real functions give complex results only when allowed', () => {
    expect(ev('sqrt(-4)', ON)).toEqual(complex(0, 2));
    close(ev('ln(-1)', ON), 0, Math.PI);
    close(ev('(-4)^0.5', ON), 0, 2);
    close(ev('arcsin(2)', ON), Math.PI / 2, -1.3169578969248166);
    close(ev('log(-100)', ON), 2, Math.PI / Math.LN10);
  });

  it('removes rounding noise: e^(iπ) = −1', () => {
    expect(ev('e^(i*pi)')).toEqual(real(-1));
    expect(ev('exp(i*pi/2)')).toEqual(complex(0, 1));
  });

  it('property: sqrt(z)² = z and exp(ln z) = z on sample points', () => {
    for (const [a, b] of [
      [3, 4],
      [-2, 0.5],
      [-7, -1],
      [0.25, -9],
    ]) {
      close(ev(`sqrt(${a}+(${b})*i)^2`), a, b);
      close(ev(`exp(ln(${a}+(${b})*i))`), a, b);
    }
  });

  it('relations are tests', () => {
    expect(ev('2+2=4')).toEqual(real(1));
    expect(ev('0.1+0.2=0.3')).toEqual(real(1));
    expect(ev('3<2')).toEqual(real(0));
    expect(ev('i<1')).toBe('domain');
  });

  it('uses variables, Ans and user functions with complex arguments', () => {
    const scope: ValueScope = {
      variables: new Map<string, Value>([
        ['A', real(5)],
        ['Z', complex(1, 1)],
        ['Ans', real(2)],
      ]),
      functions: new Map([['f', { params: ['x'], body: expr('x^2+1') }]]),
    };
    expect(ev('A*Ans', scope)).toEqual(real(10));
    expect(ev('Z^2', scope)).toEqual(complex(0, 2));
    expect(ev('f(i)', scope)).toEqual(real(0));
    expect(ev('f(3)', scope)).toEqual(real(10));
  });
});

describe('format', () => {
  const std: NumberFormat = { mode: 'standard', digits: 4, decimal: '.' };
  it.each([
    [0.1 + 0.2, '0.3'],
    [1 / 3, '0.333333333333'],
    [2 / 3, '0.666666666667'],
    [-0, '0'],
    [123456789012, '123456789012'],
    [1234567890123, '1.23456789012E12'],
    [0.000001, '0.000001'],
    [0.0000001234, '1.234E-7'],
    [-42.5, '-42.5'],
  ])('standard %d → %s', (x, want) => expect(formatReal(x, std)).toBe(want));

  it.each([
    [{ mode: 'fixed', digits: 2 }, 1.005, '1.01'],
    [{ mode: 'fixed', digits: 2 }, -0.001, '0.00'],
    [{ mode: 'fixed', digits: 0 }, 2.5, '3'],
    [{ mode: 'fixed', digits: 3 }, 0, '0.000'],
    [{ mode: 'sci', digits: 3 }, 12345, '1.235E4'],
    [{ mode: 'sci', digits: 2 }, 0, '0.00E0'],
    [{ mode: 'eng', digits: 2 }, 12345, '12.35E3'],
    [{ mode: 'eng', digits: 2 }, 0.00012, '120.00E-6'],
    [{ mode: 'eng', digits: 1 }, 999.97, '1.0E3'],
  ] as const)('%j %d → %s', (f, x, want) =>
    expect(formatReal(x, { ...f, decimal: '.' } as NumberFormat)).toBe(want),
  );

  it('decimal comma, complex rectangular and polar, LaTeX', () => {
    expect(formatReal(-2.5, { ...std, decimal: ',' })).toBe('-2,5');
    expect(formatValue(complex(3, -4), { format: std })).toBe('3-4*i');
    expect(formatValue(complex(0, 1), { format: std })).toBe('i');
    expect(formatValue(complex(0, -2), { format: std })).toBe('-2*i');
    expect(formatValue(complex(3, 4), { format: std, complexForm: 'polar', angle: 'deg' })).toBe(
      '5∠53.1301023542',
    );
    expect(valueLatex(real(1.5e-7), { format: std })).toBe('1.5\\times10^{-7}');
    expect(valueLatex(complex(1, 2), { format: std })).toBe('1+2\\,i');
    expect(valueLatex(real(2.5), { format: { ...std, decimal: ',' } })).toBe('2{,}5');
  });
});
