/**
 * Unit table (prompt 031). Each unit: factor to SI, dimension exponents over the SI base
 * [m, kg, s, A, K, mol, cd], an offset for temperatures (K = factor·x + offset), whether SI prefixes
 * apply, a display label and a menu category. Exact definitions where they exist (inch = 0.0254 m,
 * pound = 0.45359237 kg, calorie = 4.184 J, eV = 1.602176634·10⁻¹⁹ J since 2019, …).
 */

/** Dimension exponents: m, kg, s, A, K, mol, cd. */
export type Dims = readonly [number, number, number, number, number, number, number];

export interface UnitDef {
  factor: number;
  dims: Dims;
  offset?: number;
  prefix?: boolean;
  label?: string;
  category: string;
}

const D = (m = 0, kg = 0, s = 0, A = 0, K = 0, mol = 0, cd = 0): Dims => [m, kg, s, A, K, mol, cd];
const L = D(1);
const M = D(0, 1);
const T = D(0, 0, 1);
const NONE = D();
const u = (
  factor: number,
  dims: Dims,
  category: string,
  extra: Partial<UnitDef> = {},
): UnitDef => ({
  factor,
  dims,
  category,
  ...extra,
});

const day = 86400;
const lb = 0.45359237;
const g0 = 9.80665;
const inch = 0.0254;

export const UNITS: Record<string, UnitDef> = {
  // length
  m: u(1, L, 'length', { prefix: true }),
  in: u(inch, L, 'length'),
  ft: u(12 * inch, L, 'length'),
  yd: u(36 * inch, L, 'length'),
  mi: u(1609.344, L, 'length'),
  nmi: u(1852, L, 'length'),
  Ang: u(1e-10, L, 'length', { label: 'Å' }),
  au: u(149597870700, L, 'length'),
  ly: u(9460730472580800, L, 'length'),
  pc: u(149597870700 * (648000 / Math.PI), L, 'length'),
  // area, volume
  ha: u(1e4, D(2), 'area'),
  acre: u(4046.8564224, D(2), 'area'),
  l: u(1e-3, D(3), 'volume', { prefix: true, label: 'L' }),
  gal: u(3.785411784e-3, D(3), 'volume'),
  qt: u(3.785411784e-3 / 4, D(3), 'volume'),
  pt: u(3.785411784e-3 / 8, D(3), 'volume'),
  cup: u(3.785411784e-3 / 16, D(3), 'volume'),
  floz: u(3.785411784e-3 / 128, D(3), 'volume', { label: 'fl oz' }),
  // time
  s: u(1, T, 'time', { prefix: true }),
  min: u(60, T, 'time'),
  h: u(3600, T, 'time'),
  d: u(day, T, 'time'),
  wk: u(7 * day, T, 'time'),
  yr: u(365.25 * day, T, 'time'),
  Hz: u(1, D(0, 0, -1), 'time', { prefix: true }),
  // speed
  mph: u(1609.344 / 3600, D(1, 0, -1), 'speed'),
  knot: u(1852 / 3600, D(1, 0, -1), 'speed', { label: 'kn' }),
  c0: u(299792458, D(1, 0, -1), 'speed', { label: 'c' }),
  // mass
  g: u(1e-3, M, 'mass', { prefix: true }),
  t: u(1000, M, 'mass'),
  lb: u(lb, M, 'mass'),
  oz: u(lb / 16, M, 'mass'),
  Da: u(1.6605390666e-27, M, 'mass', { label: 'u' }),
  // force
  N: u(1, D(1, 1, -2), 'force', { prefix: true }),
  dyn: u(1e-5, D(1, 1, -2), 'force'),
  lbf: u(lb * g0, D(1, 1, -2), 'force'),
  kgf: u(g0, D(1, 1, -2), 'force'),
  // energy
  J: u(1, D(2, 1, -2), 'energy', { prefix: true }),
  Wh: u(3600, D(2, 1, -2), 'energy', { prefix: true }),
  cal: u(4.184, D(2, 1, -2), 'energy', { prefix: true }),
  eV: u(1.602176634e-19, D(2, 1, -2), 'energy', { prefix: true }),
  Btu: u(1055.05585262, D(2, 1, -2), 'energy'),
  erg: u(1e-7, D(2, 1, -2), 'energy'),
  // power
  W: u(1, D(2, 1, -3), 'power', { prefix: true }),
  hp: u(745.6998715822702, D(2, 1, -3), 'power'),
  // pressure
  Pa: u(1, D(-1, 1, -2), 'pressure', { prefix: true }),
  bar: u(1e5, D(-1, 1, -2), 'pressure', { prefix: true }),
  atm: u(101325, D(-1, 1, -2), 'pressure'),
  psi: u((lb * g0) / (inch * inch), D(-1, 1, -2), 'pressure'),
  mmHg: u(133.322387415, D(-1, 1, -2), 'pressure'),
  torr: u(101325 / 760, D(-1, 1, -2), 'pressure', { label: 'Torr' }),
  // temperature
  K: u(1, D(0, 0, 0, 0, 1), 'temperature', { prefix: true }),
  degC: u(1, D(0, 0, 0, 0, 1), 'temperature', { offset: 273.15, label: '°C' }),
  degF: u(5 / 9, D(0, 0, 0, 0, 1), 'temperature', { offset: (459.67 * 5) / 9, label: '°F' }),
  degR: u(5 / 9, D(0, 0, 0, 0, 1), 'temperature', { label: '°R' }),
  // electricity
  A: u(1, D(0, 0, 0, 1), 'electricity', { prefix: true }),
  C: u(1, D(0, 0, 1, 1), 'electricity', { prefix: true }),
  V: u(1, D(2, 1, -3, -1), 'electricity', { prefix: true }),
  Ohm: u(1, D(2, 1, -3, -2), 'electricity', { prefix: true, label: 'Ω' }),
  S: u(1, D(-2, -1, 3, 2), 'electricity', { prefix: true }),
  F: u(1, D(-2, -1, 4, 2), 'electricity', { prefix: true }),
  H: u(1, D(2, 1, -2, -2), 'electricity', { prefix: true }),
  Wb: u(1, D(2, 1, -2, -1), 'electricity', { prefix: true }),
  T: u(1, D(0, 1, -2, -1), 'electricity', { prefix: true }),
  // amount, light
  mol: u(1, D(0, 0, 0, 0, 0, 1), 'amount', { prefix: true }),
  cd: u(1, D(0, 0, 0, 0, 0, 0, 1), 'light', { prefix: true }),
  lm: u(1, D(0, 0, 0, 0, 0, 0, 1), 'light', { prefix: true }),
  lx: u(1, D(-2, 0, 0, 0, 0, 0, 1), 'light', { prefix: true }),
  // radiation
  Bq: u(1, D(0, 0, -1), 'radiation', { prefix: true }),
  Ci: u(3.7e10, D(0, 0, -1), 'radiation'),
  Gy: u(1, D(2, 0, -2), 'radiation', { prefix: true }),
  Sv: u(1, D(2, 0, -2), 'radiation', { prefix: true }),
  // viscosity
  P: u(0.1, D(-1, 1, -1), 'viscosity', { prefix: true }),
  St: u(1e-4, D(2, 0, -1), 'viscosity', { prefix: true }),
  // angle (dimensionless)
  rad: u(1, NONE, 'angle', { prefix: true }),
  deg: u(Math.PI / 180, NONE, 'angle', { label: '°' }),
  arcmin: u(Math.PI / 10800, NONE, 'angle', { label: '′' }),
  arcsec: u(Math.PI / 648000, NONE, 'angle', { label: '″' }),
  grad: u(Math.PI / 200, NONE, 'angle', { label: 'gon' }),
};

