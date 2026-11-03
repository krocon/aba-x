/**
 * Lists and matrices in `evaluateValue` (prompt 032). Lists: element-wise arithmetic with
 * broadcasting of scalars, element-wise functions and comparisons. Matrices: real entries,
 * + − with equal size, × as matrix product (a list is a column vector), ^ integer powers (negative =
 * inverse), / by a scalar or a regular matrix. Each function returns null when it does not apply.
 */
import * as LA from '../linalg/linalg';
import { type MathResult, fail, ok } from '../result';
import { type MatrixValue, type Value, complex, list, matrix, real } from './value';

const isColl = (v: Value) => v.kind === 'list' || v.kind === 'matrix';
type Bin = (op: string, a: Value, b: Value) => Value;

/** A list of reals as numbers (vector), or null. */
export function numbers(v: Value): number[] | null {
  if (v.kind !== 'list') return null;
  const out: number[] = [];
  for (const x of v.items) {
    if (x.kind !== 'real') return null;
    out.push(x.v);
  }
  return out;
}

const rows = (m: MatrixValue): number[][] => m.rows.map((r) => [...r]);

/** a ⊕ b for lists/matrices; `bin` is the evaluator's scalar operation. */
export function binaryC(op: string, a: Value, b: Value, bin: Bin): MathResult<Value> | null {
  if (!isColl(a) && !isColl(b)) return null;
  if (a.kind === 'list' && b.kind === 'list') {
    if (a.items.length !== b.items.length) {
      return fail(
        'domain',
        `the lists have different lengths (${a.items.length}, ${b.items.length})`,
      );
    }
    return ok(list(a.items.map((x, i) => bin(op, x, b.items[i]))));
  }
  if (a.kind === 'list' && b.kind !== 'matrix') return ok(list(a.items.map((x) => bin(op, x, b))));
  if (b.kind === 'list' && a.kind !== 'matrix') return ok(list(b.items.map((x) => bin(op, a, x))));
  // matrices
  const scalar = (v: Value) => (v.kind === 'real' ? v.v : null);
  if (a.kind === 'matrix' && b.kind === 'matrix') {
    const x = rows(a);
    const y = rows(b);
    switch (op) {
      case '+':
      case '-': {
        const r = LA.add(x, y, op === '+' ? 1 : -1);
        return r.ok ? ok(matrix(r.value)) : r;
      }
      case '*': {
        const r = LA.multiply(x, y);
        return r.ok ? ok(matrix(r.value)) : r;
      }
      case '/': {
        const inv = LA.inverse(y);
        if (!inv.ok) return inv;
        const r = LA.multiply(x, inv.value);
        return r.ok ? ok(matrix(r.value)) : r;
      }
      default:
        return fail('domain', 'a matrix cannot be an exponent');
    }
  }
  if (a.kind === 'matrix' && b.kind === 'list') {
    const v = numbers(b);
    if (!v || op !== '*') return fail('domain', 'only matrix × vector is defined here');
    const r = LA.multiply(
      rows(a),
      v.map((x) => [x]),
    );
    return r.ok ? ok(list(r.value.map((row) => real(row[0])))) : r;
  }
  if (a.kind === 'matrix') {
    const s = scalar(b);
    if (s === null) return fail('unsupported', 'matrices have real entries only');
    if (op === '^') return matrixPower(rows(a), s);
    if (op === '*') return ok(matrix(LA.mapMatrix(rows(a), (x) => x * s)));
    if (op === '/')
      return s === 0
        ? fail('division-by-zero', 'division by zero')
        : ok(matrix(LA.mapMatrix(rows(a), (x) => x / s)));
    return fail('domain', 'add a matrix only to a matrix of the same size');
  }
  if (b.kind === 'matrix') {
    const s = scalar(a);
    if (s === null) return fail('unsupported', 'matrices have real entries only');
    if (op === '*') return ok(matrix(LA.mapMatrix(rows(b), (x) => x * s)));
    return fail('domain', `scalar ${op} matrix is not defined`);
  }
  return null;
}

function matrixPower(a: number[][], n: number): MathResult<Value> {
  if (!Number.isInteger(n)) return fail('domain', 'matrix powers need an integer exponent');
  const [r, c] = LA.dims(a);
  if (r !== c) return fail('domain', 'powers need a square matrix');
  let base = a;
  if (n < 0) {
    const inv = LA.inverse(a);
    if (!inv.ok) return inv;
    base = inv.value;
  }
  let k = Math.abs(n);
  let acc = LA.identity(r);
  while (k > 0) {
    if (k & 1) acc = (LA.multiply(acc, base) as { value: number[][] }).value;
    base = (LA.multiply(base, base) as { value: number[][] }).value;
    k >>= 1;
  }
  return ok(matrix(acc));
}

/** Matrix from a value: a matrix, or a list of equal-length real lists. */
function asMatrix(v: Value | undefined): number[][] | null {
  if (v?.kind === 'matrix') return rows(v);
  if (v?.kind === 'list' && v.items.length && v.items.every((x) => x.kind === 'list')) {
    const r = v.items.map(numbers);
    if (r.every((x) => x && x.length === r[0]!.length)) return r as number[][];
  }
  return null;
}

const int = (v: Value | undefined): number | null =>
  v?.kind === 'real' && Number.isInteger(v.v) ? v.v : null;

