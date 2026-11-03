/**
 * Interpreter of the programming language: an AST walker. Statements run in async functions (INPUT,
 * WAIT, MSGBOX … wait for the host); expressions without user calls or waiting builtins are
 * evaluated synchronously (compile-time flag), which keeps simple loops fast. Arithmetic on two
 * real numbers is done here directly with the same rules as the math core (division by zero,
 * overflow, tolerant equality); everything else – complex numbers, lists, matrices, units, the
 * function catalogue – is delegated to the core's `evaluateValue`.
 *
 * Never hangs: a step budget (statements + loop iterations), a time budget (waiting for the host
 * does not count), a recursion limit, and cancellation (`signal.aborted` / `isCancelled()`), checked
 * every few hundred steps; the interpreter yields to the event loop regularly so a cancel message
 * can arrive. Every failure is a `PplError` with line and column.
 */
import type { CallNode, Expr, FunctionDecl, Program, Stmt, VarRef } from './ast';
import { type BuiltinContext, lookupBuiltin } from './builtins';
import { PplFault, makeError, type PplError } from './errors';
import type { Host } from './host';
import {
  type AngleMode,
  type Expr as CoreExpr,
  type MatrixValue,
  type NumberFormat,
  type Value,
  complex,
  evaluateValue,
  real,
} from './math-bridge';
import { compileExpression } from './parser';
import {
  FALSE,
  MAX_LIST,
  type PplList,
  type PplValue,
  TRUE,
  bool,
  copyContainer,
  formatPpl,
  isCoreValue,
  str,
  typeName,
} from './values';

/** Variables of the running function, for debuggers. */
export interface Snapshot {
  readonly function: string;
  readonly locals: Readonly<Record<string, PplValue>>;
}

export interface RunOptions {
  /** statements + loop iterations; default 100 000 000 */
  readonly maxSteps?: number;
  /** computing time in ms (waiting for the host is not counted); default 30 000 */
  readonly timeLimitMs?: number;
  /** nested calls of user functions; default 200, at most 5000 */
  readonly maxDepth?: number;
  /** an AbortSignal or anything with `aborted` */
  readonly signal?: { readonly aborted: boolean };
  readonly isCancelled?: () => boolean;
  /** before every statement; may return a promise to pause (breakpoints, single step) */
  readonly onStatement?: (line: number, column: number, snapshot: Snapshot) => void | Promise<void>;
  readonly angle?: AngleMode;
  readonly complexResults?: boolean;
  /** number format of PRINT, STRING and string concatenation */
  readonly format?: NumberFormat;
  /** RANDOM, RANDINT; default Math.random */
  readonly random?: () => number;
  /** TICKS (ms); default Date.now */
  readonly now?: () => number;
  /** yield to the event loop at least this often (ms); default 20 */
  readonly yieldEveryMs?: number;
}

export type RunResult =
  | { readonly ok: true; readonly value: PplValue; readonly steps: number }
  | { readonly ok: false; readonly error: PplError; readonly steps: number };

const NORMAL = 0;
const BREAK = 1;
const CONTINUE = 2;
const RETURN = 3;
type Signal = typeof NORMAL | typeof BREAK | typeof CONTINUE | typeof RETURN;

/** Steps between checks of budgets and cancellation. */
const CHECK_EVERY = 512;

/** Upper bound of `maxDepth`: deeper recursion would only fill memory. */
const MAX_DEPTH = 5000;

/** Relative tolerance of `==` on reals – the same as the math core. */
const EQ_TOL = 1e-12;

interface Frame {
  readonly fn: FunctionDecl;
  readonly slots: (PplValue | undefined)[];
  ret?: PplValue;
  last?: PplValue;
}

interface At {
  readonly pos: number;
  readonly end: number;
}

const CONSTANTS: Readonly<Record<string, PplValue>> = {
  pi: real(Math.PI),
  PI: real(Math.PI),
  π: real(Math.PI),
  e: real(Math.E),
  i: complex(0, 1),
};

const CORE_REL: Readonly<Record<string, '=' | '!=' | '<' | '>' | '<=' | '>='>> = {
  '==': '=',
  '≠': '!=',
  '<': '<',
  '>': '>',
  '≤': '<=',
  '≥': '>=',
};

