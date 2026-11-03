/**
 * @aba/ppl – the structured programming language of the ABA calculators (PPL-like, Pascal-style):
 * `tokenize` for highlighting, `compile` to a program, `run` an exported function against a host.
 */
export type { ExportInfo, Program } from './ast';
export { BUILTIN_NAMES } from './builtins';
export type { PplError, PplErrorCode, PplResult } from './errors';
export {
  type Coords,
  type GfxCommand,
  type Host,
  type InputField,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from './host';
export { type RunOptions, type RunResult, type Snapshot, run } from './interpreter';
export { KEYWORDS, type Token, type TokenKind, tokenize } from './lexer';
export { compile } from './parser';
export { type PplList, type PplString, type PplValue, formatPpl, str } from './values';
