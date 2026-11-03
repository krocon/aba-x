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

/** A number with units (prompt 031): `27.8 m/s` = { v: 27.8, u: { m: 1, s: -1 } }. */
export interface Quantity {
  readonly kind: 'unit';
  readonly v: number;
  readonly u: Readonly<Record<string, number>>;
}

/** A based integer (prompt 031), masked to the word size, stored as decimal digits. */
export interface BasedInt {
  readonly kind: 'int';
  readonly v: string;
  readonly base: 2 | 8 | 10 | 16;
}

export type Value = Real | Complex | Quantity | BasedInt;

export const real = (v: number): Real => ({ kind: 'real', v });
export const complex = (re: number, im: number): Complex => ({ kind: 'complex', re, im });
export const quantity = (v: number, u: Readonly<Record<string, number>>): Value =>
  Object.keys(u).length ? { kind: 'unit', v, u } : real(v);
export const based = (v: bigint, base: BasedInt['base']): BasedInt => ({
  kind: 'int',
  v: v.toString(),
  base,
});

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

/** Real or complex as complex (callers check units and integers first). */
export function asComplex(v: Value): Complex {
  if (v.kind === 'complex') return v;
  if (v.kind === 'int') return complex(Number(v.v), 0);
  return complex(v.v, 0);
}

export function isFiniteValue(v: Value): boolean {
  switch (v.kind) {
    case 'complex':
      return Number.isFinite(v.re) && Number.isFinite(v.im);
    case 'int':
      return true;
    default:
      return Number.isFinite(v.v);
  }
}
