/**
 * Interval arithmetic for reliable implicit plotting (prompt 036). An {@link Interval} encloses
 * every real value a function takes on a box; together with {@link Interval.def} and
 * {@link Interval.cont} it lets the quadtree decide a relation per cell without ever drawing a
 * false region.
 *
 * Outward rounding: JavaScript has no rounding modes, so every computed endpoint is moved
 * outwards to the neighbouring double with {@link nextDown}/{@link nextUp} (bit manipulation of
 * the IEEE 754 representation through a shared `Float64Array`/`Uint32Array` buffer – two 32-bit
 * halves instead of a `BigInt64Array`, because BigInt arithmetic is several times slower in V8).
 * - `+ − × ÷ √` are correctly rounded by IEEE 754 → one ulp outwards encloses the exact result.
 * - Library functions (`Math.sin`, `Math.exp`, `Math.pow`, …) are not guaranteed to be correctly
 *   rounded (V8 uses fdlibm, error < 1 ulp) → widened by about 4.5 ulp (relative 2⁻⁵⁰) and one
 *   more ulp.
 * - Endpoints may be ±∞ (unbounded or overflowed values); a NaN endpoint is replaced by the
 *   whole line, so an enclosure can become useless but never wrong.
 *
 * Definedness: `def` says where the function is defined on the box – `'all'` (proven on every
 * point), `'none'` (proven on no point) or `'partial'` (not proven either way). The bounds always
 * enclose the values on the defined part; an interval with `def: 'none'` carries no values.
 * `cont` is true when the function is proven continuous on its defined part of the box (no pole,
 * no jump) – used to suppress false boundary lines through poles and steps.
 *
 * Framework-free and exception-free: every operation returns an interval.
 */

export type Definedness = 'all' | 'partial' | 'none';

export interface Interval {
  readonly lo: number;
  readonly hi: number;
  readonly def: Definedness;
  readonly cont: boolean;
}

// ---------------------------------------------------------------------------------------------
// next double up / down

const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);
const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const LO_WORD = LITTLE_ENDIAN ? 0 : 1;
const HI_WORD = LITTLE_ENDIAN ? 1 : 0;

/** The smallest double greater than `x` (`Math.nextafter(x, +∞)`); NaN and +∞ stay. */
export function nextUp(x: number): number {
  if (x !== x || x === Infinity) return x;
  if (x === 0) return Number.MIN_VALUE;
  F64[0] = x;
  if (x > 0) {
    // increment the magnitude
    if (U32[LO_WORD] === 0xffffffff) {
      U32[LO_WORD] = 0;
      U32[HI_WORD]++;
    } else U32[LO_WORD]++;
  } else if (U32[LO_WORD] === 0) {
    // decrement the magnitude of a negative number
    U32[LO_WORD] = 0xffffffff;
    U32[HI_WORD]--;
  } else U32[LO_WORD]--;
  return F64[0];
}

/** The largest double less than `x` (`Math.nextafter(x, −∞)`); NaN and −∞ stay. */
export function nextDown(x: number): number {
  return -nextUp(-x);
}

/** One ulp down – for correctly rounded operations. */
const down = nextDown;
/** One ulp up – for correctly rounded operations. */
const up = nextUp;
const LIB_REL = 2 ** -50;
/** Lower bound for a library function value (≈ 5.5 ulp down). */
const downLib = (x: number) => nextDown(x - Math.abs(x) * LIB_REL);
/** Upper bound for a library function value (≈ 5.5 ulp up). */
const upLib = (x: number) => nextUp(x + Math.abs(x) * LIB_REL);

// ---------------------------------------------------------------------------------------------
// construction

const both = (a: Definedness, b: Definedness): Definedness =>
  a === 'none' || b === 'none' ? 'none' : a === 'all' && b === 'all' ? 'all' : 'partial';

/** Weakens `def` to at most `'partial'` (an operation that is undefined somewhere on the box). */
const partial = (d: Definedness): Definedness => (d === 'none' ? 'none' : 'partial');

/** The empty result of a function that is undefined on the whole box. */
export const NONE: Interval = Object.freeze({
  lo: Infinity,
  hi: -Infinity,
  def: 'none',
  cont: true,
});

