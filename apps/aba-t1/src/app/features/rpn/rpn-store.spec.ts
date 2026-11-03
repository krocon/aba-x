import { TestBed } from '@angular/core/testing';
import { COMPUTE_WORKER_FACTORY } from '@aba/core/compute/compute-client';
import { StorageApi } from '@aba/core/storage/storage-api';
import { FakeStorageApi } from '@aba/core/testing';
import { parseText } from '@aba/math/parser/text-parser';
import * as R from '@aba/math/rpn/rpn-stack';
import { real } from '@aba/math/value/value';
import { HomeStore } from '../home/home-store';
import { RpnStore } from './rpn-store';

const expr = (s: string) => {
  const p = parseText(s);
  if (!p.ok) throw new Error(p.error.message);
  return p.value;
};

describe('RpnStore', () => {
  let rpn: RpnStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageApi, useClass: FakeStorageApi },
        { provide: COMPUTE_WORKER_FACTORY, useValue: () => null },
      ],
    });
    rpn = TestBed.inject(RpnStore);
  });

  it('pushes typed lines and applies operations', async () => {
    await rpn.pushExpr(expr('3'));
    await rpn.pushExpr(expr('2+2'));
    expect(rpn.apply({ kind: 'binary', op: '*' })).toBe(true);
    expect(rpn.stack()).toEqual([real(12)]);
    expect(rpn.apply({ kind: 'binary', op: '+' })).toBe(false);
    expect(rpn.message()).toContain('2 arguments');
    expect(rpn.stack()).toEqual([real(12)]);
  });

  it('stores level 1, keeps selection in range and persists', async () => {
    await rpn.pushExpr(expr('7'));
    await rpn.pushExpr(expr('8'));
    rpn.store('Q');
    expect(TestBed.inject(HomeStore).variables().get('Q')).toEqual(real(8));
    rpn.moveSelection(1);
    rpn.moveSelection(1);
    rpn.moveSelection(1);
    expect(rpn.selected()).toBe(2);
    rpn.run((s) => R.roll(s, 2));
    expect(rpn.stack()).toEqual([real(8), real(7)]);
    await new Promise((r) => setTimeout(r));
    const again = TestBed.runInInjectionContext(() => new RpnStore());
    await again.load();
    expect(again.stack()).toEqual([real(8), real(7)]);
  });
});
