/**
 * Touch/pointer gesture recognition (prompt 026), pure and framework-free: feed pointer samples
 * (`down`/`move`/`up` with id, position and time in ms) and get gestures back. Mouse, pen and
 * finger behave the same. Two pointers make a pinch.
 */

export type SwipeDir = 'up' | 'down' | 'left' | 'right';
export type Phase = 'start' | 'move' | 'end';

export type Gesture =
  | { kind: 'tap'; x: number; y: number }
  | { kind: 'doubleTap'; x: number; y: number }
  | { kind: 'longPress'; x: number; y: number }
  /** `dx`/`dy`: movement since the previous drag event. */
  | { kind: 'drag'; phase: Phase; x: number; y: number; dx: number; dy: number }
  | { kind: 'swipe'; dir: SwipeDir; x: number; y: number }
  /** `scale`: change of the finger distance since the previous pinch event (> 1 = apart). */
  | { kind: 'pinch'; phase: Phase; cx: number; cy: number; scale: number };

export interface GestureOptions {
  /** Movement (px) below which a press is still a tap. */
  slop: number;
  /** A press at least this long (ms) without movement is a long press. */
  longPress: number;
  /** Second tap within this time (ms) and distance (px) is a double tap. */
  doubleTapTime: number;
  doubleTapDistance: number;
  /** Release speed (px/ms) above which a drag ends in a swipe. */
  swipeSpeed: number;
}

export const DEFAULT_GESTURE_OPTIONS: GestureOptions = {
  slop: 6,
  longPress: 550,
  doubleTapTime: 320,
  doubleTapDistance: 24,
  swipeSpeed: 0.6,
};

interface Track {
  x0: number;
  y0: number;
  t0: number;
  x: number;
  y: number;
  t: number;
  /** recent samples for the release speed */
  trail: { x: number; y: number; t: number }[];
  dragging: boolean;
}

export class GestureRecognizer {
  private readonly tracks = new Map<number, Track>();
  private lastTap: { x: number; y: number; t: number } | null = null;
  private pinchDist = 0;
  private pinching = false;

  constructor(private readonly opt: GestureOptions = DEFAULT_GESTURE_OPTIONS) {}

  down(id: number, x: number, y: number, t: number): Gesture[] {
    const out: Gesture[] = [];
    // a second finger turns a running drag into a pinch
    if (this.tracks.size === 1) {
      const [first] = this.tracks.values();
      if (first.dragging) out.push(this.dragEvent('end', first, 0, 0));
      first.dragging = false;
    }
    this.tracks.set(id, { x0: x, y0: y, t0: t, x, y, t, trail: [{ x, y, t }], dragging: false });
    if (this.tracks.size === 2) {
      const [a, b] = [...this.tracks.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.pinching = true;
      out.push({ kind: 'pinch', phase: 'start', ...centre(a, b), scale: 1 });
    }
    return out;
  }

  move(id: number, x: number, y: number, t: number): Gesture[] {
    const tr = this.tracks.get(id);
    if (!tr) return [];
    const dx = x - tr.x;
    const dy = y - tr.y;
    tr.x = x;
    tr.y = y;
    tr.t = t;
    tr.trail.push({ x, y, t });
    if (tr.trail.length > 6) tr.trail.shift();
    if (this.pinching && this.tracks.size === 2) {
      const [a, b] = [...this.tracks.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const scale = d / this.pinchDist;
      this.pinchDist = d;
      return [{ kind: 'pinch', phase: 'move', ...centre(a, b), scale }];
    }
    if (this.pinching) return [];
    if (!tr.dragging) {
      if (Math.hypot(x - tr.x0, y - tr.y0) < this.opt.slop) return [];
      tr.dragging = true;
      return [
        { kind: 'drag', phase: 'start', x: tr.x0, y: tr.y0, dx: 0, dy: 0 },
        this.dragEvent('move', tr, x - tr.x0, y - tr.y0),
      ];
    }
    return [this.dragEvent('move', tr, dx, dy)];
  }

  up(id: number, x: number, y: number, t: number): Gesture[] {
    const tr = this.tracks.get(id);
    if (!tr) return [];
    const out = this.move(id, x, y, t);
    this.tracks.delete(id);
    if (this.pinching) {
      if (this.tracks.size === 1) {
        const [rest] = this.tracks.values();
        out.push({
          kind: 'pinch',
          phase: 'end',
          cx: (x + rest.x) / 2,
          cy: (y + rest.y) / 2,
          scale: 1,
        });
      }
      if (this.tracks.size === 0) this.pinching = false;
      return out;
    }
    if (tr.dragging) {
      out.push(this.dragEvent('end', tr, 0, 0));
      const swipe = this.swipe(tr);
      if (swipe) out.push(swipe);
      return out;
    }
    if (t - tr.t0 >= this.opt.longPress) {
      out.push({ kind: 'longPress', x: tr.x0, y: tr.y0 });
      this.lastTap = null;
      return out;
    }
    const last = this.lastTap;
    if (
      last &&
      t - last.t <= this.opt.doubleTapTime &&
      Math.hypot(tr.x0 - last.x, tr.y0 - last.y) <= this.opt.doubleTapDistance
    ) {
      out.push({ kind: 'doubleTap', x: tr.x0, y: tr.y0 });
      this.lastTap = null;
    } else {
      out.push({ kind: 'tap', x: tr.x0, y: tr.y0 });
      this.lastTap = { x: tr.x0, y: tr.y0, t };
    }
    return out;
  }

  /** Pointer lost (pointercancel): ends a drag or pinch without a tap. */
  cancel(id: number): Gesture[] {
    const tr = this.tracks.get(id);
    if (!tr) return [];
    this.tracks.delete(id);
    if (this.pinching) {
      if (this.tracks.size === 0) this.pinching = false;
      return [{ kind: 'pinch', phase: 'end', cx: tr.x, cy: tr.y, scale: 1 }];
    }
    return tr.dragging ? [this.dragEvent('end', tr, 0, 0)] : [];
  }

  private dragEvent(phase: Phase, tr: Track, dx: number, dy: number): Gesture {
    return { kind: 'drag', phase, x: tr.x, y: tr.y, dx, dy };
  }

  private swipe(tr: Track): Gesture | null {
    const first = tr.trail[0];
    const last = tr.trail[tr.trail.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const vx = (last.x - first.x) / dt;
    const vy = (last.y - first.y) / dt;
    if (Math.hypot(vx, vy) < this.opt.swipeSpeed) return null;
    const dir: SwipeDir =
      Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
    return { kind: 'swipe', dir, x: last.x, y: last.y };
  }
}

function centre(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
}