/** Builds an interval; NaN endpoints become ±∞ (and the result is no longer proven continuous). */
export function make(lo: number, hi: number, def: Definedness = 'all', cont = true): Interval {
  if (def === 'none') return NONE;
  if (lo !== lo || hi !== hi) {
    return { lo: lo !== lo ? -Infinity : lo, hi: hi !== hi ? Infinity : hi, def, cont: false };
  }
  return { lo, hi, def, cont };
}

/** The exact point interval [x, x]. */
export function point(x: number): Interval {
  return make(x, x);
}

/** The whole line (−∞, ∞) with the given definedness, not proven continuous. */
export function entire(def: Definedness = 'partial'): Interval {
  return make(-Infinity, Infinity, def, false);
}

/** Encloses a decimal literal: exact for safe integers, otherwise one ulp in both directions. */
export function fromDecimal(text: string): Interval {
  const v = Number(text);
  if (Number.isNaN(v)) return NONE;
  if (Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER) return point(v);
  return make(down(v), up(v));
}

/** Encloses a real constant given by its nearest double (π, e, …): one ulp each side. */
export function aroundDouble(v: number): Interval {
  return make(down(v), up(v));
}

export const PI: Interval = aroundDouble(Math.PI);
export const E: Interval = aroundDouble(Math.E);
const ONE = point(1);

/** True if `x` lies in `a` (and `a` carries values). */
export function contains(a: Interval, x: number): boolean {
  return a.def !== 'none' && a.lo <= x && x <= a.hi;
}

// ---------------------------------------------------------------------------------------------
// arithmetic

export function neg(a: Interval): Interval {
  return a.def === 'none' ? NONE : make(-a.hi, -a.lo, a.def, a.cont);
}

export function add(a: Interval, b: Interval): Interval {
  const def = both(a.def, b.def);
  if (def === 'none') return NONE;
  return make(down(a.lo + b.lo), up(a.hi + b.hi), def, a.cont && b.cont);
}

export function sub(a: Interval, b: Interval): Interval {
  const def = both(a.def, b.def);
  if (def === 'none') return NONE;
  return make(down(a.lo - b.hi), up(a.hi - b.lo), def, a.cont && b.cont);
}

/** Endpoint product with 0 · ∞ = 0 (the endpoints bound finite reals). */
const m = (x: number, y: number) => (x === 0 || y === 0 ? 0 : x * y);

export function mul(a: Interval, b: Interval): Interval {
  const def = both(a.def, b.def);
  if (def === 'none') return NONE;
  const p1 = m(a.lo, b.lo);
  const p2 = m(a.lo, b.hi);
  const p3 = m(a.hi, b.lo);
  const p4 = m(a.hi, b.hi);
  return make(down(Math.min(p1, p2, p3, p4)), up(Math.max(p1, p2, p3, p4)), def, a.cont && b.cont);
}

/** Endpoint quotient: x / ±∞ = 0, ∞ / ∞ → NaN (→ whole line). */
const q = (x: number, y: number) => (x === 0 ? 0 : x / y);

/**
 * Division. A divisor that contains 0 makes the quotient undefined there: `def` becomes
 * `'partial'` (or `'none'` for the divisor [0, 0]); the result is the hull of both branches –
 * often the whole line – and not continuous.
 */
export function div(a: Interval, b: Interval): Interval {
  const def = both(a.def, b.def);
  if (def === 'none') return NONE;
  if (b.lo === 0 && b.hi === 0) return NONE;
  if (b.lo > 0 || b.hi < 0) {
    const q1 = q(a.lo, b.lo);
    const q2 = q(a.lo, b.hi);
    const q3 = q(a.hi, b.lo);
    const q4 = q(a.hi, b.hi);
    return make(
      down(Math.min(q1, q2, q3, q4)),
      up(Math.max(q1, q2, q3, q4)),
      def,
      a.cont && b.cont,
    );
  }
  // 0 ∈ b: undefined where the divisor vanishes
  const d = partial(def);
  if (a.lo === 0 && a.hi === 0) return make(0, 0, d, a.cont && b.cont);
  if (b.lo === 0) {
    // b ∈ (0, hi]: one branch
    if (a.lo >= 0) return make(down(q(a.lo, b.hi)), Infinity, d, a.cont && b.cont);
    if (a.hi <= 0) return make(-Infinity, up(q(a.hi, b.hi)), d, a.cont && b.cont);
  } else if (b.hi === 0) {
    // b ∈ [lo, 0): one branch
    if (a.lo >= 0) return make(-Infinity, up(q(a.lo, b.lo)), d, a.cont && b.cont);
    if (a.hi <= 0) return make(down(q(a.hi, b.lo)), Infinity, d, a.cont && b.cont);
  }
  return entire(d);
}

