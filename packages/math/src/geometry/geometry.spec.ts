import { describe, expect, it } from 'vitest';

import { classifyConic, conicValue, normalizeConic } from './conic';
import {
  angle,
  angleBetween,
  arcLength,
  area,
  collinear,
  concyclic,
  coordinates,
  distance,
  equation,
  equilateral,
  isosceles,
  length,
  onObject,
  parallel,
  perpendicular,
  radius,
  slope,
} from './measure';
import { Construction, type GeoObject } from './model';
import { renderData, renderScene } from './render-data';
import { type ConicCoefficients, type Shape, type Vec, dist } from './shapes';

const VIEW = { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };

/** Runs commands, failing the test on the first error. */
function scene(...lines: string[]): Construction {
  const g = new Construction();
  for (const l of lines) must(g, l);
  return g;
}

function must(g: Construction, line: string): GeoObject {
  const r = g.run(line);
  if (!r.ok) throw new Error(`${line}: ${r.error.message}`);
  return r.value;
}

function pt(s: Shape): Vec {
  if (s.kind !== 'point') throw new Error(`expected a point, got ${JSON.stringify(s)}`);
  return s.p;
}

function expectPoint(s: Shape, x: number, y: number, digits = 9): void {
  const p = pt(s);
  expect(p.x).toBeCloseTo(x, digits);
  expect(p.y).toBeCloseTo(y, digits);
}

function circleOf(s: Shape): { c: Vec; r: number } {
  if (s.kind !== 'circle') throw new Error(`expected a circle, got ${JSON.stringify(s)}`);
  return s;
}

function value<T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Coefficients equal up to a non-zero factor. */
function expectProportional(q: ConicCoefficients, want: ConicCoefficients): void {
  const a = normalizeConic(q);
  const b = normalizeConic(want);
  for (const k of ['A', 'B', 'C', 'D', 'E', 'F'] as const) expect(a[k]).toBeCloseTo(b[k], 8);
}

const triangle345 = (): Construction =>
  scene('A = point(0, 0)', 'B = point(4, 0)', 'C = point(0, 3)');

describe('triangle centres', () => {
  it('circumcircle of a right triangle: centre = midpoint of the hypotenuse', () => {
    const g = triangle345();
    must(g, 'k = circle(A, B, C)');
    const k = circleOf(g.shape('k'));
    expect(k.c.x).toBeCloseTo(2);
    expect(k.c.y).toBeCloseTo(1.5);
    expect(k.r).toBeCloseTo(2.5);
    must(g, 'k2 = circumcircle(A, B, C)');
    expect(circleOf(g.shape('k2')).r).toBeCloseTo(2.5);
  });

  it('circumcentre lies on all perpendicular bisectors', () => {
    const g = scene('A = point(-1, 0)', 'B = point(5, 1)', 'C = point(2, 6)');
    must(g, 'm1 = perpBisector(A, B)');
    must(g, 's = segment(B, C)');
    must(g, 'm2 = perpBisector(s)');
    must(g, 'O = intersect(m1, m2)');
    must(g, 'k = circumcircle(A, B, C)');
    const k = circleOf(g.shape('k'));
    expect(dist(pt(g.shape('O')), k.c)).toBeLessThan(1e-9);
  });

  it('centroid = intersection of two medians', () => {
    const g = scene('A = point(0, 0)', 'B = point(6, 0)', 'C = point(0, 3)');
    must(g, 'ma = median(A, B, C)');
    must(g, 'mb = median(B, C, A)');
    must(g, 'S = intersect(ma, mb)');
    expectPoint(g.shape('S'), 2, 1);
  });

  it('orthocentre = intersection of two altitudes', () => {
    const g = scene('A = point(0, 0)', 'B = point(4, 0)', 'C = point(1, 3)');
    must(g, 'ha = altitude(A, B, C)');
    must(g, 'hc = altitude(C, A, B)');
    must(g, 'H = intersect(ha, hc)');
    expectPoint(g.shape('H'), 1, 1);
  });

  it('incircle of the 3-4-5 triangle has radius 1 and centre (1, 1)', () => {
    const g = triangle345();
    must(g, 'i = incircle(A, B, C)');
    const i = circleOf(g.shape('i'));
    expect(i.r).toBeCloseTo(1);
    expect(i.c.x).toBeCloseTo(1);
    expect(i.c.y).toBeCloseTo(1);
  });

  it('excircle opposite A of the 3-4-5 triangle: centre (6, 6), radius 6', () => {
    const g = triangle345();
    must(g, 'e = excircle(A, B, C, 1)');
    const e = circleOf(g.shape('e'));
    expect(e.r).toBeCloseTo(6);
    expect(e.c.x).toBeCloseTo(6);
    expect(e.c.y).toBeCloseTo(6);
  });

  it('collinear points have no circumcircle and no incircle', () => {
    const g = scene('A = point(0, 0)', 'B = point(1, 1)', 'C = point(3, 3)');
    must(g, 'k = circle(A, B, C)');
    must(g, 'i = incircle(A, B, C)');
    expect(g.shape('k')).toMatchObject({ kind: 'undefined', reason: 'the points are collinear' });
    expect(g.shape('i').kind).toBe('undefined');
  });

  it('angle bisector of a right angle has direction (1, 1)/√2', () => {
    const g = scene('A = point(5, 0)', 'B = point(0, 0)', 'C = point(0, 2)');
    const w = must(g, 'w = angleBisector(A, B, C)').value;
    if (w.kind !== 'line') throw new Error('line expected');
    expect(w.d.x).toBeCloseTo(Math.SQRT1_2);
    expect(w.d.y).toBeCloseTo(Math.SQRT1_2);
  });
});

