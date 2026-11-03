import { Injectable, inject, signal } from '@angular/core';
import { FilesApi } from '@aba/core/files/files-api';
import { HistoryStore } from '../history/history-store';
import { historyDoc, loadHistory, withoutId } from '../history/history-logic';
import { functionsDoc, loadFunctions, loadVariables, variablesDoc } from '../vars/vars-logic';
import { VarsStore } from '../vars/vars-store';
import {
  type Bundle,
  type ImportSummary,
  buildBundle,
  bundleFileName,
  parseBundle,
} from './backup-logic';

const FILTER = { name: 'ABA-X1 backup', extensions: ['json'] };

/** Export and import of all user data (prompt 017). Import asks first (dialog). */
@Injectable({ providedIn: 'root' })
export class BackupStore {
  private readonly files = inject(FilesApi);
  private readonly vars = inject(VarsStore);
  private readonly history = inject(HistoryStore);

  /** Import waiting for confirmation. */
  readonly pending = signal<{ name: string; bundle: Bundle; summary: ImportSummary } | null>(null);
  readonly message = signal<string | null>(null);

  async exportData(settings?: unknown): Promise<void> {
    const bundle = buildBundle({
      variables: variablesDoc(this.vars.variables()),
      functions: functionsDoc(this.vars.functions()),
      history: historyDoc(this.history.entries()),
      ...(settings !== undefined ? { settings } : {}),
    });
    try {
      const name = await this.files.saveText(
        bundleFileName(),
        JSON.stringify(bundle, null, 2),
        FILTER,
      );
      if (name) this.message.set(`Exported to ${name}`);
    } catch (e) {
      this.message.set(`Export failed: ${(e as { message?: string }).message ?? e}`);
    }
  }

  async chooseImport(): Promise<void> {
    try {
      const file = await this.files.openText(FILTER);
      if (!file) return;
      const r = parseBundle(file.text);
      if (!r.ok) {
        this.message.set(`Import failed: ${r.message}`);
        return;
      }
      this.pending.set({ name: file.name, bundle: r.bundle, summary: r.summary });
    } catch (e) {
      this.message.set(`Import failed: ${(e as { message?: string }).message ?? e}`);
    }
  }

  /** Applies the pending import: variables/functions with the same name are replaced, history appended. */
  confirmImport(applySettings?: (settings: unknown) => void): void {
    const p = this.pending();
    if (!p) return;
    const fns = loadFunctions(p.bundle.data.functions);
    const vars = loadVariables(
      p.bundle.data.variables,
      new Set([...fns.map.keys(), ...this.vars.functions().keys()]),
    );
    for (const [name, f] of fns.map) this.vars.setFunction(name, f);
    for (const [name, v] of vars.map) this.vars.setVariable(name, v);
    const hist = loadHistory(p.bundle.data.history);
    this.history.append(hist.list.map(withoutId));
    if (p.bundle.data.settings !== undefined) applySettings?.(p.bundle.data.settings);
    const skipped = fns.skipped + vars.skipped + hist.skipped;
    this.message.set(
      `Imported ${vars.map.size} variable(s), ${fns.map.size} function(s), ${hist.list.length} history entries` +
        (skipped ? ` – ${skipped} unreadable item(s) skipped` : ''),
    );
    this.pending.set(null);
  }

  cancelImport(): void {
    this.pending.set(null);
  }
}