// ---------------------------------------------------------------------------------------------
// powers and roots

/** x^n for an integer n (x^0 = 1, negative n via division). */
export function powInt(a: Interval, n: number): Interval {
  if (a.def === 'none') return NONE;
  if (n === 0) return make(1, 1, a.def, a.cont);
  if (n === 1) return a;
  if (n < 0) return div(ONE, powInt(a, -n));
  const p = (x: number) => (n === 2 ? x * x : Math.pow(x, n));
  const lo = (x: number) => (n === 2 ? down(x * x) : downLib(p(x)));
  const hi = (x: number) => (n === 2 ? up(x * x) : upLib(p(x)));
  if (n % 2 === 1) return make(lo(a.lo), hi(a.hi), a.def, a.cont);
  // even power: |x|^n
  if (a.lo >= 0) return make(Math.max(0, lo(a.lo)), hi(a.hi), a.def, a.cont);
  if (a.hi <= 0) return make(Math.max(0, lo(a.hi)), hi(a.lo), a.def, a.cont);
  return make(0, hi(Math.max(-a.lo, a.hi)), a.def, a.cont);
}

/** x^p for a real non-integer p on its domain x ≥ 0 (x > 0 for p < 0). */
export function powReal(a: Interval, p: number): Interval {
  if (a.def === 'none' || p !== p) return NONE;
  if (Number.isInteger(p)) return powInt(a, p);
  if (p < 0) {
    // decreasing on (0, ∞), pole at 0
    if (a.hi <= 0) return NONE;
    if (a.lo <= 0) return make(downLib(Math.pow(a.hi, p)), Infinity, partial(a.def), a.cont);
    return make(downLib(Math.pow(a.hi, p)), upLib(Math.pow(a.lo, p)), a.def, a.cont);
  }
  if (a.hi < 0) return NONE;
  const d = a.lo < 0 ? partial(a.def) : a.def;
  const lo = Math.max(0, a.lo);
  return make(Math.max(0, downLib(Math.pow(lo, p))), upLib(Math.pow(a.hi, p)), d, a.cont);
}

/**
 * The real odd root x^p = sign(x)·|x|^p (p = ±1/n with odd n, defined for negative x as in the
 * numeric evaluator: (−8)^(1/3) = −2).
 */
export function powOddRoot(a: Interval, p: number): Interval {
  if (a.def === 'none') return NONE;
  if (p < 0) return div(ONE, powOddRoot(a, -p));
  const f = (x: number) => (x < 0 ? -Math.pow(-x, p) : Math.pow(x, p));
  return make(downLib(f(a.lo)), upLib(f(a.hi)), a.def, a.cont);
}

/** root(x, n): n-th root for an integer n ≥ 2 (odd n also for negative x). */
export function rootN(a: Interval, n: number): Interval {
  if (!Number.isInteger(n) || n < 2) return NONE;
  return n % 2 === 1 ? powOddRoot(a, 1 / n) : powReal(a, 1 / n);
}

/**
 * x^y with a variable exponent: exp(y · ln x) for x > 0. Where x ≤ 0 is possible the value set is
 * not enclosed tightly (negative bases with integer exponents) → whole line, `'partial'`.
 */
export function pow(a: Interval, b: Interval): Interval {
  const def = both(a.def, b.def);
  if (def === 'none') return NONE;
  if (a.lo > 0) return exp(mul(b, ln(a)));
  return entire(partial(def));
}

export function sqrt(a: Interval): Interval {
  if (a.def === 'none' || a.hi < 0) return NONE;
  const d = a.lo < 0 ? partial(a.def) : a.def;
  return make(Math.max(0, down(Math.sqrt(Math.max(0, a.lo)))), up(Math.sqrt(a.hi)), d, a.cont);
}

// ---------------------------------------------------------------------------------------------
// exponential and logarithms

export function exp(a: Interval): Interval {
  if (a.def === 'none') return NONE;
  return make(Math.max(0, downLib(Math.exp(a.lo))), upLib(Math.exp(a.hi)), a.def, a.cont);
}

