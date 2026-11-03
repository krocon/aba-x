/**
 * Backup of ABA-T1 (prompt 045): one JSON file with all stored documents (settings, home, RPN, CAS,
 * apps, notes, programs …). Pure: building, checking and summarising. A file of another app, a
 * broken file or one from a newer version is refused as a whole – never half-imported.
 */
export const BACKUP_FORMAT = 'aba-t1-backup';
export const BACKUP_VERSION = 1;

/** Storage keys that belong to a backup (in import order). */
export const BACKUP_KEYS = ['settings', 'home', 'rpn', 'cas', 'apps', 'notes', 'programs'] as const;
export type BackupKey = (typeof BACKUP_KEYS)[number];

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app: { name: string; version: string };
  docs: Partial<Record<BackupKey, unknown>>;
}

export function buildBackup(docs: Backup['docs'], app: Backup['app'], now = new Date()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    app,
    docs,
  };
}

export function backupFileName(now = new Date()): string {
  return `aba-t1-backup-${now.toISOString().slice(0, 10)}.json`;
}

export type ParsedBackup =
  { ok: true; backup: Backup; keys: BackupKey[] } | { ok: false; message: string };

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: 'the file is not valid JSON' };
  }
  const b = raw as Partial<Backup> | null;
  if (!b || b.format !== BACKUP_FORMAT)
    return { ok: false, message: 'this is not an ABA-T1 backup file' };
  if (typeof b.version !== 'number' || typeof b.docs !== 'object' || !b.docs) {
    return { ok: false, message: 'the backup file is damaged' };
  }
  if (b.version > BACKUP_VERSION)
    return { ok: false, message: 'the backup was made by a newer ABA-T1 version' };
  const keys = BACKUP_KEYS.filter((k) => k in b.docs!);
  for (const k of keys) {
    const d = b.docs[k] as { version?: unknown } | null;
    if (!d || typeof d !== 'object' || typeof d.version !== 'number') {
      return { ok: false, message: `the part "${k}" of the backup is damaged` };
    }
  }
  if (!keys.length) return { ok: false, message: 'the backup is empty' };
  return { ok: true, backup: b as Backup, keys };
}

/** Single objects (an app, a note) as their own files. */
export const OBJECT_FORMAT = 'aba-t1-object';

export interface ObjectFile<T = unknown> {
  format: typeof OBJECT_FORMAT;
  version: 1;
  kind: 'app' | 'note' | 'program';
  data: T;
}

export function parseObject(
  text: string,
  kind: ObjectFile['kind'],
): { ok: true; data: unknown } | { ok: false; message: string } {
  try {
    const o = JSON.parse(text) as Partial<ObjectFile>;
    if (o?.format !== OBJECT_FORMAT || o.kind !== kind || !o.data)
      return { ok: false, message: `this is not an ABA-T1 ${kind} file` };
    return { ok: true, data: o.data };
  } catch {
    return { ok: false, message: 'the file is not valid JSON' };
  }
}
