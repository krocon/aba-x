/**
 * Values of the language: the values of the math core plus strings, and lists that may hold
 * strings. A list without strings has exactly the shape of the core's `ListValue`, so it is handed
 * to the math core unchanged. Plain data, structured-clone safe.
 */
import {
  type NumberFormat,
  STANDARD_FORMAT,
  type Value,
  type MatrixValue,
  formatValue,
  real,
} from './math-bridge';
import { PplFault } from './errors';

export interface PplString {
  readonly kind: 'string';
  readonly s: string;
}

/** A list whose items may be strings (else identical to the core's ListValue). */
export interface PplList {
  readonly kind: 'list';
  readonly items: readonly PplValue[];
}

export type PplValue = Exclude<Value, { kind: 'list' }> | PplList | PplString;

/** Longest string and list a program may build (protects memory: `s := s + s` in a loop). */
export const MAX_STRING = 1_000_000;
export const MAX_LIST = 1_000_000;

export const str = (s: string): PplString => {
  if (s.length > MAX_STRING) {
    throw new PplFault('size-limit', `string longer than ${MAX_STRING} characters`);
  }
  return { kind: 'string', s };
};

export const TRUE = real(1);
export const FALSE = real(0);
export const bool = (b: boolean) => (b ? TRUE : FALSE);

/** True when `v` contains no strings – then it is a `Value` of the math core. */
export function isCoreValue(v: PplValue): v is Value & PplValue {
  if (v.kind === 'string') return false;
  if (v.kind === 'list') return v.items.every(isCoreValue);
  return true;
}

export function typeName(v: PplValue): string {
  switch (v.kind) {
    case 'real':
      return 'a number';
    case 'complex':
      return 'a complex number';
    case 'unit':
      return 'a number with unit';
    case 'int':
      return 'a based integer';
    case 'list':
      return 'a list';
    case 'matrix':
      return 'a matrix';
    case 'string':
      return 'a string';
  }
}

export interface FormatOptions {
  readonly format?: NumberFormat;
}

/** Display text: strings as they are, inside lists quoted; numbers like the home view. */
export function formatPpl(v: PplValue, o: FormatOptions = {}, nested = false): string {
  if (v.kind === 'string') return nested ? JSON.stringify(v.s) : v.s;
  if (v.kind === 'list') return `{${v.items.map((x) => formatPpl(x, o, true)).join(', ')}}`;
  return formatValue(v, { format: o.format ?? STANDARD_FORMAT });
}

/** Deep copy of a list or matrix (for copy-on-write index assignment). */
export function copyContainer(v: PplList | MatrixValue): PplList | MatrixValue {
  return v.kind === 'list'
    ? { kind: 'list', items: v.items.slice() }
    : { kind: 'matrix', rows: v.rows.map((r) => r.slice()) };
}
