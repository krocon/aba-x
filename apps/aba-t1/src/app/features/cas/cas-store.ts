import { Injectable, inject, signal } from '@angular/core';
import { ComputeClient } from '@aba/core/compute/compute-client';
import { StorageApi } from '@aba/core/storage/storage-api';
import type { Expr } from '@aba/math/ast/nodes';
import type { UserFunction } from '@aba/math/numeric/evaluate';
import { HomeStore } from '../home/home-store';
import { displayOptions } from '../home/home-logic';
import { SettingsStore } from '../settings/settings-store';
import { type CasAnswer, answerOf, casScope, parseCasInput } from './cas-logic';

export interface CasEntry {
  input: string;
  answer: CasAnswer | null;
  note?: string;
  error?: boolean;
}

const DOC_VERSION = 1;
const MAX = 200;

interface CasDoc {
  version: number;
  entries: CasEntry[];
  variables: [string, Expr][];
  functions: [string, UserFunction][];
}

/**
 * State of the CAS view (prompt 029): own history, CAS variables and functions. Each line runs in
 * the compute worker (`runCas`); home variables with capital names are visible as numbers.
 */
@Injectable({ providedIn: 'root' })
export class CasStore {
  private readonly compute = inject(ComputeClient);
  private readonly storage = inject(StorageApi);
  private readonly home = inject(HomeStore);
  private readonly settings = inject(SettingsStore);

  readonly entries = signal<CasEntry[]>([]);
  readonly variables = signal<ReadonlyMap<string, Expr>>(new Map());
  readonly functions = signal<ReadonlyMap<string, UserFunction>>(new Map());
  readonly selected = signal<number | null>(null);
  readonly busy = signal(false);

  async load(): Promise<void> {
    try {
      const d = (await this.storage.load<CasDoc>('cas')).value;
      if (d?.version === DOC_VERSION && Array.isArray(d.entries)) {
        this.entries.set(d.entries.slice(-MAX));
        this.variables.set(new Map(d.variables ?? []));
        this.functions.set(new Map(d.functions ?? []));
      }
    } catch (e) {
      console.error(e);
    }
  }

  /** Runs one line; `approx` = this line as decimal (≈). Returns false for an empty line. */
  async submit(src: string, approx = false, noSolution = 'no solution'): Promise<boolean> {
    if (!src.trim()) {
      const last = this.entries().at(-1);
      return last ? this.submit(last.input, approx, noSolution) : false;
    }
    const p = parseCasInput(src, new Set(this.functions().keys()));
    if (!p.ok) {
      this.append({ input: src, answer: null, note: p.error.message, error: true });
      return true;
    }
    const st = p.value;
    if (st.kind === 'define') {
      this.functions.update((m) => new Map(m).set(st.name, { params: st.params, body: st.body }));
      this.append({ input: src, answer: null, note: 'Done' });
      return true;
    }
    const expr = st.expr;
    this.busy.set(true);
    const r = await this.compute
      .run({
        op: 'cas',
        expr,
        scope: casScope(this.variables(), this.functions(), this.home.variables()),
      })
      .finally(() => this.busy.set(false));
    if (!r.ok) {
      this.append({ input: src, answer: null, note: r.error.message, error: true });
      return true;
    }
    const s = this.settings.settings();
    const answer = answerOf(
      r.value,
      approx || s.casMode === 'approx',
      displayOptions(s),
      noSolution,
    );
    if (st.kind === 'assign') {
      if (!answer.expr) {
        this.append({
          input: src,
          answer: null,
          note: 'only a single value can be stored',
          error: true,
        });
        return true;
      }
      this.variables.update((m) => new Map(m).set(st.name, answer.expr!));
    }
    this.append({ input: src, answer });
    return true;
  }

  cancel(): void {
    if (!this.busy()) return;
    this.compute.cancelAll();
    this.busy.set(false);
  }

  clearHistory(): void {
    this.entries.set([]);
    this.selected.set(null);
    this.save();
  }

  moveSelection(step: 1 | -1): void {
    const n = this.entries().length;
    if (!n) return;
    const cur = this.selected();
    if (cur === null) {
      if (step === 1) this.selected.set(n - 1);
      return;
    }
    const next = cur - step;
    this.selected.set(next >= n ? null : Math.max(0, next));
  }

  private append(e: CasEntry): void {
    this.entries.update((l) => [...l, e].slice(-MAX));
    this.selected.set(null);
    this.save();
  }

  private save(): void {
    const doc: CasDoc = {
      version: DOC_VERSION,
      entries: this.entries(),
      variables: [...this.variables()],
      functions: [...this.functions()],
    };
    void this.storage.save('cas', doc).catch((e) => console.error(e));
  }
}
