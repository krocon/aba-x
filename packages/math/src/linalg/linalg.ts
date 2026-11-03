/**
 * Real linear algebra (prompt 032), pure. Partial pivoting everywhere; "singular" means a pivot
 * below a tolerance relative to the size of the matrix entries (never a division by noise).
 * Eigenvalues: Jacobi rotations for symmetric matrices (with eigenvectors), the shifted QR
 * algorithm on Hessenberg form otherwise (complex pairs from 2×2 blocks).
 */
import { type MathResult, fail, ok } from '../result';

export type Matrix = number[][];

const EPS = 1e-12;

export const dims = (a: Matrix) => [a.length, a[0]?.length ?? 0] as const;
const copy = (a: Matrix): Matrix => a.map((r) => [...r]);
const scale = (a: Matrix) => Math.max(1, ...a.flat().map(Math.abs));

export function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
}

export function transpose(a: Matrix): Matrix {
  const [r, c] = dims(a);
  return Array.from({ length: c }, (_, j) => Array.from({ length: r }, (_, i) => a[i][j]));
}

export function add(a: Matrix, b: Matrix, sign = 1): MathResult<Matrix> {
  const [r, c] = dims(a);
  const [r2, c2] = dims(b);
  if (r !== r2 || c !== c2)
    return fail('domain', `cannot add a ${r}×${c} and a ${r2}×${c2} matrix`);
  return ok(a.map((row, i) => row.map((x, j) => x + sign * b[i][j])));
}

export function multiply(a: Matrix, b: Matrix): MathResult<Matrix> {
  const [r, n] = dims(a);
  const [n2, c] = dims(b);
  if (n !== n2) return fail('domain', `cannot multiply a ${r}×${n} by a ${n2}×${c} matrix`);
  return ok(
    Array.from({ length: r }, (_, i) =>
      Array.from({ length: c }, (_, j) => {
        let s = 0;
        for (let k = 0; k < n; k++) s += a[i][k] * b[k][j];
        return s;
      }),
    ),
  );
}

export const mapMatrix = (a: Matrix, f: (x: number) => number): Matrix => a.map((r) => r.map(f));

function square(a: Matrix, what: string): MathResult<number> {
  const [r, c] = dims(a);
  return r === c && r > 0 ? ok(r) : fail('domain', `${what} needs a square matrix`);
}

/** LU decomposition with partial pivoting: P·A = L·U (packed), sign of P. */
export function lu(
  a: Matrix,
): MathResult<{ lu: Matrix; perm: number[]; sign: number; singular: boolean }> {
  const n = square(a, 'lu');
  if (!n.ok) return n;
  const m = copy(a);
  const perm = m.map((_, i) => i);
  let sign = 1;
  let singular = false;
  const tol = EPS * scale(a) * n.value;
  for (let k = 0; k < n.value; k++) {
    let p = k;
    for (let i = k + 1; i < n.value; i++) if (Math.abs(m[i][k]) > Math.abs(m[p][k])) p = i;
    if (Math.abs(m[p][k]) <= tol) {
      singular = true;
      continue;
    }
    if (p !== k) {
      [m[p], m[k]] = [m[k], m[p]];
      [perm[p], perm[k]] = [perm[k], perm[p]];
      sign = -sign;
    }
    for (let i = k + 1; i < n.value; i++) {
      m[i][k] /= m[k][k];
      for (let j = k + 1; j < n.value; j++) m[i][j] -= m[i][k] * m[k][j];
    }
  }
  return ok({ lu: m, perm, sign, singular });
}

export function det(a: Matrix): MathResult<number> {
  const r = lu(a);
  if (!r.ok) return r;
  if (r.value.singular) return ok(0);
  return ok(r.value.lu.reduce((acc, row, i) => acc * row[i], r.value.sign));
}

/** Reduced row echelon form; also the pivot columns. */
export function rref(a: Matrix): { rref: Matrix; pivots: number[] } {
  const m = copy(a);
  const [rows, cols] = dims(m);
  const tol = EPS * scale(a) * Math.max(rows, cols);
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = r;
    for (let i = r + 1; i < rows; i++) if (Math.abs(m[i][c]) > Math.abs(m[p][c])) p = i;
    if (Math.abs(m[p][c]) <= tol) {
      for (let i = r; i < rows; i++) m[i][c] = 0;
      continue;
    }
    [m[p], m[r]] = [m[r], m[p]];
    const pv = m[r][c];
    for (let j = 0; j < cols; j++) m[r][j] /= pv;
    for (let i = 0; i < rows; i++) {
      if (i === r) continue;
      const f = m[i][c];
      for (let j = 0; j < cols; j++) m[i][j] -= f * m[r][j];
    }
    pivots.push(c);
    r++;
  }
  // clean −0 and tiny noise
  return { rref: m.map((row) => row.map((x) => (Math.abs(x) <= tol ? 0 : x))), pivots };
}

export const rank = (a: Matrix) => rref(a).pivots.length;

