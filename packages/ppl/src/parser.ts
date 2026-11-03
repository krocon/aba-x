/**
 * Parser of the programming language: recursive descent for statements, precedence climbing for
 * expressions. Locals and parameters are resolved to slots while parsing (in source order, like
 * the declarations are executed); calls are resolved after the whole program is read, so functions
 * may be used before they are defined. The first syntax error stops compilation and is returned
 * with line and column.
 *
 * Grammar (EBNF, keywords case-insensitive):
 *   program   = { decl } ;
 *   decl      = [ "EXPORT" ] ident "(" [ ident { "," ident } ] ")" ( ";" | "BEGIN" block "END" [ ";" ] )
 *             | "LOCAL" vars ";" ;
 *   block     = { stmt ( ";" | before END/ELSE/UNTIL/DEFAULT ) } ;
 *   stmt      = "LOCAL" vars | target ":=" expr | expr | "RETURN" [ expr ]
 *             | "IF" expr "THEN" block [ "ELSE" block ] "END"
 *             | "CASE" { "IF" expr "THEN" block "END" ";" } [ "DEFAULT" block ] "END"
 *             | "FOR" ident ( "FROM" | ":=" ) expr ( "TO" | "DOWNTO" ) expr [ "STEP" expr ] "DO" block "END"
 *             | "WHILE" expr "DO" block "END" | "REPEAT" block "UNTIL" expr | "BREAK" | "CONTINUE" ;
 *   vars      = ident [ ":=" expr ] { "," ident [ ":=" expr ] } ;
 *   target    = ident [ "(" expr { "," expr } ")" ] ;
 *   expr      = or ;  or = and { ("OR" | "XOR") and } ;  and = not { "AND" not } ;
 *   not       = "NOT" not | cmp ;  cmp = sum { ("==" | "=" | "≠" | "<>" | "<" | ">" | "≤" | "<=" | "≥" | ">=") sum } ;
 *   sum       = prod { ("+" | "-") prod } ;  prod = unary { ("*" | "/" | "MOD") unary } ;
 *   unary     = "-" unary | "+" unary | power ;  power = postfix [ "^" unary ] ;
 *   postfix   = primary { "!" } ;
 *   primary   = number | string | ident [ "(" [ expr { "," expr } ] ")" ] | "(" expr ")"
 *             | "{" [ expr { "," expr } ] "}" | "[" row { "," row } "]" | "[" expr { "," expr } "]" ;
 *   row       = "[" expr { "," expr } "]" ;
 */
import type {
  BinOp,
  CallNode,
  CallTarget,
  Expr,
  FunctionDecl,
  Program,
  ProgramVar,
  Stmt,
  VarRef,
} from './ast';
import { isGraphicsBuiltin, lookupBuiltin } from './builtins';
import { type PplResult, PplFault, lineStarts, makeError } from './errors';
import { type Token, tokenize } from './lexer';
import { lookupFunction, real } from './math-bridge';
import { str } from './values';

/** Math catalogue names in any case → canonical name (`NCR` → `nCr`). */
const MATH_NAMES = new Map<string, string>();
const mathName = (name: string): string | undefined => {
  const key = name.toLowerCase();
  if (MATH_NAMES.has(key)) return MATH_NAMES.get(key);
  // try the exact spelling first (nCr), then lower case
  const def = lookupFunction(name) ?? lookupFunction(key);
  const canonical = def && def.name !== 'makelist' ? def.name : undefined;
  if (canonical) MATH_NAMES.set(key, canonical);
  return canonical;
};

const mathArity = (canonical: string) => {
  const def = lookupFunction(canonical);
  return def ? { min: def.minArgs, max: def.maxArgs } : { min: 0, max: 64 };
};

const BLOCK_END = new Set(['END', 'ELSE', 'UNTIL', 'DEFAULT']);

const COMPARE: Readonly<Record<string, BinOp>> = {
  '==': '==',
  '≠': '≠',
  '<': '<',
  '>': '>',
  '≤': '≤',
  '≥': '≥',
};

interface FunctionScope {
  readonly slots: string[];
  readonly names: Map<string, number>;
}

class Parser {
  private readonly toks: Token[];
  private i = 0;
  private scope: FunctionScope | null = null;
  private loops = 0;
  readonly programVars = new Set<string>();
  readonly calls: CallNode[] = [];

