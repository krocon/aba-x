/**
 * Display of values (prompt 027): number formats like a calculator – Standard (up to 12 significant
 * digits, scientific outside 10⁻⁶ ≤ |x| < 10¹²), Fixed, Scientific, Engineering – decimal point or
 * comma, complex numbers as a+b·i or r∠θ. Plain text and LaTeX. Pure.
 */
import type { AngleMode } from '../numeric/evaluate';
import { C } from './complex';
import type { Value } from './value';

export type FormatMode = 'standard' | 'fixed' | 'sci' | 'eng';

export interface NumberFormat {
  readonly mode: FormatMode;
  /** digits after the decimal point (fixed, sci, eng), 0–11 */
  readonly digits: number;
  readonly decimal: '.' | ',';
}

export type ComplexForm = 'rect' | 'polar';

export interface DisplayOptions {
  readonly format: NumberFormat;
  readonly complexForm?: ComplexForm;
  readonly angle?: AngleMode;
}

export const STANDARD_FORMAT: NumberFormat = { mode: 'standard', digits: 4, decimal: '.' };

/** A real number as mantissa and exponent (exponent null = no E-notation). */
interface Parts {
  sign: string;
  mantissa: string;
  exponent: number | null;
}

/** Rounds half away from zero at `d` decimals (1.005 → 1.01, unlike toFixed). */
function roundTo(x: number, d: number): number {
  const s = Math.sign(x);
  const r = Number(`${Math.round(Number(`${Math.abs(x)}e${d}`))}e-${d}`);
  return s * r;
}

function trimZeros(m: string): string {
  return m.includes('.') ? m.replace(/\.?0+$/, '') : m;
}

function sci(x: number, digits: number, trim: boolean): Parts {
  const [m, e] = Math.abs(x).toExponential(digits).split('e');
  return { sign: x < 0 ? '-' : '', mantissa: trim ? trimZeros(m) : m, exponent: Number(e) };
}

function parts(x: number, f: NumberFormat): Parts {
  if (x === 0 || Object.is(x, -0)) {
    const zero = f.mode !== 'standard' && f.digits > 0 ? `0.${'0'.repeat(f.digits)}` : '0';
    return { sign: '', mantissa: zero, exponent: f.mode === 'sci' || f.mode === 'eng' ? 0 : null };
  }
  const a = Math.abs(x);
  const sign = x < 0 ? '-' : '';
  switch (f.mode) {
    case 'standard': {
      // 12 significant digits removes binary noise (0.1 + 0.2 = 0.3)
      const r = Number(a.toPrecision(12));
      if (r >= 1e12 || r < 1e-6) return sci(Number(sign + r), 11, true);
      return {
        sign,
        mantissa: trimZeros(r.toFixed(Math.max(0, 11 - Math.floor(Math.log10(r))))),
        exponent: null,
      };
    }
    case 'fixed': {
      if (a >= 1e12) return sci(x, f.digits, false);
      const r = roundTo(a, f.digits);
      if (r === 0 && a !== 0 && a < 1e-11) return sci(x, f.digits, false);
      return { sign: r === 0 ? '' : sign, mantissa: r.toFixed(f.digits), exponent: null };
    }
    case 'sci':
      return sci(x, f.digits, false);
    case 'eng': {
      let e = Math.floor(Math.log10(a));
      e -= ((e % 3) + 3) % 3;
      let m = a / 10 ** e;
      let text = m.toFixed(f.digits);
      if (Number(text) >= 1000) {
        e += 3;
        m /= 1000;
        text = m.toFixed(f.digits);
      }
      return { sign, mantissa: text, exponent: e };
    }
  }
}

function realText(x: number, f: NumberFormat): string {
  const p = parts(x, f);
  const m = f.decimal === ',' ? p.mantissa.replace('.', ',') : p.mantissa;
  return p.sign + m + (p.exponent === null ? '' : `E${p.exponent}`);
}

function realLatex(x: number, f: NumberFormat): string {
  const p = parts(x, f);
  const m = f.decimal === ',' ? p.mantissa.replace('.', '{,}') : p.mantissa;
  return p.sign + m + (p.exponent === null ? '' : `\\times10^{${p.exponent}}`);
}

/** −0 shows as 0; a value whose display is 0 has no sign. */
export function formatReal(x: number, f: NumberFormat = STANDARD_FORMAT): string {
  return realText(x, f);
}

function angleOf(re: number, im: number, angle: AngleMode | undefined): number {
  const t = Math.atan2(im, re);
  return angle === 'deg' ? (t * 180) / Math.PI : t;
}

/** Plain text: `3+4*i`, `5∠53.1301023542`, `−2.5E−7`. */
export function formatValue(v: Value, o: DisplayOptions): string {
  if (v.kind === 'real') return realText(v.v, o.format);
  if (o.complexForm === 'polar') {
    const r = C.abs(v);
    return `${realText(r, o.format)}∠${realText(angleOf(v.re, v.im, o.angle), o.format)}`;
  }
  const re = v.re === 0 ? '' : realText(v.re, o.format);
  const imAbs = realText(Math.abs(v.im), o.format);
  const im = imAbs === '1' ? 'i' : `${imAbs}*i`;
  if (!re) return v.im < 0 ? `-${im}` : im;
  return `${re}${v.im < 0 ? '-' : '+'}${im}`;
}

/** LaTeX for the display: `3+4i`, `5\angle 53.13`, `1.5\times10^{-7}`. */
export function valueLatex(v: Value, o: DisplayOptions): string {
  if (v.kind === 'real') return realLatex(v.v, o.format);
  if (o.complexForm === 'polar') {
    const r = C.abs(v);
    const t = angleOf(v.re, v.im, o.angle);
    return `${realLatex(r, o.format)}\\angle ${realLatex(t, o.format)}${o.angle === 'deg' ? '^{\\circ}' : ''}`;
  }
  const imAbs = realLatex(Math.abs(v.im), o.format);
  const im = imAbs === '1' ? 'i' : `${imAbs}\\,i`;
  if (v.re === 0) return v.im < 0 ? `-${im}` : im;
  return `${realLatex(v.re, o.format)}${v.im < 0 ? '-' : '+'}${im}`;
}