describe('tangents', () => {
  it('tangents from an external point touch the circle at (9/5, ±12/5)', () => {
    const g = scene('O = point(0, 0)', 'k = circle(O, 3)', 'P = point(5, 0)');
    must(g, 't1 = tangent(P, k, 1)');
    must(g, 't2 = tangent(P, k, 2)');
    must(g, 'T1 = intersect(t1, k)');
    must(g, 'T2 = intersect(t2, k)');
    expectPoint(g.shape('T1'), 9 / 5, 12 / 5, 6);
    expectPoint(g.shape('T2'), 9 / 5, -12 / 5, 6);
    // tangent ⟂ radius
    must(g, 'r1 = line(O, T1)');
    expect(value(perpendicular(g.shape('t1'), g.shape('r1')))).toBe(true);
  });

  it('a point on the circle has one tangent, perpendicular to the radius', () => {
    const g = scene('O = point(0, 0)', 'k = circle(O, 2)', 'P = point(0, 2)', 't = tangent(P, k)');
    expect(value(slope(g.shape('t')))).toBeCloseTo(0);
  });

  it('a point inside the circle has no tangent', () => {
    const g = scene('O = point(0, 0)', 'k = circle(O, 2)', 'P = point(1, 0)', 't = tangent(P, k)');
    expect(g.shape('t')).toMatchObject({ kind: 'undefined' });
  });
});

