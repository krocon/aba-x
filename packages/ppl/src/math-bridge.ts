/**
 * The only door from the language core into the mathematical core. Everything `@aba/ppl` uses from
 * `@aba/math` is re-exported here, so only this file knows the `@aba/math/…` alias.
 */
export type { Expr } from '@aba/math/ast/nodes';
export type { AngleMode } from '@aba/math/numeric/evaluate';
export type { MathErrorCode } from '@aba/math/result';
export { lookupFunction } from '@aba/math/functions';
export { evaluateValue } from '@aba/math/value/evaluate-value';
export { type Complex, type MatrixValue, type Value, complex, real } from '@aba/math/value/value';
export { type NumberFormat, STANDARD_FORMAT, formatValue } from '@aba/math/value/format';
