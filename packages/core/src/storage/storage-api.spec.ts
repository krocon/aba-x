import { TestBed } from '@angular/core/testing';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { INVOKE } from '../platform/platform-api';
import { IDB_FACTORY, IndexedDbStorageApi, STORAGE_DB_NAME, TauriStorageApi } from './storage-api';

describe('TauriStorageApi', () => {
  it('maps every call to the storage_* commands', async () => {
    const calls: [string, unknown][] = [];
    TestBed.configureTestingModule({
      providers: [
        TauriStorageApi,
        {
          provide: INVOKE,
          useValue: (cmd: string, args?: unknown) => {
            calls.push([cmd, args]);
            return Promise.resolve(cmd === 'storage_load' ? { value: 1, setAside: null } : null);
          },
        },
      ],
    });
    const api = TestBed.inject(TauriStorageApi);
    expect(await api.load('settings')).toEqual({ value: 1, setAside: null });
    await api.save('history', [1, 2]);
    await api.remove('history');
    expect(calls).toEqual([
      ['storage_load', { key: 'settings' }],
      ['storage_save', { key: 'history', value: [1, 2] }],
      ['storage_remove', { key: 'history' }],
    ]);
  });
});

describe('IndexedDbStorageApi', () => {
  function setup(factory: IDBFactory | undefined) {
    TestBed.configureTestingModule({
      providers: [
        IndexedDbStorageApi,
        { provide: IDB_FACTORY, useValue: factory },
        { provide: STORAGE_DB_NAME, useValue: 'aba-x' },
      ],
    });
    return TestBed.inject(IndexedDbStorageApi);
  }

  it('returns null for a missing document', async () => {
    const api = setup(new FakeIDBFactory());
    expect(await api.load('settings')).toEqual({ value: null, setAside: null });
  });

  it('round-trips, replaces and removes documents', async () => {
    const api = setup(new FakeIDBFactory());
    const doc = { schemaVersion: 1, expr: '∫₀¹ x² dx', list: [1.5, -2] };
    await api.save('history', doc);
    expect((await api.load('history')).value).toEqual(doc);
    await api.save('history', { schemaVersion: 1 });
    expect((await api.load('history')).value).toEqual({ schemaVersion: 1 });
    await api.remove('history');
    expect((await api.load('history')).value).toBeNull();
  });

  it('rejects with "unavailable" without IndexedDB', async () => {
    const api = setup(undefined);
    await expect(api.load('settings')).rejects.toMatchObject({ code: 'unavailable' });
  });
});