  constructor(private readonly source: string) {
    this.toks = tokenize(source).filter((t) => t.kind !== 'comment');
    const bad = this.toks.find((t) => t.kind === 'invalid');
    if (bad) throw new PplFault('syntax', bad.message ?? 'invalid token', bad.start, bad.end);
  }

  // ---- token helpers ----

  private peek(offset = 0): Token | undefined {
    return this.toks[this.i + offset];
  }

  private get pos(): number {
    return this.peek()?.start ?? this.source.length;
  }

  private get lastEnd(): number {
    return this.toks[this.i - 1]?.end ?? 0;
  }

  private describe(t: Token | undefined): string {
    if (!t) return 'the end of the program';
    if (t.kind === 'string') return 'a string';
    if (t.kind === 'number') return `the number ${t.text}`;
    return `'${t.text}'`;
  }

  private fail(message: string, t = this.peek()): never {
    throw new PplFault(
      'syntax',
      message,
      t?.start ?? this.source.length,
      t?.end ?? this.source.length,
    );
  }

  private isKw(kw: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t?.kind === 'keyword' && t.value === kw;
  }

  private isOp(op: string): boolean {
    const t = this.peek();
    return t?.kind === 'operator' && t.value === op;
  }

  private isPunct(p: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t?.kind === 'punctuation' && t.value === p;
  }

  private kw(kw: string, context: string): Token {
    if (!this.isKw(kw)) this.fail(`expected ${kw} ${context}, found ${this.describe(this.peek())}`);
    return this.toks[this.i++];
  }

  private punct(p: string, context: string): Token {
    if (!this.isPunct(p))
      this.fail(`expected '${p}' ${context}, found ${this.describe(this.peek())}`);
    return this.toks[this.i++];
  }

  private ident(context: string): Token {
    const t = this.peek();
    if (t?.kind !== 'identifier') {
      const why = t?.kind === 'keyword' ? ` (${t.value} is a reserved word)` : '';
      this.fail(`expected a name ${context}, found ${this.describe(t)}${why}`);
    }
    this.i++;
    return t;
  }

  // ---- program ----

  program(): Program {
    const functions = new Map<string, FunctionDecl>();
    const declared = new Set<string>();
    const variables: ProgramVar[] = [];
    while (this.peek()) {
      if (this.isPunct(';')) {
        this.i++;
        continue;
      }
      if (this.isKw('LOCAL')) {
        this.i++;
        variables.push(...this.programLocals());
        this.endOfStatement();
        continue;
      }
      const exported = this.isKw('EXPORT');
      if (exported) this.i++;
      const nameTok = this.ident(exported ? 'after EXPORT' : 'of a function or LOCAL');
      const upper = nameTok.text.toUpperCase();
      if (!this.isPunct('(')) {
        this.fail(
          exported
            ? `expected '(' after ${nameTok.text} (exported variables are not supported)`
            : `expected '(' after ${nameTok.text}: a program contains functions and LOCAL declarations`,
        );
      }
      this.i++;
      const params: string[] = [];
      if (!this.isPunct(')')) {
        do {
          const p = this.ident('of a parameter');
          if (params.includes(p.text)) this.fail(`parameter ${p.text} appears twice`, p);
          params.push(p.text);
        } while (this.isPunct(',') && ++this.i);
      }
      this.punct(')', 'after the parameters');
      if (this.isPunct(';')) {
        // forward declaration
        this.i++;
        declared.add(upper);
        continue;
      }
      if (functions.has(upper)) this.fail(`function ${nameTok.text} is defined twice`, nameTok);
      if (lookupBuiltin(upper)) this.fail(`${nameTok.text} is a builtin command`, nameTok);
      this.kw('BEGIN', `after ${nameTok.text}(…)`);
      this.scope = { slots: [...params], names: new Map(params.map((p, k) => [p, k])) };
      const body = this.block();
      this.kw('END', `to close ${nameTok.text}`);
      if (this.isPunct(';')) this.i++;
      functions.set(upper, {
        name: nameTok.text,
        params,
        exported,
        body,
        slots: this.scope.slots,
        pos: nameTok.start,
      });
      this.scope = null;
    }
    for (const d of declared) {
      if (!functions.has(d)) {
        const t = this.toks.find((x) => x.kind === 'identifier' && x.text.toUpperCase() === d);
        this.fail(`function ${t?.text ?? d} is declared but never defined`, t);
      }
    }
    const exports = [...functions.values()]
      .filter((f) => f.exported)
      .map((f) => ({ name: f.name, params: f.params }));
    return {
      source: this.source,
      functions,
      exports,
      variables,
      lineStarts: lineStarts(this.source),
    };
  }