function logWith(a: Interval, f: (x: number) => number): Interval {
  if (a.def === 'none' || a.hi <= 0) return NONE;
  if (a.lo <= 0) return make(-Infinity, upLib(f(a.hi)), partial(a.def), a.cont);
  return make(downLib(f(a.lo)), upLib(f(a.hi)), a.def, a.cont);
}

/** Natural logarithm, defined for x > 0. */
export function ln(a: Interval): Interval {
  return logWith(a, Math.log);
}

/** Decimal logarithm, defined for x > 0. */
export function log10(a: Interval): Interval {
  return logWith(a, Math.log10);
}

// ---------------------------------------------------------------------------------------------
// trigonometry (radians)

const TWO_PI = 2 * Math.PI;
/** Beyond this magnitude the period is not resolved reliably → [−1, 1]. */
const TRIG_LIMIT = 2 ** 40;

/**
 * True if a point c + k·period (k ∈ ℤ) may lie in [lo, hi]. The tolerance covers the rounding of
 * c + k·period (π is not a double), so a critical point near an endpoint counts as inside – the
 * enclosure gets wider, never wrong.
 */
function mayContain(lo: number, hi: number, c: number, period: number): boolean {
  const tol = 1e-14 * Math.max(1, Math.abs(lo), Math.abs(hi));
  const k = Math.ceil((lo - tol - c) / period);
  for (let j = k - 1; j <= k + 1; j++) {
    const t = c + j * period;
    if (t >= lo - tol && t <= hi + tol) return true;
  }
  return false;
}

/** sin/cos: endpoint values plus ±1 where a maximum (at `maxAt`) or minimum may lie inside. */
function sinCos(a: Interval, f: (x: number) => number, maxAt: number, minAt: number): Interval {
  if (a.def === 'none') return NONE;
  const { lo, hi } = a;
  if (
    !Number.isFinite(lo) ||
    !Number.isFinite(hi) ||
    hi - lo >= TWO_PI ||
    Math.max(-lo, hi) > TRIG_LIMIT
  ) {
    return make(-1, 1, a.def, a.cont);
  }
  const fl = f(lo);
  const fh = f(hi);
  const rlo = mayContain(lo, hi, minAt, TWO_PI) ? -1 : Math.max(-1, downLib(Math.min(fl, fh)));
  const rhi = mayContain(lo, hi, maxAt, TWO_PI) ? 1 : Math.min(1, upLib(Math.max(fl, fh)));
  return make(rlo, rhi, a.def, a.cont);
}

export function sin(a: Interval): Interval {
  return sinCos(a, Math.sin, Math.PI / 2, -Math.PI / 2);
}

export function cos(a: Interval): Interval {
  return sinCos(a, Math.cos, 0, Math.PI);
}

/** Tangent: increasing between its poles π/2 + kπ; a box around a pole → whole line, partial. */
export function tan(a: Interval): Interval {
  if (a.def === 'none') return NONE;
  const { lo, hi } = a;
  if (
    !Number.isFinite(lo) ||
    !Number.isFinite(hi) ||
    hi - lo >= Math.PI ||
    Math.max(-lo, hi) > TRIG_LIMIT ||
    mayContain(lo, hi, Math.PI / 2, Math.PI)
  ) {
    return entire(partial(a.def));
  }
  return make(downLib(Math.tan(lo)), upLib(Math.tan(hi)), a.def, a.cont);
}

/** Increasing function on a closed domain [dlo, dhi] (arcsin: [−1, 1]). */
function increasingOn(
  a: Interval,
  f: (x: number) => number,
  dlo: number,
  dhi: number,
  rlo = -Infinity,
  rhi = Infinity,
): Interval {
  if (a.def === 'none' || a.hi < dlo || a.lo > dhi) return NONE;
  const d = a.lo < dlo || a.hi > dhi ? partial(a.def) : a.def;
  const lo = Math.max(rlo, downLib(f(Math.max(a.lo, dlo))));
  const hi = Math.min(rhi, upLib(f(Math.min(a.hi, dhi))));
  return make(lo, hi, d, a.cont);
}

export function asin(a: Interval): Interval {
  return increasingOn(a, Math.asin, -1, 1, -upLib(Math.PI / 2), upLib(Math.PI / 2));
}

export function acos(a: Interval): Interval {
  if (a.def === 'none' || a.hi < -1 || a.lo > 1) return NONE;
  const d = a.lo < -1 || a.hi > 1 ? partial(a.def) : a.def;
  const lo = Math.max(0, downLib(Math.acos(Math.min(a.hi, 1))));
  const hi = Math.min(upLib(Math.PI), upLib(Math.acos(Math.max(a.lo, -1))));
  return make(lo, hi, d, a.cont);
}

