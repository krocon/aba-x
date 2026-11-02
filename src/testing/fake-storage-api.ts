import { Injectable } from '@angular/core';
import { LoadedDoc, StorageApi, StorageKey } from '../app/core/storage/storage-api';

/** In-memory `StorageApi` for specs. Never import from production code. */
@Injectable()
export class FakeStorageApi extends StorageApi {
  readonly docs = new Map<StorageKey, unknown>();
  failWith: { code: string; message: string } | null = null;
  setAside: string | null = null;

  load<T>(key: StorageKey): Promise<LoadedDoc<T>> {
    if (this.failWith) return Promise.reject(this.failWith);
    const value = this.docs.has(key) ? (structuredClone(this.docs.get(key)) as T) : null;
    return Promise.resolve({ value, setAside: this.setAside });
  }

  save<T>(key: StorageKey, value: T): Promise<void> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.docs.set(key, structuredClone(value));
    return Promise.resolve();
  }

  remove(key: StorageKey): Promise<void> {
    this.docs.delete(key);
    return Promise.resolve();
  }
}
