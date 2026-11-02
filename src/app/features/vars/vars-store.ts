import { Injectable, computed, inject, signal } from '@angular/core';
import type { Expr } from '../../../math/ast/nodes';
import type { UserFunction } from '../../../math/numeric/evaluate';
import { StorageApi } from '../../core/storage/storage-api';
import { functionsDoc, loadFunctions, loadVariables, variablesDoc } from './vars-logic';

/** User variables and functions, persisted in the documents `variables` and `functions` (prompt 008). */
@Injectable({ providedIn: 'root' })
export class VarsStore {
  private readonly storage = inject(StorageApi);
  private readOnly = { variables: false, functions: false };

  readonly variables = signal<ReadonlyMap<string, Expr>>(new Map());
  readonly functions = signal<ReadonlyMap<string, UserFunction>>(new Map());
  readonly functionNames = computed(() => new Set(this.functions().keys()));
  /** Problem while loading or saving, for the status line. */
  readonly problem = signal<string | null>(null);

  async restore(): Promise<void> {
    try {
      const fns = loadFunctions((await this.storage.load('functions')).value);
      const vars = loadVariables(
        (await this.storage.load('variables')).value,
        new Set(fns.map.keys()),
      );
      this.functions.set(fns.map);
      this.variables.set(vars.map);
      this.readOnly = { variables: vars.readOnly, functions: fns.readOnly };
      if (fns.skipped + vars.skipped > 0) {
        this.problem.set(`${fns.skipped + vars.skipped} unreadable variable(s) skipped`);
      }
    } catch {
      this.problem.set('Variables could not be loaded.');
    }
  }

  setVariable(name: string, value: Expr): void {
    const next = new Map(this.variables());
    next.set(name, value);
    const fns = new Map(this.functions());
    const hadFn = fns.delete(name);
    this.variables.set(next);
    this.save('variables');
    if (hadFn) {
      this.functions.set(fns);
      this.save('functions');
    }
  }

  setFunction(name: string, fn: UserFunction): void {
    const next = new Map(this.functions());
    next.set(name, fn);
    const vars = new Map(this.variables());
    const hadVar = vars.delete(name);
    this.functions.set(next);
    this.save('functions');
    if (hadVar) {
      this.variables.set(vars);
      this.save('variables');
    }
  }

  purge(name: string): boolean {
    const vars = new Map(this.variables());
    const fns = new Map(this.functions());
    const v = vars.delete(name);
    const f = fns.delete(name);
    if (v) {
      this.variables.set(vars);
      this.save('variables');
    }
    if (f) {
      this.functions.set(fns);
      this.save('functions');
    }
    return v || f;
  }

  private save(which: 'variables' | 'functions'): void {
    if (this.readOnly[which]) {
      this.problem.set(`${which} were saved by a newer ABA-X1 version – changes are not stored`);
      return;
    }
    const doc =
      which === 'variables' ? variablesDoc(this.variables()) : functionsDoc(this.functions());
    this.storage.save(which, doc).catch(() => this.problem.set('Variables could not be saved.'));
  }
}
