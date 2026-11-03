import { Injectable, inject } from '@angular/core';
import { AppStore } from '../../apps/app-store';
import { NavStore } from '../../core/nav/nav-store';
import { ProgramRunner } from './program-runner';
import { ProgramStore } from './program-store';

export type AppHook = 'START' | 'RESET' | 'SYMB' | 'PLOT' | 'NUM';

/** The program that belongs to an app instance: its name without spaces and signs. */
export const appProgramName = (instanceName: string) => instanceName.replace(/[^A-Za-z0-9_]/g, '');

/**
 * App programs (prompt 044): a program named like an app (copy) – "My Fn" → MyFn – customises it.
 * Its exported functions without parameters START (when the app starts), RESET (when it is
 * reset), SYMB, PLOT and NUM (instead of the view) take over; anything they PRINT or draw shows
 * in the terminal.
 */
@Injectable({ providedIn: 'root' })
export class AppPrograms {
  private readonly apps = inject(AppStore);
  private readonly store = inject(ProgramStore);
  private readonly runner = inject(ProgramRunner);
  private readonly nav = inject(NavStore);

  /** the program of the current app, if it exports this hook */
  hook(h: AppHook) {
    const name = appProgramName(this.apps.current().name);
    if (!name || !this.store.get(name)) return null;
    const fn = this.runner.find(name, h);
    return fn && fn.params.length === 0 ? fn : null;
  }

  /** Runs a hook if there is one; true = it replaced the default action. */
  async run(h: AppHook): Promise<boolean> {
    const fn = this.hook(h);
    if (!fn) return false;
    this.runner.clearTerminal();
    await this.runner.exec(fn, []);
    if (this.runner.terminal().length || this.runner.drew() || this.runner.lastError())
      this.nav.go('terminal');
    return h !== 'START' && h !== 'RESET';
  }
}
