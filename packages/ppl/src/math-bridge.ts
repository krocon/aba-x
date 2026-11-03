/**
 * The only door from the language core into the mathematical core. Everything `@aba/ppl` uses from
 * `@aba/math` is re-exported here, so switching the relative paths to the `@aba/math/…` alias is a
 * single edit.
 */
export type { Expr } from '../../math/src/ast/nodes';
export type { AngleMode } from '../../math/src/numeric/evaluate';
export type { MathErrorCode } from '../../math/src/result';
export { lookupFunction } from '../../math/src/functions';
export { evaluateValue } from '../../math/src/value/evaluate-value';
export {
  type Complex,
  type MatrixValue,
  type Value,
  complex,
  real,
} from '../../math/src/value/value';
export { type NumberFormat, STANDARD_FORMAT, formatValue } from '../../math/src/value/format';
