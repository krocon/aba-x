import { Injectable, inject, signal } from '@angular/core';
import { DeviceStore } from '../../core/device/device-store';
import { HomeStore } from '../../features/home/home-store';
import { drawCommand } from '../../features/programs/program-graphics';
import { ProgramRunner } from '../../features/programs/program-runner';
import { type FromWorker, type ToWorker, fromJson, toJson } from './python-protocol';

export interface OutLine {
  text: string;
  err?: boolean;
  input?: boolean;
}

export interface PythonResult {
  ok: boolean;
  error?: string;
  line?: number;
}

/** A program may compute this long before it is stopped (On stops it earlier). */
const TIME_LIMIT_MS = 60_000;
const MAX_OUT = 2000;

/**
 * The Python runtime of the app (prompt 047): a worker with MicroPython, started on first use and
 * terminated to cancel (On, time limit). Home variables go in as a snapshot; what a program
 * stores with `calc.set` comes back into the home view. Drawing goes to the screen G0.
 */
@Injectable({ providedIn: 'root' })
export class PythonRunner {
  private readonly home = inject(HomeStore);
  private readonly programs = inject(ProgramRunner);
  readonly output = signal<OutLine[]>([]);
  readonly running = signal(false);
  /** the last run drew on G0 */
  readonly drew = signal(false);
  private worker: Worker | null = null;
  private pending: { id: number; resolve: (r: PythonResult) => void } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;

  constructor() {
    inject(DeviceStore).intercept((p) => {
      if (!this.running()) return false;
      if (p.id === 'on') this.cancel();
      return p.id === 'on';
    });
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') return null;
    const w = new Worker(new URL('./python.worker', import.meta.url), { type: 'module' });
    w.addEventListener('message', (e: MessageEvent<FromWorker>) => this.receive(e.data));
    w.addEventListener('error', (e) => {
      this.print(`Python: ${e.message || 'the runtime could not be loaded'}`, true);
      this.finish({ ok: false, error: 'the runtime could not be loaded' });
    });
    this.worker = w;
    return w;
  }

  print(text: string, err = false, input = false): void {
    this.output.update((o) =>
      [...o, ...text.split('\n').map((t) => ({ text: t, err, input }))].slice(-MAX_OUT),
    );
  }

  clear(): void {
    this.output.set([]);
  }

  /** Runs a shell line or a script; resolves when it ends, fails or is cancelled. */
  run(code: string, mode: 'shell' | 'script'): Promise<PythonResult> {
    if (this.running()) return Promise.resolve({ ok: false, error: 'Python is busy' });
    const w = this.ensureWorker();
    if (!w) return Promise.resolve({ ok: false, error: 'no web workers here' });
    const vars: Record<string, unknown> = {};
    for (const [k, v] of this.home.variables()) {
      const j = toJson(v);
      if (j !== null) vars[k] = j;
    }
    const id = this.nextId++;
    this.running.set(true);
    this.drew.set(false);
    this.timer = setTimeout(() => {
      this.print('stopped: time limit', true);
      this.cancel();
    }, TIME_LIMIT_MS);
    return new Promise((resolve) => {
      this.pending = { id, resolve };
      const msg: ToWorker = { op: 'run', id, code, mode, vars };
      w.postMessage(msg);
    });
  }

  /** On: the worker is terminated (the interpreter state is lost). */
  cancel(): void {
    if (!this.running()) return;
    this.worker?.terminate();
    this.worker = null;
    this.print('KeyboardInterrupt (On) – Python restarted', true);
    this.finish({ ok: false, error: 'cancelled' });
  }

  private finish(r: PythonResult): void {
    clearTimeout(this.timer);
    this.running.set(false);
    const p = this.pending;
    this.pending = null;
    p?.resolve(r);
  }

  private receive(m: FromWorker): void {
    if (m.type === 'out') this.print(m.text, m.err);
    else if (m.type === 'gfx') {
      this.drew.set(true);
      drawCommand(m.cmd, (n) => this.programs.screen(n));
      this.programs.screenVersion.update((v) => v + 1);
    } else if (m.type === 'done' && m.id === this.pending?.id) {
      for (const [name, json] of Object.entries(m.vars)) {
        const v = fromJson(json);
        if (v) this.home.store(name, v);
        else this.print(`calc.set: ${name} cannot hold this value`, true);
      }
      this.finish({
        ok: m.ok,
        ...(m.error ? { error: m.error } : {}),
        ...(m.line !== undefined ? { line: m.line } : {}),
      });
    }
  }
}
