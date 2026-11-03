/**
 * Complex arithmetic and the elementary functions on principal branches (prompt 027). Angles of the
 * trigonometric functions are radians; the evaluator converts degrees.
 */
import { type Complex, complex } from './value';

export const C = {
  add: (a: Complex, b: Complex) => complex(a.re + b.re, a.im + b.im),
  sub: (a: Complex, b: Complex) => complex(a.re - b.re, a.im - b.im),
  mul: (a: Complex, b: Complex) => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re),
  /** null for division by zero */
  div(a: Complex, b: Complex): Complex | null {
    const d = b.re * b.re + b.im * b.im;
    if (d === 0) return null;
    // Smith's algorithm keeps the intermediate values in range
    if (Math.abs(b.re) >= Math.abs(b.im)) {
      const r = b.im / b.re;
      const den = b.re + b.im * r;
      return complex((a.re + a.im * r) / den, (a.im - a.re * r) / den);
    }
    const r = b.re / b.im;
    const den = b.re * r + b.im;
    return complex((a.re * r + a.im) / den, (a.im * r - a.re) / den);
  },
  neg: (a: Complex) => complex(-a.re, -a.im),
  conj: (a: Complex) => complex(a.re, -a.im),
  abs: (a: Complex) => Math.hypot(a.re, a.im),
  arg: (a: Complex) => Math.atan2(a.im, a.re),
  exp(a: Complex): Complex {
    const m = Math.exp(a.re);
    return complex(m * Math.cos(a.im), m * Math.sin(a.im));
  },
  /** principal logarithm; null for 0 */
  ln(a: Complex): Complex | null {
    if (a.re === 0 && a.im === 0) return null;
    return complex(Math.log(Math.hypot(a.re, a.im)), Math.atan2(a.im, a.re));
  },
  sqrt(a: Complex): Complex {
    if (a.im === 0) {
      return a.re >= 0 ? complex(Math.sqrt(a.re), 0) : complex(0, Math.sqrt(-a.re));
    }
    const m = Math.hypot(a.re, a.im);
    const re = Math.sqrt((m + a.re) / 2);
    const im = Math.sign(a.im) * Math.sqrt((m - a.re) / 2);
    return complex(re, im);
  },
  /** a^b; integer exponents by repeated squaring (exact for Gaussian integers), else exp(b·ln a) */
  pow(a: Complex, b: Complex): Complex | null {
    if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 1024) {
      let n = Math.abs(b.re);
      let base = a;
      let acc = complex(1, 0);
      while (n > 0) {
        if (n & 1) acc = C.mul(acc, base);
        base = C.mul(base, base);
        n >>= 1;
      }
      return b.re < 0 ? C.div(complex(1, 0), acc) : acc;
    }
    if (a.re === 0 && a.im === 0) return b.re > 0 ? complex(0, 0) : null;
    const l = C.ln(a)!;
    return C.exp(C.mul(b, l));
  },
  sin: (a: Complex) => complex(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im)),
  cos: (a: Complex) => complex(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im)),
  tan(a: Complex): Complex | null {
    return C.div(C.sin(a), C.cos(a));
  },
  sinh: (a: Complex) => complex(Math.sinh(a.re) * Math.cos(a.im), Math.cosh(a.re) * Math.sin(a.im)),
  cosh: (a: Complex) => complex(Math.cosh(a.re) * Math.cos(a.im), Math.sinh(a.re) * Math.sin(a.im)),
  tanh(a: Complex): Complex | null {
    return C.div(C.sinh(a), C.cosh(a));
  },
  /** asin z = −i·ln(iz + √(1 − z²)) */
  asin(a: Complex): Complex | null {
    const iz = complex(-a.im, a.re);
    const s = C.sqrt(C.sub(complex(1, 0), C.mul(a, a)));
    const l = C.ln(C.add(iz, s));
    return l && complex(l.im, -l.re);
  },
  /** acos z = π/2 − asin z */
  acos(a: Complex): Complex | null {
    const s = C.asin(a);
    return s && complex(Math.PI / 2 - s.re, -s.im);
  },
  /** atan z = (i/2)·(ln(1 − iz) − ln(1 + iz)) */
  atan(a: Complex): Complex | null {
    const iz = complex(-a.im, a.re);
    const l1 = C.ln(C.sub(complex(1, 0), iz));
    const l2 = C.ln(C.add(complex(1, 0), iz));
    if (!l1 || !l2) return null;
    const d = C.sub(l1, l2);
    return complex(-d.im / 2, d.re / 2);
  },
};
