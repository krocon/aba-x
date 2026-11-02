import { Injectable, inject, signal } from '@angular/core';
import { bin, neg } from '../../../math/ast/build';
import type { BinaryOp, Expr } from '../../../math/ast/nodes';
import type { AngleMode, UserFunction } from '../../../math/numeric/evaluate';
import type { MathResult } from '../../../math/result';
import { CalculatorEngine, type Evaluation } from './calculator-engine';
import { type StackEntry, drop, dropN, level, push, swap, top } from './entry-stack';
import {
  type EditCommand,
  type KeyAction,
  type KeyDef,
  type Shift,
  nextShift,
  resolveKey,
} from './keypad/keypad-model';

/** What the store needs from the input line (implemented by `MathInput`). */
export interface MathEditor {
  insert(latex: string): void;
  command(command: EditCommand): void;
  latex(): string;
  clear(): void;
  focus(): void;
}

/** Keys that work on the stack when the input line is empty (RPN, prompt 005 E4). */
const RPN_BINARY: Record<string, BinaryOp> = { add: '+', sub: '-', mul: '*', div: '/', pow: '^' };

/**
 * State of the calculator device: entry stack, shift/alpha, angle mode, busy flag, the key lit by
 * the hardware keyboard and a one-line message. Keys from the virtual keypad and from the
 * hardware keyboard end up here.
 */
@Injectable({ providedIn: 'root' })
export class CalculatorStore {
  private readonly engine = inject(CalculatorEngine);
  private editor: MathEditor | null = null;
  private nextId = 1;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private run$ = 0;
  /** Keys pressed while a computation runs – replayed in order afterwards (like a calculator). */
  private readonly queue: (() => void)[] = [];

  readonly stack = signal<StackEntry[]>([]);
  readonly shift = signal<Shift>('none');
  readonly alpha = signal(false);
  readonly message = signal<string | null>(null);
  readonly litKey = signal<string | null>(null);
  readonly busy = signal(false);
  readonly angle = signal<AngleMode>('rad');
  /** EXACT (default) or APPROX annunciator. */
  readonly approxMode = signal(false);
  /** User variables and functions (prompt 008 fills them). */
  readonly variables = signal<ReadonlyMap<string, Expr>>(new Map());
  readonly functions = signal<ReadonlyMap<string, UserFunction>>(new Map());

  attach(editor: MathEditor | null): void {
    this.editor = editor;
  }

  press(key: KeyDef): void {
    const action = resolveKey(key, this.shift());
    this.shift.set(nextShift(this.shift(), action));
    if (this.busy() && action.kind !== 'clear') {
      this.queue.push(() => this.pressResolved(key, action));
      return;
    }
    this.pressResolved(key, action);
  }

  private pressResolved(key: KeyDef, action: KeyAction): void {
    if (this.rpn(key, action)) return;
    this.run(action);
  }

  run(action: KeyAction): void {
    this.message.set(null);
    switch (action.kind) {
      case 'insert':
        this.editor?.insert(action.latex);
        break;
      case 'command':
        this.editor?.command(action.command);
        break;
      case 'enter':
        void this.enter();
        break;
      case 'approx':
        void this.enter(true);
        break;
      case 'clear':
        if (this.busy()) this.cancel();
        else this.editor?.clear();
        break;
      case 'shift':
        break;
      case 'alpha':
        this.alpha.update((a) => !a);
        break;
      case 'stack':
        this.stackOp(action.op);
        break;
      case 'planned':
        this.message.set(`${action.what}: not available yet`);
        break;
    }
    if (action.kind !== 'enter' && action.kind !== 'approx') this.editor?.focus();
  }

  /**
   * ENTER: evaluates the line and pushes the result. An empty line duplicates level 1 (→NUM: turns
   * level 1 into its decimal value). Errors stay in the message line, the input is kept.
   */
  async enter(approx = false): Promise<void> {
    if (this.busy()) {
      this.queue.push(() => void this.enter(approx));
      return;
    }
    const latex = this.editor?.latex().trim() ?? '';
    if (!latex) {
      const t = top(this.stack());
      if (!t) return;
      if (!approx) {
        this.pushEntry({ ...t });
        return;
      }
      await this.apply(t.expr, 1, true);
      return;
    }
    const r = await this.guard(() => this.engine.evaluate(latex, this.context(approx)));
    if (!r) return;
    if (!r.ok) {
      this.message.set(r.error.message);
      return;
    }
    this.pushEvaluation(r.value);
    this.editor?.clear();
    this.editor?.focus();
  }

