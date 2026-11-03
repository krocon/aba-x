/**
 * Values of the general evaluator (prompt 027, ABA-T1 home view): real and complex numbers – lists,
 * matrices, units and based integers join in later prompts. Plain data, structured-clone safe.
 */

export interface Real {
  readonly kind: 'real';
  readonly v: number;
}

export interface Complex {
  readonly kind: 'complex';
  readonly re: number;
  readonly im: number;
}

export type Value = Real | Complex;

export const real = (v: number): Real => ({ kind: 'real', v });
export const complex = (re: number, im: number): Complex => ({ kind: 'complex', re, im });

/**
 * Rounding noise of the complex functions (e^{iπ} = −1 + 1.2·10⁻¹⁶ i) is removed: a part smaller
 * than 10⁻¹⁴ of the other one is 0. A complex number without imaginary part becomes real again.
 */
export function normalize(v: Value): Value {
  if (v.kind !== 'complex') return v;
  const tiny = 1e-14 * Math.max(Math.abs(v.re), Math.abs(v.im));
  const re = Math.abs(v.re) < tiny ? 0 : v.re;
  const im = Math.abs(v.im) < tiny ? 0 : v.im;
  return im === 0 ? real(re) : complex(re, im);
}

export function asComplex(v: Value): Complex {
  return v.kind === 'complex' ? v : complex(v.v, 0);
}

export function isFiniteValue(v: Value): boolean {
  return v.kind === 'real' ? Number.isFinite(v.v) : Number.isFinite(v.re) && Number.isFinite(v.im);
}
