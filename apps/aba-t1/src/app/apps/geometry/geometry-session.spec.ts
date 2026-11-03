import { TestBed } from '@angular/core/testing';
import { StorageApi } from '@aba/core/storage/storage-api';
import { FakeStorageApi } from '@aba/core/testing';
import { AppStore } from '../app-store';
import type { GeometryState } from './geometry-logic';
import { GeometrySession } from './geometry-session';

describe('GeometrySession', () => {
  let g: GeometrySession;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: StorageApi, useClass: FakeStorageApi }],
    });
    TestBed.inject(AppStore).start('geometry');
    g = TestBed.inject(GeometrySession);
  });

  const state = () => g.state();

  it('stores every construction step as a script line', () => {
    for (const l of [
      'A = point(0, 0)',
      'B = point(4, 0)',
      'C = point(0, 3)',
      't = triangle(A, B, C)',
    ])
      expect(g.run(l).ok).toBe(true);
    expect(g.add('circumcircle', ['A', 'B', 'C'])).toEqual({ ok: true, value: 'GA' });
    expect(state().script.split('\n')).toHaveLength(5);
    expect(g.run('X = nonsense(A)').ok).toBe(false);
    expect(state().script.split('\n')).toHaveLength(5);
  });

  it('keeps the live construction while dragging (no rebuild)', () => {
    g.run('O = point(0, 0)');
    g.run('k = circle(O, 2)');
    g.run('A = point(-5, 1)');
    g.run('B = point(5, 1)');
    g.run('l = line(A, B)');
    g.run('S = intersect(l, k, 2)');
    const c = g.scene().c;
    const x0 = (c.shape('S') as { p: { x: number } }).p.x;
    expect(x0).toBeGreaterThan(0);
    // move the line down through the circle: S stays on its branch (right side)
    for (let y = 1; y >= -1.5; y -= 0.25) {
      g.move('A', -5, y);
      g.move('B', 5, y);
    }
    expect(g.scene().c).toBe(c);
    expect((c.shape('S') as { p: { x: number } }).p.x).toBeGreaterThan(0);
    expect(state().script).toContain('A = point(-5, -1.5)');
  });

  it('cascades deletions and renames into the display state', () => {
    g.run('A = point(0, 0)');
    g.run('B = point(1, 1)');
    g.run('s = segment(A, B)');
    g.update((s: GeometryState) => ({
      ...s,
      measures: ['length(s)', 'coordinates(B)'],
      trace: ['B'],
    }));
    expect(g.rename('B', 'P').ok).toBe(true);
    expect(state().measures).toEqual(['length(s)', 'coordinates(P)']);
    expect(state().trace).toEqual(['P']);
    const d = g.delete('A');
    expect(d.ok && d.value).toEqual(['A', 's']);
    expect(state().measures).toEqual(['coordinates(P)']);
    g.toggleHidden('P');
    expect(g.scene().c.get('P')?.hidden).toBe(true);
  });

  it('redefines by replaying the script', () => {
    g.run('A = point(0, 0)');
    g.run('B = point(2, 0)');
    g.run('M = midpoint(A, B)');
    expect(g.redefine('B', 'point(4, 2)').ok).toBe(true);
    expect(g.scene().c.shape('M')).toEqual({ kind: 'point', p: { x: 2, y: 1 } });
    expect(g.redefine('A', 'midpoint(A, B)').ok).toBe(false);
  });
});