const sym = (name: string): CoreExpr => ({ type: 'sym', name });

function yieldToEventLoop(): Promise<void> {
  const st = (globalThis as { setTimeout?: (f: () => void, ms: number) => unknown }).setTimeout;
  return new Promise((resolve) => (st ? st(resolve, 0) : resolve()));
}

const finite = (x: number): PplValue => {
  if (!Number.isFinite(x)) throw new PplFault('domain', 'overflow (result too large)');
  return real(x);
};

const close = (p: number, q: number) =>
  p === q || Math.abs(p - q) <= EQ_TOL * Math.max(Math.abs(p), Math.abs(q));

const at = (x: PplFault, node: At): PplFault => {
  if (x.pos < 0) {
    x.pos = node.pos;
    x.end = node.end;
  }
  return x;
};

const PROGRAM_FN: FunctionDecl = {
  name: '(program)',
  params: [],
  exported: false,
  body: [],
  slots: [],
  pos: 0,
};

class Interpreter {
  steps = 0;
  private nextCheck: number;
  private readonly maxSteps: number;
  private readonly maxDepth: number;
  private deadline: number;
  private lastYield = Date.now();
  private readonly yieldEvery: number;
  private depth = 0;
  private readonly programVars = new Map<string, PplValue>();
  /** lists/matrices owned by exactly one variable: index assignment may change them in place */
  private readonly owned = new WeakSet<object>();
  private readonly exprCache = new Map<string, Expr>();

  constructor(
    private readonly program: Program,
    private readonly host: Host,
    private readonly o: RunOptions,
  ) {
    this.maxSteps = o.maxSteps ?? 100_000_000;
    this.maxDepth = Math.min(o.maxDepth ?? 200, MAX_DEPTH);
    this.deadline = Date.now() + (o.timeLimitMs ?? 30_000);
    this.yieldEvery = o.yieldEveryMs ?? 20;
    this.nextCheck = Math.min(CHECK_EVERY, this.maxSteps + 1);
  }

  // ---- budgets ----

  private cancelled(): boolean {
    return !!this.o.signal?.aborted || !!this.o.isCancelled?.();
  }

  checkCancel(): void {
    if (this.cancelled()) throw new PplFault('cancelled', 'the program was cancelled');
  }

  private async checkpoint(): Promise<void> {
    this.nextCheck = Math.min(this.steps + CHECK_EVERY, this.maxSteps + 1);
    if (this.steps > this.maxSteps) {
      throw new PplFault(
        'step-limit',
        `the step budget of ${this.maxSteps} steps is used up – is there an endless loop?`,
      );
    }
    this.checkCancel();
    const now = Date.now();
    if (now > this.deadline) {
      throw new PplFault('timeout', 'the time budget is used up – is there an endless loop?');
    }
    if (now - this.lastYield >= this.yieldEvery) {
      await yieldToEventLoop();
      this.lastYield = Date.now();
      this.deadline += this.lastYield - now;
      this.checkCancel();
    }
  }

  /** Waiting for the host (dialogs, WAIT, debugger) does not use up the time budget. */
  private async waiting<T>(p: Promise<T> | T): Promise<T> {
    const t0 = Date.now();
    try {
      return await p;
    } finally {
      const dt = Date.now() - t0;
      this.deadline += dt;
      this.lastYield = Date.now();
    }
  }

  // ---- variables ----

  private readRaw(ref: VarRef, f: Frame): PplValue {
    let v: PplValue | undefined;
    if (ref.scope === 'local') v = f.slots[ref.slot];
    else if (ref.scope === 'program') v = this.programVars.get(ref.name);
    else v = this.host.get(ref.name) ?? CONSTANTS[ref.name];
    if (v === undefined) {
      throw new PplFault(
        'unknown-symbol',
        ref.scope === 'global' ? `unknown variable ${ref.name}` : `${ref.name} has no value yet`,
      );
    }
    return v;
  }

