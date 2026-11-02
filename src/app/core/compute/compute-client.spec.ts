import { TestBed } from '@angular/core/testing';
import { parseText } from '../../../math/parser/text-parser';
import { toText } from '../../../math/serializer';
import type { ComputeRequest, ComputeResponse } from '../../../math/worker/protocol';
import { handle } from '../../../math/worker/host';
import { COMPUTE_WORKER_FACTORY, ComputeClient } from './compute-client';

const p = (s: string) => {
  const r = parseText(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

/** A worker stand-in that answers asynchronously, or never (to test timeouts). */
class FakeWorker {
  onmessage: ((e: MessageEvent<ComputeResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  terminated = false;
  constructor(private readonly hang = false) {}
  postMessage(req: ComputeRequest) {
    if (this.hang) return;
    setTimeout(() => this.onmessage?.({ data: handle(req) } as MessageEvent<ComputeResponse>));
  }
  terminate() {
    this.terminated = true;
  }
}

describe('ComputeClient', () => {
  function setup(factory: () => Worker | null) {
    TestBed.configureTestingModule({
      providers: [{ provide: COMPUTE_WORKER_FACTORY, useValue: factory }],
    });
    return TestBed.inject(ComputeClient);
  }

  it('runs CAS work through the worker protocol', async () => {
    const client = setup(() => new FakeWorker() as unknown as Worker);
    const r = await client.run({ op: 'differentiate', expr: p('x^3'), variable: 'x', order: 1 });
    expect(r.ok && toText(r.value.expr)).toBe('3*x^2');
  });

  it('falls back to in-thread execution without workers', async () => {
    const client = setup(() => null);
    const r = await client.run({ op: 'factor', expr: p('x^2-1') });
    expect(r.ok).toBe(true);
  });

  it('times out, terminates the worker and starts a new one', async () => {
    const workers: FakeWorker[] = [];
    const client = setup(() => {
      const w = new FakeWorker(workers.length === 0);
      workers.push(w);
      return w as unknown as Worker;
    });
    const r = await client.run({ op: 'sleep', ms: 10 }, 20);
    expect(r).toMatchObject({ ok: false, error: { code: 'timeout' } });
    expect(workers[0].terminated).toBe(true);
    const again = await client.run({ op: 'expand', expr: p('(x+1)^2') });
    expect(again.ok).toBe(true);
    expect(workers.length).toBe(2);
  });

  it('cancels everything that is pending', async () => {
    const client = setup(() => new FakeWorker(true) as unknown as Worker);
    const pending = client.run({ op: 'sleep', ms: 1000 });
    expect(client.busy).toBe(true);
    client.cancelAll();
    expect(await pending).toMatchObject({ ok: false, error: { code: 'cancelled' } });
    expect(client.busy).toBe(false);
  });
});
