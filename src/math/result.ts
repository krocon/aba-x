/**
 * Result of every operation of the mathematical core. Errors are values, never exceptions that
 * cross the core boundary, so the UI can tell "unsupported" from "wrong input" from "no
 * convergence" – and never shows a guessed result.
 *
 * Framework-free: nothing under `src/math/` may import Angular or Tauri (ESLint enforces it).
 */
export type MathErrorCode =
  | 'syntax'
  | 'unknown-symbol'
  | 'unknown-function'
  | 'domain'
  | 'division-by-zero'
  | 'no-convergence'
  | 'unsupported'
  | 'not-solvable'
  | 'not-evaluable'
  | 'timeout';

export interface MathError {
  readonly code: MathErrorCode;
  readonly message: string;
  /** Character range in the input, when the error belongs to a position (syntax errors). */
  readonly span?: { readonly start: number; readonly end: number };
}

export type MathResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: MathError };

export function ok<T>(value: T): MathResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(
  code: MathErrorCode,
  message: string,
  span?: MathError['span'],
): MathResult<T> {
  return { ok: false, error: span ? { code, message, span } : { code, message } };
}

/** Applies `f` to a successful value; errors pass through unchanged. */
export function mapResult<T, U>(r: MathResult<T>, f: (value: T) => U): MathResult<U> {
  return r.ok ? ok(f(r.value)) : r;
}
