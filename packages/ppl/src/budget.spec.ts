import { compile } from './parser';
import { run } from './interpreter';
import { FakeHost, later, runSource, sleep, value } from './testing/fake-host';

const endless = 'EXPORT LOOP()\nBEGIN\n  WHILE 1 DO\n    A := A + 1;\n  END;\nEND;';

describe('budgets and cancellation', () => {
  it('stops an endless loop at the step budget with a clear error', async () => {
    const r = await runSource(endless, 'LOOP', [], new FakeHost(), { maxSteps: 10_000 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('step-limit');
    expect(r.error.message).toBe(
      'the step budget of 10000 steps is used up – is there an endless loop?',
    );
    expect(r.error.line).toBeGreaterThanOrEqual(3);
    expect(r.steps).toBe(10_001);
  });

  it('stops an endless loop at the time budget', async () => {
    const r = await runSource(endless, 'LOOP', [], new FakeHost(), {
      maxSteps: 1e12,
      timeLimitMs: 50,
    });
    expect(r.ok || r.error.code).toBe('timeout');
  });

  it('stops an empty endless loop too (loop iterations count as steps)', async () => {
    const src = 'EXPORT E() BEGIN REPEAT UNTIL 0; END;';
    expect(await value(src, 'E', [], undefined, { maxSteps: 1000 })).toMatch(
      /^error step-limit 1:31/,
    );
  });

  it('is cancelled from outside while running (signal)', async () => {
    const signal = { aborted: false };
    later(30, () => (signal.aborted = true));
    const t0 = Date.now();
    const r = await runSource(endless, 'LOOP', [], new FakeHost(), {
      maxSteps: 1e12,
      timeLimitMs: 10_000,
      signal,
      yieldEveryMs: 5,
    });
    expect(r.ok || r.error.code).toBe('cancelled');
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('is cancelled by a callback, also while waiting for INPUT', async () => {
    let cancel = false;
    const host = new FakeHost();
    host.input = async () => {
      cancel = true;
      return null;
    };
    const r = await runSource('EXPORT F() BEGIN LOCAL a; INPUT(a); RETURN 1; END;', 'F', [], host, {
      isCancelled: () => cancel,
    });
    expect(r.ok || r.error.code).toBe('cancelled');
  });

  it('time spent waiting for the host does not count', async () => {
    const host = new FakeHost();
    host.wait = (s) => sleep(s * 1000);
    const r = await runSource('EXPORT W() BEGIN WAIT(0.15); RETURN 1; END;', 'W', [], host, {
      timeLimitMs: 100,
    });
    expect(r.ok).toBe(true);
  });

  it('calls onStatement with line, column and the locals, and may pause', async () => {
    const seen: string[] = [];
    const p = compile('EXPORT S(n)\nBEGIN\n  LOCAL k := n + 1;\n  RETURN k * 2;\nEND;');
    if (!p.ok) throw new Error(p.error.message);
    const r = await run(p.value, 'S', [{ kind: 'real', v: 4 }], new FakeHost(), {
      onStatement: async (line, column, snap) => {
        await sleep(1);
        seen.push(`${line}:${column} ${snap.function} ${JSON.stringify(snap.locals)}`);
      },
    });
    expect(r.ok && r.value).toEqual({ kind: 'real', v: 10 });
    expect(seen).toEqual([
      '3:3 S {"n":{"kind":"real","v":4}}',
      '4:3 S {"n":{"kind":"real","v":4},"k":{"kind":"real","v":5}}',
    ]);
  });

  it('limits the size of strings', async () => {
    const src = 'EXPORT G() BEGIN LOCAL s := "ab"; WHILE 1 DO s := s + s; END; END;';
    expect(await value(src, 'G')).toMatch(
      /^error size-limit 1:\d+ string longer than 1000000 characters/,
    );
  });
});
