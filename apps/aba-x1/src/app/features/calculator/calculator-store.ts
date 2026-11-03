import { Injectable, inject, signal } from '@angular/core';
import { I18n } from '../../core/i18n/i18n';
import { SettingsStore } from '../settings/settings-store';
import { bin, neg } from '@aba/math/ast/build';
import type { BinaryOp, Expr } from '@aba/math/ast/nodes';
import type { MathResult } from '@aba/math/result';
import { isFreeName } from '@aba/math/parser/statement';
import type { VarsMenuEntry } from '../vars/vars-logic';
import type { MenuName } from './device/softkeys';
import { GraphStore } from '../graph/graph-store';
import { VarsStore } from '../vars/vars-store';
import { HistoryStore } from '../history/history-store';
import { UiStateStore } from '../../core/ui-state/ui-state-store';
import { CalculatorEngine, type CasOp, type Evaluation } from './calculator-engine';
import { toText } from '@aba/math/serializer';
import {
  type StackEntry,
  drop,
  dropLevel,
  dropN,
  replaceEntry,
  level,
  moveSelection,
  push,
  swap,
  top,
} from './entry-stack';
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
  readonly vars = inject(VarsStore);
  private readonly ui = inject(UiStateStore);
  readonly history = inject(HistoryStore);
  readonly graph = inject(GraphStore);
  private editor: MathEditor | null = null;
  private nextId = 1;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private run$ = 0;
  /** Keys pressed while a computation runs – replayed in order afterwards (like a calculator). */
  private readonly queue: (() => void)[] = [];

  readonly stack = signal<StackEntry[]>([]);
  readonly shift = signal<Shift>('none');
  /** α: off, for one key, or locked (α twice). */
  readonly alpha = signal<'off' | 'once' | 'lock'>('off');
  readonly message = signal<string | null>(null);
  readonly litKey = signal<string | null>(null);
  readonly busy = signal(false);
  /** Selected stack level while browsing the stack (▲ on an empty line), else null. */
  readonly selected = signal<number | null>(null);
  /** Id of the stack entry being edited (its input is in the line; ENTER replaces it in place). */
  readonly editing = signal<number | null>(null);
  private readonly settings = inject(SettingsStore);
  private readonly i18n = inject(I18n);
  /** RAD/DEG and EXACT/APPROX come from the settings (prompt 018). */
  readonly angle = this.settings.angle;
  readonly approxMode = this.settings.approx;
  /**
   * Soft menu: `mode` = the menu of the current mode (Standard: the main menu, CAS: CAS functions),
   * `main` = mode selection, `vars` = the user's variables, `cas-calc` = calculus submenu.
   */
  readonly menu = signal<MenuName>('mode');
  readonly varsPage = signal(0);

  attach(editor: MathEditor | null): void {
    this.editor = editor;
  }

  press(key: KeyDef): void {
    if (this.alpha() !== 'off' && key.alpha && key.action.kind !== 'alpha') {
      const upper = this.shift() === 'left';
      this.shift.set('none');
      if (this.alpha() === 'once') this.alpha.set('off');
      this.run({ kind: 'insert', latex: upper ? key.alpha : key.alpha.toLowerCase() });
      return;
    }
    const action = resolveKey(key, this.shift());
    this.shift.set(nextShift(this.shift(), action));
    if (this.busy() && action.kind !== 'clear') {
      this.queue.push(() => this.pressResolved(key, action));
      return;
    }
    this.pressResolved(key, action);
  }

  private pressResolved(key: KeyDef, action: KeyAction): void {
    if (this.browse(action)) return;
    if (this.rpn(key, action)) return;
    this.run(action);
  }

  /** ▲ on an empty line starts browsing the stack; while browsing, keys act on the selection. */
  private browse(action: KeyAction): boolean {
    if (this.menu() === 'hist') return this.histKey(action);
    if (this.ui.mode() === 'graph' && (this.editor?.latex().trim() ?? '') === '') {
      return this.graphKey(action);
    }
    const sel = this.selected();
    if (sel === null) {
      const empty = (this.editor?.latex().trim() ?? '') === '';
      if (
        action.kind === 'command' &&
        action.command === 'moveUp' &&
        empty &&
        this.stack().length > 0
      ) {
        this.selected.set(1);
        return true;
      }
      return false;
    }
    if (action.kind === 'command') {
      if (action.command === 'moveUp') this.moveSelection(1);
      else if (action.command === 'moveDown') this.moveSelection(-1);
      else if (action.command === 'deleteBackward' || action.command === 'deleteForward')
        this.dropSelected();
      else this.selected.set(null);
      return true;
    }
    if (action.kind === 'enter') {
      this.editLevel(sel);
      return true;
    }
    if (action.kind === 'clear') {
      this.selected.set(null);
      return true;
    }
    this.selected.set(null);
    return false;
  }

  /** Keys in the HIST view: ▲▼ select, ENTER inserts the input, DEL deletes, ON leaves. */
  private histKey(action: KeyAction): boolean {
    if (action.kind === 'command') {
      if (action.command === 'moveUp') this.history.move(1);
      else if (action.command === 'moveDown') this.history.move(-1);
      else if (action.command === 'deleteBackward' || action.command === 'deleteForward') {
        const c = this.history.current();
        if (c) this.history.remove(c.id);
      }
      return true;
    }
    if (action.kind === 'enter') {
      this.histUse('input');
      return true;
    }
    if (action.kind === 'clear') {
      this.closeHistory();
      return true;
    }
    return false;
  }

  /**
   * Graph mode with an empty line (prompt 014): arrows pan (or move the trace cursor / switch the
   * traced function), + and − zoom, ON ends trace and clears marks.
   */
  graphKey(action: KeyAction): boolean {
    const g = this.graph;
    const tracing = g.trace() !== null;
    if (action.kind === 'command') {
      switch (action.command) {
        case 'moveUp':
          if (tracing) g.selectNext(-1);
          else g.panBy(0, 0.1);
          return true;
        case 'moveDown':
          if (tracing) g.selectNext(1);
          else g.panBy(0, -0.1);
          return true;
        case 'moveToPreviousChar':
          if (tracing) g.traceStep(-1);
          else g.panBy(-0.1, 0);
          return true;
        case 'moveToNextChar':
          if (tracing) g.traceStep(1);
          else g.panBy(0.1, 0);
          return true;
        default:
          return false;
      }
    }
    if (action.kind === 'insert' && (action.latex === '+' || action.latex === '-')) {
      g.zoomBy(action.latex === '+' ? 0.7 : 1 / 0.7);
      return true;
    }
    if (action.kind === 'clear') {
      g.endTrace();
      g.clearMarks();
      g.listOpen.set(false);
      return true;
    }
    // ENTER on an empty line does nothing in graph mode (no stack here)
    return action.kind === 'enter';
  }

  isGraphMode(): boolean {
    return this.ui.mode() === 'graph';
  }

  /** Y= EDIT: the selected function goes back into the line for editing. */
  editFunction(): void {
    const f = this.graph.current();
    if (!f) return;
    this.graph.remove(this.graph.selected());
    this.graph.listOpen.set(false);
    this.editor?.clear();
    this.editor?.insert(f.latex);
    this.editor?.focus();
  }

  openHistory(): void {
    this.menu.set('hist');
    this.history.selected.set(this.history.entries().at(-1)?.id ?? null);
  }

  closeHistory(): void {
    this.menu.set('mode');
    this.history.selected.set(null);
    this.editor?.focus();
  }

  /** Inserts the input or the result of the selected history entry and leaves HIST. */
  histUse(what: 'input' | 'result'): void {
    const c = this.history.current();
    this.closeHistory();
    if (c) this.editor?.insert(what === 'input' ? c.input : c.result);
  }

  moveSelection(delta: number): void {
    if (this.selected() === null && delta > 0 && this.stack().length > 0) {
      this.selected.set(1);
      return;
    }
    const next = moveSelection(this.selected(), delta, this.stack().length);
    // ▼ below level 1 leaves the stack
    this.selected.set(this.selected() === 1 && delta < 0 ? null : next);
  }

  /** VARS softkey: insert the name; left shift stores level 1 under it, right shift purges it. */
  varsSoftkey(entry: VarsMenuEntry): void {
    const shift = this.shift();
    this.shift.set('none');
    this.message.set(null);
    switch (entry.kind) {
      case 'exit':
        this.menu.set('mode');
        return;
      case 'next':
        this.varsPage.update((p) => p + 1);
        return;
      default: {
        if (shift === 'left') {
          this.sto(entry.name);
          return;
        }
        if (shift === 'right') {
          if (this.vars.purge(entry.name)) {
            this.message.set(this.i18n.t('msg.purged', { name: entry.name }));
          }
          return;
        }
        const name = entry.name.length === 1 ? entry.name : `\\mathrm{${entry.name}}`;
        if (entry.kind === 'fn') {
          const args = Array.from({ length: entry.arity }, (_, i) => (i === 0 ? '#0' : '#?')).join(
            ',',
          );
          this.editor?.insert(`${name}\\left(${args}\\right)`);
        } else this.editor?.insert(name);
        this.editor?.focus();
      }
    }
  }

  /** The selected entry (or level 1) – for copying. */
  current(): StackEntry | null {
    return level(this.stack(), this.selected() ?? 1);
  }

  /**
   * Edit a stack level (click on it, or ENTER while browsing): its input goes into the line,
   * ENTER then replaces the level in place, Esc/ON cancels.
   */
  editLevel(n: number): void {
    const e = level(this.stack(), n);
    if (!e) return;
    this.selected.set(null);
    this.editing.set(e.id);
    this.editor?.clear();
    this.editor?.insert(e.input ?? e.latex);
    this.message.set(this.i18n.t('msg.editing', { n }));
    this.editor?.focus();
  }

  cancelEdit(): void {
    if (this.editing() === null) return;
    this.editing.set(null);
    this.editor?.clear();
    this.message.set(null);
  }

  recallSelected(): void {
    const e = this.current();
    this.selected.set(null);
    if (e) this.editor?.insert(e.latex);
    this.editor?.focus();
  }

  dropSelected(): void {
    const n = this.selected();
    if (n === null) return;
    this.stack.update((s) => dropLevel(s, n));
    const size = this.stack().length;
    this.selected.set(size === 0 ? null : Math.min(n, size));
  }

  /** Text for the clipboard: plain text and LaTeX of the selected entry (or level 1). */
  clipboardText(): { text: string; latex: string } | null {
    const e = this.current();
    return e ? { text: e.text ?? toText(e.expr), latex: e.latex } : null;
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
        else if (this.editing() !== null) this.cancelEdit();
        else this.editor?.clear();
        break;
      case 'shift':
        break;
      case 'alpha':
        this.alpha.update((a) => (a === 'off' ? 'once' : a === 'once' ? 'lock' : 'off'));
        break;
      case 'stack':
        this.stackOp(action.op);
        break;
      case 'sto':
        this.sto();
        break;
      case 'vars':
        this.menu.set(this.menu() === 'vars' ? 'mode' : 'vars');
        this.varsPage.set(0);
        break;
      case 'planned':
        this.message.set(this.i18n.t('msg.notAvailable', { what: action.what }));
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
    if (this.ui.mode() === 'graph') {
      const err = this.graph.add(latex);
      if (err) this.message.set(err);
      else {
        this.message.set(null);
        this.editor?.clear();
      }
      return;
    }
    const mode = this.ui.mode() === 'cas' ? 'cas' : 'standard';
    const r = await this.guardAny(() =>
      this.engine.evaluateStatement(latex, this.context(approx), mode),
    );
    if (!r) return;
    if (!r.ok) {
      this.message.set(r.error.message);
      return;
    }
    const o = r.value;
    const edited = this.editing();
    this.editing.set(null);
    if (o.kind === 'value' && edited !== null) this.pushEvaluation(o.evaluation, edited);
    else if (o.kind === 'value') this.pushEvaluation(o.evaluation);
    else if (o.kind === 'assign') {
      this.vars.setVariable(o.name, o.evaluation.expr);
      this.message.set(`${o.name} := ${toText(o.evaluation.expr)}`);
    } else {
      this.vars.setFunction(o.name, { params: o.params, body: o.body });
      this.message.set(`${o.name}(${o.params.join(', ')}) := ${toText(o.body)}`);
    }
    this.editor?.clear();
    this.editor?.focus();
  }

  /**
   * CAS menu operation on the input line, or on level 1 when the line is empty (the result
   * replaces it). The note (n ∈ ℤ, + C, unchecked) goes to the message line.
   */
  async casOp(op: CasOp): Promise<void> {
    if (this.busy()) {
      this.queue.push(() => void this.casOp(op));
      return;
    }
    this.message.set(null);
    const line = this.editor?.latex().trim() ?? '';
    let target: Expr;
    if (line) {
      const parsed = this.engine.parse(line, { functions: this.vars.functions() });
      if (!parsed.ok) {
        this.message.set(parsed.error.message);
        return;
      }
      target = parsed.value;
    } else {
      const t = top(this.stack());
      if (!t) {
        this.message.set(this.i18n.t('msg.enterFirst'));
        return;
      }
      target = t.expr;
    }
    const r = await this.guard(() => this.engine.casOperation(op, target, this.context(false)));
    if (!r) return;
    if (!r.ok) {
      this.message.set(r.error.message);
      return;
    }
    if (line) this.editor?.clear();
    else this.stack.update(drop);
    this.pushEvaluation(r.value);
    if (r.value.note) this.message.set(r.value.note);
    this.editor?.focus();
  }

  /** Inserts a template into the line (CALC menu: ∫, d/dx, lim). */
  insertTemplate(latex: string): void {
    this.editor?.insert(latex);
    this.editor?.focus();
  }

  /** STO: the input line holds a name, level 1 is stored under it. */
  sto(name?: string): void {
    const target =
      name ??
      this.editor
        ?.latex()
        .trim()
        .replace(/^\\mathrm\{(.*)\}$/, '$1') ??
      '';
    const t = top(this.stack());
    if (!isFreeName(target) || !t) {
      this.message.set(this.i18n.t('msg.sto'));
      return;
    }
    this.vars.setVariable(target, t.expr);
    this.stack.update(drop);
    if (!name) this.editor?.clear();
    this.message.set(`${target} := ${t.text ?? t.latex}`);
  }

  /** Replays queued keys until one of them starts a new computation. */
  private drain(): void {
    while (this.queue.length > 0 && !this.busy()) this.queue.shift()!();
  }

  clearStack(): void {
    this.selected.set(null);
    this.stack.set([]);
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
    this.settings.update({ angle: this.angle() === 'rad' ? 'deg' : 'rad' });
  }

  toggleApprox(): void {
    this.settings.update({ approx: !this.approxMode() });
  }

  private context(approx: boolean) {
    return {
      angle: this.angle(),
      approx: approx || this.approxMode(),
      ans: top(this.stack())?.expr,
      variables: this.vars.variables(),
      functions: this.vars.functions(),
      digits: this.settings.digits(),
    };
  }

  private guard(f: () => Promise<MathResult<Evaluation>>): Promise<MathResult<Evaluation> | null> {
    return this.guardAny(f);
  }

  /** Runs an evaluation with busy flag; stale results (after a newer run) are dropped. */
  private async guardAny<T>(f: () => Promise<MathResult<T>>): Promise<MathResult<T> | null> {
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

  private pushEvaluation(v: Evaluation, replaceId?: number): void {
    this.history.add(v.input, v.latex, toText(v.expr));
    const text = toText(v.expr);
    const typed = this.engine.parse(v.input, { functions: this.vars.functions() });
    const entry = {
      expr: v.expr,
      latex: v.latex,
      approximate: v.approximate,
      input: v.input,
      showInput: !typed.ok || toText(typed.value) !== text,
      text,
      ...(v.approx && !this.approxMode() ? { approx: v.approx.latex } : {}),
    };
    if (replaceId !== undefined) {
      this.stack.update((s) => replaceEntry(s, replaceId, entry, this.nextId++));
    } else this.pushEntry(entry);
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