describe('intersections', () => {
  it('two circles meet in two points; index 1 is left of centre₁ → centre₂', () => {
    const g = scene('A = point(0, 0)', 'B = point(6, 0)', 'k1 = circle(A, 5)', 'k2 = circle(B, 5)');
    must(g, 'S1 = intersect(k1, k2, 1)');
    must(g, 'S2 = intersect(k1, k2, 2)');
    expectPoint(g.shape('S1'), 3, 4);
    expectPoint(g.shape('S2'), 3, -4);
  });

  it('touching circles meet in one point (both indices)', () => {
    const g = scene('A = point(0, 0)', 'B = point(5, 0)', 'k1 = circle(A, 2)', 'k2 = circle(B, 3)');
    must(g, 'S1 = intersect(k1, k2, 1)');
    must(g, 'S2 = intersect(k1, k2, 2)');
    expectPoint(g.shape('S1'), 2, 0);
    expectPoint(g.shape('S2'), 2, 0);
  });

  it('disjoint and coincident circles have no intersection point', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(10, 0)',
      'k1 = circle(A, 2)',
      'k2 = circle(B, 3)',
    );
    must(g, 'S = intersect(k1, k2)');
    expect(g.shape('S')).toEqual({ kind: 'undefined', reason: 'no intersection' });
    must(g, 'k3 = circle(A, 2)');
    must(g, 'T = intersect(k1, k3)');
    expect(g.shape('T')).toEqual({ kind: 'undefined', reason: 'the circles coincide' });
  });

  it('parallel lines → undefined intersection, never a point', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(1, 1)',
      'C = point(0, 2)',
      'l = line(A, B)',
      'p = parallel(C, l)',
      'S = intersect(l, p)',
    );
    expect(g.shape('S')).toEqual({ kind: 'undefined', reason: 'the lines are parallel' });
    // measuring it is an error, not a number
    expect(coordinates(g.shape('S')).ok).toBe(false);
  });

  it('line ∩ circle in canonical order along the line', () => {
    const g = scene(
      'O = point(0, 0)',
      'k = circle(O, 5)',
      'A = point(-1, 3)',
      'B = point(1, 3)',
      'l = line(A, B)',
      'S1 = intersect(l, k, 1)',
      'S2 = intersect(k, l, 2)',
    );
    expectPoint(g.shape('S1'), -4, 3);
    expectPoint(g.shape('S2'), 4, 3);
  });

  it('a segment that does not reach the circle has no intersection', () => {
    const g = scene(
      'O = point(0, 0)',
      'k = circle(O, 5)',
      'A = point(-1, 0)',
      'B = point(1, 0)',
      's = segment(A, B)',
      'S = intersect(s, k)',
      'r = ray(A, B)',
      'R = intersect(r, k, 2)',
    );
    expect(g.shape('S').kind).toBe('undefined');
    expectPoint(g.shape('R'), 5, 0);
  });

  it('crossing and non-crossing segments', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(2, 2)',
      'C = point(0, 2)',
      'D = point(2, 0)',
      'E = point(5, 0)',
      's1 = segment(A, B)',
      's2 = segment(C, D)',
      's3 = segment(D, E)',
      'X = intersect(s1, s2)',
      'Y = intersect(s1, s3)',
    );
    expectPoint(g.shape('X'), 1, 1);
    expect(g.shape('Y')).toMatchObject({ kind: 'undefined' });
  });

  it('line ∩ ellipse', () => {
    const g = scene(
      'F1 = point(-3, 0)',
      'F2 = point(3, 0)',
      'P = point(5, 0)',
      'e = ellipse(F1, F2, P)',
      'l = line(F1, F2)',
      'S1 = intersect(l, e, 1)',
      'S2 = intersect(l, e, 2)',
    );
    expectPoint(g.shape('S1'), -5, 0);
    expectPoint(g.shape('S2'), 5, 0);
  });
});

