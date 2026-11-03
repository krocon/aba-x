import { Injectable, inject, signal } from '@angular/core';
import { FilesApi } from '@aba/core/files/files-api';
import { APP_IDENTITY } from '@aba/core/platform/platform-api';
import { StorageApi } from '@aba/core/storage/storage-api';
import { AppStore } from '../../apps/app-store';
import type { AppInstance } from '../../apps/app-contract';
import { CasStore } from '../cas/cas-store';
import { HomeStore } from '../home/home-store';
import { NotesStore } from '../notes/notes-store';
import { RpnStore } from '../rpn/rpn-store';
import { SettingsStore } from '../settings/settings-store';
import {
  BACKUP_KEYS,
  OBJECT_FORMAT,
  type ParsedBackup,
  backupFileName,
  buildBackup,
  parseBackup,
  parseObject,
} from './backup-logic';

/**
 * Export and import of ABA-T1 data (prompt 045): a full backup of every stored document, and
 * single apps or notes as files. Desktop: system dialogs; web: download / file selection. An import
 * asks first (`pending`) and then replaces the documents and reloads every store.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly storage = inject(StorageApi);
  private readonly files = inject(FilesApi);
  private readonly identity = inject(APP_IDENTITY);
  private readonly settings = inject(SettingsStore);
  private readonly home = inject(HomeStore);
  private readonly rpn = inject(RpnStore);
  private readonly cas = inject(CasStore);
  private readonly apps = inject(AppStore);
  private readonly notes = inject(NotesStore);
  /** a checked backup waiting for confirmation */
  readonly pending = signal<Extract<ParsedBackup, { ok: true }> | null>(null);
  readonly message = signal<string | null>(null);

  async exportBackup(): Promise<void> {
    const docs: Record<string, unknown> = {};
    for (const k of BACKUP_KEYS) {
      const d = await this.storage.load<unknown>(k).catch(() => ({ value: null }));
      if (d.value !== null) docs[k] = d.value;
    }
    const b = buildBackup(docs, { name: this.identity.name, version: this.identity.version });
    const name = await this.files.saveText(backupFileName(), JSON.stringify(b, null, 1), {
      name: 'ABA-T1 backup',
      extensions: ['json'],
    });
    if (name) this.message.set(`✓ ${name}`);
  }

  async chooseBackup(): Promise<void> {
    const f = await this.files.openText({ name: 'ABA-T1 backup', extensions: ['json'] });
    if (!f) return;
    const p = parseBackup(f.text);
    if (!p.ok) this.message.set(p.message);
    else this.pending.set(p);
  }

  /** Replaces the stored documents with the backup and reloads all stores. */
  async confirmImport(): Promise<void> {
    const p = this.pending();
    this.pending.set(null);
    if (!p) return;
    for (const k of p.keys) await this.storage.save(k, p.backup.docs[k]);
    await Promise.all([
      this.settings.load(),
      this.home.load(),
      this.rpn.load(),
      this.cas.load(),
      this.apps.load(),
      this.notes.load(),
    ]);
    this.message.set(`✓ ${p.keys.join(', ')}`);
  }

  async exportApp(inst: AppInstance): Promise<void> {
    const file = { format: OBJECT_FORMAT, version: 1, kind: 'app', data: inst };
    await this.files.saveText(
      `${inst.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'app'}.aba-t1-app.json`,
      JSON.stringify(file),
      {
        name: 'ABA-T1 app',
        extensions: ['json'],
      },
    );
  }

  async importApp(): Promise<void> {
    const f = await this.files.openText({ name: 'ABA-T1 app', extensions: ['json'] });
    if (!f) return;
    const p = parseObject(f.text, 'app');
    if (!p.ok) {
      this.message.set(p.message);
      return;
    }
    const err = this.apps.importInstance(p.data as AppInstance);
    this.message.set(err ?? `✓ ${(p.data as AppInstance).name}`);
  }

  async importNote(): Promise<void> {
    const f = await this.files.openText({ name: 'Note', extensions: ['md', 'txt'] });
    if (f) this.notes.create(f.text);
  }
}
