/**
 * Quantities with units (prompt 031), pure. A unit expression is a product of named units with
 * integer exponents (`{ km: 1, h: -1 }`); names resolve through the unit table, with SI prefixes
 * for metric units. Arithmetic keeps the units as written; addition converts the right operand into
 * the units of the left one and needs equal dimensions. Temperatures with an offset (°C, °F) are
 * converted affinely only by `convert` between two pure temperatures; in all other arithmetic they
 * count as temperature differences.
 */
import { type MathResult, fail, ok } from '../result';
import { BASE, DERIVED, type Dims, PREFIXES, UNITS, type UnitDef } from './units.data';

export type UnitExpr = Readonly<Record<string, number>>;

export interface Resolved {
  factor: number;
  dims: Dims;
  offset?: number;
  label: string;
}

const ZERO: Dims = [0, 0, 0, 0, 0, 0, 0];

/** `km` → kilo·metre; exact names win (`min` is a minute, `cd` a candela, `Pa` a pascal). */
export function resolveUnit(name: string): Resolved | null {
  const exact = UNITS[name];
  if (exact)
    return {
      factor: exact.factor,
      dims: exact.dims,
      offset: exact.offset,
      label: exact.label ?? name,
    };
  for (const [p, f] of Object.entries(PREFIXES).sort((a, b) => b[0].length - a[0].length)) {
    if (!name.startsWith(p)) continue;
    const base: UnitDef | undefined = UNITS[name.slice(p.length)];
    if (base?.prefix) {
      const lbl = (p === 'u' ? 'µ' : p) + (base.label ?? name.slice(p.length));
      return { factor: f * base.factor, dims: base.dims, label: lbl };
    }
  }
  return null;
}

export function isUnitName(name: string): boolean {
  return resolveUnit(name) !== null;
}

function addDims(a: Dims, b: Dims, k = 1): Dims {
  return a.map((x, i) => x + k * b[i]) as unknown as Dims;
}

/** Factor to SI and dimension of a unit expression; null if a name is unknown. */
export function measure(u: UnitExpr): { factor: number; dims: Dims } | null {
  let factor = 1;
  let dims = ZERO;
  for (const [name, exp] of Object.entries(u)) {
    const r = resolveUnit(name);
    if (!r) return null;
    factor *= r.factor ** exp;
    dims = addDims(dims, r.dims, exp);
  }
  return { factor, dims };
}

export const sameDims = (a: Dims, b: Dims) => a.every((x, i) => x === b[i]);
export const dimensionless = (d: Dims) => d.every((x) => x === 0);

export function multiplyUnits(a: UnitExpr, b: UnitExpr, k = 1): UnitExpr {
  const out: Record<string, number> = { ...a };
  for (const [n, e] of Object.entries(b)) {
    const v = (out[n] ?? 0) + k * e;
    if (v === 0) delete out[n];
    else out[n] = v;
  }
  return out;
}

export function powUnits(a: UnitExpr, n: number): MathResult<UnitExpr> {
  const out: Record<string, number> = {};
  for (const [name, e] of Object.entries(a)) {
    const v = e * n;
    if (!Number.isInteger(Math.round(v * 1e9) / 1e9) || Math.abs(v - Math.round(v)) > 1e-9) {
      return fail('domain', 'the power of a unit must give whole exponents');
    }
    if (Math.round(v) !== 0) out[name] = Math.round(v);
  }
  return ok(out);
}

/** A single temperature unit with an offset (°C, °F) to the first power? */
function pureTemperature(u: UnitExpr): Resolved | null {
  const names = Object.keys(u);
  if (names.length !== 1 || u[names[0]] !== 1) return null;
  const r = resolveUnit(names[0]);
  return r && r.dims[4] === 1 && r.dims.every((x, i) => i === 4 || x === 0) ? r : null;
}

/** Converts v·from into the units `to`. */
export function convertValue(v: number, from: UnitExpr, to: UnitExpr): MathResult<number> {
  const a = measure(from);
  const b = measure(to);
  if (!a || !b) return fail('unknown-symbol', 'unknown unit');
  if (!sameDims(a.dims, b.dims)) return fail('domain', 'the units are not compatible');
  const ta = pureTemperature(from);
  const tb = pureTemperature(to);
  if (ta && tb) {
    // absolute temperatures: K = factor·x + offset
    const kelvin = ta.factor * v + (ta.offset ?? 0);
    return ok((kelvin - (tb.offset ?? 0)) / tb.factor);
  }
  return ok((v * a.factor) / b.factor);
}

/** SI base units of a dimension. */
export function baseUnits(d: Dims): UnitExpr {
  const out: Record<string, number> = {};
  d.forEach((e, i) => {
    if (e) out[BASE[i]] = e;
  });
  return out;
}

/** A named derived SI unit with this dimension (N, J, W, Pa, …), or null. */
export function derivedFor(d: Dims): string | null {
  return DERIVED.find((n) => sameDims(UNITS[n].dims, d)) ?? null;
}

/** Display: `km/h`, `m²·kg`, `1/s` (labels like °C, Ω, µm). */
export function unitText(u: UnitExpr, latex = false): string {
  const name = (n: string) => {
    const l = resolveUnit(n)?.label ?? n;
    return latex
      ? `\\mathrm{${l.replace(/°/g, '{}^{\\circ}').replace(/Ω/g, '\\Omega').replace(/µ/g, '\\mu ')}}`
      : l;
  };
  const pow = (n: string, e: number) =>
    e === 1 ? name(n) : latex ? `${name(n)}^{${e}}` : `${name(n)}^${e}`;
  const num = Object.entries(u).filter(([, e]) => e > 0);
  const den = Object.entries(u).filter(([, e]) => e < 0);
  const join = latex ? '\\cdot ' : '·';
  const top = num.map(([n, e]) => pow(n, e)).join(join) || '1';
  if (!den.length) return top;
  const bottom = den.map(([n, e]) => pow(n, -e)).join(join);
  return den.length > 1 && !latex ? `${top}/(${bottom})` : `${top}/${bottom}`;
}

/** Unit expression as input text: `_km/_h`, `_m^2*_kg`. */
export function unitInput(u: UnitExpr): string {
  const num = Object.entries(u).filter(([, e]) => e > 0);
  const den = Object.entries(u).filter(([, e]) => e < 0);
  const f = ([n, e]: [string, number]) => `_${n}${Math.abs(e) === 1 ? '' : `^${Math.abs(e)}`}`;
  const top = num.map(f).join('*') || '1';
  if (!den.length) return top;
  return `${top}/${den.length > 1 ? `(${den.map(f).join('*')})` : f(den[0])}`;
}