describe('dragging and dependency graph', () => {
  it('moving a free point updates all dependants (and only them)', () => {
    const g = triangle345();
    must(g, 'k = circle(A, B, C)');
    must(g, 'M = midpoint(A, B)');
    must(g, 'Q = point(9, 9)');
    const changed = value(g.movePoint('B', 8, 0));
    expect(changed).toEqual(['B', 'k', 'M']);
    const k = circleOf(g.shape('k'));
    expect(k.c.x).toBeCloseTo(4);
    expectPoint(g.shape('M'), 4, 0);
    expect(g.describe('B')).toBe('point(8, 0)');
  });

  it('a degenerate state comes and goes while dragging', () => {
    const g = scene('A = point(0, 0)', 'B = point(1, 1)', 'C = point(2, 0)', 'k = circle(A, B, C)');
    value(g.movePoint('B', 1, 0));
    expect(g.shape('k').kind).toBe('undefined');
    value(g.movePoint('B', 1, -1));
    expect(circleOf(g.shape('k')).r).toBeCloseTo(1);
  });

  it('an ambiguous intersection stays on its branch while dragging', () => {
    const lines = [
      'O = point(0, 0)',
      'k = circle(O, 5)',
      'B = point(1, 0)',
      'A = point(-1, 0)',
      'l = line(A, B)',
      'S = intersect(l, k, 1)',
    ];
    const g = scene(...lines);
    expectPoint(g.shape('S'), -5, 0);
    // A slides through B: the line stays the x axis, but its direction flips.
    for (let x = -1; x <= 3; x += 0.3) value(g.movePoint('A', x, 0));
    value(g.movePoint('A', 3, 0));
    expectPoint(g.shape('S'), -5, 0);
    // A fresh construction in the end position picks the canonical first solution instead.
    const fresh = scene(...lines.slice(0, 3), 'A = point(3, 0)', ...lines.slice(4));
    expectPoint(fresh.shape('S'), 5, 0);
  });

  it('deleting cascades to all dependants and reports them', () => {
    const g = triangle345();
    must(g, 'l = line(A, B)');
    must(g, 'p = parallel(C, l)');
    must(g, 'k = circle(C, 1)');
    must(g, 'S = intersect(p, k)');
    expect(g.dependants('B')).toEqual(['l', 'p', 'S']);
    expect(value(g.delete('B'))).toEqual(['B', 'l', 'p', 'S']);
    expect(g.objects().map((o) => o.name)).toEqual(['A', 'C', 'k']);
    expect(g.delete('B').ok).toBe(false);
  });

  it('rename keeps references; names are checked', () => {
    const g = triangle345();
    must(g, 'k = circle(A, B)');
    value(g.rename('A', 'Center'));
    expect(g.describe('k')).toBe('circle(Center, B)');
    expect(g.rename('B', 'C')).toMatchObject({ ok: false });
    expect(g.rename('B', '1x')).toMatchObject({ ok: false });
    expect(g.rename('B', 'circle')).toMatchObject({ ok: false });
  });

  it('default names GA, GB, …, then GA1; hiding', () => {
    const g = new Construction();
    const names: string[] = [];
    for (let i = 0; i < 28; i++) names.push(value(g.add('point', [i, 0])).name);
    expect(names.slice(0, 3)).toEqual(['GA', 'GB', 'GC']);
    expect(names.slice(25)).toEqual(['GZ', 'GA1', 'GB1']);
    value(g.setHidden('GA', true));
    expect(g.get('GA')?.hidden).toBe(true);
  });

  it('the script replays to the same construction', () => {
    const g = triangle345();
    must(g, 'k = incircle(A, B, C)');
    must(g, 'r = rotate(k, A, pi/2)');
    const h = new Construction();
    for (const line of g.script().split('\n')) must(h, line);
    expect(h.script()).toBe(g.script());
    expect(h.shape('r')).toEqual(g.shape('r'));
    expect(circleOf(h.shape('r')).c.x).toBeCloseTo(-1);
  });

  it('command errors are values with codes', () => {
    const g = triangle345();
    expect(g.run('k = sphere(A, B)')).toMatchObject({
      ok: false,
      error: { code: 'unknown-function' },
    });
    expect(g.run('k = circle(A, Z)')).toMatchObject({
      ok: false,
      error: { code: 'unknown-symbol' },
    });
    expect(g.run('k = line(A)')).toMatchObject({ ok: false, error: { code: 'syntax' } });
    must(g, 'l = line(A, B)');
    expect(g.run('m = line(A, l)')).toMatchObject({ ok: false, error: { code: 'domain' } });
    must(g, 'k = circle(A, 2)');
    must(g, 'e = ellipse(A, B, C)');
    expect(g.run('X = intersect(k, e)')).toMatchObject({
      ok: false,
      error: { code: 'unsupported' },
    });
    expect(g.run('A = point(1, 1)')).toMatchObject({ ok: false, error: { code: 'syntax' } });
  });

  it('only free points move', () => {
    const g = triangle345();
    must(g, 'M = midpoint(A, B)');
    expect(g.movePoint('M', 1, 1)).toMatchObject({ ok: false, error: { code: 'unsupported' } });
    expect(g.isFree('A')).toBe(true);
    expect(g.isFree('M')).toBe(false);
  });

  it('sliders clamp and drive dependants; slider-bound points are not free', () => {
    const g = scene(
      's = slider(2, 0, 4)',
      'O = point(0, 0)',
      'k = circle(O, s)',
      'P = point(s, 1)',
    );
    expect(radius(g.shape('k')).ok && value(radius(g.shape('k')))).toBe(2);
    expect(value(g.setSlider('s', 9))).toEqual(['s', 'k', 'P']);
    expect(value(radius(g.shape('k')))).toBe(4);
    expectPoint(g.shape('P'), 4, 1);
    expect(g.isFree('P')).toBe(false);
    expect(g.movePoint('P', 0, 0).ok).toBe(false);
    must(g, 'n = slider(5, 3, 12)');
    must(g, 'h = regularPolygon(O, P, n)');
    const h = g.shape('h');
    expect(h.kind === 'polygon' && h.pts.length).toBe(5);
    value(g.setSlider('n', 6));
    expect(value(length(g.shape('h')))).toBeCloseTo(6 * Math.hypot(4, 1));
  });

  it('a point on a circle follows drags along the circle', () => {
    const g = scene('O = point(0, 0)', 'k = circle(O, 2)', 'P = pointOn(k, 0)');
    expectPoint(g.shape('P'), 2, 0);
    value(g.movePoint('P', 0, 10));
    expectPoint(g.shape('P'), 0, 2);
    value(g.setParameter('P', Math.PI));
    expectPoint(g.shape('P'), -2, 0);
    value(g.movePoint('O', 1, 1));
    expectPoint(g.shape('P'), -1, 1);
  });

  it('points on segments and polygons', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(4, 0)',
      'C = point(4, 4)',
      's = segment(A, B)',
      'P = pointOn(s, 0.25)',
      'q = polygon(A, B, C)',
      'Q = pointOn(q, 0)',
    );
    expectPoint(g.shape('P'), 1, 0);
    value(g.movePoint('Q', 5, 2));
    expectPoint(g.shape('Q'), 4, 2);
  });
});

