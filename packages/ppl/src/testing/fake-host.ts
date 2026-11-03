/**
 * Test helpers: a recording fake host (globals in a map, terminal lines, graphics commands, scripted
 * dialogs and keys) and `runSource` = compile + run with small budgets.
 */
import type { GfxCommand, Host, InputField } from '../host';
import { type RunOptions, type RunResult, run } from '../interpreter';
import { real } from '../math-bridge';
import { compile } from '../parser';
import { type PplValue, formatPpl } from '../values';

export class FakeHost implements Host {
  readonly globals = new Map<string, PplValue>();
  readonly printed: string[] = [];
  readonly gfxLog: GfxCommand[] = [];
  readonly messages: string[] = [];
  readonly forms: { title: string; fields: readonly InputField[] }[] = [];
  inputAnswers: (readonly PplValue[] | null)[] = [];
  chooseAnswers: number[] = [];
  keys: number[] = [];
  readonly down = new Set<number>();
  waited: number[] = [];

  constructor() {
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') this.globals.set(c, real(0));
  }

  get(name: string) {
    return this.globals.get(name);
  }

  set(name: string, value: PplValue) {
    if (!this.globals.has(name)) return false;
    this.globals.set(name, value);
    return true;
  }

  print(text: string) {
    this.printed.push(text);
  }

  clearTerminal() {
    this.printed.length = 0;
  }

  async input(title: string, fields: readonly InputField[]) {
    this.forms.push({ title, fields });
    return this.inputAnswers.shift() ?? null;
  }

  async msgbox(text: string) {
    this.messages.push(text);
  }

  async choose(title: string, items: readonly string[]) {
    this.messages.push(`${title}: ${items.join('|')}`);
    return this.chooseAnswers.shift() ?? 0;
  }

  getKey() {
    return this.keys.shift() ?? null;
  }

  isKeyDown(code: number) {
    return this.down.has(code);
  }

  async wait(seconds: number) {
    this.waited.push(seconds);
  }

  gfx(command: GfxCommand) {
    this.gfxLog.push(command);
  }
}

export const num = (n: number) => real(n);

/** Compiles (must succeed) and runs `name`. */
export async function runSource(
  source: string,
  name: string,
  args: readonly PplValue[] = [],
  host: Host = new FakeHost(),
  options: RunOptions = {},
): Promise<RunResult> {
  const p = compile(source);
  if (!p.ok) throw new Error(`compile error ${p.error.line}:${p.error.column} ${p.error.message}`);
  return run(p.value, name, args, host, { maxSteps: 2_000_000, timeLimitMs: 5000, ...options });
}

/** The value as text, or `error <code> <line>:<column>`. */
export async function value(
  source: string,
  name: string,
  args: readonly number[] = [],
  host: Host = new FakeHost(),
  options: RunOptions = {},
): Promise<string> {
  const r = await runSource(source, name, args.map(real), host, options);
  return r.ok
    ? formatPpl(r.value, {}, true)
    : `error ${r.error.code} ${r.error.line}:${r.error.column} ${r.error.message}`;
}

/** Timers and clock of the test runtime (the package compiles without DOM or Node types). */
const rt = globalThis as unknown as {
  setTimeout(f: () => void, ms: number): unknown;
  performance: { now(): number };
  console: { info(...a: unknown[]): void };
};

export const later = (ms: number, f: () => void) => rt.setTimeout(f, ms);
export const sleep = (ms: number) => new Promise<void>((resolve) => rt.setTimeout(resolve, ms));
export const clock = () => rt.performance.now();
export const report = (...a: unknown[]) => rt.console.info(...a);
