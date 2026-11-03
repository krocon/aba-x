import { Injectable, inject, signal } from '@angular/core';
import type { Value } from '@aba/math/value/value';
import {
  type GfxCommand,
  type Host,
  type InputField,
  type PplError,
  type PplValue,
  type RunOptions,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  type Snapshot,
  formatPpl,
  run,
} from '@aba/ppl';
import { type MathErrorCode, type MathResult, fail, ok } from '@aba/math/result';

const MATH_CODES = [
  'syntax',
  'domain',
  'division-by-zero',
  'no-convergence',
  'not-solvable',
  'timeout',
  'unknown-symbol',
  'unknown-function',
  'not-evaluable',
  'unsupported',
  'cancelled',
] as const;
import { DeviceStore } from '../../core/device/device-store';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { allKeys } from '../device/keypad-model';
import { HomeStore } from '../home/home-store';
import { SettingsStore } from '../settings/settings-store';
import { drawCommand } from './program-graphics';
import { ProgramStore } from './program-store';

/** A dialog a running program waits for (INPUT, MSGBOX, CHOOSE). */
export type ProgramDialog =
  | { kind: 'msgbox'; text: string; done: () => void }
  | {
      kind: 'input';
      title: string;
      fields: readonly InputField[];
      done: (values: readonly string[] | null) => void;
    }
  | { kind: 'choose'; title: string; items: readonly string[]; done: (k: number) => void };

/** Key codes of GETKEY: the position of the key on the keypad (0 = top left). */
export const KEY_CODES: readonly string[] = allKeys().map((k) => k.id);

/** Debugger hooks (prompt 044): called before every statement of a debugged run. */
export type StatementHook = (line: number, column: number, s: Snapshot) => void | Promise<void>;

const MAX_TERMINAL = 2000;

/**
 * Runs exported program functions (prompt 043) against the calculator: home variables A–Z (and
 * other real/complex/list/matrix variables), the terminal, dialogs, the keypad and ten graphics
 * screens. The interpreter is cooperative (it yields every 20 ms), so the display stays live;
 * On cancels. Programs cannot reach the DOM – they only see this host.
 */
@Injectable({ providedIn: 'root' })
export class ProgramRunner {
  private readonly home = inject(HomeStore);
  private readonly settings = inject(SettingsStore);
  private readonly device = inject(DeviceStore);
  private readonly store = inject(ProgramStore);

  readonly terminal = signal<string[]>([]);
  /** the error of the last run with its position (the editor jumps there) */
  readonly lastError = signal<{ program: string; error: PplError } | null>(null);
  readonly running = signal<string | null>(null);
  readonly dialog = signal<ProgramDialog | null>(null);
  /** a graphics screen was drawn on during the run (the display shows G0 then) */
  readonly drew = signal(false);
  /** bumps when a screen changed (views repaint) */
  readonly screenVersion = signal(0);
  readonly screens: (HTMLCanvasElement | null)[] = Array.from({ length: 10 }, () => null);

  /** debugger (prompt 044): where the run is paused, with the variables of the function */
  readonly paused = signal<{ program: string; line: number; snapshot: Snapshot } | null>(null);
  /** breakpoints by program name: 1-based lines */
  readonly breakpoints = signal<ReadonlyMap<string, ReadonlySet<number>>>(new Map());
  private stepping = false;
  /** set by `start` for a debugged run: the hook of the next call */
  private nextHook: ((program: string) => StatementHook) | null = null;
  private resume: (() => void) | null = null;

  private controller: AbortController | null = null;
  private keys: number[] = [];
  private down = new Set<number>();

  constructor() {
    this.device.intercept((p) => this.onKey(p));
    this.home.programs = {
      names: () => [...this.store.exports().values()].map((e) => e.name),
      call: (name, args) => this.call(name, args),
    };
  }

