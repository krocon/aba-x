import { area, extrema, intersections, roots, tangent } from './analysis';
import { autoY, sample } from './sampler';
import { STANDARD_VIEW, niceStep, pan, ticks, toScreenX, toWorldX, valid, zoom } from './viewport';

const screen = { width: 400, height: 260 };

describe('viewport', () => {
  it('nice steps and ticks', () => {
    expect(niceStep(20)).toBe(2);
    expect(niceStep(0.03)).toBeCloseTo(0.005);
    expect(ticks(-1, 1, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it('zoom keeps the centre, pan moves, screen mapping round-trips', () => {
    const z = zoom(STANDARD_VIEW, 0.5);
    expect([z.xmin, z.xmax]).toEqual([-5, 5]);
    expect(pan(STANDARD_VIEW, 0.1, 0).xmin).toBeCloseTo(-8);
    expect(toWorldX(STANDARD_VIEW, screen, toScreenX(STANDARD_VIEW, screen, 3.3))).toBeCloseTo(3.3);
    expect(valid({ xmin: 0, xmax: 0, ymin: 0, ymax: 1 })).toBe(false);
  });
});

describe('sampler', () => {
  const v = { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };

  it('draws a parabola as one line', () => {
    expect(sample((x) => x * x - 3, v, screen).length).toBe(1);
  });

  it('breaks at poles instead of drawing a vertical line', () => {
    const lines = sample(Math.tan, v, screen);
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const l of lines) {
      for (let i = 1; i < l.length; i++) {
        const [x0, y0] = l[i - 1];
        const [x1, y1] = l[i];
        // no segment crosses an asymptote of tan at π/2 + kπ
        const k0 = Math.floor((x0 - Math.PI / 2) / Math.PI);
        const k1 = Math.floor((x1 - Math.PI / 2) / Math.PI);
        expect(k0 === k1 || Math.abs(y1 - y0) < 50).toBe(true);
      }
    }
    expect(sample((x) => 1 / x, v, screen).length).toBe(2);
  });

  it('breaks at jumps and where f is undefined', () => {
    expect(sample(Math.floor, v, screen).length).toBeGreaterThanOrEqual(10);
    expect(sample(Math.sqrt, v, screen).length).toBe(1);
    expect(sample(Math.sqrt, v, screen)[0][0][0]).toBeGreaterThanOrEqual(0);
  });

  it('auto range ignores the pole spikes', () => {
    const r = autoY((x) => 1 / x, -5, 5)!;
    expect(r.ymax).toBeLessThan(100);
    expect(autoY(() => NaN, 0, 1)).toBeNull();
  });
});

describe('analysis', () => {
  it('roots, extrema and intersections of x² − 4', () => {
    const f = (x: number) => x * x - 4;
    expect(roots(f, -5, 5).map((p) => +p.x.toFixed(8))).toEqual([-2, 2]);
    expect(extrema(f, -5, 5)).toEqual([
      { kind: 'min', x: expect.closeTo(0, 6), y: expect.closeTo(-4, 6) },
    ]);
    expect(intersections(f, (x) => x, -5, 5).map((p) => +p.x.toFixed(6))).toEqual([
      -1.561553, 2.561553,
    ]);
  });

  it('extrema of sin, none at the poles of 1/x²', () => {
    expect(extrema(Math.sin, 0, 7).map((p) => p.kind)).toEqual(['max', 'min']);
    expect(extrema((x) => 1 / (x * x), -2, 2)).toEqual([]);
  });

  it('tangent and signed area', () => {
    const t = tangent((x) => x ** 3, 1);
    expect(t.ok && t.value.slope).toBeCloseTo(3, 8);
    expect(tangent(Math.abs, 0).ok).toBe(false);
    const a = area(Math.sin, 0, 2 * Math.PI);
    expect(a.ok && a.value.value).toBeCloseTo(0, 9);
    expect(a.ok && a.value.positive).toBeCloseTo(2, 8);
    expect(a.ok && a.value.negative).toBeCloseTo(-2, 8);
  });
});
