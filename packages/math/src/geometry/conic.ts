/**
 * Conics (prompt 042): general coefficients Ax² + Bxy + Cy² + Dx + Ey + F = 0, construction from
 * foci / focus and directrix / five points, classification into a drawable form, and the action of
 * affine maps. Pure, double precision.
 */
import { type ConicCoefficients, type Vec, add, rotateVec, vec } from './shapes';

/** Drawable normal form of a conic (angles in radians, counter-clockwise from the x axis). */
export type ConicForm =
  | {
      readonly type: 'ellipse';
      readonly center: Vec;
      readonly a: number;
      readonly b: number;
      readonly angle: number;
    }
  /** Branches center ± a·cosh(u)·e₁ + b·sinh(u)·e₂, e₁ along `angle` (transverse axis). */
  | {
      readonly type: 'hyperbola';
      readonly center: Vec;
      readonly a: number;
      readonly b: number;
      readonly angle: number;
    }
  /** Points vertex + X·e₁ + k·X²·e₂ with e₁ = (cos angle, sin angle), e₂ = e₁ turned by +90°. */
  | { readonly type: 'parabola'; readonly vertex: Vec; readonly angle: number; readonly k: number }
  /** Line pairs, single points, no real points – nothing to draw as a curve. */
  | { readonly type: 'degenerate'; readonly reason: string };

/** Relative threshold below which a (normalised) coefficient counts as zero. */
const ZERO = 1e-10;

export function conicFromCircle(c: Vec, r: number): ConicCoefficients {
  return { A: 1, B: 0, C: 1, D: -2 * c.x, E: -2 * c.y, F: c.x * c.x + c.y * c.y - r * r };
}

/**
 * α·X² + β·Y² + γ = 0 in the frame centred at `center` and turned by `angle`
 * (X along the angle), expressed in world coordinates.
 */
export function conicFromAxes(
  center: Vec,
  angle: number,
  alpha: number,
  beta: number,
  gamma: number,
): ConicCoefficients {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const A = alpha * c * c + beta * s * s;
  const B = 2 * c * s * (alpha - beta);
  const C = alpha * s * s + beta * c * c;
  const { x: cx, y: cy } = center;
  return normalizeConic({
    A,
    B,
    C,
    D: -2 * A * cx - B * cy,
    E: -2 * C * cy - B * cx,
    F: A * cx * cx + B * cx * cy + C * cy * cy + gamma,
  });
}

/** Conic of an ellipse / hyperbola with semi-axes a, b (transverse axis along `angle`). */
export function conicFromForm(form: ConicForm): ConicCoefficients | undefined {
  switch (form.type) {
    case 'ellipse':
      return conicFromAxes(form.center, form.angle, 1 / form.a ** 2, 1 / form.b ** 2, -1);
    case 'hyperbola':
      return conicFromAxes(form.center, form.angle, 1 / form.a ** 2, -1 / form.b ** 2, -1);
    default:
      return undefined;
  }
}

/** Parabola with focus `f` and directrix through `p` with unit direction `d`. */
export function conicFromFocusDirectrix(f: Vec, p: Vec, d: Vec): ConicCoefficients {
  const n = vec(-d.y, d.x);
  const m = n.x * p.x + n.y * p.y;
  // |X − f|² − (n·X − m)² = 0
  return normalizeConic({
    A: 1 - n.x * n.x,
    B: -2 * n.x * n.y,
    C: 1 - n.y * n.y,
    D: -2 * f.x + 2 * m * n.x,
    E: -2 * f.y + 2 * m * n.y,
    F: f.x * f.x + f.y * f.y - m * m,
  });
}

const COEFFS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** Scales so the largest coefficient has magnitude 1 and the first noticeable one is positive. */
export function normalizeConic(q: ConicCoefficients): ConicCoefficients {
  const m = Math.max(...COEFFS.map((k) => Math.abs(q[k])));
  if (!(m > 0) || !Number.isFinite(m)) return q;
  const first = COEFFS.map((k) => q[k]).find((v) => Math.abs(v) > ZERO * m) ?? 1;
  const f = (first < 0 ? -1 : 1) / m;
  const r = (v: number): number => (Math.abs(v * f) < 1e-15 ? 0 : v * f);
  return { A: r(q.A), B: r(q.B), C: r(q.C), D: r(q.D), E: r(q.E), F: r(q.F) };
}

