import { TestBed } from '@angular/core/testing';
import { COMPUTE_WORKER_FACTORY } from '@aba/core/compute/compute-client';
import { StorageApi } from '@aba/core/storage/storage-api';
import { FakeStorageApi } from '@aba/core/testing';
import { real } from '@aba/math/value/value';
import { HomeStore } from '../home/home-store';
import { appProgramName } from './app-programs';
import { ProgramRunner } from './program-runner';
import { ProgramStore } from './program-store';

describe('programs', () => {
  let store: ProgramStore;
  let runner: ProgramRunner;
  let home: HomeStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageApi, useClass: FakeStorageApi },
        { provide: COMPUTE_WORKER_FACTORY, useValue: () => null },
      ],
    });
    store = TestBed.inject(ProgramStore);
    runner = TestBed.inject(ProgramRunner);
    home = TestBed.inject(HomeStore);
  });

  it('exports are case-insensitive, errors are kept per program', () => {
    store.put('P', 'EXPORT Twice(x)\nBEGIN\n  RETURN 2*x;\nEND;');
    store.put('Q', 'EXPORT broken(\nBEGIN');
    expect(store.exports().get('twice')?.params).toEqual(['x']);
    expect(store.compiled().find((c) => c.doc.name === 'Q')?.error?.line).toBeGreaterThan(0);
    expect(store.rename('P', 'Q')).toBe(false);
    expect(store.rename('P', 'R')).toBe(true);
  });

  it('the home view calls exported functions; PRINT goes to the terminal', async () => {
    store.put('P', 'EXPORT TWICE(x)\nBEGIN\n  PRINT("hi");\n  A := 7;\n  RETURN 2*x;\nEND;');
    await home.submit('TWICE(4)+1', 'text');
    expect(home.entries().at(-1)?.value).toEqual(real(9));
    expect(runner.terminal()).toEqual(['hi']);
    expect(home.variables().get('A')).toEqual(real(7));
  });

  it('errors carry the program position', async () => {
    store.put('P', 'EXPORT BAD()\nBEGIN\n  RETURN 1/0;\nEND;');
    await home.submit('BAD()', 'text');
    expect(home.entries().at(-1)?.error).toBe(true);
    expect(runner.lastError()?.error.line).toBe(3);
  });

  it('the debugger pauses at a breakpoint and shows the locals', async () => {
    store.put('P', 'EXPORT F()\nBEGIN\n  LOCAL k := 5;\n  k := k + 1;\n  RETURN k;\nEND;');
    runner.toggleBreakpoint('P', 4);
    const fn = runner.find('P', 'f')!;
    const done = runner.exec(fn, [], runner.debugHook('P', false));
    await new Promise((r) => setTimeout(r, 20));
    expect(runner.paused()?.line).toBe(4);
    expect(runner.paused()?.snapshot.locals['k']).toEqual(real(5));
    runner.continueRun(false);
    const r = await done;
    expect(r.ok && r.value).toEqual(real(6));
  });

  it('user keys run K_<key> in user mode; app programs are named after the app', async () => {
    store.put('U', 'EXPORT K_SIN()\nBEGIN\n  RETURN 42;\nEND;');
    expect(runner.userFunction({ id: 'sin', layer: 'main' })?.name).toBe('K_SIN');
    expect(runner.userFunction({ id: 'sin', layer: 'shift' })).toBeNull();
    runner.toggleUserMode();
    expect(runner.userMode()).toBe('once');
    expect(appProgramName('My Fn 2')).toBe('MyFn2');
  });
});