  /** Replays queued keys until one of them starts a new computation. */
  private drain(): void {
    while (this.queue.length > 0 && !this.busy()) this.queue.shift()!();
  }

  cancel(): void {
    this.queue.length = 0;
    this.engine.cancel();
  }

  /** Lights the virtual key that matches a hardware key for a moment. */
  flash(keyId: string): void {
    this.litKey.set(keyId);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.litKey.set(null), 120);
  }

  toggleAngle(): void {
    this.angle.update((a) => (a === 'rad' ? 'deg' : 'rad'));
  }

  toggleApprox(): void {
    this.approxMode.update((a) => !a);
  }

  private context(approx: boolean) {
    return {
      angle: this.angle(),
      approx: approx || this.approxMode(),
      ans: top(this.stack())?.expr,
      variables: this.variables(),
      functions: this.functions(),
    };
  }

  /** Runs an evaluation with busy flag; stale results (after a newer run) are dropped. */
  private async guard(
    f: () => Promise<MathResult<Evaluation>>,
  ): Promise<MathResult<Evaluation> | null> {
    const id = ++this.run$;
    this.busy.set(true);
    try {
      const r = await f();
      return id === this.run$ ? r : null;
    } finally {
      if (id === this.run$) {
        this.busy.set(false);
        // after the caller has pushed the result and cleared the line
        setTimeout(() => this.drain());
      }
    }
  }

  /** RPN: operator/function keys on an empty line work on the stack. Returns true if handled. */
  private rpn(key: KeyDef, action: KeyAction): boolean {
    if (action.kind !== 'insert' || this.busy()) return false;
    if ((this.editor?.latex().trim() ?? '') !== '') return false;
    const s = this.stack();
    const op = this.shiftedPlain(key, action) ? RPN_BINARY[key.id] : undefined;
    if (op && s.length >= 2) {
      void this.apply(bin(op, level(s, 2)!.expr, level(s, 1)!.expr), 2);
      return true;
    }
    if (key.id === 'neg' && s.length >= 1) {
      void this.apply(neg(level(s, 1)!.expr), 1);
      return true;
    }
    const unary =
      action.latex.includes('#0') && !action.latex.includes('#?') && !action.latex.includes('#@');
    if (unary && s.length >= 1 && !RPN_BINARY[key.id]) {
      const arg = `\\left(${level(s, 1)!.latex}\\right)`;
      void this.applyLatex(action.latex.replace('#0', arg), 1);
      return true;
    }
    return false;
  }

  private shiftedPlain(key: KeyDef, action: KeyAction): boolean {
    return action === key.action;
  }

  private async apply(e: Expr, consumed: number, approx = false): Promise<void> {
    const r = await this.guard(() => this.engine.evaluateExpr(e, this.context(approx)));
    this.finishStackOp(r, consumed);
  }

  private async applyLatex(latex: string, consumed: number): Promise<void> {
    const r = await this.guard(() => this.engine.evaluate(latex, this.context(false)));
    this.finishStackOp(r, consumed);
  }

  private finishStackOp(r: MathResult<Evaluation> | null, consumed: number): void {
    if (!r) return;
    if (!r.ok) {
      this.message.set(r.error.message);
      return;
    }
    this.stack.update((s) => dropN(s, consumed));
    this.pushEvaluation(r.value);
  }

  private pushEvaluation(v: Evaluation): void {
    this.pushEntry({
      expr: v.expr,
      latex: v.latex,
      approximate: v.approximate,
      input: v.input,
      ...(v.approx && !this.approxMode() ? { approx: v.approx.latex } : {}),
    });
  }

  private pushEntry(e: Omit<StackEntry, 'id'>): void {
    this.stack.update((s) => push(s, e, this.nextId++));
  }

  private stackOp(op: 'drop' | 'swap' | 'recall'): void {
    if (op === 'drop') this.stack.update(drop);
    else if (op === 'swap') this.stack.update(swap);
    else {
      const t = top(this.stack());
      if (t) this.editor?.insert(t.latex);
    }
  }
}
