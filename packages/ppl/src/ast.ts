/**
 * Syntax tree of a compiled program. Names are resolved at compile time: locals and parameters
 * become slots of their function, calls know whether they go to a user function, a builtin, the
 * math catalogue or index a variable. `a` (async) marks subtrees that may wait for the host or call
 * user code – everything else is evaluated synchronously (fast path of the interpreter).
 */
import type { PplValue } from './values';

/** A variable as read or written: local slot of the running function, program variable or global. */
export type VarRef =
  | { readonly scope: 'local'; readonly slot: number; readonly name: string }
  | { readonly scope: 'program'; readonly name: string }
  | { readonly scope: 'global'; readonly name: string };

export type BinOp = '+' | '-' | '*' | '/' | '^' | 'MOD' | '==' | '≠' | '<' | '>' | '≤' | '≥';

interface Node {
  /** source offset of the node (for error positions) */
  readonly pos: number;
  readonly end: number;
  /** may wait (host I/O, user code): evaluate with the async walker */
  a: boolean;
}

export interface ConstNode extends Node {
  readonly k: 'const';
  readonly v: PplValue;
}

export interface VarNode extends Node {
  readonly k: 'var';
  ref: VarRef;
}

export interface UnaryNode extends Node {
  readonly k: 'neg' | 'not' | 'fact';
  readonly x: Expr;
}

export interface BinNode extends Node {
  readonly k: 'bin';
  readonly op: BinOp;
  readonly x: Expr;
  readonly y: Expr;
}

export interface LogicNode extends Node {
  readonly k: 'and' | 'or' | 'xor';
  readonly x: Expr;
  readonly y: Expr;
}

export interface ListNode extends Node {
  readonly k: 'list';
  readonly items: readonly Expr[];
}

export interface MatrixNode extends Node {
  readonly k: 'matrix';
  readonly rows: readonly (readonly Expr[])[];
}

export type CallTarget =
  | { readonly kind: 'user'; readonly name: string }
  | { readonly kind: 'builtin'; readonly name: string }
  | { readonly kind: 'math'; readonly name: string }
  | { readonly kind: 'index'; readonly ref: VarRef }
  /** a bare name (no parentheses) that turned out to be a variable */
  | { readonly kind: 'var'; readonly ref: VarRef }
  /** decided at run time: a host variable holding a list/matrix, else an unknown function */
  | { readonly kind: 'unresolved'; readonly name: string };

export interface CallNode extends Node {
  readonly k: 'call';
  readonly name: string;
  readonly args: Expr[];
  /** written without parentheses: a variable or a call without arguments */
  readonly bare: boolean;
  target: CallTarget;
  /** screen numbers of arguments written as G0…G9 (graphics builtins) */
  screens?: (number | undefined)[];
  /** variables written by INPUT/CHOOSE (first argument) */
  refs?: VarRef[];
}

export type Expr =
  ConstNode | VarNode | UnaryNode | BinNode | LogicNode | ListNode | MatrixNode | CallNode;

interface StmtBase {
  readonly pos: number;
  readonly end: number;
}

export interface LocalStmt extends StmtBase {
  readonly k: 'local';
  readonly decls: readonly { readonly slot: number; readonly init?: Expr }[];
}

export interface AssignStmt extends StmtBase {
  readonly k: 'assign';
  target: VarRef;
  /** L(2) := … / M(1, 2) := … */
  readonly index?: readonly Expr[];
  readonly value: Expr;
}

export interface ExprStmt extends StmtBase {
  readonly k: 'expr';
  readonly e: Expr;
}

export interface ReturnStmt extends StmtBase {
  readonly k: 'return';
  readonly e?: Expr;
}

export interface IfStmt extends StmtBase {
  readonly k: 'if';
  readonly cond: Expr;
  readonly then: readonly Stmt[];
  readonly else?: readonly Stmt[];
}

export interface CaseStmt extends StmtBase {
  readonly k: 'case';
  readonly arms: readonly { readonly cond: Expr; readonly body: readonly Stmt[] }[];
  readonly dflt?: readonly Stmt[];
}

export interface ForStmt extends StmtBase {
  readonly k: 'for';
  v: VarRef;
  readonly from: Expr;
  readonly to: Expr;
  readonly step?: Expr;
  readonly down: boolean;
  readonly body: readonly Stmt[];
}

export interface WhileStmt extends StmtBase {
  readonly k: 'while';
  readonly cond: Expr;
  readonly body: readonly Stmt[];
}

export interface RepeatStmt extends StmtBase {
  readonly k: 'repeat';
  readonly body: readonly Stmt[];
  readonly cond: Expr;
}

export interface JumpStmt extends StmtBase {
  readonly k: 'break' | 'continue';
}

export type Stmt =
  | LocalStmt
  | AssignStmt
  | ExprStmt
  | ReturnStmt
  | IfStmt
  | CaseStmt
  | ForStmt
  | WhileStmt
  | RepeatStmt
  | JumpStmt;

export interface FunctionDecl {
  /** as written */
  readonly name: string;
  readonly params: readonly string[];
  readonly exported: boolean;
  readonly body: readonly Stmt[];
  /** names of all slots: parameters first, then locals in order of declaration */
  readonly slots: readonly string[];
  readonly pos: number;
}

export interface ProgramVar {
  readonly name: string;
  readonly init?: Expr;
}

export interface ExportInfo {
  readonly name: string;
  readonly params: readonly string[];
}

/** A compiled program. Function names are case-insensitive (keys in upper case). */
export interface Program {
  readonly source: string;
  readonly functions: ReadonlyMap<string, FunctionDecl>;
  readonly exports: readonly ExportInfo[];
  /** program-wide variables (`LOCAL` outside a function), initialised at the start of every run */
  readonly variables: readonly ProgramVar[];
  readonly lineStarts: readonly number[];
}