/** Functions of lists and matrices; null for other names. */
export function callC(name: string, args: Value[], bin: Bin): MathResult<Value> | null {
  const [a, b] = args;
  const need = (what: string) => fail<Value>('domain', `${name} needs ${what}`);
  switch (name) {
    case 'size':
      if (a?.kind === 'list') return ok(real(a.items.length));
      if (a?.kind === 'matrix')
        return ok(list([real(a.rows.length), real(a.rows[0]?.length ?? 0)]));
      return need('a list or a matrix');
    case 'sumlist':
    case 'prodlist': {
      if (a?.kind !== 'list') return need('a list');
      if (!a.items.length) return ok(real(name === 'sumlist' ? 0 : 1));
      return ok(a.items.reduce((acc, x) => bin(name === 'sumlist' ? '+' : '*', acc, x)));
    }
    case 'deltalist': {
      if (a?.kind !== 'list') return need('a list');
      return ok(list(a.items.slice(1).map((x, i) => bin('-', x, a.items[i]))));
    }
    case 'sort':
    case 'reverse': {
      if (a?.kind !== 'list') return need('a list');
      if (name === 'reverse') return ok(list([...a.items].reverse()));
      const v = numbers(a);
      if (!v) return need('a list of real numbers');
      return ok(list([...v].sort((x, y) => x - y).map(real)));
    }
    case 'concat': {
      if (a?.kind !== 'list' || b?.kind !== 'list') return need('two lists');
      return ok(list([...a.items, ...b.items]));
    }
    case 'pos': {
      if (a?.kind !== 'list' || !b) return need('a list and a value');
      const i = a.items.findIndex((x) => JSON.stringify(x) === JSON.stringify(b));
      return ok(real(i + 1));
    }
    case 'get': {
      const i = int(b);
      if (a?.kind === 'list') {
        if (i === null || i < 1 || i > a.items.length) return fail('domain', 'index out of range');
        return ok(a.items[i - 1]);
      }
      if (a?.kind === 'matrix') {
        const j = int(args[2]);
        if (
          i === null ||
          j === null ||
          i < 1 ||
          i > a.rows.length ||
          j < 1 ||
          j > a.rows[0].length
        ) {
          return fail('domain', 'index out of range');
        }
        return ok(real(a.rows[i - 1][j - 1]));
      }
      return need('a list or a matrix');
    }
    case 'dot':
    case 'cross': {
      const x = a && numbers(a);
      const y = b && numbers(b);
      if (!x || !y || x.length !== y.length) return need('two vectors of the same length');
      if (name === 'dot') return ok(real(x.reduce((s, v, i) => s + v * y[i], 0)));
      if (x.length !== 3) return need('two vectors with 3 components');
      return ok(
        list(
          [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]].map(
            real,
          ),
        ),
      );
    }
    case 'identity': {
      const n = int(a);
      if (n === null || n < 1 || n > 100) return need('a size 1…100');
      return ok(matrix(LA.identity(n)));
    }
    case 'randmat': {
      const r = int(a);
      const c = int(b) ?? r;
      if (r === null || c === null || r < 1 || c < 1 || r * c > 10000) return need('a size');
      return ok(
        matrix(
          Array.from({ length: r }, () =>
            Array.from({ length: c }, () => Math.round(Math.random() * 198 - 99)),
          ),
        ),
      );
    }
  }
  const m = asMatrix(a);
  const mres = (r: MathResult<number[][]>) => (r.ok ? ok(matrix(r.value) as Value) : r);
  switch (name) {
    case 'det': {
      if (!m) return need('a matrix');
      const r = LA.det(m);
      return r.ok ? ok(real(r.value)) : r;
    }
    case 'inv':
      return m ? mres(LA.inverse(m)) : need('a matrix');
    case 'trn':
      return m ? ok(matrix(LA.transpose(m))) : need('a matrix');
    case 'rref':
      return m ? ok(matrix(LA.rref(m).rref)) : need('a matrix');
    case 'rank':
      return m ? ok(real(LA.rank(m))) : need('a matrix');
    case 'trace':
      return m ? ok(real(LA.trace(m))) : need('a matrix');
    case 'norm':
      if (m) return ok(real(LA.frobenius(m)));
      if (a && numbers(a)) return ok(real(Math.hypot(...numbers(a)!)));
      return null;
    case 'eigval': {
      if (!m) return need('a matrix');
      const r = LA.eigenvalues(m);
      if (!r.ok) return r;
      return ok(
        list(
          r.value.map(([re, im]) =>
            Math.abs(im) <= 1e-12 * (1 + Math.abs(re)) ? real(re) : complex(re, im),
          ),
        ),
      );
    }
    case 'eigvec': {
      if (!m) return need('a matrix');
      if (!LA.isSymmetric(m))
        return fail('unsupported', 'eigenvectors: only for symmetric matrices');
      const r = LA.eigenSymmetric(m);
      return r.ok ? ok(matrix(r.value.vectors)) : r;
    }
    case 'linsolve': {
      const rhs = b && numbers(b);
      if (!m || !rhs) return need('a matrix and a vector');
      const r = LA.solveLinear(m, rhs);
      return r.ok ? ok(list(r.value.map(real))) : r;
    }
  }
  return null;
}
