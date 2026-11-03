import { TestBed } from '@angular/core/testing';
import { COMPUTE_WORKER_FACTORY } from '@aba/core/compute/compute-client';
import { StorageApi } from '@aba/core/storage/storage-api';
import { FakeStorageApi } from '@aba/core/testing';
import { complex, real } from '@aba/math/value/value';
import { SettingsStore } from '../settings/settings-store';
import { HomeStore } from './home-store';

describe('HomeStore', () => {
  let home: HomeStore;
  let storage: FakeStorageApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageApi, useClass: FakeStorageApi },
        { provide: COMPUTE_WORKER_FACTORY, useValue: () => null },
      ],
    });
    home = TestBed.inject(HomeStore);
    storage = TestBed.inject(StorageApi) as FakeStorageApi;
  });

  const last = () => home.entries().at(-1)!;

  it('evaluates, keeps Ans and stores variables', async () => {
    await home.submit('2+3*4', 'text');
    expect(last().value).toEqual(real(14));
    await home.submit('Ans/2▶A', 'text');
    expect(home.variables().get('A')).toEqual(real(7));
    await home.submit('A:=A+1', 'text');
    await home.submit('A*2', 'text');
    expect(last().value).toEqual(real(16));
  });

  it('repeats the last input on an empty line', async () => {
    await home.submit('1+1', 'text');
    await home.submit('', 'text');
    expect(home.entries().length).toBe(2);
  });

  it('defines functions and reports errors in the history', async () => {
    await home.submit('f(x):=x^2+1', 'text');
    expect(last().note).toBe('Done');
    await home.submit('f(3)', 'text');
    expect(last().value).toEqual(real(10));
    await home.submit('1/0', 'text');
    expect(last().error).toBe(true);
    await home.submit('2+', 'text');
    expect(last().error).toBe(true);
  });

  it('follows the complex setting', async () => {
    const settings = TestBed.inject(SettingsStore);
    await home.submit('sqrt(-4)', 'text');
    expect(last().error).toBe(true);
    settings.update({ ...settings.settings(), complex: 'rect' });
    await home.submit('sqrt(-4)', 'text');
    expect(last().value).toEqual(complex(0, 2));
  });

  it('saves and loads the history, variables and functions', async () => {
    await home.submit('5▶B', 'text');
    await home.submit('g(t):=t*B', 'text');
    await new Promise((r) => setTimeout(r));
    const again = TestBed.runInInjectionContext(() => new HomeStore());
    await again.load();
    expect(again.entries().length).toBe(2);
    expect(again.variables().get('B')).toEqual(real(5));
    expect(again.functions().has('g')).toBe(true);
    expect(storage).toBeTruthy();
  });

  it('moves the selection through the history', async () => {
    await home.submit('1', 'text');
    await home.submit('2', 'text');
    home.moveSelection(1);
    expect(home.selected()).toBe(1);
    home.moveSelection(1);
    home.moveSelection(1);
    expect(home.selected()).toBe(0);
    home.moveSelection(-1);
    home.moveSelection(-1);
    expect(home.selected()).toBeNull();
  });
});