describe('transformations', () => {
  const quad = (): Construction =>
    scene(
      'A = point(0, 0)',
      'B = point(3, 0)',
      'C = point(4, 2)',
      'D = point(1, 3)',
      'q = polygon(A, B, C, D)',
    );

  it('rotating a polygon keeps side lengths and area', () => {
    const g = quad();
    must(g, 'Z = point(-2, 5)');
    must(g, 'r = rotate(q, Z, 1.234)');
    expect(value(length(g.shape('r')))).toBeCloseTo(value(length(g.shape('q'))), 10);
    expect(value(area(g.shape('r')))).toBeCloseTo(value(area(g.shape('q'))), 10);
  });

  it('reflecting twice in a line is the identity', () => {
    const g = quad();
    must(g, 'P = point(-1, 2)');
    must(g, 'R = point(3, 7)');
    must(g, 'm = line(P, R)');
    must(g, 'q1 = reflect(q, m)');
    must(g, 'q2 = reflect(q1, m)');
    const a = g.shape('q');
    const b = g.shape('q2');
    if (a.kind !== 'polygon' || b.kind !== 'polygon') throw new Error('polygons expected');
    a.pts.forEach((p, i) => expect(dist(p, b.pts[i])).toBeLessThan(1e-12));
    expect(value(area(g.shape('q1')))).toBeCloseTo(value(area(a)));
  });

  it('point reflection twice is the identity; circles stay circles', () => {
    const g = scene(
      'O = point(1, 1)',
      'k = circle(O, 2)',
      'Z = point(4, 0)',
      'k1 = reflect(k, Z)',
      'k2 = reflect(k1, Z)',
    );
    expect(circleOf(g.shape('k1')).c).toEqual({ x: 7, y: -1 });
    expect(circleOf(g.shape('k2')).c).toEqual({ x: 1, y: 1 });
  });

  it('translation by two points or by dx, dy', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(2, 1)',
      'P = point(5, 5)',
      'P1 = translate(P, A, B)',
      'P2 = translate(P, -1, 3)',
    );
    expectPoint(g.shape('P1'), 7, 6);
    expectPoint(g.shape('P2'), 4, 8);
  });

  it('dilation and similarity scale radii and lengths', () => {
    const g = scene(
      'O = point(0, 0)',
      'Z = point(1, 0)',
      'k = circle(Z, 1)',
      'k2 = dilate(k, O, 3)',
      's = segment(O, Z)',
      's2 = similarity(s, O, 2, pi/2)',
    );
    const k2 = circleOf(g.shape('k2'));
    expect(k2.r).toBeCloseTo(3);
    expect(k2.c.x).toBeCloseTo(3);
    const s2 = g.shape('s2');
    if (s2.kind !== 'segment') throw new Error('segment expected');
    expect(s2.b.x).toBeCloseTo(0);
    expect(s2.b.y).toBeCloseTo(2);
  });

  it('projection onto a line: foot of a point, shadow of a circle, perpendicular line undefined', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(1, 0)',
      'l = line(A, B)',
      'P = point(3, 4)',
      'F = project(P, l)',
      'k = circle(P, 2)',
      's = project(k, l)',
      'C = point(3, 9)',
      'm = line(P, C)',
      'n = project(m, l)',
    );
    expectPoint(g.shape('F'), 3, 0);
    expect(value(length(g.shape('s')))).toBeCloseTo(4);
    expect(g.shape('n').kind).toBe('undefined');
  });

  it('inversion: points round-trip, lines ↔ circles through the centre', () => {
    const g = scene(
      'O = point(0, 0)',
      'k = circle(O, 2)',
      'P = point(1, 0)',
      'P1 = invert(P, k)',
      'P2 = invert(P1, k)',
      'A = point(1, -5)',
      'B = point(1, 5)',
      'l = line(A, B)',
      'c = invert(l, k)',
      'l2 = invert(c, k)',
    );
    expectPoint(g.shape('P1'), 4, 0);
    expectPoint(g.shape('P2'), 1, 0);
    const c = circleOf(g.shape('c'));
    expect(c.c.x).toBeCloseTo(2);
    expect(c.r).toBeCloseTo(2);
    expect(g.shape('l2').kind).toBe('line');
    expect(value(distance(g.shape('P'), g.shape('l2')))).toBeCloseTo(0);
    expect(g.run('X = invert(O, k)').ok && g.shape('X').kind).toBe('undefined');
  });

  it('regular polygon, equilateral triangle, square, parallelogram', () => {
    const g = scene(
      'O = point(0, 0)',
      'V = point(2, 0)',
      'h = regularPolygon(O, V, 6)',
      't = equilateral(O, V)',
      'q = square(O, V)',
      'W = point(3, 2)',
      'p = parallelogram(O, V, W)',
    );
    expect(value(length(g.shape('h')))).toBeCloseTo(12);
    expect(value(equilateral(undefined, g.shape('t')))).toBe(true);
    expect(value(area(g.shape('q')))).toBeCloseTo(4);
    expect(value(equilateral(undefined, g.shape('q')))).toBe(true);
    expect(value(area(g.shape('p')))).toBeCloseTo(4);
  });
});

