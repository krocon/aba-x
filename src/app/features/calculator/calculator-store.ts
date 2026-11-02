import { Injectable, signal } from '@angular/core';
import { StackEntry, drop, push, swap, top } from './entry-stack';
import {
  EditCommand,
  KeyAction,
  KeyDef,
  Shift,
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

/**
 * State of the calculator device: entry stack, shift/alpha annunciators, the key lit by the
 * hardware keyboard and a one-line message. Keys from the virtual keypad and from the
 * hardware keyboard end up here.
 */
@Injectable({ providedIn: 'root' })
export class CalculatorStore {
  private editor: MathEditor | null = null;
  private nextId = 1;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  readonly stack = signal<StackEntry[]>([]);
  readonly shift = signal<Shift>('none');
  readonly alpha = signal(false);
  readonly message = signal<string | null>(null);
  readonly litKey = signal<string | null>(null);

  attach(editor: MathEditor | null): void {
    this.editor = editor;
  }

  press(key: KeyDef): void {
    const action = resolveKey(key, this.shift());
    this.shift.set(nextShift(this.shift(), action));
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
        this.enter();
        break;
      case 'clear':
        this.editor?.clear();
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
    if (action.kind !== 'enter') this.editor?.focus();
  }

  /** Line → level 1. An empty line duplicates level 1, as on RPN calculators. */
  enter(): void {
    const latex = this.editor?.latex().trim() ?? '';
    const value = latex || top(this.stack())?.latex;
    if (!value) return;
    this.stack.update((s) => push(s, value, this.nextId++));
    this.editor?.clear();
    this.editor?.focus();
  }

  /** Lights the virtual key that matches a hardware key for a moment. */
  flash(keyId: string): void {
    this.litKey.set(keyId);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.litKey.set(null), 120);
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