  /** Reading a whole list/matrix shares it: later index assignments copy it first. */
  private read(ref: VarRef, f: Frame): PplValue {
    const v = this.readRaw(ref, f);
    if (v.kind === 'list' || v.kind === 'matrix') this.owned.delete(v);
    return v;
  }

  private write(ref: VarRef, v: PplValue, f: Frame): void {
    if (ref.scope === 'local') f.slots[ref.slot] = v;
    else if (ref.scope === 'program') this.programVars.set(ref.name, v);
    else if (this.host.set(ref.name, v) === false) {
      throw new PplFault('type', `${ref.name} cannot be assigned (unknown or read-only variable)`);
    }
  }

  // ---- values ----

  format(v: PplValue): string {
    return formatPpl(v, this.o.format ? { format: this.o.format } : {});
  }

  private truthy(v: PplValue): boolean {
    if (v.kind === 'real') return v.v !== 0;
    if (v.kind === 'int') return v.v !== '0';
    throw new PplFault('type', `a condition must be a number, not ${typeName(v)}`);
  }

  private core(e: CoreExpr, vars: readonly PplValue[]): PplValue {
    const variables = new Map<string, Value>();
    vars.forEach((v, k) => {
      if (!isCoreValue(v)) {
        throw new PplFault(
          'type',
          v.kind === 'string'
            ? 'a string cannot be used in a calculation'
            : 'a list containing strings cannot be used in a calculation',
        );
      }
      variables.set(`$${k}`, v);
    });
    const r = evaluateValue(e, {
      angle: this.o.angle ?? 'rad',
      complexResults: this.o.complexResults ?? true,
      variables,
    });
    if (!r.ok) throw new PplFault(r.error.code, r.error.message);
    return r.value as PplValue;
  }

  math(name: string, args: readonly PplValue[]): PplValue {
    return this.core({ type: 'call', name, args: args.map((_, k) => sym(`$${k}`)) }, args);
  }

  private bin(op: string, a: PplValue, b: PplValue): PplValue {
    if (a.kind === 'real' && b.kind === 'real') {
      const x = a.v;
      const y = b.v;
      switch (op) {
        case '+':
          return finite(x + y);
        case '-':
          return finite(x - y);
        case '*':
          return finite(x * y);
        case '/':
          if (y === 0) throw new PplFault('division-by-zero', 'division by zero');
          return finite(x / y);
        case '==':
          return bool(close(x, y));
        case '≠':
          return bool(!close(x, y));
        case '<':
          return bool(x < y);
        case '>':
          return bool(x > y);
        case '≤':
          return bool(x <= y);
        case '≥':
          return bool(x >= y);
      }
    }
    if (a.kind === 'string' || b.kind === 'string') return this.stringOp(op, a, b);
    if (op === 'MOD') return this.math('mod', [a, b]);
    const rel = CORE_REL[op];
    const e: CoreExpr = rel
      ? { type: 'rel', op: rel, left: sym('$0'), right: sym('$1') }
      : { type: 'bin', op: op as '+', left: sym('$0'), right: sym('$1') };
    return this.core(e, [a, b]);
  }

  private stringOp(op: string, a: PplValue, b: PplValue): PplValue {
    if (op === '+') return str(this.format(a) + this.format(b));
    const both = a.kind === 'string' && b.kind === 'string';
    if (op === '==') return bool(both && a.s === b.s);
    if (op === '≠') return bool(!(both && a.s === b.s));
    if (both && CORE_REL[op]) {
      const c = a.s < b.s ? -1 : a.s > b.s ? 1 : 0;
      return bool(op === '<' ? c < 0 : op === '>' ? c > 0 : op === '≤' ? c <= 0 : c >= 0);
    }
    throw new PplFault('type', `${op} is not defined for strings`);
  }

  private neg(v: PplValue): PplValue {
    if (v.kind === 'real') return real(-v.v);
    return this.core({ type: 'neg', arg: sym('$0') }, [v]);
  }