  /** The canvas of a graphics screen (created on first use). */
  screen(n: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    if (!this.screens[n]) {
      const c = document.createElement('canvas');
      c.width = SCREEN_WIDTH;
      c.height = SCREEN_HEIGHT;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      }
      this.screens[n] = c;
    }
    return this.screens[n];
  }

  cancel(): void {
    this.controller?.abort();
    this.continueRun(false);
    const d = this.dialog();
    if (d?.kind === 'msgbox') d.done();
    if (d?.kind === 'input') d.done(null);
    if (d?.kind === 'choose') d.done(0);
  }

  toggleBreakpoint(program: string, line: number): void {
    const all = new Map(this.breakpoints());
    const set = new Set(all.get(program) ?? []);
    if (set.has(line)) set.delete(line);
    else set.add(line);
    all.set(program, set);
    this.breakpoints.set(all);
  }

  /** Debugger: go on to the next statement (step) or to the next breakpoint. */
  continueRun(step: boolean): void {
    this.stepping = step;
    const r = this.resume;
    this.resume = null;
    this.paused.set(null);
    r?.();
  }

  /** A hook for `call` that pauses at breakpoints, or at every statement while stepping. */
  debugHook(program: string, stepFirst: boolean): StatementHook {
    this.stepping = stepFirst;
    let last = -1;
    return (line, _column, snapshot) => {
      // one pause per line: several statements on one line count once
      const bp = this.breakpoints().get(program)?.has(line) ?? false;
      const pause = line !== last && (this.stepping || bp);
      last = line;
      if (!pause) return;
      this.paused.set({ program, line, snapshot });
      return new Promise<void>((res) => (this.resume = res));
    };
  }

  /**
   * Starts an exported function from the catalogue or editor: asks for its arguments, then runs it
   * through the home view (so the call and its result land in the history). `debug` pauses at the
   * first statement (step) or at breakpoints only.
   */
  async start(name: string, debug: 'off' | 'step' | 'breakpoints' = 'off'): Promise<boolean> {
    const fn = this.store.exports().get(name.toLowerCase());
    if (!fn || this.running()) return false;
    let args: string[] = [];
    if (fn.params.length) {
      const values = await new Promise<readonly string[] | null>((resolve) =>
        this.dialog.set({
          kind: 'input',
          title: `${fn.name}(${fn.params.join(', ')})`,
          fields: fn.params.map((p) => ({
            name: p,
            label: p,
            help: '',
            value: { kind: 'real', v: 0 } as PplValue,
          })),
          done: (v) => {
            this.dialog.set(null);
            resolve(v);
          },
        }),
      );
      if (!values) return false;
      args = values.map((v) => v.trim() || '0');
    }
    if (debug !== 'off') this.nextHook = (program) => this.debugHook(program, debug === 'step');
    await this.home.submit(`${fn.name}(${args.join(',')})`, 'text');
    return true;
  }

  clearTerminal(): void {
    this.terminal.set([]);
  }

  /**
   * Runs an exported function by name (any case) with core values as arguments; resolves to its
   * value as a core value (strings are reported as an error – the home view has no strings).
   */
  async call(
    name: string,
    args: readonly Value[],
    hook?: StatementHook,
  ): Promise<MathResult<Value>> {
    const fn = this.store.exports().get(name.toLowerCase());
    if (!fn) return fail('unknown-function', `no exported function ${name}`);
    if (this.running()) return fail('not-evaluable', `${this.running()} is still running`);
    // a debugged start (prompt 044) hands its hook over for the next call
    hook ??= this.nextHook?.(fn.program) ?? undefined;
    this.nextHook = null;
    this.controller = new AbortController();
    this.running.set(fn.name);
    this.drew.set(false);
    this.keys = [];
    const s = this.settings.settings();
    const options: RunOptions = {
      signal: this.controller.signal,
      angle: s.angle,
      complexResults: s.complex !== 'off',
      ...(hook ? { onStatement: hook } : {}),
    };
    try {
      const r = await run(fn.compiled, fn.name, args as PplValue[], this.host(), options);
      if (!r.ok) {
        this.lastError.set({ program: fn.program, error: r.error });
        const where = `${fn.program} ${r.error.line}:${r.error.column}`;
        const code = (MATH_CODES as readonly string[]).includes(r.error.code)
          ? (r.error.code as MathErrorCode)
          : 'not-evaluable';
        return fail(code, `${r.error.message} (${where})`);
      }
      this.lastError.set(null);
      if (r.value.kind === 'string') return ok({ kind: 'real', v: 0 } as Value);
      if (r.value.kind === 'list' && r.value.items.some((x) => x.kind === 'string'))
        return fail('unsupported', 'a list with strings cannot be shown here');
      return ok(r.value as Value);
    } finally {
      this.paused.set(null);
      this.resume = null;
      this.running.set(null);
      this.controller = null;
      this.dialog.set(null);
    }
  }

  /** While a program runs, keys go to its key buffer; On cancels it. */
  private onKey(p: KeyPress): boolean {
    if (!this.running()) return false;
    if (p.id === 'on') {
      this.cancel();
      return true;
    }
    if (this.dialog()) return false;
    const code = KEY_CODES.indexOf(p.id);
    if (code >= 0) {
      this.keys.push(code);
      this.down.add(code);
      setTimeout(() => this.down.delete(code), 150);
    }
    return true;
  }

  private print(text: string): void {
    this.terminal.update((t) => [...t, ...text.split('\n')].slice(-MAX_TERMINAL));
  }

  private host(): Host {
    return {
      get: (name) => this.home.variables().get(name) as PplValue | undefined,
      set: (name, value) => {
        if (value.kind === 'string') return false;
        if (value.kind === 'list' && value.items.some((x) => x.kind === 'string')) return false;
        if (!/^[A-Z]$/.test(name) && !this.home.variables().has(name)) return false;
        this.home.store(name, value as Value);
        return true;
      },
      print: (text) => this.print(text),
      clearTerminal: () => this.clearTerminal(),
      input: (title, fields) =>
        new Promise((resolve) =>
          this.dialog.set({
            kind: 'input',
            title,
            fields,
            done: (values) => {
              this.dialog.set(null);
              resolve(values ? values.map((v, k) => this.parseInput(v, fields[k].value)) : null);
            },
          }),
        ),
      msgbox: (text) =>
        new Promise((resolve) =>
          this.dialog.set({
            kind: 'msgbox',
            text,
            done: () => {
              this.dialog.set(null);
              resolve();
            },
          }),
        ),
      choose: (title, items) =>
        new Promise((resolve) =>
          this.dialog.set({
            kind: 'choose',
            title,
            items,
            done: (k) => {
              this.dialog.set(null);
              resolve(k);
            },
          }),
        ),
      getKey: () => this.keys.shift() ?? null,
      isKeyDown: (code) => this.down.has(code),
      wait: (seconds) =>
        new Promise((resolve) => {
          if (seconds > 0) {
            const t = setTimeout(resolve, seconds * 1000);
            this.controller?.signal.addEventListener('abort', () => {
              clearTimeout(t);
              resolve();
            });
            return;
          }
          // WAIT(0): until a key is pressed
          const poll = setInterval(() => {
            if (this.keys.length || !this.running()) {
              clearInterval(poll);
              resolve();
            }
          }, 50);
        }),
      gfx: (cmd: GfxCommand) => {
        this.drew.set(true);
        drawCommand(cmd, (n) => this.screen(n));
        this.screenVersion.update((v) => v + 1);
      },
    };
  }

  /** A typed INPUT value: a number when it reads as one, else a string. */
  private parseInput(text: string, before: PplValue): PplValue {
    const t = text.trim();
    const n = Number(t.replace(',', '.'));
    if (t && Number.isFinite(n)) return { kind: 'real', v: n } as PplValue;
    if (before.kind === 'string' || t) return { kind: 'string', s: text } as PplValue;
    return before;
  }

  /** A value for the terminal (strings without quotes). */
  show(v: PplValue): string {
    return formatPpl(v);
  }
}