export const PREFIXES: Record<string, number> = {
  Y: 1e24,
  Z: 1e21,
  E: 1e18,
  P: 1e15,
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  h: 1e2,
  da: 1e1,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  u: 1e-6,
  µ: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
  a: 1e-18,
  z: 1e-21,
  y: 1e-24,
};

/** Named SI units that `usimplify` may produce, by dimension. */
export const DERIVED = ['N', 'J', 'W', 'Pa', 'C', 'V', 'Ohm', 'S', 'F', 'H', 'Wb', 'T', 'Hz'];

/** SI base units in dimension order. */
export const BASE = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd'];

/** Menu order (Units key). */
export const UNIT_MENU: Record<string, string[]> = {
  length: ['m', 'cm', 'mm', 'km', 'in', 'ft', 'yd', 'mi', 'nmi', 'Ang', 'au', 'ly', 'pc'],
  area: ['ha', 'acre'],
  volume: ['l', 'ml', 'gal', 'qt', 'pt', 'cup', 'floz'],
  time: ['s', 'ms', 'min', 'h', 'd', 'wk', 'yr', 'Hz'],
  speed: ['mph', 'knot'],
  mass: ['kg', 'g', 'mg', 't', 'lb', 'oz', 'Da'],
  force: ['N', 'kN', 'dyn', 'lbf', 'kgf'],
  energy: ['J', 'kJ', 'Wh', 'kWh', 'cal', 'kcal', 'eV', 'Btu', 'erg'],
  power: ['W', 'kW', 'hp'],
  pressure: ['Pa', 'hPa', 'kPa', 'bar', 'atm', 'psi', 'mmHg', 'torr'],
  temperature: ['K', 'degC', 'degF', 'degR'],
  electricity: ['A', 'C', 'V', 'Ohm', 'S', 'F', 'H', 'Wb', 'T'],
  amount: ['mol'],
  light: ['cd', 'lm', 'lx'],
  radiation: ['Bq', 'Ci', 'Gy', 'Sv'],
  viscosity: ['P', 'St'],
  angle: ['rad', 'deg', 'arcmin', 'arcsec', 'grad'],
};