  private programLocals(): ProgramVar[] {
    const out: ProgramVar[] = [];
    do {
      const t = this.ident('after LOCAL');
      let init: Expr | undefined;
      if (this.isOp(':=')) {
        this.i++;
        init = this.expr();
      }
      this.programVars.add(t.text);
      out.push(init ? { name: t.text, init } : { name: t.text });
    } while (this.isPunct(',') && ++this.i);
    return out;
  }

  private endOfStatement(): void {
    if (this.isPunct(';')) {
      this.i++;
      return;
    }
    const t = this.peek();
    if (!t || (t.kind === 'keyword' && BLOCK_END.has(t.value))) return;
    this.fail(`expected ';' after the statement, found ${this.describe(t)}`);
  }

  // ---- statements ----

  private block(): Stmt[] {
    const out: Stmt[] = [];
    for (;;) {
      while (this.isPunct(';')) this.i++;
      const t = this.peek();
      if (!t) return out;
      if (t.kind === 'keyword' && BLOCK_END.has(t.value)) return out;
      out.push(this.statement());
      this.endOfStatement();
    }
  }

  private statement(): Stmt {
    const t = this.peek() as Token;
    const pos = t.start;
    if (t.kind === 'keyword') {
      switch (t.value) {
        case 'LOCAL':
          this.i++;
          return this.localStmt(pos);
        case 'RETURN': {
          this.i++;
          const n = this.peek();
          if (!n || this.isPunct(';') || (n.kind === 'keyword' && BLOCK_END.has(n.value))) {
            return { k: 'return', pos, end: this.lastEnd };
          }
          const e = this.expr();
          return { k: 'return', e, pos, end: this.lastEnd };
        }
        case 'IF':
          return this.ifStmt(pos);
        case 'CASE':
          return this.caseStmt(pos);
        case 'FOR':
          return this.forStmt(pos);
        case 'WHILE': {
          this.i++;
          const cond = this.expr();
          this.kw('DO', 'after the WHILE condition');
          const body = this.loopBody();
          this.kw('END', 'to close WHILE');
          return { k: 'while', cond, body, pos, end: this.lastEnd };
        }
        case 'REPEAT': {
          this.i++;
          const body = this.loopBody();
          this.kw('UNTIL', 'to close REPEAT');
          const cond = this.expr();
          return { k: 'repeat', body, cond, pos, end: this.lastEnd };
        }
        case 'BREAK':
        case 'CONTINUE':
          this.i++;
          if (!this.loops) this.fail(`${t.value} outside of a loop`, t);
          return { k: t.value === 'BREAK' ? 'break' : 'continue', pos, end: t.end };
        case 'EXPORT':
          return this.fail('EXPORT is only allowed before a function, outside of BEGIN … END');
        case 'BEGIN':
          return this.fail('BEGIN … END blocks inside functions are not needed – remove BEGIN');
        default:
          if (BLOCK_END.has(t.value) || ['THEN', 'DO', 'FROM', 'TO', 'STEP'].includes(t.value)) {
            this.fail(`unexpected ${t.value}`);
          }
      }
    }
    const e = this.expr();
    if (this.isOp(':=')) {
      const at = this.peek() as Token;
      this.i++;
      const value = this.expr();
      // an assignment target is not a call
      const at2 = e.k === 'call' ? this.calls.indexOf(e) : -1;
      if (at2 >= 0) this.calls.splice(at2, 1);
      if (e.k === 'var') return { k: 'assign', target: e.ref, value, pos, end: this.lastEnd };
      if (e.k === 'call' && e.target.kind === 'unresolved' && e.bare) {
        return { k: 'assign', target: this.nonLocal(e.name), value, pos, end: this.lastEnd };
      }
      if (e.k === 'call') {
        const ref = this.lookupVar(e.name);
        if (!e.args.length) this.fail(`an index is missing in ${e.name}() := …`, at);
        return { k: 'assign', target: ref, index: e.args, value, pos, end: this.lastEnd };
      }
      this.fail(`only a variable or an indexed variable can be assigned`, at);
    }
    return { k: 'expr', e, pos, end: this.lastEnd };
  }

