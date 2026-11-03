import { Injectable, computed, inject, signal } from '@angular/core';
import { ComputeClient } from '@aba/core/compute/compute-client';
import { StorageApi } from '@aba/core/storage/storage-api';
import type { UserFunction } from '@aba/math/numeric/evaluate';
import type { Value } from '@aba/math/value/value';
import { SettingsStore } from '../settings/settings-store';
import {
  type HistoryEntry,
  type InputKind,
  MAX_HISTORY,
  parseHomeInput,
  scopeOf,
} from './home-logic';

const DOC_VERSION = 1;

interface HomeDoc {
  version: number;
  entries: HistoryEntry[];
  variables: [string, Value][];
  functions: [string, UserFunction][];
}

/**
 * State of the home view (prompt 027): history, variables (A–Z and own names), user functions,
 * `Ans`, selection. Evaluation runs in the compute worker; On cancels it. Saved after each change.
 */
@Injectable({ providedIn: 'root' })
export class HomeStore {
  private readonly compute = inject(ComputeClient);
  private readonly storage = inject(StorageApi);
  private readonly settingsStore = inject(SettingsStore);

  readonly entries = signal<HistoryEntry[]>([]);
  readonly variables = signal<ReadonlyMap<string, Value>>(new Map());
  readonly functions = signal<ReadonlyMap<string, UserFunction>>(new Map());
  /** selected history row (index into entries), null = the entry line is active */
  readonly selected = signal<number | null>(null);
  readonly busy = signal(false);
  /** message of the last save problem, shown in the title bar */
  readonly problem = signal<string | null>(null);
  readonly ans = computed(() => this.variables().get('Ans') ?? null);

  async load(): Promise<void> {
    try {
      const doc = await this.storage.load<HomeDoc>('home');
      const d = doc.value;
      if (d && d.version === DOC_VERSION && Array.isArray(d.entries)) {
        this.entries.set(d.entries.slice(-MAX_HISTORY));
        this.variables.set(new Map(d.variables ?? []));
        this.functions.set(new Map(d.functions ?? []));
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Evaluates one input line and appends it to the history. An empty line repeats the last
   * input (like the calculator). Returns false if nothing was done.
   */
  async submit(src: string, kind: InputKind): Promise<boolean> {
    if (!src.trim()) {
      const last = this.entries().at(-1);
      if (!last) return false;
      return this.submit(last.input, last.kind);
    }
    const parsed = parseHomeInput(src, kind, new Set(this.functions().keys()));
    if (!parsed.ok) {
      this.append({ input: src, kind, value: null, note: parsed.error.message, error: true });
      return true;
    }
    const st = parsed.value;
    if (st.kind === 'define') {
      const fns = new Map(this.functions());
      fns.set(st.name, { params: st.params, body: st.body });
      this.functions.set(fns);
      this.append({ input: src, kind, value: null, note: 'Done' });
      return true;
    }
    this.busy.set(true);
    const r = await this.compute.run({
      op: 'evaluate',
      expr: st.expr,
      scope: scopeOf(this.settingsStore.settings(), this.variables(), this.functions()),
    });
    this.busy.set(false);
    if (!r.ok) {
      this.append({ input: src, kind, value: null, note: r.error.message, error: true });
      return true;
    }
    const vars = new Map(this.variables());
    vars.set('Ans', r.value);
    if (st.kind === 'store') vars.set(st.name, r.value);
    this.variables.set(vars);
    this.append({ input: src, kind, value: r.value });
    return true;
  }

  /** On: abandons a running evaluation. */
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

  /** Moves the selection: +1 = older (up), −1 = newer; past the newest back to the entry line. */
  moveSelection(step: 1 | -1): void {
    const n = this.entries().length;
    if (n === 0) return;
    const cur = this.selected();
    if (cur === null) {
      if (step === 1) this.selected.set(n - 1);
      return;
    }
    const next = cur - step;
    this.selected.set(next >= n ? null : Math.max(0, next));
  }

  private append(e: HistoryEntry): void {
    this.entries.update((list) => [...list, e].slice(-MAX_HISTORY));
    this.selected.set(null);
    this.save();
  }

  private save(): void {
    const doc: HomeDoc = {
      version: DOC_VERSION,
      entries: this.entries(),
      variables: [...this.variables()],
      functions: [...this.functions()],
    };
    this.storage.save('home', doc).then(
      () => this.problem.set(null),
      (e: { message?: string }) => this.problem.set(e?.message ?? String(e)),
    );
  }
}