export function inverse(a: Matrix): MathResult<Matrix> {
  const n = square(a, 'the inverse');
  if (!n.ok) return n;
  const aug = a.map((row, i) => [...row, ...identity(n.value)[i]]);
  const { rref: r, pivots } = rref(aug);
  if (pivots.length < n.value || pivots.some((p, i) => p !== i)) {
    return fail('domain', 'the matrix is singular (no inverse)');
  }
  return ok(r.map((row) => row.slice(n.value)));
}

/** A·x = b for a square, regular A. */
export function solveLinear(a: Matrix, b: number[]): MathResult<number[]> {
  const n = square(a, 'solving');
  if (!n.ok) return n;
  if (b.length !== n.value) return fail('domain', 'the right side has the wrong length');
  const f = lu(a);
  if (!f.ok) return f;
  if (f.value.singular) return fail('domain', 'the system has no unique solution');
  const { lu: m, perm } = f.value;
  const y = perm.map((p) => b[p]);
  for (let i = 0; i < n.value; i++) for (let k = 0; k < i; k++) y[i] -= m[i][k] * y[k];
  for (let i = n.value - 1; i >= 0; i--) {
    for (let k = i + 1; k < n.value; k++) y[i] -= m[i][k] * y[k];
    y[i] /= m[i][i];
  }
  return ok(y);
}

export const trace = (a: Matrix) => a.reduce((s, r, i) => s + (r[i] ?? 0), 0);
export const frobenius = (a: Matrix) => Math.sqrt(a.flat().reduce((s, x) => s + x * x, 0));

export function isSymmetric(a: Matrix): boolean {
  const tol = 1e-12 * scale(a);
  return a.every((r, i) => r.every((x, j) => Math.abs(x - a[j][i]) <= tol));
}

