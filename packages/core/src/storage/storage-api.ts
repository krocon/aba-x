import { Injectable, InjectionToken, inject } from '@angular/core';
import { INVOKE } from '../platform/platform-api';

/** Document keys – the same on both platforms (file `<key>.json` on desktop, IndexedDB row on web). */
export type StorageKey = 'ui-state' | 'settings' | 'history' | 'variables' | 'functions' | 'graph';

export interface LoadedDoc<T> {
  /** `null` when the document does not exist yet (or was unreadable and set aside). */
  value: T | null;
  /** Name of a broken document that was set aside, so the UI can tell the user once. */
  setAside: string | null;
}

/** Error of a storage call, mirrors the Rust `AppError` (`{ code, message }`). */
export interface StorageError {
  code: string;
  message: string;
}

/**
 * Persistence of user data. Desktop: JSON files written atomically by Rust (`storage.rs`).
 * Web: IndexedDB. Callers own the shape and schema version of their documents.
 */
export abstract class StorageApi {
  abstract load<T>(key: StorageKey): Promise<LoadedDoc<T>>;
  abstract save<T>(key: StorageKey, value: T): Promise<void>;
  abstract remove(key: StorageKey): Promise<void>;
}

@Injectable()
export class TauriStorageApi extends StorageApi {
  private readonly invoke = inject(INVOKE);

  load<T>(key: StorageKey): Promise<LoadedDoc<T>> {
    return this.invoke<{ value: T | null; setAside: string | null }>('storage_load', { key });
  }

  save<T>(key: StorageKey, value: T): Promise<void> {
    return this.invoke<void>('storage_save', { key, value });
  }

  remove(key: StorageKey): Promise<void> {
    return this.invoke<void>('storage_remove', { key });
  }
}

export const IDB_FACTORY = new InjectionToken<IDBFactory | undefined>('IDB_FACTORY', {
  providedIn: 'root',
  factory: () => globalThis.indexedDB,
});

const DB_NAME = 'aba-x';
const DB_VERSION = 1;
const STORE = 'documents';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function storageError(code: string, err: unknown): StorageError {
  return { code, message: err instanceof Error ? err.message : String(err) };
}

/**
 * One object store `documents`, key = `StorageKey`, value = the document as structured clone.
 * Without IndexedDB (some private modes) every call rejects with `unavailable` – the app keeps
 * working with its in-memory state and says so.
 */
@Injectable()
export class IndexedDbStorageApi extends StorageApi {
  private readonly factory = inject(IDB_FACTORY);
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.factory) {
      return Promise.reject<IDBDatabase>({ code: 'unavailable', message: 'no IndexedDB' });
    }
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = this.factory!.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(storageError('unavailable', req.error));
      req.onblocked = () => reject({ code: 'unavailable', message: 'database blocked' });
    }).catch((e: unknown) => {
      this.db = null;
      throw e;
    });
    return this.db;
  }

  private async tx<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    try {
      return await request(run(db.transaction(STORE, mode).objectStore(STORE)));
    } catch (e) {
      throw storageError('io', e);
    }
  }

  async load<T>(key: StorageKey): Promise<LoadedDoc<T>> {
    const value = (await this.tx('readonly', (s) => s.get(key))) as T | undefined;
    return { value: value ?? null, setAside: null };
  }

  async save<T>(key: StorageKey, value: T): Promise<void> {
    await this.tx('readwrite', (s) => s.put(value, key));
  }

  async remove(key: StorageKey): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(key));
  }
}