  private index(v: PplValue, idx: readonly PplValue[], name: string): PplValue {
    const pos = (x: PplValue, n: number, what: string): number => {
      if (x.kind !== 'real' || !Number.isInteger(x.v)) {
        throw new PplFault('index', `the index of ${name} must be an integer`);
      }
      if (x.v < 1 || x.v > n) {
        throw new PplFault('index', `${what} ${x.v} of ${name} does not exist (1…${n})`);
      }
      return x.v - 1;
    };
    if (!idx.length) throw new PplFault('index', `an index is missing after ${name}`);
    if (v.kind === 'list') {
      const item = v.items[pos(idx[0], v.items.length, 'item')];
      return idx.length === 1 ? item : this.index(item, idx.slice(1), name);
    }
    if (v.kind === 'matrix') {
      if (idx.length > 2) throw new PplFault('index', `${name} has two indices (row, column)`);
      if (idx.length === 2) {
        const row = v.rows[pos(idx[0], v.rows.length, 'row')];
        return real(row[pos(idx[1], row.length, 'column')]);
      }
      if (v.rows.length === 1) return real(v.rows[0][pos(idx[0], v.rows[0].length, 'entry')]);
      const row = v.rows[pos(idx[0], v.rows.length, 'row')];
      return { kind: 'list', items: row.map(real) };
    }
    if (v.kind === 'string' && idx.length === 1) {
      return str(v.s[pos(idx[0], v.s.length, 'character')]);
    }
    throw new PplFault('index', `${name} is ${typeName(v)} and cannot be indexed`);
  }

  private assignIndexed(ref: VarRef, idx: readonly PplValue[], v: PplValue, f: Frame): void {
    const cur = this.readRaw(ref, f);
    if (cur.kind !== 'list' && cur.kind !== 'matrix') {
      throw new PplFault('index', `${ref.name} is ${typeName(cur)}, not a list or matrix`);
    }
    const inPlace = ref.scope !== 'global' && this.owned.has(cur);
    const target = inPlace ? cur : copyContainer(cur);
    this.setIndexed(target, idx, v, ref.name);
    if (!inPlace) {
      if (ref.scope !== 'global') this.owned.add(target);
      this.write(ref, target, f);
    }
  }

  /** Changes `c` in place (it is a fresh copy or owned by one variable). */
  private setIndexed(
    c: PplList | MatrixValue,
    idx: readonly PplValue[],
    v: PplValue,
    name: string,
  ) {
    const k = (x: PplValue | undefined, n: number, what: string, append = false): number => {
      if (x?.kind !== 'real' || !Number.isInteger(x.v)) {
        throw new PplFault('index', `the index of ${name} must be an integer`);
      }
      if (x.v < 1 || x.v > n + (append ? 1 : 0)) {
        throw new PplFault('index', `${what} ${x.v} of ${name} does not exist (1…${n})`);
      }
      return x.v - 1;
    };
    if (c.kind === 'list') {
      const items = c.items as PplValue[];
      const at0 = k(idx[0], items.length, 'item', idx.length === 1);
      if (idx.length === 1) {
        if (at0 === items.length && items.length >= MAX_LIST) {
          throw new PplFault('size-limit', `list longer than ${MAX_LIST} items`);
        }
        items[at0] = v;
        return;
      }
      const inner = items[at0];
      if (inner.kind !== 'list' && inner.kind !== 'matrix') {
        throw new PplFault('index', `item ${at0 + 1} of ${name} is not a list`);
      }
      const copy = copyContainer(inner);
      this.setIndexed(copy, idx.slice(1), v, name);
      items[at0] = copy;
      return;
    }
    if (v.kind !== 'real')
      throw new PplFault('type', `matrix entries must be numbers, not ${typeName(v)}`);
    const rows = c.rows as number[][];
    if (idx.length === 2) {
      const r = k(idx[0], rows.length, 'row');
      rows[r][k(idx[1], rows[r].length, 'column')] = v.v;
    } else if (idx.length === 1 && rows.length === 1) {
      rows[0][k(idx[0], rows[0].length, 'entry')] = v.v;
    } else {
      throw new PplFault('index', `${name} needs a row and a column`);
    }
  }

  // ---- expressions ----