  /** A variable by name: local slot, program variable or global. */
  private lookupVar(name: string): VarRef {
    const slot = this.scope?.names.get(name);
    if (slot !== undefined) return { scope: 'local', slot, name };
    return this.nonLocal(name);
  }

  private nonLocal(name: string): VarRef {
    return this.programVars.has(name) ? { scope: 'program', name } : { scope: 'global', name };
  }

  private localStmt(pos: number): Stmt {
    const scope = this.scope as FunctionScope;
    const decls: { slot: number; init?: Expr }[] = [];
    do {
      const t = this.ident('after LOCAL');
      let init: Expr | undefined;
      if (this.isOp(':=')) {
        this.i++;
        init = this.expr();
      }
      // a name declared twice reuses its slot
      let slot = scope.names.get(t.text);
      if (slot === undefined) {
        slot = scope.slots.length;
        scope.slots.push(t.text);
        scope.names.set(t.text, slot);
      }
      decls.push(init ? { slot, init } : { slot });
    } while (this.isPunct(',') && ++this.i);
    return { k: 'local', decls, pos, end: this.lastEnd };
  }

  private ifStmt(pos: number): Stmt {
    this.i++;
    const cond = this.expr();
    this.kw('THEN', 'after the IF condition');
    const then = this.block();
    let otherwise: Stmt[] | undefined;
    if (this.isKw('ELSE')) {
      this.i++;
      otherwise = this.block();
    }
    this.kw('END', 'to close IF');
    return otherwise
      ? { k: 'if', cond, then, else: otherwise, pos, end: this.lastEnd }
      : { k: 'if', cond, then, pos, end: this.lastEnd };
  }

  private caseStmt(pos: number): Stmt {
    this.i++;
    const arms: { cond: Expr; body: Stmt[] }[] = [];
    let dflt: Stmt[] | undefined;
    for (;;) {
      while (this.isPunct(';')) this.i++;
      if (this.isKw('IF')) {
        this.i++;
        const cond = this.expr();
        this.kw('THEN', 'after the CASE condition');
        const body = this.block();
        this.kw('END', 'to close IF inside CASE');
        arms.push({ cond, body });
        continue;
      }
      if (this.isKw('DEFAULT')) {
        this.i++;
        dflt = this.block();
      }
      break;
    }
    this.kw('END', 'to close CASE');
    if (!arms.length && !dflt) this.fail('CASE needs at least one IF … THEN … END');
    return dflt
      ? { k: 'case', arms, dflt, pos, end: this.lastEnd }
      : { k: 'case', arms, pos, end: this.lastEnd };
  }

  private forStmt(pos: number): Stmt {
    this.i++;
    const name = this.ident('after FOR');
    if (this.isKw('FROM') || this.isOp(':=')) this.i++;
    else this.fail(`expected FROM after FOR ${name.text}, found ${this.describe(this.peek())}`);
    const from = this.expr();
    let down = false;
    if (this.isKw('DOWNTO')) down = true;
    else if (!this.isKw('TO'))
      this.fail(`expected TO or DOWNTO, found ${this.describe(this.peek())}`);
    this.i++;
    const to = this.expr();
    let step: Expr | undefined;
    if (this.isKw('STEP')) {
      this.i++;
      step = this.expr();
    }
    this.kw('DO', 'after the FOR range');
    const body = this.loopBody();
    this.kw('END', 'to close FOR');
    const v = this.lookupVar(name.text);
    return step
      ? { k: 'for', v, from, to, step, down, body, pos, end: this.lastEnd }
      : { k: 'for', v, from, to, down, body, pos, end: this.lastEnd };
  }

  private loopBody(): Stmt[] {
    this.loops++;
    try {
      return this.block();
    } finally {
      this.loops--;
    }
  }

  // ---- expressions ----

  expr(): Expr {
    return this.or();
  }

