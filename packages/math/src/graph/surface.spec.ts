import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMERA, faces, project, sampleSurface } from './surface';

const R = { xmin: -2, xmax: 2, ymin: -2, ymax: 2, zmin: -5, zmax: 5 };
const S = { width: 400, height: 300 };

describe('surfaces', () => {
  it('samples a paraboloid on the grid', () => {
    const g = sampleSurface((x, y) => x * x + y * y, R, 4);
    expect(g.z[0][0]).toBe(8 > 5 ? NaN : 8); // clipped above zmax
    expect(g.z[2][2]).toBe(0);
    expect(g.xs).toEqual([-2, -1, 0, 1, 2]);
  });

  it('masks undefined values (1/(xy)) instead of drawing spikes', () => {
    const g = sampleSurface((x, y) => 1 / (x * y), R, 4);
    expect(Number.isNaN(g.z[2][1])).toBe(true); // x = 0
    const fs = faces(g, R, DEFAULT_CAMERA, S);
    expect(
      fs.every((f) => f.points.every((p) => Number.isFinite(p.sx) && Number.isFinite(p.sy))),
    ).toBe(true);
  });

  it('projects the box centre to the screen centre and sorts back to front', () => {
    const p = project(R, DEFAULT_CAMERA, S);
    const c = p(0, 0, 0);
    expect(c.sx).toBeCloseTo(200, 9);
    expect(c.sy).toBeCloseTo(150, 9);
    const fs = faces(
      sampleSurface((x, y) => Math.sin(x) * Math.cos(y), R, 10),
      R,
      DEFAULT_CAMERA,
      S,
    );
    expect(fs.length).toBe(100);
    for (let k = 1; k < fs.length; k++) expect(fs[k - 1].depth).toBeGreaterThanOrEqual(fs[k].depth);
  });
});