  /** Synchronous evaluation of an expression without async parts (`!e.a`). */
  ev(e: Expr, f: Frame): PplValue {
    switch (e.k) {
      case 'const':
        return e.v;
      case 'var':
        try {
          return this.read(e.ref, f);
        } catch (x) {
          throw x instanceof PplFault ? at(x, e) : x;
        }
      default:
        return this.compute(e, f, null);
    }
  }

  /** Evaluation that may wait. */
  async evA(e: Expr, f: Frame): Promise<PplValue> {
    if (!e.a) return this.ev(e, f);
    switch (e.k) {
      case 'neg':
      case 'not':
      case 'fact':
        return this.compute(e, f, [await this.evA(e.x, f)]);
      case 'bin':
      case 'xor':
        return this.compute(e, f, [await this.evA(e.x, f), await this.evA(e.y, f)]);
      case 'and':
      case 'or': {
        const x = this.truthyAt(await this.evA(e.x, f), e.x);
        if (e.k === 'and' ? !x : x) return bool(x);
        return bool(this.truthyAt(await this.evA(e.y, f), e.y));
      }
      case 'list': {
        const items: PplValue[] = [];
        for (const x of e.items) items.push(await this.evA(x, f));
        return this.compute(e, f, items);
      }
      case 'matrix': {
        const items: PplValue[] = [];
        for (const x of e.rows.flat()) items.push(await this.evA(x, f));
        return this.compute(e, f, items);
      }
      case 'call': {
        const args: PplValue[] = [];
        for (const x of e.args) args.push(await this.evA(x, f));
        return this.callA(e, args, f);
      }
      default:
        return this.ev(e, f);
    }
  }

  private truthyAt(v: PplValue, node: At): boolean {
    try {
      return this.truthy(v);
    } catch (x) {
      throw x instanceof PplFault ? at(x, node) : x;
    }
  }

  /** Applies a node to evaluated children (`vals`), or evaluates them synchronously (`null`). */
  private compute(e: Expr, f: Frame, vals: PplValue[] | null): PplValue {
    const sub = (k: number, x: Expr) => (vals ? vals[k] : this.ev(x, f));
    try {
      switch (e.k) {
        case 'neg':
          return this.neg(sub(0, e.x));
        case 'not':
          return bool(!this.truthyAt(sub(0, e.x), e.x));
        case 'fact':
          return this.core({ type: 'post', op: '!', arg: sym('$0') }, [sub(0, e.x)]);
        case 'bin':
          return this.bin(e.op, sub(0, e.x), sub(1, e.y));
        case 'xor':
          return bool(this.truthyAt(sub(0, e.x), e.x) !== this.truthyAt(sub(1, e.y), e.y));
        case 'and': {
          const x = this.truthyAt(sub(0, e.x), e.x);
          return x ? bool(this.truthyAt(sub(1, e.y), e.y)) : FALSE;
        }
        case 'or': {
          const x = this.truthyAt(sub(0, e.x), e.x);
          return x ? TRUE : bool(this.truthyAt(sub(1, e.y), e.y));
        }
        case 'list': {
          if (e.items.length > MAX_LIST) throw new PplFault('size-limit', 'list too long');
          return { kind: 'list', items: vals ?? e.items.map((x) => this.ev(x, f)) };
        }
        case 'matrix': {
          const flat = vals ?? e.rows.flat().map((x) => this.ev(x, f));
          const n = e.rows[0].length;
          const rows: number[][] = [];
          flat.forEach((v, k) => {
            if (v.kind !== 'real') {
              throw new PplFault('type', `matrix entries must be numbers, not ${typeName(v)}`);
            }
            if (k % n === 0) rows.push([]);
            rows[rows.length - 1].push(v.v);
          });
          return { kind: 'matrix', rows };
        }
        case 'call': {
          const args = vals ?? e.args.map((x) => this.ev(x, f));
          return this.callSync(e, args, f);
        }
        default:
          return this.ev(e, f);
      }
    } catch (x) {
      throw x instanceof PplFault ? at(x, e) : x;
    }
  }

  private callSync(e: CallNode, args: PplValue[], f: Frame): PplValue {
    const r = this.dispatch(e, args, f);
    if (r instanceof Promise) {
      throw new PplFault('unsupported', `${e.name} cannot be used here`);
    }
    return r;
  }

