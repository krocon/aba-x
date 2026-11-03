import { TestBed } from '@angular/core/testing';
import { COMPUTE_WORKER_FACTORY } from '@aba/core/compute/compute-client';
import { StorageApi } from '@aba/core/storage/storage-api';
import { FakeStorageApi } from '@aba/core/testing';
import { HomeStore } from '../home/home-store';
import { CasStore } from './cas-store';

describe('CasStore', () => {
  let cas: CasStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageApi, useClass: FakeStorageApi },
        { provide: COMPUTE_WORKER_FACTORY, useValue: () => null },
      ],
    });
    cas = TestBed.inject(CasStore);
  });

  const last = () => cas.entries().at(-1)!;

  it('computes exactly, stores variables and functions, uses home variables', async () => {
    await cas.submit('\\frac{1}{3}+\\frac{1}{6}');
    expect(last().answer?.latex).toBe('\\frac{1}{2}');
    await cas.submit('\\frac{1}{3}+\\frac{1}{6}', true);
    expect(last().answer?.text).toBe('0.5');
    await cas.submit('a:=x+1');
    await cas.submit('\\operatorname{expand}(a^2)');
    expect(last().answer?.text).toMatch(/x\^2/);
    await cas.submit('g(t)\\coloneq t^3');
    await cas.submit('\\frac{d}{dx}g(x)');
    expect(last().answer?.text).toMatch(/3\*x\^2|3x\^2/);
    await TestBed.inject(HomeStore).submit('5▶B', 'text');
    await cas.submit('B+1');
    expect(last().answer?.text).toBe('6');
  });

  it('reports errors in the history', async () => {
    await cas.submit('\\operatorname{ifactor}(2.5)');
    expect(last().error).toBe(true);
    await cas.submit('2+');
    expect(last().error).toBe(true);
  });
});