export function atan(a: Interval): Interval {
  return increasingOn(a, Math.atan, -Infinity, Infinity, -upLib(Math.PI / 2), upLib(Math.PI / 2));
}

// ---------------------------------------------------------------------------------------------
// hyperbolic functions

export function sinh(a: Interval): Interval {
  return increasingOn(a, Math.sinh, -Infinity, Infinity);
}

export function cosh(a: Interval): Interval {
  if (a.def === 'none') return NONE;
  const m0 = Math.min(Math.abs(a.lo), Math.abs(a.hi));
  const m1 = Math.max(Math.abs(a.lo), Math.abs(a.hi));
  const lo = a.lo <= 0 && a.hi >= 0 ? 1 : Math.max(1, downLib(Math.cosh(m0)));
  return make(lo, upLib(Math.cosh(m1)), a.def, a.cont);
}

export function tanh(a: Interval): Interval {
  return increasingOn(a, Math.tanh, -Infinity, Infinity, -1, 1);
}

export function asinh(a: Interval): Interval {
  return increasingOn(a, Math.asinh, -Infinity, Infinity);
}

export function acosh(a: Interval): Interval {
  return increasingOn(a, Math.acosh, 1, Infinity, 0);
}

/** artanh on the open domain (−1, 1): the values grow to ±∞ at the ends. */
export function atanh(a: Interval): Interval {
  if (a.def === 'none' || a.hi <= -1 || a.lo >= 1) return NONE;
  const d = a.lo <= -1 || a.hi >= 1 ? partial(a.def) : a.def;
  const lo = a.lo <= -1 ? -Infinity : downLib(Math.atanh(a.lo));
  const hi = a.hi >= 1 ? Infinity : upLib(Math.atanh(a.hi));
  return make(lo, hi, d, a.cont);
}

// ---------------------------------------------------------------------------------------------
// piecewise functions

export function abs(a: Interval): Interval {
  if (a.def === 'none') return NONE;
  if (a.lo >= 0) return a;
  if (a.hi <= 0) return neg(a);
  return make(0, Math.max(-a.lo, a.hi), a.def, a.cont);
}

/** sign: −1, 0, 1 – a jump at 0. */
export function sign(a: Interval): Interval {
  if (a.def === 'none') return NONE;
  if (a.lo > 0) return make(1, 1, a.def, a.cont);
  if (a.hi < 0) return make(-1, -1, a.def, a.cont);
  if (a.lo === 0 && a.hi === 0) return make(0, 0, a.def, a.cont);
  return make(a.lo < 0 ? -1 : 0, a.hi > 0 ? 1 : 0, a.def, false);
}

/** A non-decreasing step function: continuous only if both ends land on the same step. */
function step(a: Interval, f: (x: number) => number): Interval {
  if (a.def === 'none') return NONE;
  const lo = f(a.lo);
  const hi = f(a.hi);
  return make(lo, hi, a.def, a.cont && lo === hi);
}

export function floor(a: Interval): Interval {
  return step(a, Math.floor);
}

export function ceil(a: Interval): Interval {
  return step(a, Math.ceil);
}

/** round as in the numeric evaluator (`Math.round`, halves up). */
export function round(a: Interval): Interval {
  return step(a, Math.round);
}

export function min(a: Interval, b: Interval): Interval {
  const def = both(a.def, b.def);
  if (def === 'none') return NONE;
  return make(Math.min(a.lo, b.lo), Math.min(a.hi, b.hi), def, a.cont && b.cont);
}

export function max(a: Interval, b: Interval): Interval {
  const def = both(a.def, b.def);
  if (def === 'none') return NONE;
  return make(Math.max(a.lo, b.lo), Math.max(a.hi, b.hi), def, a.cont && b.cont);
}

/** Applies an increasing function with a known absolute error bound `err` (erf: 1e-14). */
export function increasingAbs(
  a: Interval,
  f: (x: number) => number,
  err: number,
  rlo = -Infinity,
  rhi = Infinity,
): Interval {
  if (a.def === 'none') return NONE;
  return make(Math.max(rlo, down(f(a.lo) - err)), Math.min(rhi, up(f(a.hi) + err)), a.def, a.cont);
}
