import { describe, expect, it } from 'vitest';
import { depreciation, depreciationSchedule } from './depreciation';

const val = <T>(r: { ok: boolean; value?: T; error?: { message: string } }) => {
  if (!r.ok) throw new Error(`not ok: ${r.error?.message}`);
  return r.value as T;
};
const deps = (r: ReturnType<typeof depreciationSchedule>) => val(r).map((y) => y.depreciation);

describe('depreciation', () => {
  const asset = { cost: 10000, salvage: 1000, life: 5 };

  it('straight line', () => {
    deps(depreciationSchedule({ ...asset, method: 'sl' })).forEach((x) =>
      expect(x).toBeCloseTo(1800, 10),
    );
    const y3 = val(depreciation({ ...asset, method: 'sl' }, 3));
    expect(y3).toMatchObject({ year: 3, accumulated: 5400, bookValue: 4600, remaining: 3600 });
  });

  it('straight line with a fractional life', () => {
    const d = deps(depreciationSchedule({ cost: 1000, salvage: 0, life: 2.5, method: 'sl' }));
    expect(d).toEqual([400, 400, 200]);
  });

  it("sum of the years' digits", () => {
    const d = deps(depreciationSchedule({ ...asset, method: 'syd' }));
    [3000, 2400, 1800, 1200, 600].forEach((x, i) => expect(d[i]).toBeCloseTo(x, 10));
    expect(val(depreciation({ ...asset, method: 'syd' }, 5)).bookValue).toBeCloseTo(1000, 10);
  });

  it('double declining balance stops at the salvage value', () => {
    const d = deps(depreciationSchedule({ ...asset, method: 'db' }));
    [4000, 2400, 1440, 864, 296].forEach((x, i) => expect(d[i]).toBeCloseTo(x, 10));
  });

  it('declining balance with switch to straight line (Excel VDB)', () => {
    const p = { cost: 10000, salvage: 0, life: 5, method: 'db' as const };
    const plain = deps(depreciationSchedule(p));
    [4000, 2400, 1440, 864, 518.4].forEach((x, i) => expect(plain[i]).toBeCloseTo(x, 10));
    const sw = deps(depreciationSchedule({ ...p, switchToSl: true }));
    [4000, 2400, 1440, 1080, 1080].forEach((x, i) => expect(sw[i]).toBeCloseTo(x, 10));
    // 150 % declining balance
    const f = deps(depreciationSchedule({ ...p, factor: 1.5 }));
    expect(f[0]).toBeCloseTo(3000, 10);
    expect(f[1]).toBeCloseTo(2100, 10);
  });

  it('validates the input', () => {
    expect(depreciationSchedule({ ...asset, salvage: 20000, method: 'sl' }).ok).toBe(false);
    expect(depreciationSchedule({ ...asset, life: 0, method: 'sl' }).ok).toBe(false);
    expect(depreciationSchedule({ ...asset, life: 4.5, method: 'syd' }).ok).toBe(false);
    expect(depreciationSchedule({ ...asset, method: 'db', factor: 0 }).ok).toBe(false);
    expect(depreciationSchedule({ ...asset, cost: -1, method: 'sl' }).ok).toBe(false);
    expect(depreciation({ ...asset, method: 'sl' }, 6).ok).toBe(false);
    expect(depreciation({ ...asset, method: 'sl' }, 0).ok).toBe(false);
  });
});