  private async callA(e: CallNode, args: PplValue[], f: Frame): Promise<PplValue> {
    try {
      return await this.dispatch(e, args, f);
    } catch (x) {
      throw x instanceof PplFault ? at(x, e) : x;
    }
  }

  private dispatch(e: CallNode, args: PplValue[], f: Frame): PplValue | Promise<PplValue> {
    const t = e.target;
    switch (t.kind) {
      case 'user': {
        const fn = this.program.functions.get(t.name) as FunctionDecl;
        return this.callUser(fn, args, e);
      }
      case 'builtin': {
        const spec = lookupBuiltin(t.name);
        if (!spec) throw new PplFault('unknown-function', `unknown command ${e.name}`);
        const r = spec.fn(this.context(e, args, f));
        return spec.async ? this.waiting(r) : r;
      }
      case 'math':
        return this.math(t.name, args);
      case 'index': {
        const v = t.ref.scope === 'global' ? this.host.get(t.ref.name) : this.readRaw(t.ref, f);
        if (v === undefined) {
          throw new PplFault('unknown-function', `unknown function or variable ${e.name}`);
        }
        return this.index(v, args, e.name);
      }
      case 'var':
        return this.read(t.ref, f);
      case 'unresolved':
        throw new PplFault('unknown-function', `unknown function ${e.name}`);
    }
  }

  private context(e: CallNode, args: PplValue[], f: Frame): BuiltinContext {
    return {
      name: e.target.kind === 'builtin' ? e.target.name : e.name.toUpperCase(),
      host: this.host,
      args,
      screens: e.screens ?? [],
      refs: e.refs ?? [],
      read: (ref) => this.readRaw(ref, f),
      write: (ref, v) => this.write(ref, v, f),
      format: (v) => this.format(v),
      random: this.o.random ?? Math.random,
      now: this.o.now ?? Date.now,
      math: (name, a) => this.math(name, a),
      evalString: (source) => this.evalString(source, f),
      checkCancel: () => this.checkCancel(),
    };
  }

  private async evalString(source: string, f: Frame): Promise<PplValue> {
    const key = `${f.fn.name}\u0000${source}`;
    let e = this.exprCache.get(key);
    if (!e) {
      try {
        e = compileExpression(source, this.program, f.fn.slots);
      } catch (x) {
        if (x instanceof PplFault) {
          throw new PplFault(x.code, `EXPR: ${x.message} (at character ${x.pos + 1})`);
        }
        throw x;
      }
      this.exprCache.set(key, e);
    }
    try {
      return await this.evA(e, f);
    } catch (x) {
      if (x instanceof PplFault) {
        // positions inside the string are meaningless in the program
        throw new PplFault(x.code, `EXPR: ${x.message}`);
      }
      throw x;
    }
  }

  // ---- functions and statements ----

  async callUser(fn: FunctionDecl, args: readonly PplValue[], node: At): Promise<PplValue> {
    if (this.depth >= this.maxDepth) {
      throw new PplFault(
        'recursion-limit',
        `more than ${this.maxDepth} nested calls of ${fn.name} – endless recursion?`,
        node.pos,
        node.end,
      );
    }
    const frame: Frame = { fn, slots: new Array<PplValue | undefined>(fn.slots.length) };
    args.forEach((a, k) => (frame.slots[k] = a));
    this.depth++;
    try {
      await this.block(fn.body, frame);
    } finally {
      this.depth--;
    }
    return frame.ret ?? frame.last ?? real(0);
  }

  async initProgram(): Promise<void> {
    const frame: Frame = { fn: PROGRAM_FN, slots: [] };
    for (const v of this.program.variables) {
      this.programVars.set(v.name, v.init ? await this.evA(v.init, frame) : real(0));
    }
  }

  private async block(stmts: readonly Stmt[], f: Frame): Promise<Signal> {
    for (const s of stmts) {
      if (++this.steps >= this.nextCheck) await this.at(this.checkpoint(), s);
      if (this.o.onStatement) await this.hook(s, f);
      let r: Signal | Promise<Signal>;
      try {
        r = this.exec(s, f);
        if (typeof r !== 'number') r = await r;
      } catch (x) {
        throw x instanceof PplFault ? at(x, s) : x;
      }
      if (r !== NORMAL) return r;
    }
    return NORMAL;
  }

