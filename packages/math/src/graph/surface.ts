/**
 * Surfaces z = f(x, y) for the 3D graphing app (prompt 046), pure: sampling on a grid (undefined
 * points and points outside the z range are masked – gaps, never spikes), a rotation/projection
 * and the faces sorted back to front for a painter's algorithm on a 2D canvas.
 */
export interface Range3 {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  zmin: number;
  zmax: number;
}

export interface Grid {
  n: number;
  xs: number[];
  ys: number[];
  /** z[i][j] at (xs[i], ys[j]); NaN = undefined or clipped */
  z: number[][];
}

export function sampleSurface(f: (x: number, y: number) => number, r: Range3, n = 30): Grid {
  const xs = Array.from({ length: n + 1 }, (_, i) => r.xmin + ((r.xmax - r.xmin) * i) / n);
  const ys = Array.from({ length: n + 1 }, (_, j) => r.ymin + ((r.ymax - r.ymin) * j) / n);
  const z = xs.map((x) =>
    ys.map((y) => {
      const v = f(x, y);
      return Number.isFinite(v) && v >= r.zmin && v <= r.zmax ? v : NaN;
    }),
  );
  return { n, xs, ys, z };
}

export interface Camera {
  /** rotation about the z axis (radians) */
  azimuth: number;
  /** elevation above the xy plane (radians) */
  elevation: number;
  /** zoom factor (1 = the box fills the screen) */
  zoom: number;
}

export const DEFAULT_CAMERA: Camera = { azimuth: -Math.PI / 4, elevation: Math.PI / 6, zoom: 1 };

/**
 * Point in the unit box (−1…1 per axis) → screen (px) and depth. Orthographic projection; larger
 * depth = further away.
 */
export function project(
  r: Range3,
  cam: Camera,
  size: { width: number; height: number },
): (x: number, y: number, z: number) => { sx: number; sy: number; depth: number } {
  const nx = (x: number) => (2 * (x - r.xmin)) / (r.xmax - r.xmin) - 1;
  const ny = (y: number) => (2 * (y - r.ymin)) / (r.ymax - r.ymin) - 1;
  const nz = (z: number) => (2 * (z - r.zmin)) / (r.zmax - r.zmin) - 1;
  const ca = Math.cos(cam.azimuth);
  const sa = Math.sin(cam.azimuth);
  const ce = Math.cos(cam.elevation);
  const se = Math.sin(cam.elevation);
  const scale = (Math.min(size.width, size.height) / 3.6) * cam.zoom;
  return (x, y, z) => {
    const X = nx(x);
    const Y = ny(y);
    const Z = nz(z);
    // rotate about z, then tilt about the screen x axis
    const x1 = X * ca - Y * sa;
    const y1 = X * sa + Y * ca;
    const sy = y1 * se - Z * ce;
    const depth = y1 * ce + Z * se;
    return { sx: size.width / 2 + x1 * scale, sy: size.height / 2 + sy * scale * 1, depth: -depth };
  };
}

export interface Face {
  points: { sx: number; sy: number }[];
  depth: number;
  /** mean height 0…1 for colouring */
  t: number;
}

/** The grid as quadrilaterals sorted back to front (masked cells are left out). */
export function faces(
  g: Grid,
  r: Range3,
  cam: Camera,
  size: { width: number; height: number },
): Face[] {
  const p = project(r, cam, size);
  const out: Face[] = [];
  for (let i = 0; i < g.n; i++) {
    for (let j = 0; j < g.n; j++) {
      const corners: [number, number][] = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ];
      const zs = corners.map(([a, b]) => g.z[a][b]);
      if (zs.some((z) => Number.isNaN(z))) continue;
      const pts = corners.map(([a, b], k) => p(g.xs[a], g.ys[b], zs[k]));
      const zm = zs.reduce((s, z) => s + z, 0) / 4;
      out.push({
        points: pts.map(({ sx, sy }) => ({ sx, sy })),
        depth: pts.reduce((s, q) => s + q.depth, 0) / 4,
        t: (zm - r.zmin) / (r.zmax - r.zmin),
      });
    }
  }
  return out.sort((a, b) => b.depth - a.depth);
}
