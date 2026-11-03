import { fcn, zoomView } from './plot-logic';

const V = { xmin: -10, xmax: 10, ymin: -5, ymax: 5 };
const S = { width: 320, height: 200 };

describe('plot logic', () => {
  it('zooms in variants', () => {
    expect(zoomView(V, 'in', S)).toEqual({ xmin: -5, xmax: 5, ymin: -2.5, ymax: 2.5 });
    expect(zoomView(V, 'xout', S)).toEqual({ ...V, xmin: -20, xmax: 20 });
    expect(zoomView(V, 'square', S)).toEqual({ ...V, ymin: -6.25, ymax: 6.25 });
    expect(zoomView(V, 'decimal', S)).toEqual({ xmin: -16, xmax: 16, ymin: -10, ymax: 10 });
    const auto = zoomView(V, 'auto', S, 0, 0, (x) => x * x);
    expect(auto.ymin).toBeLessThan(0);
    expect(auto.ymax).toBeGreaterThan(100);
  });

  it('finds root, extremum, intersection, slope and area near the cursor', () => {
    const f = (x: number) => x * x - 4;
    expect(fcn('root', f, [], 1.5, V)).toMatchObject({ kind: 'point', x: expect.closeTo(2, 9) });
    expect(fcn('root', f, [], -3, V)).toMatchObject({ x: expect.closeTo(-2, 9) });
    expect(fcn('extremum', f, [], 1, V)).toMatchObject({
      label: 'min',
      x: expect.closeTo(0, 6),
      y: expect.closeTo(-4, 9),
    });
    expect(fcn('intersection', f, [(x) => x - 2], 0, V)).toMatchObject({ kind: 'point' });
    expect(fcn('slope', f, [], 3, V)).toMatchObject({ slope: expect.closeTo(6, 6) });
    expect(fcn('area', f, [], 2, V, -2)).toMatchObject({ value: expect.closeTo(-32 / 3, 8) });
    expect(fcn('area', f, [], 2, V).kind).toBe('none');
    expect(fcn('root', (x) => x * x + 1, [], 0, V).kind).toBe('none');
    expect(fcn('slope', (x) => Math.abs(x), [], 0, V).kind).toBe('none');
  });
});