/** Eigenvalues and eigenvectors (columns) of a symmetric matrix, ascending (Jacobi). */
export function eigenSymmetric(a: Matrix): MathResult<{ values: number[]; vectors: Matrix }> {
  const n = square(a, 'eigenvalues');
  if (!n.ok) return n;
  const m = copy(a);
  const v = identity(n.value);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n.value; p++) for (let q = p + 1; q < n.value; q++) off += m[p][q] ** 2;
    if (off <= 1e-30 * scale(a) ** 2) break;
    for (let p = 0; p < n.value; p++) {
      for (let q = p + 1; q < n.value; q++) {
        if (Math.abs(m[p][q]) < 1e-300) continue;
        const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n.value; k++) {
          const mkp = m[k][p];
          const mkq = m[k][q];
          m[k][p] = c * mkp - s * mkq;
          m[k][q] = s * mkp + c * mkq;
        }
        for (let k = 0; k < n.value; k++) {
          const mpk = m[p][k];
          const mqk = m[q][k];
          m[p][k] = c * mpk - s * mqk;
          m[q][k] = s * mpk + c * mqk;
        }
        for (let k = 0; k < n.value; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const order = m.map((_, i) => i).sort((i, j) => m[i][i] - m[j][j]);
  return ok({
    values: order.map((i) => m[i][i]),
    vectors: v.map((row) => order.map((i) => row[i])),
  });
}

/** Eigenvalues of a general real matrix as [re, im] pairs (Hessenberg reduction + shifted QR). */
export function eigenvalues(a: Matrix): MathResult<[number, number][]> {
  const n0 = square(a, 'eigenvalues');
  if (!n0.ok) return n0;
  if (isSymmetric(a)) {
    const s = eigenSymmetric(a);
    return s.ok ? ok(s.value.values.map((x) => [x, 0])) : s;
  }
  const n = n0.value;
  const h = copy(a);
  // reduction to upper Hessenberg form (elimination with pivoting)
  for (let m = 1; m < n - 1; m++) {
    let x = 0;
    let i = m;
    for (let j = m; j < n; j++) {
      if (Math.abs(h[j][m - 1]) > Math.abs(x)) {
        x = h[j][m - 1];
        i = j;
      }
    }
    if (i !== m) {
      for (let j = m - 1; j < n; j++) [h[i][j], h[m][j]] = [h[m][j], h[i][j]];
      for (let j = 0; j < n; j++) [h[j][i], h[j][m]] = [h[j][m], h[j][i]];
    }
    if (x !== 0) {
      for (i = m + 1; i < n; i++) {
        let y = h[i][m - 1];
        if (y !== 0) {
          y /= x;
          h[i][m - 1] = y;
          for (let j = m; j < n; j++) h[i][j] -= y * h[m][j];
          for (let j = 0; j < n; j++) h[j][m] += y * h[j][i];
        }
      }
    }
  }
  for (let i = 2; i < n; i++) for (let j = 0; j < i - 1; j++) h[i][j] = 0;
  return hqr(h);
}

/** QR iterations on an upper Hessenberg matrix (after the classic hqr algorithm). */
function hqr(a: Matrix): MathResult<[number, number][]> {
  const n = a.length;
  const wr = new Array<number>(n).fill(0);
  const wi = new Array<number>(n).fill(0);
  let anorm = 0;
  for (let i = 0; i < n; i++)
    for (let j = Math.max(i - 1, 0); j < n; j++) anorm += Math.abs(a[i][j]);
  let nn = n - 1;
  let t = 0;
  let p = 0;
  let q = 0;
  let r = 0;
  while (nn >= 0) {
    let its = 0;
    let l: number;
    do {
      for (l = nn; l >= 1; l--) {
        const s = Math.abs(a[l - 1][l - 1]) + Math.abs(a[l][l]);
        if (Math.abs(a[l][l - 1]) + (s === 0 ? anorm : s) === (s === 0 ? anorm : s)) {
          a[l][l - 1] = 0;
          break;
        }
      }
      const x = a[nn][nn];
      if (l === nn) {
        wr[nn] = x + t;
        wi[nn--] = 0;
      } else {
        const y = a[nn - 1][nn - 1];
        const w = a[nn][nn - 1] * a[nn - 1][nn];
        if (l === nn - 1) {
          p = 0.5 * (y - x);
          q = p * p + w;
          const z = Math.sqrt(Math.abs(q));
          const xx = x + t;
          if (q >= 0) {
            const zz = p + (p >= 0 ? Math.abs(z) : -Math.abs(z));
            wr[nn - 1] = wr[nn] = xx + zz;
            if (zz) wr[nn] = xx - w / zz;
            wi[nn - 1] = wi[nn] = 0;
          } else {
            wr[nn - 1] = wr[nn] = xx + p;
            wi[nn - 1] = -(wi[nn] = z);
          }
          nn -= 2;
        } else {
          if (its === 60) return fail('no-convergence', 'eigenvalues: no convergence');
          let xs = x;
          let ys = y;
          let ws = w;
          if (its === 10 || its === 20) {
            t += xs;
            for (let i = 0; i <= nn; i++) a[i][i] -= xs;
            const s = Math.abs(a[nn][nn - 1]) + Math.abs(a[nn - 1][nn - 2]);
            ys = xs = 0.75 * s;
            ws = -0.4375 * s * s;
          }
          its++;
          let m: number;
          let z: number;
          for (m = nn - 2; m >= l; m--) {
            z = a[m][m];
            r = xs - z;
            const s = ys - z;
            p = (r * s - ws) / a[m + 1][m] + a[m][m + 1];
            q = a[m + 1][m + 1] - z - r - s;
            r = a[m + 2][m + 1];
            const sc = Math.abs(p) + Math.abs(q) + Math.abs(r);
            p /= sc;
            q /= sc;
            r /= sc;
            if (m === l) break;
            const u = Math.abs(a[m][m - 1]) * (Math.abs(q) + Math.abs(r));
            const v =
              Math.abs(p) * (Math.abs(a[m - 1][m - 1]) + Math.abs(z) + Math.abs(a[m + 1][m + 1]));
            if (u + v === v) break;
          }
          for (let i = m + 2; i <= nn; i++) {
            a[i][i - 2] = 0;
            if (i !== m + 2) a[i][i - 3] = 0;
          }
          for (let k = m; k <= nn - 1; k++) {
            let xn = 0;
            if (k !== m) {
              p = a[k][k - 1];
              q = a[k + 1][k - 1];
              r = k !== nn - 1 ? a[k + 2][k - 1] : 0;
              xn = Math.abs(p) + Math.abs(q) + Math.abs(r);
              if (xn !== 0) {
                p /= xn;
                q /= xn;
                r /= xn;
              }
            }
            const s0 = Math.sqrt(p * p + q * q + r * r);
            const s = p >= 0 ? s0 : -s0;
            if (s === 0) continue;
            if (k === m) {
              if (l !== m) a[k][k - 1] = -a[k][k - 1];
            } else a[k][k - 1] = -s * xn;
            p += s;
            const xx = p / s;
            const yy = q / s;
            const zz = r / s;
            q /= p;
            r /= p;
            for (let j = k; j <= nn; j++) {
              let pp = a[k][j] + q * a[k + 1][j];
              if (k !== nn - 1) {
                pp += r * a[k + 2][j];
                a[k + 2][j] -= pp * zz;
              }
              a[k + 1][j] -= pp * yy;
              a[k][j] -= pp * xx;
            }
            const mmin = nn < k + 3 ? nn : k + 3;
            for (let i = l; i <= mmin; i++) {
              let pp = xx * a[i][k] + yy * a[i][k + 1];
              if (k !== nn - 1) {
                pp += zz * a[i][k + 2];
                a[i][k + 2] -= pp * r;
              }
              a[i][k + 1] -= pp * q;
              a[i][k] -= pp;
            }
          }
        }
      }
    } while (l < nn - 1);
  }
  const out = wr.map((re, i) => [re, wi[i]] as [number, number]);
  return ok(out.sort((x, y) => x[0] - y[0] || x[1] - y[1]));
}
