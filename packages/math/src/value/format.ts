/**
 * Display of values (prompt 027): number formats like a calculator – Standard (up to 12 significant
 * digits, scientific outside 10⁻⁶ ≤ |x| < 10¹²), Fixed, Scientific, Engineering – decimal point or
 * comma, complex numbers as a+b·i or r∠θ. Plain text and LaTeX. Pure.
 */
import type { AngleMode } from '../numeric/evaluate';
import { C } from './complex';
import { unitInput, unitText } from '../units/units';
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

const intText = (v: { v: string; base: 2 | 8 | 10 | 16 }) =>
  `#${BigInt(v.v).toString(v.base).toUpperCase()}${{ 2: 'b', 8: 'o', 10: 'd', 16: 'h' }[v.base]}`;

/** Plain text: `3+4*i`, `5∠53.1301023542`, `−2.5E−7`, `27.7777777778 m/s`, `#FFh`. */
export function formatValue(v: Value, o: DisplayOptions): string {
  if (v.kind === 'real') return realText(v.v, o.format);
  if (v.kind === 'unit') return `${realText(v.v, o.format)} ${unitText(v.u)}`;
  if (v.kind === 'int') return intText(v);
  if (v.kind === 'list') return `{${v.items.map((x) => formatValue(x, o)).join(', ')}}`;
  if (v.kind === 'matrix')
    return `[${v.rows.map((r) => `[${r.map((x) => realText(x, o.format)).join(', ')}]`).join(', ')}]`;
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
  if (v.kind === 'unit') return `${realLatex(v.v, o.format)}\\,${unitText(v.u, true)}`;
  if (v.kind === 'int') return `\\#\\mathrm{${intText(v).slice(1)}}`;
  if (v.kind === 'list') {
    return `\\left\\lbrace ${v.items.map((x) => valueLatex(x, o)).join(',\\,')}\\right\\rbrace`;
  }
  if (v.kind === 'matrix') {
    const body = v.rows.map((r) => r.map((x) => realLatex(x, o.format)).join('&')).join('\\\\');
    return `\\begin{pmatrix}${body}\\end{pmatrix}`;
  }
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

/**
 * A value as text input that reads back to the same value (full precision): `1.5*10^(20)`,
 * `27.7777777778*_m/_s`, `#FFh`, `3-4*i`.
 */
export function valueInput(v: Value): string {
  const full: NumberFormat = { mode: 'standard', digits: 0, decimal: '.' };
  const n = (x: number) => realText(x, full).replace(/E(-?\d+)/, '*10^($1)');
  switch (v.kind) {
    case 'real':
      return n(v.v);
    case 'int':
      return intText(v);
    case 'unit':
      return `${n(v.v)}*${unitInput(v.u)}`;
    case 'list':
      return `{${v.items.map(valueInput).join(', ')}}`;
    case 'matrix':
      return `[${v.rows.map((r) => `[${r.map(n).join(', ')}]`).join(', ')}]`;
    case 'complex': {
      const im = `${n(Math.abs(v.im))}*i`;
      if (v.re === 0) return v.im < 0 ? `-${im}` : im;
      return `${n(v.re)}${v.im < 0 ? '-' : '+'}${im}`;
    }
  }
}