  private or(): Expr {
    let x = this.and();
    while (this.isKw('OR') || this.isKw('XOR')) {
      const k = this.isKw('OR') ? 'or' : 'xor';
      this.i++;
      const y = this.and();
      x = { k, x, y, pos: x.pos, end: y.end, a: false };
    }
    return x;
  }

  private and(): Expr {
    let x = this.not();
    while (this.isKw('AND')) {
      this.i++;
      const y = this.not();
      x = { k: 'and', x, y, pos: x.pos, end: y.end, a: false };
    }
    return x;
  }

  private not(): Expr {
    if (this.isKw('NOT')) {
      const pos = this.pos;
      this.i++;
      const x = this.not();
      return { k: 'not', x, pos, end: x.end, a: false };
    }
    return this.compare();
  }

  private compare(): Expr {
    let x = this.sum();
    for (;;) {
      const t = this.peek();
      const op = t?.kind === 'operator' ? COMPARE[t.value] : undefined;
      if (!op) return x;
      this.i++;
      const y = this.sum();
      x = { k: 'bin', op, x, y, pos: x.pos, end: y.end, a: false };
    }
  }

  private sum(): Expr {
    let x = this.prod();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.peek() as Token).value as BinOp;
      this.i++;
      const y = this.prod();
      x = { k: 'bin', op, x, y, pos: x.pos, end: y.end, a: false };
    }
    return x;
  }

  private prod(): Expr {
    let x = this.unary();
    while (this.isOp('*') || this.isOp('/') || this.isKw('MOD')) {
      const t = this.peek() as Token;
      const op = (t.kind === 'keyword' ? 'MOD' : t.value) as BinOp;
      this.i++;
      const y = this.unary();
      x = { k: 'bin', op, x, y, pos: x.pos, end: y.end, a: false };
    }
    return x;
  }

  private unary(): Expr {
    if (this.isOp('-') || this.isOp('+')) {
      const minus = this.isOp('-');
      const pos = this.pos;
      this.i++;
      const x = this.unary();
      return minus ? { k: 'neg', x, pos, end: x.end, a: false } : x;
    }
    return this.power();
  }

  private power(): Expr {
    const x = this.postfix();
    if (!this.isOp('^')) return x;
    this.i++;
    const y = this.unary();
    return { k: 'bin', op: '^', x, y, pos: x.pos, end: y.end, a: false };
  }

  private postfix(): Expr {
    let x = this.primary();
    while (this.isOp('!')) {
      const t = this.toks[this.i++];
      x = { k: 'fact', x, pos: x.pos, end: t.end, a: false };
    }
    return x;
  }

  private args(close: string, context: string): Expr[] {
    const out: Expr[] = [];
    if (this.isPunct(close)) {
      this.i++;
      return out;
    }
    for (;;) {
      out.push(this.expr());
      if (this.isPunct(',')) {
        this.i++;
        continue;
      }
      this.punct(close, context);
      return out;
    }
  }

  private primary(): Expr {
    const t = this.peek();
    if (!t) this.fail('the expression is incomplete');
    const pos = t.start;
    switch (t.kind) {
      case 'number': {
        this.i++;
        return { k: 'const', v: real(Number(t.value)), pos, end: t.end, a: false };
      }
      case 'string':
        this.i++;
        return { k: 'const', v: str(t.value), pos, end: t.end, a: false };
      case 'identifier':
        return this.name();
      case 'punctuation':
        if (t.value === '(') {
          this.i++;
          const e = this.expr();
          this.punct(')', 'to close the parenthesis');
          return e;
        }
        if (t.value === '{') {
          this.i++;
          const items = this.args('}', 'to close the list');
          return { k: 'list', items, pos, end: this.lastEnd, a: false };
        }
        if (t.value === '[') return this.matrix();
        break;
      case 'keyword':
        this.fail(`unexpected ${t.value} in an expression`);
    }
    if (this.isOp(':=')) this.fail(`unexpected ':=' – only a variable can be assigned`);
    this.fail(`unexpected ${this.describe(t)} in an expression`);
  }

  private matrix(): Expr {
    const pos = this.pos;
    this.i++;
    if (this.isPunct('[')) {
      const rows: Expr[][] = [];
      do {
        this.punct('[', 'to open a matrix row');
        rows.push(this.args(']', 'to close the matrix row'));
      } while (this.isPunct(',') && ++this.i);
      this.punct(']', 'to close the matrix');
      const n = rows[0].length;
      if (!n || rows.some((r) => r.length !== n)) {
        throw new PplFault(
          'syntax',
          'all rows of a matrix need the same number of entries',
          pos,
          this.lastEnd,
        );
      }
      return { k: 'matrix', rows, pos, end: this.lastEnd, a: false };
    }
    const row = this.args(']', 'to close the vector');
    if (!row.length)
      throw new PplFault('syntax', 'an empty matrix is not allowed', pos, this.lastEnd);
    return { k: 'matrix', rows: [row], pos, end: this.lastEnd, a: false };
  }

  private name(): Expr {
    const t = this.toks[this.i++];
    const pos = t.start;
    const hasArgs = this.isPunct('(');
    const local = this.scope?.names.get(t.text);
    if (!hasArgs && local !== undefined) {
      return {
        k: 'var',
        ref: { scope: 'local', slot: local, name: t.text },
        pos,
        end: t.end,
        a: false,
      };
    }
    if (!hasArgs && this.programVars.has(t.text)) {
      return { k: 'var', ref: { scope: 'program', name: t.text }, pos, end: t.end, a: false };
    }
    let args: Expr[] = [];
    if (hasArgs) {
      this.i++;
      args = this.args(')', `to close the arguments of ${t.text}`);
    }
    const target: CallTarget =
      local !== undefined
        ? { kind: 'index', ref: { scope: 'local', slot: local, name: t.text } }
        : this.programVars.has(t.text)
          ? { kind: 'index', ref: { scope: 'program', name: t.text } }
          : { kind: 'unresolved', name: t.text };
    const call: CallNode = {
      k: 'call',
      name: t.text,
      args,
      bare: !hasArgs,
      target,
      pos,
      end: this.lastEnd,
      a: false,
    };
    if (target.kind === 'unresolved') this.calls.push(call);
    return call;
  }

  /** Parses a single expression (EXPR) with the slots of a function. */
  standaloneExpr(slots: readonly string[]): Expr {
    this.scope = { slots: [...slots], names: new Map(slots.map((s, k) => [s, k])) };
    const e = this.expr();
    if (this.peek()) this.fail(`unexpected ${this.describe(this.peek())} after the expression`);
    return e;
  }
}

