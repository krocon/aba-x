/** Complete example programs (own examples) and the performance target. */
import { FakeHost, clock, report, runSource, value } from './testing/fake-host';

describe('example programs', () => {
  it('prime sieve of Eratosthenes', async () => {
    const src = `
      // all primes up to n
      EXPORT PRIMES(n)
      BEGIN
        LOCAL marks := MAKEFLAGS(n), out := {}, k, m;
        FOR k FROM 2 TO n DO
          IF marks(k) THEN
            out(SIZE(out) + 1) := k;
            FOR m FROM k * k TO n STEP k DO marks(m) := 0; END;
          END;
        END;
        RETURN out;
      END;

      MAKEFLAGS(n)
      BEGIN
        LOCAL L := {}, k;
        FOR k FROM 1 TO n DO L(k) := 1; END;
        RETURN L;
      END;`;
    expect(await value(src, 'PRIMES', [50])).toBe(
      '{2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47}',
    );
    const r = await runSource(src, 'PRIMES', [{ kind: 'real', v: 10000 }]);
    expect(r.ok && r.value.kind === 'list' && r.value.items.length).toBe(1229);
  });

  it("Newton's method for the square root of 2 and a cosine fixpoint", async () => {
    const src = `
      LOCAL a := 2;
      f(x) BEGIN RETURN x^2 - a; END;
      EXPORT NEWTON(x0, eps)
      BEGIN
        LOCAL x := x0, dx, steps := 0;
        REPEAT
          dx := f(x) / (2 * x);
          x := x - dx;
          steps := steps + 1;
        UNTIL ABS(dx) < eps OR steps > 50;
        RETURN x;
      END;`;
    expect(await value(src, 'NEWTON', [1, 1e-12])).toBe('1.41421356237');
    const cosine = `
      EXPORT FIX(x)
      BEGIN
        LOCAL k;
        FOR k FROM 1 TO 100 DO
          LOCAL nx := x - (COS(x) - x) / (-SIN(x) - 1);
          IF ABS(nx - x) < 1E-14 THEN RETURN nx; END;
          x := nx;
        END;
        RETURN x;
      END;`;
    expect(await value(cosine, 'FIX', [1])).toBe('0.739085133215');
  });

  it('Collatz sequence length and PRINT of the path', async () => {
    const src = `
      EXPORT COLLATZ(n)
      BEGIN
        LOCAL steps := 0, path := "" + n;
        WHILE n ≠ 1 DO
          IF n MOD 2 == 0 THEN n := n / 2; ELSE n := 3 * n + 1; END;
          steps := steps + 1;
          path := path + "→" + n;
        END;
        PRINT(path);
        RETURN steps;
      END;`;
    const host = new FakeHost();
    expect(await value(src, 'COLLATZ', [6], host)).toBe('8');
    expect(host.printed).toEqual(['6→3→10→5→16→8→4→2→1']);
    expect(await value(src, 'COLLATZ', [27])).toBe('111');
  });

  it('draws a star with LINE_P (recorded by a fake screen)', async () => {
    const src = `
      EXPORT STAR(n, r)
      BEGIN
        LOCAL k, a, b;
        RECT_P();
        FOR k FROM 0 TO n - 1 DO
          a := 2 * π * k / n;
          b := 2 * π * (k + 2) / n;
          LINE_P(160 + r * COS(a), 120 - r * SIN(a), 160 + r * COS(b), 120 - r * SIN(b), RGB(0, 0, 128));
        END;
        RETURN n;
      END;`;
    const host = new FakeHost();
    const r = await runSource(
      src,
      'STAR',
      [
        { kind: 'real', v: 5 },
        { kind: 'real', v: 100 },
      ],
      host,
    );
    expect(r.ok).toBe(true);
    const lines = host.gfxLog.filter((c) => c.op === 'line');
    expect(lines).toHaveLength(5);
    expect(lines.every((l) => l.op === 'line' && l.color === 128 && l.screen === 0)).toBe(true);
    const first = lines[0];
    expect(first.op === 'line' && [first.x1, first.y1]).toEqual([260, 120]);
    // the star is closed: the end of the last line is the start of the second one
    const last = lines[4];
    const second = lines[1];
    expect(
      last.op === 'line' && second.op === 'line' && Math.abs(last.x2 - second.x1),
    ).toBeLessThan(1e-9);
  });

  it('greatest common divisor (Euclid) on globals', async () => {
    const src = `
      EXPORT EUCLID()
      BEGIN
        WHILE B ≠ 0 DO
          LOCAL t := B;
          B := A MOD B;
          A := t;
        END;
        RETURN A;
      END;`;
    const host = new FakeHost();
    host.globals.set('A', { kind: 'real', v: 1071 });
    host.globals.set('B', { kind: 'real', v: 462 });
    expect(await value(src, 'EUCLID', [], host)).toBe('21');
  });
});

describe('performance', () => {
  it('runs a loop of 10^6 simple iterations well under 3 s', async () => {
    const src = `
      EXPORT SUM(n)
      BEGIN
        LOCAL k, s := 0;
        FOR k FROM 1 TO n DO s := s + k; END;
        RETURN s;
      END;`;
    const t0 = clock();
    const r = await runSource(src, 'SUM', [{ kind: 'real', v: 1e6 }], new FakeHost(), {
      maxSteps: 1e7,
      timeLimitMs: 10_000,
    });
    const ms = clock() - t0;
    expect(r.ok && r.value).toEqual({ kind: 'real', v: 500000500000 });
    report(`10^6 iterations: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(3000);
  });
});
