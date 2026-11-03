/**
 * Physical and mathematical constants (prompt 031). Values: CODATA 2022 recommended values
 * (NIST, May 2024); exact since the 2019 SI redefinition where marked. The unit is written in the
 * unit syntax of ABA-T1 (`_m/_s`).
 */
export interface ConstantDef {
  name: string;
  symbol: string;
  value: number;
  /** unit expression (text syntax), '' for pure numbers */
  unit: string;
  category: 'math' | 'chemistry' | 'physics' | 'quantum';
  exact?: boolean;
}

export const CODATA_VERSION = 'CODATA 2022';

export const CONSTANTS: readonly ConstantDef[] = [
  { name: 'e', symbol: 'e', value: Math.E, unit: '', category: 'math', exact: true },
  { name: 'pi', symbol: 'π', value: Math.PI, unit: '', category: 'math', exact: true },
  {
    name: 'phi',
    symbol: 'φ',
    value: (1 + Math.sqrt(5)) / 2,
    unit: '',
    category: 'math',
    exact: true,
  },
  {
    name: 'NA',
    symbol: 'Nₐ',
    value: 6.02214076e23,
    unit: '1/_mol',
    category: 'chemistry',
    exact: true,
  },
  {
    name: 'R',
    symbol: 'R',
    value: 8.31446261815324,
    unit: '_J/(_mol*_K)',
    category: 'chemistry',
    exact: true,
  },
  {
    name: 'k',
    symbol: 'k',
    value: 1.380649e-23,
    unit: '_J/_K',
    category: 'chemistry',
    exact: true,
  },
  { name: 'Vm', symbol: 'Vₘ', value: 22.41396954e-3, unit: '_m^3/_mol', category: 'chemistry' },
  {
    name: 'F',
    symbol: 'F',
    value: 96485.33212,
    unit: '_C/_mol',
    category: 'chemistry',
    exact: true,
  },
  { name: 'c', symbol: 'c', value: 299792458, unit: '_m/_s', category: 'physics', exact: true },
  { name: 'G', symbol: 'G', value: 6.6743e-11, unit: '_m^3/(_kg*_s^2)', category: 'physics' },
  { name: 'g', symbol: 'g', value: 9.80665, unit: '_m/_s^2', category: 'physics', exact: true },
  { name: 'eps0', symbol: 'ε₀', value: 8.8541878188e-12, unit: '_F/_m', category: 'physics' },
  { name: 'mu0', symbol: 'μ₀', value: 1.25663706127e-6, unit: '_N/_A^2', category: 'physics' },
  {
    name: 'sigma',
    symbol: 'σ',
    value: 5.670374419e-8,
    unit: '_W/(_m^2*_K^4)',
    category: 'physics',
  },
  {
    name: 'h',
    symbol: 'h',
    value: 6.62607015e-34,
    unit: '_J*_s',
    category: 'quantum',
    exact: true,
  },
  {
    name: 'hbar',
    symbol: 'ħ',
    value: 6.62607015e-34 / (2 * Math.PI),
    unit: '_J*_s',
    category: 'quantum',
    exact: true,
  },
  { name: 'q', symbol: 'e', value: 1.602176634e-19, unit: '_C', category: 'quantum', exact: true },
  { name: 'me', symbol: 'mₑ', value: 9.1093837139e-31, unit: '_kg', category: 'quantum' },
  { name: 'mp', symbol: 'mₚ', value: 1.67262192595e-27, unit: '_kg', category: 'quantum' },
  { name: 'mn', symbol: 'mₙ', value: 1.67492750056e-27, unit: '_kg', category: 'quantum' },
  { name: 'a0', symbol: 'a₀', value: 5.29177210544e-11, unit: '_m', category: 'quantum' },
  { name: 'Rinf', symbol: 'R∞', value: 10973731.568157, unit: '1/_m', category: 'quantum' },
  { name: 'alpha', symbol: 'α', value: 7.2973525643e-3, unit: '', category: 'quantum' },
];
