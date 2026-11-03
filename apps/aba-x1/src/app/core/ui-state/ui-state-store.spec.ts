import { TestBed } from '@angular/core/testing';
import { FakeStorageApi } from '@aba/core/testing';
import { StorageApi } from '@aba/core/storage/storage-api';
import { UiStateStore } from './ui-state-store';

describe('UiStateStore', () => {
  let storage: FakeStorageApi;
  let store: UiStateStore;

  beforeEach(() => {
    storage = new FakeStorageApi();
    TestBed.configureTestingModule({ providers: [{ provide: StorageApi, useValue: storage }] });
    store = TestBed.inject(UiStateStore);
  });

  it('restores the stored mode and saves changes', async () => {
    storage.docs.set('ui-state', { schemaVersion: 1, mode: 'cas' });
    await store.restore();
    expect(store.mode()).toBe('cas');
    store.setMode('graph');
    await Promise.resolve();
    expect(storage.docs.get('ui-state')).toEqual({ schemaVersion: 1, mode: 'graph' });
  });

  it('does not overwrite a document of a newer version', async () => {
    storage.docs.set('ui-state', { schemaVersion: 7, mode: 'cas', future: true });
    await store.restore();
    store.setMode('graph');
    await Promise.resolve();
    expect(store.mode()).toBe('graph');
    expect(storage.docs.get('ui-state')).toEqual({ schemaVersion: 7, mode: 'cas', future: true });
  });

  it('reports unavailable storage and a set-aside document', async () => {
    storage.failWith = { code: 'unavailable', message: 'x' };
    await store.restore();
    expect(store.mode()).toBe('standard');
    expect(store.storageProblem()).toContain('unavailable');

    storage.failWith = null;
    storage.setAside = 'ui-state.json.bad';
    await store.restore();
    expect(store.storageProblem()).toContain('ui-state.json.bad');
  });
});