/** Resolves calls (user function, builtin, math catalogue, index of a global) and async flags. */
function resolve(
  calls: readonly CallNode[],
  functions: ReadonlyMap<string, FunctionDecl>,
  programVars: ReadonlySet<string>,
): void {
  for (const c of calls) {
    const upper = c.name.toUpperCase();
    const user = functions.get(upper);
    if (user) {
      if (user.params.length !== c.args.length) {
        throw new PplFault(
          'syntax',
          `${user.name} takes ${user.params.length} argument(s), not ${c.args.length}`,
          c.pos,
          c.end,
        );
      }
      c.target = { kind: 'user', name: upper };
      continue;
    }
    const builtin = lookupBuiltin(upper);
    if (builtin && (!c.bare || builtin.min === 0)) {
      if (c.args.length < builtin.min || c.args.length > builtin.max) {
        const n = builtin.min === builtin.max ? `${builtin.min}` : `${builtin.min}–${builtin.max}`;
        throw new PplFault(
          'syntax',
          `${upper} takes ${n} argument(s), not ${c.args.length}`,
          c.pos,
          c.end,
        );
      }
      c.target = { kind: 'builtin', name: upper };
      if (isGraphicsBuiltin(upper)) {
        c.screens = c.args.map((a) => screenOf(a, programVars));
        c.screens.forEach((s, k) => {
          if (s !== undefined)
            c.args[k] = {
              k: 'const',
              v: real(s),
              pos: c.args[k].pos,
              end: c.args[k].end,
              a: false,
            };
        });
      }
      if (builtin.ref) {
        const first = c.args[0];
        const refs = first.k === 'list' ? first.items.map(refOf) : [refOf(first)];
        c.refs = refs;
        c.args[0] = { k: 'const', v: real(0), pos: first.pos, end: first.end, a: false };
      }
      continue;
    }
    if (c.bare) {
      c.target = { kind: 'var', ref: { scope: 'global', name: c.name } };
      continue;
    }
    const math = mathName(c.name);
    if (math) {
      const { min, max } = mathArity(math);
      if (c.args.length < min || c.args.length > max) {
        const n = min === max ? `${min}` : `${min}–${max}`;
        throw new PplFault(
          'syntax',
          `${c.name} takes ${n} argument(s), not ${c.args.length}`,
          c.pos,
          c.end,
        );
      }
      c.target = { kind: 'math', name: math };
      continue;
    }
    c.target = { kind: 'index', ref: { scope: 'global', name: c.name } };
  }
}

