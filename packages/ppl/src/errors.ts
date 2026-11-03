/**
 * Errors of the language core – compile and runtime errors alike are values with a position
 * (1-based line and column) and a readable English message. Shaped like `MathResult` of the math
 * core, with more codes and a position.
 */
import type { MathErrorCode } from './math-bridge';

export type PplErrorCode =
  | MathErrorCode
  /** a value of the wrong kind (a string where a number is needed …) */
  | 'type'
  /** list/matrix index out of range or not an integer */
  | 'index'
  /** the step budget is used up (endless loop?) */
  | 'step-limit'
  /** too many nested function calls */
  | 'recursion-limit'
  /** a value grew beyond the size limits (strings, lists) */
  | 'size-limit';

export interface PplError {
  readonly code: PplErrorCode;
  readonly message: string;
  /** 1-based */
  readonly line: number;
  /** 1-based */
  readonly column: number;
  /** character range in the source */
  readonly span: { readonly start: number; readonly end: number };
}

export type PplResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: PplError };

/** Thrown inside the core only; always converted into a `PplError` at the API boundary. */
export class PplFault extends Error {
  constructor(
    readonly code: PplErrorCode,
    message: string,
    /** offset in the source, -1 = not known yet (filled in by the caller) */
    public pos = -1,
    public end = -1,
  ) {
    super(message);
  }
}

/** Offsets of the line starts, for offset → line/column. */
export function lineStarts(source: string): number[] {
  const starts = [0];
  for (let k = 0; k < source.length; k++) if (source[k] === '\n') starts.push(k + 1);
  return starts;
}

/** 1-based line and column of an offset. */
export function lineColumn(
  starts: readonly number[],
  pos: number,
): { line: number; column: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: pos - starts[lo] + 1 };
}

export function makeError(
  starts: readonly number[],
  code: PplErrorCode,
  message: string,
  start: number,
  end = start,
): PplError {
  const { line, column } = lineColumn(starts, Math.max(0, start));
  return { code, message, line, column, span: { start, end: Math.max(start, end) } };
}