describe('conics', () => {
  it('the conic through five points of x² + y² = 25 is that circle (up to scale)', () => {
    const g = scene(
      'A = point(5, 0)',
      'B = point(3, 4)',
      'C = point(-4, 3)',
      'D = point(0, -5)',
      'E = point(-3, -4)',
      'c = conic(A, B, C, D, E)',
    );
    const e = value(equation(g.shape('c')));
    if (e.kind !== 'conic') throw new Error('conic expected');
    expectProportional(e.coefficients, { A: 1, B: 0, C: 1, D: 0, E: 0, F: -25 });
    expect(e.type).toBe('ellipse');
  });

  it('five points with four on a line do not give a proper conic', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(1, 0)',
      'C = point(2, 0)',
      'D = point(3, 0)',
      'E = point(0, 1)',
      'c = conic(A, B, C, D, E)',
    );
    const s = g.shape('c');
    expect(
      s.kind === 'undefined' || (s.kind === 'conic' && classifyConic(s.q).type === 'degenerate'),
    ).toBe(true);
  });

  it('ellipse from foci and a point: x²/25 + y²/16 = 1, area 20π', () => {
    const g = scene(
      'F1 = point(-3, 0)',
      'F2 = point(3, 0)',
      'P = point(0, 4)',
      'e = ellipse(F1, F2, P)',
    );
    const s = g.shape('e');
    if (s.kind !== 'conic') throw new Error('conic expected');
    expectProportional(s.q, { A: 16, B: 0, C: 25, D: 0, E: 0, F: -400 });
    expect(value(area(s))).toBeCloseTo(20 * Math.PI);
    // Ramanujan: π(3(a+b) − √((3a+b)(a+3b)))
    expect(value(length(s))).toBeCloseTo(Math.PI * (27 - Math.sqrt(19 * 17)), 4);
  });

  it('rotated ellipse classifies back to its axes', () => {
    const g = scene(
      'F1 = point(1, 1)',
      'F2 = point(3, 3)',
      'P = point(0, 3)',
      'e = ellipse(F1, F2, P)',
    );
    const s = g.shape('e');
    if (s.kind !== 'conic') throw new Error('conic expected');
    const f = classifyConic(s.q);
    if (f.type !== 'ellipse') throw new Error('ellipse expected');
    const a = (Math.hypot(1, 2) + Math.hypot(3, 0)) / 2;
    expect(Math.max(f.a, f.b)).toBeCloseTo(a);
    expect(f.center.x).toBeCloseTo(2);
    expect(value(onObject(g.shape('P'), s))).toBe(true);
  });

  it('hyperbola from foci and a vertex: x²/9 − y²/16 = 1', () => {
    const g = scene(
      'F1 = point(-5, 0)',
      'F2 = point(5, 0)',
      'P = point(3, 0)',
      'h = hyperbola(F1, F2, P)',
    );
    const s = g.shape('h');
    if (s.kind !== 'conic') throw new Error('conic expected');
    expectProportional(s.q, { A: 16, B: 0, C: -9, D: 0, E: 0, F: -144 });
    const r = renderData(s, VIEW);
    expect(r.type === 'polyline' && r.paths.length).toBe(2);
    if (r.type === 'polyline')
      for (const p of r.paths.flat())
        expect(conicValue(s.q, p) / (1 + p.x * p.x + p.y * p.y)).toBeCloseTo(0, 9);
  });

  it('parabola from focus (0, 1) and directrix y = −1 is x² = 4y', () => {
    const g = scene(
      'F = point(0, 1)',
      'A = point(0, -1)',
      'B = point(1, -1)',
      'd = line(A, B)',
      'p = parabola(F, d)',
    );
    const s = g.shape('p');
    if (s.kind !== 'conic') throw new Error('conic expected');
    expectProportional(s.q, { A: 1, B: 0, C: 0, D: 0, E: -4, F: 0 });
    const f = classifyConic(s.q);
    expect(f.type).toBe('parabola');
    const r = renderData(s, VIEW);
    if (r.type !== 'polyline') throw new Error('polyline expected');
    for (const q of r.paths[0]) expect(q.x * q.x - 4 * q.y).toBeCloseTo(0, 8);
  });

  it('focus on the directrix → undefined parabola', () => {
    const g = scene(
      'F = point(0, -1)',
      'A = point(0, -1)',
      'B = point(1, -1)',
      'd = line(A, B)',
      'p = parabola(F, d)',
    );
    expect(g.shape('p')).toMatchObject({
      kind: 'undefined',
      reason: 'the focus lies on the directrix',
    });
  });
});

