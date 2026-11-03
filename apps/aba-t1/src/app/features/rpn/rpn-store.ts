import { Injectable, inject, signal } from '@angular/core';
import { StorageApi } from '@aba/core/storage/storage-api';
import type { Expr } from '@aba/math/ast/nodes';
import { type MathResult, ok } from '@aba/math/result';
import * as R from '@aba/math/rpn/rpn-stack';
import type { Value } from '@aba/math/value/value';
import { HomeStore } from '../home/home-store';

const DOC_VERSION = 1;

/**
 * The RPN stack of the home view (prompt 028): operations from `@aba/math/rpn`, evaluation of
 * typed lines through the home store (same variables, functions and settings), persistence.
 */
@Injectable({ providedIn: 'root' })
export class RpnStore {
  private readonly storage = inject(StorageApi);
  private readonly home = inject(HomeStore);
  readonly stack = signal<R.Stack>([]);
  /** selected level (1 = bottom), null = none */
  readonly selected = signal<number | null>(null);
  readonly message = signal<string | null>(null);

  async load(): Promise<void> {
    try {
      const doc = await this.storage.load<{ version: number; stack: Value[] }>('rpn');
      if (doc.value?.version === DOC_VERSION && Array.isArray(doc.value.stack)) {
        this.stack.set(doc.value.stack);
      }
    } catch (e) {
      console.error(e);
    }
  }

  /** Runs a stack operation; an error leaves the stack and shows the message. */
  run(f: (s: R.Stack) => MathResult<R.Stack>): boolean {
    const r = f(this.stack());
    if (!r.ok) {
      this.message.set(r.error.message);
      return false;
    }
    this.set(r.value);
    return true;
  }

  apply(op: R.Operation): boolean {
    return this.run((s) => R.apply(s, op, this.home.scope()));
  }

  /** Evaluates a typed expression and pushes its value. */
  async pushExpr(expr: Expr): Promise<boolean> {
    const r = await this.home.evaluate(expr);
    if (!r.ok) {
      this.message.set(r.error.message);
      return false;
    }
    return this.run((s) => ok(R.push(s, r.value)));
  }

  /** Sto ▶: level 1 is stored under the name (the stack keeps it). */
  store(name: string): boolean {
    const v = R.level(this.stack(), 1);
    if (!v) {
      this.message.set('needs 1 argument on the stack');
      return false;
    }
    this.home.store(name, v);
    return true;
  }

  moveSelection(step: 1 | -1): void {
    const n = this.stack().length;
    if (!n) return;
    const cur = this.selected();
    const next = cur === null ? (step === 1 ? 1 : null) : cur + step;
    this.selected.set(next === null || next < 1 ? null : Math.min(n, next));
  }

  clear(): void {
    this.set([]);
  }

  private set(s: R.Stack): void {
    this.stack.set(s);
    this.message.set(null);
    this.selected.set(null);
    void this.storage
      .save('rpn', { version: DOC_VERSION, stack: s })
      .catch((e) => console.error(e));
  }
}
