import { Injectable, inject, signal } from '@angular/core';
import { StorageApi } from '@aba/core/storage/storage-api';
import { AppMode, DEFAULT_UI_STATE, sanitizeUiState } from './ui-state-logic';

/** Selected mode and other small UI state, persisted in the document `ui-state`. */
@Injectable({ providedIn: 'root' })
export class UiStateStore {
  private readonly storage = inject(StorageApi);
  private readOnly = false;

  readonly mode = signal<AppMode>(DEFAULT_UI_STATE.mode);
  /** Last storage problem as a short text for the status line, `null` when all is well. */
  readonly storageProblem = signal<string | null>(null);

  async restore(): Promise<void> {
    try {
      const doc = await this.storage.load<unknown>('ui-state');
      const { state, readOnly } = sanitizeUiState(doc.value);
      this.readOnly = readOnly;
      this.mode.set(state.mode);
      if (doc.setAside) this.storageProblem.set(`Unreadable ${doc.setAside} was set aside.`);
    } catch (e) {
      this.storageProblem.set(describe(e));
    }
  }

  setMode(mode: AppMode): void {
    if (mode === this.mode()) return;
    this.mode.set(mode);
    if (this.readOnly) return;
    this.storage
      .save('ui-state', { ...DEFAULT_UI_STATE, mode })
      .then(() => this.storageProblem.set(null))
      .catch((e: unknown) => this.storageProblem.set(describe(e)));
  }
}

function describe(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  return code === 'unavailable'
    ? 'Browser storage is unavailable – settings are not kept.'
    : 'Saving failed – settings may not be kept.';
}