describe('locus', () => {
  it('the midpoint of a segment with one end on a circle runs on a circle', () => {
    const g = scene(
      'O = point(0, 0)',
      'k = circle(O, 2)',
      'Q = pointOn(k, 0)',
      'A = point(4, 0)',
      'M = midpoint(A, Q)',
      'L = locus(M, Q)',
    );
    const l = g.shape('L');
    if (l.kind !== 'polyline') throw new Error('polyline expected');
    const pts = l.paths.flat();
    expect(pts.length).toBeGreaterThan(100);
    for (const p of pts) expect(dist(p, { x: 2, y: 0 })).toBeCloseTo(1, 9);
    // the locus follows when the scene changes
    value(g.movePoint('A', 0, 4));
    const l2 = g.shape('L');
    if (l2.kind !== 'polyline') throw new Error('polyline expected');
    for (const p of l2.paths.flat()) expect(dist(p, { x: 0, y: 2 })).toBeCloseTo(1, 9);
  });

  it('locus needs a point on an object that the traced point depends on', () => {
    const g = scene('A = point(0, 0)', 'B = point(1, 0)', 'M = midpoint(A, B)');
    expect(g.run('L = locus(M, A)')).toMatchObject({ ok: false, error: { code: 'domain' } });
  });
});

describe('measurements', () => {
  it('distances, slope, angles', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(4, 0)',
      'C = point(0, 3)',
      'l = line(B, C)',
      'v = line(A, C)',
    );
    expect(value(distance(g.shape('B'), g.shape('C')))).toBeCloseTo(5);
    expect(value(distance(g.shape('A'), g.shape('l')))).toBeCloseTo(12 / 5);
    expect(value(slope(g.shape('l')))).toBeCloseTo(-3 / 4);
    expect(slope(g.shape('v'))).toMatchObject({ ok: false, error: { code: 'domain' } });
    expect(value(angle(g.shape('B'), g.shape('A'), g.shape('C')))).toBeCloseTo(Math.PI / 2);
    expect(value(angleBetween(g.shape('l'), g.shape('v')))).toBeCloseTo(Math.atan2(4, 3));
  });

  it('lengths, areas, radius, arc length', () => {
    const g = triangle345();
    must(g, 't = triangle(A, B, C)');
    must(g, 'k = circle(A, 2)');
    must(g, 'P = pointOn(k, 0)');
    must(g, 'Q = pointOn(k, pi/2)');
    expect(value(length(g.shape('t')))).toBeCloseTo(12);
    expect(value(area(g.shape('t')))).toBeCloseTo(6);
    expect(value(area(g.shape('k')))).toBeCloseTo(4 * Math.PI);
    expect(value(length(g.shape('k')))).toBeCloseTo(4 * Math.PI);
    expect(value(arcLength(g.shape('k'), g.shape('P'), g.shape('Q')))).toBeCloseTo(Math.PI);
    expect(value(arcLength(g.shape('k'), g.shape('Q'), g.shape('P')))).toBeCloseTo(3 * Math.PI);
  });

  it('equations of a line and a circle', () => {
    const g = scene('A = point(0, 1)', 'B = point(1, 2)', 'l = line(A, B)', 'k = circle(B, 3)');
    const e = value(equation(g.shape('l')));
    if (e.kind !== 'line') throw new Error('line expected');
    // −x + y − 1 = 0 normalised to a > 0: x − y + 1 = 0, scaled by 1/√2
    expect(e.a).toBeCloseTo(Math.SQRT1_2);
    expect(e.b).toBeCloseTo(-Math.SQRT1_2);
    expect(e.c).toBeCloseTo(Math.SQRT1_2);
    const c = value(equation(g.shape('k')));
    expect(c).toMatchObject({
      kind: 'circle',
      r: 3,
      coefficients: { A: 1, C: 1, D: -2, E: -4, F: -4 },
    });
  });

  it('tests: collinear, concyclic, parallel, perpendicular, isosceles, on object', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(1, 1)',
      'C = point(2, 2)',
      'D = point(2, 0)',
      'l = line(A, B)',
      'p = parallel(D, l)',
      'n = perpendicular(D, l)',
      'k = circle(A, B, D)',
      'S = intersect(n, l)',
    );
    expect(value(collinear(g.shape('A'), g.shape('B'), g.shape('C')))).toBe(true);
    expect(value(collinear(g.shape('A'), g.shape('B'), g.shape('D')))).toBe(false);
    expect(value(parallel(g.shape('l'), g.shape('p')))).toBe(true);
    expect(value(perpendicular(g.shape('l'), g.shape('n')))).toBe(true);
    expect(value(perpendicular(g.shape('l'), g.shape('p')))).toBe(false);
    expect(value(onObject(g.shape('S'), g.shape('l')))).toBe(true);
    expect(value(onObject(g.shape('S'), g.shape('n')))).toBe(true);
    expect(value(onObject(g.shape('C'), g.shape('k')))).toBe(false);
    expect(value(isosceles(undefined, g.shape('A'), g.shape('B'), g.shape('D')))).toBe(true);
    must(g, 'E = point(1, -1)');
    expect(value(concyclic(g.shape('A'), g.shape('B'), g.shape('D'), g.shape('E')))).toBe(true);
    expect(value(concyclic(g.shape('A'), g.shape('B'), g.shape('D'), g.shape('C')))).toBe(false);
  });

  it('tolerance scales with the scene', () => {
    const big = { kind: 'point', p: { x: 1e6, y: 1e6 + 1e-5 } } as const;
    const o = { kind: 'point', p: { x: 0, y: 0 } } as const;
    const far = { kind: 'point', p: { x: 2e6, y: 2e6 } } as const;
    expect(value(collinear(o, big, far))).toBe(false);
    expect(value(collinear(o, big, far, { scale: 2e6 }))).toBe(true);
  });

  it('measuring an undefined object is an error', () => {
    const u: Shape = { kind: 'undefined', reason: 'the lines are parallel' };
    expect(distance(u, u)).toMatchObject({ ok: false, error: { code: 'not-evaluable' } });
    expect(area(u)).toMatchObject({ ok: false, error: { code: 'not-evaluable' } });
  });
});

describe('render data', () => {
  it('primitives for every kind; undefined objects draw nothing', () => {
    const g = scene(
      'A = point(0, 0)',
      'B = point(2, 0)',
      'C = point(0, 2)',
      'l = line(A, B)',
      'r = ray(A, C)',
      's = segment(B, C)',
      'k = circle(A, 1)',
      't = triangle(A, B, C)',
      'e = ellipse(A, B, C)',
      'p = parallel(C, l)',
      'X = intersect(l, p)',
      'n = slider(1, 0, 2)',
    );
    const types = Object.fromEntries(renderScene(g, VIEW).map((i) => [i.name, i.primitive.type]));
    expect(types).toEqual({
      A: 'point',
      B: 'point',
      C: 'point',
      l: 'line',
      r: 'ray',
      s: 'segment',
      k: 'circle',
      t: 'polygon',
      e: 'ellipse',
      p: 'line',
      X: 'none',
      n: 'none',
    });
  });
});
