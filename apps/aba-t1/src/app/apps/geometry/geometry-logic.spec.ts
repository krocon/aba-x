import { describe, expect, it } from 'vitest';
import {
  TOOLS,
  build,
  chooseIndex,
  createsPoint,
  defaultMeasures,
  equalView,
  fitView,
  fmtEquation,
  fmtMeasured,
  hitTest,
  initGeometryState,
  measure,
  nextStep,
  redefine,
  renamed,
  snap,
  toolById,
  toolComplete,
  withoutObjects,
} from './geometry-logic';

const F = { mode: 'standard' as const, digits: 4, decimal: '.' as const };
const O = { format: F, angle: 'deg' as const, yes: 'Yes', no: 'No' };

const TRIANGLE = [
  'A = point(0, 0)',
  'B = point(4, 0)',
  'C = point(0, 3)',
  't = triangle(A, B, C)',
  'u = circumcircle(A, B, C)',
].join('\n');

const show = (c: ReturnType<typeof build>['c'], text: string) => {
  const r = measure(c, text);
  return r.ok ? fmtMeasured(r.value, O) : `error: ${r.error.message}`;
};

describe('geometry app logic', () => {
  it('rebuilds a construction from its script and measures it', () => {
    const { c, errors } = build(TRIANGLE, ['u']);
    expect(errors).toEqual([]);
    expect(c.get('u')?.hidden).toBe(true);
    expect(show(c, 'area(t)')).toBe('6');
    expect(show(c, 'length(t)')).toBe('12');
    expect(show(c, 'distance(B, C)')).toBe('5');
    expect(show(c, 'angle(B, A, C)')).toBe('90°');
    expect(show(c, 'radius(u)')).toBe('2.5');
    expect(show(c, 'coordinates(C)')).toBe('(0, 3)');
    expect(show(c, 'isCollinear(A, B, C)')).toBe('No');
    expect(show(c, 'equation(u)')).toBe('(x − 2)² + (y − 1.5)² = 6.25');
    expect(show(c, 'C')).toBe('(0, 3)');
    expect(show(c, 'area(Z)')).toContain('unknown object');
    expect(show(c, 'foo(A)')).toContain('unknown measurement');
    expect(show(c, 'distance(A)')).toContain('usage');
  });

  it('measurements follow a dragged vertex', () => {
    const { c } = build(TRIANGLE);
    expect(c.movePoint('C', 0, 6).ok).toBe(true);
    expect(show(c, 'area(t)')).toBe('12');
    const r = measure(c, 'radius(u)');
    expect(r.ok && r.value.kind === 'number' && r.value.v).toBeCloseTo(Math.hypot(4, 6) / 2, 12);
  });

  it('reports lines and conics as equations', () => {
    const { c } = build('A = point(0, 1)\nB = point(2, 5)\nl = line(A, B)');
    expect(show(c, 'equation(l)')).toBe('y = 2x + 1');
    expect(show(c, 'slope(l)')).toBe('2');
    expect(
      fmtEquation(
        {
          kind: 'conic',
          type: 'ellipse',
          coefficients: { A: 1, B: 0, C: 4, D: 0, E: 0, F: -4 },
        },
        F,
      ),
    ).toBe('x² + 4y² − 4 = 0');
  });

  it('marks degenerate constructions instead of inventing figures', () => {
    const { c } = build(
      'A = point(0, 0)\nB = point(1, 0)\nC = point(2, 0)\nk = circumcircle(A, B, C)',
    );
    expect(c.get('k')?.value.kind).toBe('undefined');
    expect(show(c, 'radius(k)')).toContain('undefined');
  });

  it('collects script errors without stopping', () => {
    const { c, errors } = build('A = point(1, 2)\nB = nonsense(A)\nC = point(3, 4)');
    expect(c.objects().map((o) => o.name)).toEqual(['A', 'C']);
    expect(errors).toHaveLength(1);
  });

  it('redefines an object and replays the script', () => {
    const r = redefine(TRIANGLE, 'C', 'point(0, 6)');
    expect(r.ok && r.value).toContain('C = point(0, 6)');
    expect(redefine(TRIANGLE, 'A', 'midpoint(B, C)').ok).toBe(false);
    expect(redefine(TRIANGLE, 'X', 'point(1, 1)').ok).toBe(false);
  });

  it('keeps names consistent when renaming and deleting', () => {
    const s = {
      ...initGeometryState(),
      hidden: ['A'],
      colors: { A: '#000' },
      trace: ['A'],
      measures: ['distance(A, B)', 'area(t)'],
    };
    const r = renamed(s, 'A', 'P', 'x');
    expect(r.hidden).toEqual(['P']);
    expect(r.colors).toEqual({ P: '#000' });
    expect(r.measures).toEqual(['distance(P, B)', 'area(t)']);
    const d = withoutObjects(s, ['A', 't'], '');
    expect(d.measures).toEqual([]);
    expect(d.trace).toEqual([]);
  });

  it('hits points before the figures they lie on', () => {
    const { c } = build(TRIANGLE);
    expect(hitTest(c, { x: 0.05, y: 0.05 }, 0.2)?.name).toBe('A');
    expect(hitTest(c, { x: 2, y: 0.1 }, 0.2)?.name).toBe('t');
    expect(hitTest(c, { x: 9, y: 9 }, 0.2)).toBeUndefined();
    expect(hitTest(c, { x: 2, y: -0.95 }, 0.2)?.name).toBe('u');
  });

  it('describes the tools', () => {
    const tri = toolById('triangle')!;
    expect(tri.steps).toHaveLength(3);
    const { c } = build(TRIANGLE + '\ns = segment(A, B)');
    expect(toolComplete(toolById('midpoint')!, [c.get('s')!])).toBe(true);
    expect(toolComplete(toolById('midpoint')!, [c.get('A')!])).toBe(false);
    expect(nextStep(toolById('polygon')!, [c.get('A')!])).toEqual(['point']);
    expect(createsPoint(toolById('segment')!.steps[0], toolById('segment')!)).toBe(true);
    expect(createsPoint(toolById('translate')!.steps[0], toolById('translate')!)).toBe(false);
    expect(createsPoint(toolById('distance')!.steps[0], toolById('distance')!)).toBe(false);
    for (const t of TOOLS) expect(t.cmd || t.measure).toBeTruthy();
  });

  it('chooses the intersection and tangent the user pointed at', () => {
    const { c } = build(
      'O = point(0, 0)\nk = circle(O, 2)\nA = point(-5, 0)\nB = point(5, 0)\nl = line(A, B)\nP = point(4, 0)',
    );
    const shapes = [c.shape('l'), c.shape('k')];
    expect(chooseIndex('intersect', shapes, { x: -2, y: 0.3 }, 1e-9)).toBe(1);
    expect(chooseIndex('intersect', shapes, { x: 2, y: 0.3 }, 1e-9)).toBe(2);
    const t = [c.shape('P'), c.shape('k')];
    const i1 = chooseIndex('tangent', t, { x: 1, y: 1.8 }, 1e-9);
    const i2 = chooseIndex('tangent', t, { x: 1, y: -1.8 }, 1e-9);
    expect(i1).not.toBe(i2);
  });

  it('suggests measurements for a selected object', () => {
    const { c } = build(TRIANGLE);
    expect(defaultMeasures(c.get('t')!)).toEqual(['area(t)', 'length(t)']);
    expect(defaultMeasures(c.get('A')!)).toEqual(['coordinates(A)']);
  });

  it('keeps circles round and snaps to a nice grid', () => {
    const v = equalView({ xmin: -10, xmax: 10, ymin: -1, ymax: 1 }, { width: 400, height: 300 });
    expect(v.ymax - v.ymin).toBeCloseTo(15);
    expect(snap(0.30000000000000004, 0.1)).toBe(0.3);
    expect(snap(1.26, 0.5)).toBe(1.5);
    const { c } = build(TRIANGLE);
    const f = fitView(c)!;
    expect(f.xmin).toBeLessThan(-0.5);
    expect(f.xmax).toBeGreaterThan(4);
    expect(fitView(build('').c)).toBeNull();
  });
});