/** Value of the conic polynomial at `p` (0 on the curve). */
export function conicValue(q: ConicCoefficients, p: Vec): number {
  return q.A * p.x * p.x + q.B * p.x * p.y + q.C * p.y * p.y + q.D * p.x + q.E * p.y + q.F;
}

/** Symmetric 3×3 matrix S with Q(x, y) = (x, y, 1) S (x, y, 1)ᵀ. */
export function conicMatrix(q: ConicCoefficients): number[][] {
  return [
    [q.A, q.B / 2, q.D / 2],
    [q.B / 2, q.C, q.E / 2],
    [q.D / 2, q.E / 2, q.F],
  ];
}

export function conicFromMatrix(s: readonly (readonly number[])[]): ConicCoefficients {
  return normalizeConic({
    A: s[0][0],
    B: s[0][1] + s[1][0],
    C: s[1][1],
    D: s[0][2] + s[2][0],
    E: s[1][2] + s[2][1],
    F: s[2][2],
  });
}

/** Determinant by Gaussian elimination with partial pivoting. */
export function determinant(m: readonly (readonly number[])[]): number {
  const a = m.map((row) => [...row]);
  const n = a.length;
  let det = 1;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (a[piv][col] === 0) return 0;
    if (piv !== col) {
      [a[piv], a[col]] = [a[col], a[piv]];
      det = -det;
    }
    det *= a[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / a[col][col];
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return det;
}

/**
 * The conic through five points (null space of the 5×6 system by signed 5×5 minors). `undefined`
 * when the points do not determine a unique conic (coincident points, four on a line …).
 */
export function conicThroughFive(pts: readonly Vec[]): ConicCoefficients | undefined {
  if (pts.length !== 5) return undefined;
  // Centre and scale for conditioning; transformed back afterwards.
  const cx = pts.reduce((s, p) => s + p.x, 0) / 5;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 5;
  const sc = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy)));
  if (!(sc > 0)) return undefined;
  const local = pts.map((p) => vec((p.x - cx) / sc, (p.y - cy) / sc));
  const rows = local.map((p) => [p.x * p.x, p.x * p.y, p.y * p.y, p.x, p.y, 1]);
  const c = [0, 1, 2, 3, 4, 5].map(
    (j) => (j % 2 ? -1 : 1) * determinant(rows.map((r) => r.filter((_, k) => k !== j))),
  );
  const m = Math.max(...c.map(Math.abs));
  if (!(m > 1e-12)) return undefined;
  const local5: ConicCoefficients = { A: c[0], B: c[1], C: c[2], D: c[3], E: c[4], F: c[5] };
  // Undo x' = (x − cx)/sc: the map X ↦ (X − c)/sc is affine.
  return transformConic(local5, { a: sc, b: 0, c: 0, d: sc, e: cx, f: cy });
}

/** Affine map x' = a·x + b·y + e, y' = c·x + d·y + f. */
export interface Affine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

/** Image of a conic under an invertible affine map (S' = H⁻ᵀ S H⁻¹). */
export function transformConic(q: ConicCoefficients, t: Affine): ConicCoefficients | undefined {
  const det = t.a * t.d - t.b * t.c;
  if (!(Math.abs(det) > 0)) return undefined;
  // H⁻¹ for H = [[a, b, e], [c, d, f], [0, 0, 1]]
  const ia = t.d / det;
  const ib = -t.b / det;
  const ic = -t.c / det;
  const id = t.a / det;
  const inv = [
    [ia, ib, -(ia * t.e + ib * t.f)],
    [ic, id, -(ic * t.e + id * t.f)],
    [0, 0, 1],
  ];
  const s = conicMatrix(q);
  const out = [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => {
      let v = 0;
      for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) v += inv[k][i] * s[k][l] * inv[l][j];
      return v;
    }),
  );
  return conicFromMatrix(out);
}