const screenOf = (a: Expr, programVars: ReadonlySet<string>): number | undefined =>
  a.k === 'call' && a.bare && /^G[0-9]$/i.test(a.name) && !programVars.has(a.name)
    ? Number(a.name[1])
    : undefined;

function refOf(e: Expr): VarRef {
  if (e.k === 'var') return e.ref;
  if (e.k === 'call' && e.bare) return { scope: 'global', name: e.name };
  throw new PplFault('syntax', 'a variable is expected here', e.pos, e.end);
}

/** Async flags bottom-up: user calls and async builtins make a subtree async. */
function markExpr(e: Expr): boolean {
  switch (e.k) {
    case 'const':
    case 'var':
      return false;
    case 'neg':
    case 'not':
    case 'fact':
      return (e.a = markExpr(e.x));
    case 'bin':
    case 'and':
    case 'or':
    case 'xor': {
      // both sides must be marked: no short-circuit here
      const x = markExpr(e.x);
      const y = markExpr(e.y);
      return (e.a = x || y);
    }
    case 'list':
      return (e.a = e.items.map(markExpr).some(Boolean));
    case 'matrix':
      return (e.a = e.rows.flat().map(markExpr).some(Boolean));
    case 'call': {
      const inner = e.args.map(markExpr).some(Boolean);
      const t = e.target;
      const self = t.kind === 'user' || (t.kind === 'builtin' && !!lookupBuiltin(t.name)?.async);
      return (e.a = inner || self);
    }
  }
}

function markStmts(stmts: readonly Stmt[]): void {
  for (const s of stmts) {
    switch (s.k) {
      case 'local':
        s.decls.forEach((d) => d.init && markExpr(d.init));
        break;
      case 'assign':
        s.index?.forEach(markExpr);
        markExpr(s.value);
        break;
      case 'expr':
        markExpr(s.e);
        break;
      case 'return':
        if (s.e) markExpr(s.e);
        break;
      case 'if':
        markExpr(s.cond);
        markStmts(s.then);
        if (s.else) markStmts(s.else);
        break;
      case 'case':
        s.arms.forEach((a) => {
          markExpr(a.cond);
          markStmts(a.body);
        });
        if (s.dflt) markStmts(s.dflt);
        break;
      case 'for':
        [s.from, s.to, ...(s.step ? [s.step] : [])].forEach(markExpr);
        markStmts(s.body);
        break;
      case 'while':
      case 'repeat':
        markExpr(s.cond);
        markStmts(s.body);
        break;
    }
  }
}

/** Compiles a program. The first syntax error is returned with its line and column. */
export function compile(source: string): PplResult<Program> {
  try {
    const p = new Parser(source);
    const program = p.program();
    resolve(p.calls, program.functions, p.programVars);
    program.variables.forEach((v) => v.init && markExpr(v.init));
    for (const f of program.functions.values()) markStmts(f.body);
    return { ok: true, value: program };
  } catch (x) {
    if (x instanceof PplFault) {
      return { ok: false, error: makeError(lineStarts(source), x.code, x.message, x.pos, x.end) };
    }
    throw x;
  }
}

/**
 * Compiles one expression (for EXPR) against a program and the slots of the running function.
 * Errors are faults with positions inside `source`.
 */
export function compileExpression(
  source: string,
  program: Program,
  slots: readonly string[],
): Expr {
  const p = new Parser(source);
  for (const v of program.variables) p.programVars.add(v.name);
  const e = p.standaloneExpr(slots);
  resolve(p.calls, program.functions, p.programVars);
  markExpr(e);
  return e;
}