  private async at<T>(p: Promise<T>, node: At): Promise<T> {
    try {
      return await p;
    } catch (x) {
      throw x instanceof PplFault ? at(x, node) : x;
    }
  }

  private async hook(s: Stmt, f: Frame): Promise<void> {
    const locals: Record<string, PplValue> = {};
    f.fn.slots.forEach((name, k) => {
      const v = f.slots[k];
      if (v !== undefined) locals[name] = v;
    });
    const { line, column } = makeError(this.program.lineStarts, 'syntax', '', s.pos);
    await this.waiting(this.o.onStatement?.(line, column, { function: f.fn.name, locals }));
    this.checkCancel();
  }

  private exec(s: Stmt, f: Frame): Signal | Promise<Signal> {
    switch (s.k) {
      case 'assign':
        if (s.value.a || s.index?.some((x) => x.a)) return this.assignA(s, f);
        this.assign(s.target, s.index && s.index.map((x) => this.ev(x, f)), this.ev(s.value, f), f);
        return NORMAL;
      case 'expr':
        if (s.e.a) return this.exprA(s.e, f);
        f.last = this.ev(s.e, f);
        return NORMAL;
      case 'local':
        if (s.decls.some((d) => d.init?.a)) return this.localA(s.decls, f);
        for (const d of s.decls) f.slots[d.slot] = d.init ? this.ev(d.init, f) : real(0);
        return NORMAL;
      case 'return':
        if (s.e?.a) return this.returnA(s.e, f);
        f.ret = s.e ? this.ev(s.e, f) : real(0);
        return RETURN;
      case 'break':
        return BREAK;
      case 'continue':
        return CONTINUE;
      case 'if':
        return this.ifA(s.cond, s.then, s.else, f);
      case 'case':
        return this.caseA(s, f);
      case 'for':
        return this.forA(s, f);
      case 'while':
        return this.whileA(s.cond, s.body, f);
      case 'repeat':
        return this.repeatA(s.body, s.cond, f);
    }
  }

  private assign(target: VarRef, index: PplValue[] | undefined, v: PplValue, f: Frame): void {
    if (index) this.assignIndexed(target, index, v, f);
    else this.write(target, v, f);
    f.last = v;
  }

  private async assignA(s: Extract<Stmt, { k: 'assign' }>, f: Frame): Promise<Signal> {
    let index: PplValue[] | undefined;
    if (s.index) {
      index = [];
      for (const x of s.index) index.push(await this.evA(x, f));
    }
    this.assign(s.target, index, await this.evA(s.value, f), f);
    return NORMAL;
  }

  private async exprA(e: Expr, f: Frame): Promise<Signal> {
    f.last = await this.evA(e, f);
    return NORMAL;
  }

  private async localA(decls: Extract<Stmt, { k: 'local' }>['decls'], f: Frame): Promise<Signal> {
    for (const d of decls) f.slots[d.slot] = d.init ? await this.evA(d.init, f) : real(0);
    return NORMAL;
  }

  private async returnA(e: Expr, f: Frame): Promise<Signal> {
    f.ret = await this.evA(e, f);
    return RETURN;
  }

  private async cond(e: Expr, f: Frame): Promise<boolean> {
    return this.truthyAt(e.a ? await this.evA(e, f) : this.ev(e, f), e);
  }

  private async ifA(
    c: Expr,
    then: readonly Stmt[],
    otherwise: readonly Stmt[] | undefined,
    f: Frame,
  ): Promise<Signal> {
    if (await this.cond(c, f)) return this.block(then, f);
    return otherwise ? this.block(otherwise, f) : NORMAL;
  }

  private async caseA(s: Extract<Stmt, { k: 'case' }>, f: Frame): Promise<Signal> {
    for (const arm of s.arms) if (await this.cond(arm.cond, f)) return this.block(arm.body, f);
    return s.dflt ? this.block(s.dflt, f) : NORMAL;
  }