/** Normal form of a conic: rotate away the xy term, then complete the squares. */
export function classifyConic(q0: ConicCoefficients): ConicForm {
  const q = normalizeConic(q0);
  const quad = Math.max(Math.abs(q.A), Math.abs(q.B), Math.abs(q.C));
  if (!(quad > ZERO)) return { type: 'degenerate', reason: 'the equation is linear' };
  const th = 0.5 * Math.atan2(q.B, q.A - q.C);
  const c = Math.cos(th);
  const s = Math.sin(th);
  let A1 = q.A * c * c + q.B * c * s + q.C * s * s;
  let C1 = q.A * s * s - q.B * c * s + q.C * c * c;
  const D1 = q.D * c + q.E * s;
  const E1 = -q.D * s + q.E * c;
  if (Math.abs(A1) < ZERO * quad) A1 = 0;
  if (Math.abs(C1) < ZERO * quad) C1 = 0;
  const toWorld = (x: number, y: number): Vec => rotateVec(vec(x, y), th);

  if (A1 !== 0 && C1 !== 0) {
    const x0 = -D1 / (2 * A1);
    const y0 = -E1 / (2 * C1);
    const F1 = q.F - (D1 * D1) / (4 * A1) - (E1 * E1) / (4 * C1);
    const center = toWorld(x0, y0);
    const scale = Math.max(1, Math.abs(q.F), Math.abs(D1 * x0), Math.abs(E1 * y0));
    if (Math.abs(F1) < 1e-12 * scale) return { type: 'degenerate', reason: 'a point or two lines' };
    if (A1 * C1 > 0) {
      if (-F1 / A1 <= 0) return { type: 'degenerate', reason: 'no real points' };
      return {
        type: 'ellipse',
        center,
        a: Math.sqrt(-F1 / A1),
        b: Math.sqrt(-F1 / C1),
        angle: th,
      };
    }
    if (-F1 / A1 > 0)
      return {
        type: 'hyperbola',
        center,
        a: Math.sqrt(-F1 / A1),
        b: Math.sqrt(F1 / C1),
        angle: th,
      };
    return {
      type: 'hyperbola',
      center,
      a: Math.sqrt(-F1 / C1),
      b: Math.sqrt(F1 / A1),
      angle: th + Math.PI / 2,
    };
  }
  if (C1 === 0) {
    // A1·x'² + D1·x' + E1·y' + F = 0
    if (Math.abs(E1) < ZERO) return { type: 'degenerate', reason: 'parallel lines' };
    const x0 = -D1 / (2 * A1);
    const y0 = -(q.F - (D1 * D1) / (4 * A1)) / E1;
    return { type: 'parabola', vertex: toWorld(x0, y0), angle: th, k: -A1 / E1 };
  }
  // C1·y'² + D1·x' + E1·y' + F = 0
  if (Math.abs(D1) < ZERO) return { type: 'degenerate', reason: 'parallel lines' };
  const y0 = -E1 / (2 * C1);
  const x0 = -(q.F - (E1 * E1) / (4 * C1)) / D1;
  return { type: 'parabola', vertex: toWorld(x0, y0), angle: th + Math.PI / 2, k: C1 / D1 };
}

/** Point of an ellipse / hyperbola branch / parabola for a parameter (angle, u or X). */
export function conicPoint(form: ConicForm, t: number, branch: 1 | -1 = 1): Vec | undefined {
  switch (form.type) {
    case 'ellipse':
      return add(
        form.center,
        rotateVec(vec(form.a * Math.cos(t), form.b * Math.sin(t)), form.angle),
      );
    case 'hyperbola':
      return add(
        form.center,
        rotateVec(vec(branch * form.a * Math.cosh(t), form.b * Math.sinh(t)), form.angle),
      );
    case 'parabola':
      return add(form.vertex, rotateVec(vec(t, form.k * t * t), form.angle));
    default:
      return undefined;
  }
}

/** Ellipse circumference by the trapezoidal rule (spectrally exact for periodic integrands). */
export function ellipseCircumference(a: number, b: number): number {
  const n = 512;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    s += Math.hypot(a * Math.sin(t), b * Math.cos(t));
  }
  return (s * 2 * Math.PI) / n;
}
