/**
 * The expression tree of ABA-X1 (prompt 003, design 003 E1). Plain readonly objects – they survive
 * `structuredClone`, so they cross the worker boundary unchanged. No library type ever appears here.
 */

export type BinaryOp = '+' | '-' | '*' | '/' | '^';
export type RelationOp = '=' | '<' | '>' | '<=' | '>=' | '!=';

/** A number as written: digits with optional fraction and exponent (`3`, `0.5`, `1.2e-3`). */
export interface NumberNode {
  readonly type: 'num';
  readonly value: string;
}

/** A name: variable, constant (`pi`, `e`, `i`, `inf`) or `Ans`. */
export interface SymbolNode {
  readonly type: 'sym';
  readonly name: string;
}

export interface NegNode {
  readonly type: 'neg';
  readonly arg: Expr;
}

export interface BinaryNode {
  readonly type: 'bin';
  readonly op: BinaryOp;
  readonly left: Expr;
  readonly right: Expr;
}

/** Postfix `!` (factorial) and `%` (percent = /100). */
export interface PostfixNode {
  readonly type: 'post';
  readonly op: '!' | '%';
  readonly arg: Expr;
}

/** Function application: built-in (`sin`, `sqrt`, `root`, `log`, `abs` …) or user-defined. */
export interface CallNode {
  readonly type: 'call';
  readonly name: string;
  readonly args: readonly Expr[];
}

/** d^order/d variable^order of expr. */
export interface DerivativeNode {
  readonly type: 'deriv';
  readonly expr: Expr;
  readonly variable: string;
  readonly order: number;
}

/** ∫ expr d variable, definite when both bounds are present. */
export interface IntegralNode {
  readonly type: 'int';
  readonly expr: Expr;
  readonly variable: string;
  readonly lower?: Expr;
  readonly upper?: Expr;
}

/** Σ / Π over variable from lower to upper. */
export interface SeriesNode {
  readonly type: 'series';
  readonly kind: 'sum' | 'prod';
  readonly expr: Expr;
  readonly variable: string;
  readonly lower: Expr;
  readonly upper: Expr;
}

export interface LimitNode {
  readonly type: 'limit';
  readonly expr: Expr;
  readonly variable: string;
  readonly to: Expr;
  readonly direction?: '+' | '-';
}

/** Equation or inequality. At top level `a = 5` / `f(x) = …` may be read as a definition (prompt 008). */
export interface RelationNode {
  readonly type: 'rel';
  readonly op: RelationOp;
  readonly left: Expr;
  readonly right: Expr;
}

export interface MatrixNode {
  readonly type: 'matrix';
  readonly rows: readonly (readonly Expr[])[];
}

export interface ListNode {
  readonly type: 'list';
  readonly items: readonly Expr[];
}

export type Expr =
  | NumberNode
  | SymbolNode
  | NegNode
  | BinaryNode
  | PostfixNode
  | CallNode
  | DerivativeNode
  | IntegralNode
  | SeriesNode
  | LimitNode
  | RelationNode
  | MatrixNode
  | ListNode;

export type ExprType = Expr['type'];
