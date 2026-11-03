import { describe, expect, it } from 'vitest';
import { parseText } from '../parser/text-parser';
import { evaluateNumeric } from '../numeric/evaluate';
import { polar, sampleParametric } from './parametric';
import { SequenceSystem, cobwebMap } from './sequence';

const V = { xmin: -2, xmax: 2, ymin: -2, ymax: 2 };
const O = { tmin: 0, tmax: 2 * Math.PI, tstep: 0.1, width: 320, height: 240 };
const expr = (s: string) => {
  const p = parseText(s, { functions: new Set(['U1', 'U2']) });
  if (!p.ok) throw new Error(p.error.message);
  return p.value;
};

describe('parametric and polar curves', () => {
  it('a circle is one closed line close to radius 1', () => {
    const lines = sampleParametric((t) => [Math.cos(t), Math.sin(t)], V, O);
    expect(lines.length).toBe(1);
    const pts = lines[0];
    expect(Math.hypot(...pts[0])).toBeCloseTo(1, 12);
    expect(Math.hypot(pts.at(-1)![0] - pts[0][0], pts.at(-1)![1] - pts[0][1])).toBeLessThan(1e-9);
    for (const [x, y] of pts) expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
  });

  it('a rose r = cos 3θ stays within r ≤ 1', () => {
    const lines = sampleParametric(
      polar((t) => Math.cos(3 * t)),
      V,
      O,
    );
    for (const l of lines)
      for (const [x, y] of l) expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 1e-12);
  });

  it('breaks at a pole instead of drawing across it', () => {
    // x = t, y = 1/t through t = 0
    const lines = sampleParametric(
      (t) => [t, 1 / t],
      { xmin: -2, xmax: 2, ymin: -5, ymax: 5 },
      { ...O, tmin: -2, tmax: 2, tstep: 0.1 },
    );
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const l of lines) {
      const xs = l.map((p) => p[0]);
      expect(Math.min(...xs) < 0 && Math.max(...xs) > 0).toBe(false);
    }
  });
});

describe('sequences', () => {
  it('explicit and recursive (Fibonacci), with other sequences', () => {
    const s = new SequenceSystem([
      { name: 'U1', expr: expr('U1(N-1)+U1(N-2)'), start: [1, 1] },
      { name: 'U2', expr: expr('2*U1(N)+N'), start: [] },
    ]);
    expect(s.value('U1', 10)).toEqual({ ok: true, value: 55 });
    expect(s.value('U2', 3)).toEqual({ ok: true, value: 7 });
    const deep = s.value('U1', 70);
    expect(deep.ok && deep.value).toBeCloseTo(190392490709135, -2);
  });

  it('reports self references, missing start terms and bad indices', () => {
    const s = new SequenceSystem([
      { name: 'U1', expr: expr('U1(N)+1'), start: [] },
      { name: 'U2', expr: expr('U2(N-1)*2'), start: [] },
    ]);
    expect(s.value('U1', 3).ok).toBe(false);
    const r = s.value('U2', 3);
    expect(!r.ok && r.error.message).toMatch(/U2/);
    expect(s.value('U2', 0).ok).toBe(false);
  });

  it('cobweb map of a first-order recursion', () => {
    const g = cobwebMap({ name: 'U1', expr: expr('2.8*U1(N-1)*(1-U1(N-1))'), start: [0.2] });
    expect(g && evaluateNumeric(g, { variables: new Map([['X', 0.5]]) })).toEqual({
      ok: true,
      value: 0.7,
    });
    expect(cobwebMap({ name: 'U1', expr: expr('U1(N-1)+N'), start: [1] })).toBeNull();
  });
});