  private async loopStep(node: At): Promise<void> {
    if (++this.steps >= this.nextCheck) await this.at(this.checkpoint(), node);
  }

  private async number(e: Expr, f: Frame, what: string): Promise<number> {
    const v = await this.evA(e, f);
    if (v.kind !== 'real') {
      throw new PplFault('type', `${what} must be a number, not ${typeName(v)}`, e.pos, e.end);
    }
    return v.v;
  }

  private async forA(s: Extract<Stmt, { k: 'for' }>, f: Frame): Promise<Signal> {
    const from = await this.number(s.from, f, 'the start of FOR');
    const to = await this.number(s.to, f, 'the end of FOR');
    const step = s.step ? await this.number(s.step, f, 'STEP') : 1;
    if (!(step > 0)) {
      const where = s.step ?? s;
      throw new PplFault(
        'domain',
        'STEP must be positive (use DOWNTO to count down)',
        where.pos,
        where.end,
      );
    }
    const tol = step * 1e-10;
    const delta = s.down ? -step : step;
    let x = from;
    this.write(s.v, real(x), f);
    for (;;) {
      if (s.down ? x < to - tol : x > to + tol) return NORMAL;
      const r = await this.block(s.body, f);
      if (r === BREAK) return NORMAL;
      if (r === RETURN) return r;
      const cur = this.readRaw(s.v, f);
      if (cur.kind !== 'real') {
        throw new PplFault(
          'type',
          `the loop variable ${s.v.name} must stay a number`,
          s.pos,
          s.end,
        );
      }
      x = cur.v + delta;
      this.write(s.v, real(x), f);
      await this.loopStep(s);
    }
  }

  private async whileA(c: Expr, body: readonly Stmt[], f: Frame): Promise<Signal> {
    for (;;) {
      if (!(await this.cond(c, f))) return NORMAL;
      const r = await this.block(body, f);
      if (r === BREAK) return NORMAL;
      if (r === RETURN) return r;
      await this.loopStep(c);
    }
  }

  private async repeatA(body: readonly Stmt[], c: Expr, f: Frame): Promise<Signal> {
    for (;;) {
      const r = await this.block(body, f);
      if (r === BREAK) return NORMAL;
      if (r === RETURN) return r;
      if (await this.cond(c, f)) return NORMAL;
      await this.loopStep(c);
    }
  }
}

/**
 * Runs the exported function `name` (any case) of a compiled program with `args`. Resolves to its
 * value (RETURN, else the value of the last statement, else 0) or to an error with position.
 */
export async function run(
  program: Program,
  name: string,
  args: readonly PplValue[],
  host: Host,
  options: RunOptions = {},
): Promise<RunResult> {
  const starts = program.lineStarts;
  const fn = program.functions.get(name.toUpperCase());
  if (!fn?.exported) {
    const error = makeError(starts, 'unknown-function', `${name} is not an exported function`, 0);
    return { ok: false, error, steps: 0 };
  }
  if (args.length !== fn.params.length) {
    const message = `${fn.name} takes ${fn.params.length} argument(s), not ${args.length}`;
    return { ok: false, error: makeError(starts, 'syntax', message, fn.pos), steps: 0 };
  }
  const it = new Interpreter(program, host, options);
  try {
    await it.initProgram();
    const value = await it.callUser(fn, args, { pos: fn.pos, end: fn.pos + fn.name.length });
    return { ok: true, value, steps: it.steps };
  } catch (x) {
    if (x instanceof PplFault) {
      const pos = x.pos < 0 ? fn.pos : x.pos;
      return {
        ok: false,
        error: makeError(starts, x.code, x.message, pos, x.end),
        steps: it.steps,
      };
    }
    if (x instanceof RangeError) {
      const message = 'too many nested calls (the call stack overflowed)';
      return {
        ok: false,
        error: makeError(starts, 'recursion-limit', message, fn.pos),
        steps: it.steps,
      };
    }
    const message = `internal error: ${x instanceof Error ? x.message : String(x)}`;
    return {
      ok: false,
      error: makeError(starts, 'not-evaluable', message, fn.pos),
      steps: it.steps,
    };
  }
}
