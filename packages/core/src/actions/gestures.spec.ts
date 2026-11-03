import { GestureRecognizer } from './gestures';

const kinds = (gs: { kind: string; phase?: string }[]) =>
  gs.map((g) => (g.phase ? `${g.kind}:${g.phase}` : g.kind));

describe('GestureRecognizer', () => {
  it('recognises tap, double tap and long press', () => {
    const r = new GestureRecognizer();
    r.down(1, 10, 10, 0);
    expect(kinds(r.up(1, 11, 10, 80))).toEqual(['tap']);
    r.down(1, 12, 11, 200);
    expect(kinds(r.up(1, 12, 11, 260))).toEqual(['doubleTap']);
    r.down(1, 50, 50, 1000);
    expect(kinds(r.up(1, 50, 50, 1700))).toEqual(['longPress']);
    // too late for a double tap
    r.down(1, 50, 50, 3000);
    r.up(1, 50, 50, 3050);
    r.down(1, 50, 50, 3600);
    expect(kinds(r.up(1, 50, 50, 3650))).toEqual(['tap']);
  });

  it('turns movement beyond the slop into a drag with deltas and a swipe on fast release', () => {
    const r = new GestureRecognizer();
    r.down(1, 0, 0, 0);
    expect(r.move(1, 3, 0, 10)).toEqual([]);
    const start = r.move(1, 20, 0, 20);
    expect(kinds(start)).toEqual(['drag:start', 'drag:move']);
    expect(start[1]).toMatchObject({ dx: 20, dy: 0 });
    expect(r.move(1, 30, 5, 30)[0]).toMatchObject({ kind: 'drag', dx: 10, dy: 5 });
    const end = r.up(1, 60, 5, 40);
    expect(kinds(end)).toEqual(['drag:move', 'drag:end', 'swipe']);
    expect(end[2]).toMatchObject({ dir: 'right' });
  });

  it('does not swipe after a slow drag', () => {
    const r = new GestureRecognizer();
    r.down(1, 0, 0, 0);
    r.move(1, 0, 30, 200);
    r.move(1, 0, 40, 600);
    expect(kinds(r.up(1, 0, 41, 1000))).toEqual(['drag:move', 'drag:end']);
  });

  it('pinches with two pointers and reports the scale step', () => {
    const r = new GestureRecognizer();
    r.down(1, 0, 0, 0);
    expect(kinds(r.down(2, 100, 0, 5))).toEqual(['pinch:start']);
    const m = r.move(2, 200, 0, 20);
    expect(m[0]).toMatchObject({ kind: 'pinch', phase: 'move', scale: 2, cx: 100, cy: 0 });
    expect(kinds(r.up(2, 200, 0, 30))).toEqual(['pinch:move', 'pinch:end']);
    // the remaining finger lifts without a tap
    expect(r.up(1, 0, 0, 40)).toEqual([]);
  });

  it('a second finger ends a running drag; cancel ends without tap', () => {
    const r = new GestureRecognizer();
    r.down(1, 0, 0, 0);
    r.move(1, 30, 0, 10);
    expect(kinds(r.down(2, 100, 0, 20))).toEqual(['drag:end', 'pinch:start']);
    expect(kinds(r.cancel(2))).toEqual(['pinch:end']);
    const s = new GestureRecognizer();
    s.down(1, 0, 0, 0);
    expect(s.cancel(1)).toEqual([]);
  });
});
