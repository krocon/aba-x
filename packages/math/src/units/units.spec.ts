import { describe, expect, it } from 'vitest';
import { parseLatex } from '../parser/latex-parser';
import { parseText } from '../parser/text-parser';
import { toLatex, toText } from '../serializer';
import { type ValueScope, evaluateValue } from '../value/evaluate-value';
import { formatValue, valueInput } from '../value/format';
import type { Value } from '../value/value';
import { CONSTANTS } from './constants.data';
import { convertValue, resolveUnit, unitText } from './units';

function ev(src: string, scope: ValueScope = {}): Value | string {
  const p = parseText(src);
  if (!p.ok) return `parse: ${p.error.message}`;
  const r = evaluateValue(p.value, scope);
  return r.ok ? r.value : `${r.error.code}: ${r.error.message}`;
}
const show = (src: string, scope: ValueScope = {}) => {
  const v = ev(src, scope);
  return typeof v === 'string'
    ? v
    : formatValue(v, { format: { mode: 'standard', digits: 0, decimal: '.' } });
};
const conv = (v: number, a: string, b: string) => {
  const r = convertValue(v, { [a]: 1 }, { [b]: 1 });
  return r.ok ? r.value : NaN;
};

describe('units', () => {
  it('resolves names and prefixes (exact names first)', () => {
    expect(resolveUnit('km')?.factor).toBe(1000);
    expect(resolveUnit('min')?.factor).toBe(60);
    expect(resolveUnit('cd')?.dims[6]).toBe(1);
    expect(resolveUnit('mm')?.factor).toBeCloseTo(1e-3, 15);
    expect(resolveUnit('kWh')?.factor).toBe(3.6e6);
    expect(resolveUnit('um')?.label).toBe('µm');
    expect(resolveUnit('kin')).toBeNull(); // inches take no prefix
    expect(resolveUnit('xyz')).toBeNull();
  });

  it.each([
    [1, 'in', 'cm', 2.54],
    [1, 'mi', 'km', 1.609344],
    [1, 'lb', 'kg', 0.45359237],
    [1, 'atm', 'Pa', 101325],
    [1, 'kcal', 'J', 4184],
    [1, 'kWh', 'MJ', 3.6],
    [1, 'hp', 'W', 745.6998715822702],
    [1, 'gal', 'l', 3.785411784],
    [1, 'eV', 'J', 1.602176634e-19],
    [1, 'yr', 'd', 365.25],
    [180, 'deg', 'rad', Math.PI],
    [1, 'mmHg', 'torr', 1.000000142466321],
    [1, 'psi', 'kPa', 6.894757293168361],
    [0, 'degC', 'K', 273.15],
    [100, 'degC', 'degF', 212],
    [-40, 'degF', 'degC', -40],
    [0, 'K', 'degF', -459.67],
    [491.67, 'degR', 'K', 273.15],
  ])('%d %s = %d %s', (v, a, b, want) => expect(conv(v, a, b)).toBeCloseTo(want, 9));

  it('computes with quantities and checks dimensions', () => {
    expect(show('convert(100_km/_h, 1_m/_s)')).toBe('27.7777777778 m/s');
    expect(show('5_m+20_cm')).toBe('5.2 m');
    expect(show('20_degC+5_K')).toBe('25 °C'); // a difference, no offset
    expect(show('3_m*4_m')).toBe('12 m^2');
    expect(show('sqrt(16_m^2)')).toBe('4 m');
    expect(show('(10_m)/(2_s)')).toBe('5 m/s');
    expect(show('(6_m)/(2_m)')).toBe('3');
    expect(show('1_m+1_s')).toMatch(/^domain/);
    expect(show('mksa(1_N)')).toBe('1 m·kg/s^2');
    expect(show('usimplify(2_kg*3_m/_s^2)')).toBe('6 N');
    expect(show('ufactor(1_J, 1_N)')).toBe('1 N·m');
    expect(show('sin(30_deg)', { angle: 'rad' })).toBe('0.5');
    expect(show('1_km>999_m')).toBe('1');
    expect(show('5_xyz')).toMatch(/^unknown-symbol/);
  });

  it('reads units in LaTeX and writes them back', () => {
    const p = parseLatex('5\\mathrm{\\_km}/\\mathrm{\\_h}');
    expect(p.ok && toText(p.value)).toBe('5*_km/_h');
    const t = parseText('5*_km');
    expect(t.ok && toLatex(t.value)).toContain('\\mathrm{\\_km}');
    expect(parseLatex('5_{m}').ok).toBe(true); // MathLive subscript after a number
    const v = ev('convert(1_mi, 1_km)') as Value;
    expect(ev(valueInput(v))).toEqual(v);
    expect(unitText({ m: 1, s: -2 }, true)).toBe('\\mathrm{m}/\\mathrm{s}^{2}');
  });

  it('constants: CODATA values with parseable units', () => {
    const c = CONSTANTS.find((x) => x.name === 'c')!;
    expect(c.value).toBe(299792458);
    for (const k of CONSTANTS) {
      if (!k.unit) continue;
      expect(typeof ev(`${k.value}*${k.unit}`), k.name).not.toBe('string');
    }
  });
});

describe('based integers in the evaluator', () => {
  const S: ValueScope = { integer: { bits: 8, signed: false, base: 16 } };
  it.each([
    ['#FFh+#1b', '#0h'],
    ['#FFh+1', '#0h'],
    ['#Ah*3', '#1Eh'],
    ['#7h/2', '#3h'],
    ['bitand(#Ch, #Ah)', '#8h'],
    ['bin(#Ah)', '#1010b'],
    ['bitnot(#0h)', '#FFh'],
    ['bitrl(#81h)', '#3h'],
    ['r2b(200)', '#C8h'],
    ['b2r(#FFh)', '255'],
    ['#10h+0.5', '16.5'],
    ['#10h=16', '1'],
  ])('%s = %s', (src, want) => expect(show(src, S)).toBe(want));

  it('signed word size and parsing', () => {
    expect(show('b2r(#FFh)', { integer: { bits: 8, signed: true, base: 16 } })).toBe('-1');
    expect(show('#12g')).toMatch(/^syntax/);
    const p = parseLatex('\\#FFh+1');
    expect(p.ok && toText(p.value)).toBe('#FFh + 1');
    expect(parseLatex('\\#\\mathrm{1010b}').ok).toBe(true);
  });
});
