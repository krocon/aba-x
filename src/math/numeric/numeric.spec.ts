import { parseText } from '../parser/text-parser';
import { derivative } from './derivative';
import { compile, evaluateNumeric, erf } from './evaluate';
import { gaussLegendre, integrateAdaptive, simpson, trapezoid } from './quadrature';
import { bisection, brent, newton, rootsIn, secant } from './roots';

const ast = (s: string) => {
  const r = parseText(s);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const num = (s: string, scope = {}) => evaluateNumeric(ast(s), scope);
const val = (s: string, scope = {}) => {
  const r = num(s, scope);
  if (!r.ok) throw new Error(`${s}: ${r.error.message}`);
  return r.value;
};

describe('evaluateNumeric', () => {
  it.each([
    ['1+2*3', 7],
    ['2^10', 1024],
    ['-2^2', -4],
    ['5!', 120],
    ['50%', 0.5],
    ['sqrt(16)', 4],
    ['root(-8, 3)', -2],
    ['(-8)^(1/3)', -2],
    ['ln(e)', 1],
    ['log(1000)', 3],
    ['log(8, 2)', 3],
    ['abs(-3)', 3],
    ['nCr(5, 2)', 10],
    ['gcd(12, 18)', 6],
    ['mod(-1, 3)', 2],
    ['sum(k^2, k, 1, 10)', 385],
    ['product(k, k, 1, 5)', 120],
    ['arctan(1)*4', Math.PI],
  ])('%s = %d', (src, expected) => {
    expect(val(src)).toBeCloseTo(expected, 12);
  });

  it('works in degrees with exact special angles', () => {
    expect(val('sin(30)', { angle: 'deg' })).toBe(0.5);
    expect(val('sin(180)', { angle: 'deg' })).toBe(0);
    expect(val('cos(90)', { angle: 'deg' })).toBe(0);
    expect(val('arcsin(1)', { angle: 'deg' })).toBeCloseTo(90, 12);
    expect(num('tan(90)', { angle: 'deg' })).toMatchObject({
      ok: false,
      error: { code: 'domain' },
    });
  });

  it.each([
    ['1/0', 'division-by-zero'],
    ['0^-1', 'division-by-zero'],
    ['ln(0)', 'domain'],
    ['sqrt(-1)', 'domain'],
    ['(-2)^0.5', 'domain'],
    ['arcsin(2)', 'domain'],
    ['(-1)!', 'domain'],
    ['2.5!', 'domain'],
    ['y+1', 'unknown-symbol'],
    ['i^2', 'unsupported'],
    ['10^400', 'domain'],
    ['diff(x^2, x)', 'not-evaluable'],
    ['integrate(x, x)', 'not-evaluable'],
    ['x = 1', 'not-evaluable'],
  ])('%s fails with %s', (src, code) => {
    expect(num(src)).toMatchObject({ ok: false, error: { code } });
  });

  it('uses variables and user functions, stops runaway recursion', () => {
    const fs = new Set(['f', 'g']);
    const p = (s: string) => {
      const r = parseText(s, { functions: fs });
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    };
    const functions = new Map([['f', { params: ['x'], body: p('x^2 - 3*x + 2') }]]);
    const r = evaluateNumeric(p('f(4) + a'), { variables: new Map([['a', 1]]), functions });
    expect(r).toEqual({ ok: true, value: 7 });
    const loop = new Map([['g', { params: ['x'], body: p('g(x)+1') }]]);
    expect(evaluateNumeric(p('g(1)'), { functions: loop })).toMatchObject({
      ok: false,
      error: { code: 'not-evaluable' },
    });
  });

  it('evaluates definite integrals', () => {
    expect(val('integrate(x^2, x, 0, 1)')).toBeCloseTo(1 / 3, 12);
  });

  it('compile() turns errors into gaps (NaN)', () => {
    const f = compile(ast('1/x'), 'x');
    expect(f(2)).toBe(0.5);
    expect(f(0)).toBeNaN();
  });

  it('erf matches reference values', () => {
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 14);
    expect(erf(2)).toBeCloseTo(0.9953222650189527, 14);
    expect(erf(4)).toBeCloseTo(0.9999999845827421, 14);
  });
});

describe('quadrature', () => {
  const sin = Math.sin;
  it('classic rules converge on smooth integrands', () => {
    expect(trapezoid(sin, 0, Math.PI, 2000)).toBeCloseTo(2, 5);
    expect(simpson(sin, 0, Math.PI, 200)).toBeCloseTo(2, 8);
    expect(gaussLegendre(sin, 0, Math.PI, 10)).toBeCloseTo(2, 12);
    expect(gaussLegendre((x) => x ** 19, 0, 1, 10)).toBeCloseTo(1 / 20, 14);
  });

  it.each([
    ['sin on [0, π]', Math.sin, 0, Math.PI, 2],
    ['x² on [0, 1]', (x: number) => x * x, 0, 1, 1 / 3],
    ['1/√x on [0, 1] (integrable singularity)', (x: number) => 1 / Math.sqrt(x), 0, 1, 2],
    ['e^(−x²) on ℝ', (x: number) => Math.exp(-x * x), -Infinity, Infinity, Math.sqrt(Math.PI)],
    ['1/x² on [1, ∞)', (x: number) => 1 / (x * x), 1, Infinity, 1],
    ['reversed bounds', (x: number) => x, 1, 0, -0.5],
    ['empty interval', (x: number) => x, 2, 2, 0],
  ])('adaptive: %s', (_, f, a, b, expected) => {
    const r = integrateAdaptive(f, a, b);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.value).toBeCloseTo(expected, 7);
      expect(r.value.error).toBeLessThan(1e-6);
    }
  });

  it('reports non-integrable singularities and undefined integrands', () => {
    expect(integrateAdaptive((x) => 1 / x, -1, 1).ok).toBe(false);
    expect(integrateAdaptive((x) => 1 / (x * x), 0, 1).ok).toBe(false);
    expect(integrateAdaptive((x) => Math.sqrt(x), -1, 1)).toMatchObject({
      ok: false,
      error: { code: 'domain' },
    });
    expect(integrateAdaptive((x) => x, NaN, 1)).toMatchObject({ ok: false });
  });
});

describe('roots', () => {
  const f = (x: number) => x * x - 2;
  it.each([
    ['bisection', () => bisection(f, 0, 2)],
    ['brent', () => brent(f, 0, 2)],
    ['newton', () => newton(f, 1)],
    ['secant', () => secant(f, 1, 2)],
  ])('%s finds √2', (_, run) => {
    const r = run();
    expect(r.ok && r.value.root).toBeCloseTo(Math.SQRT2, 12);
  });

  it('needs a sign change for bracketing methods', () => {
    expect(brent((x) => x * x + 1, -1, 1)).toMatchObject({
      ok: false,
      error: { code: 'not-solvable' },
    });
  });

  it('reports non-convergence', () => {
    expect(newton((x) => x * x + 1, 0.5, { maxIter: 50 }).ok).toBe(false);
    expect(newton((x) => x ** 3 - 2 * x + 2, 0, { maxIter: 50 }).ok).toBe(false);
  });

  it('finds all roots, skips poles, finds touching roots', () => {
    expect(rootsIn((x) => Math.sin(x), -0.5, 7).map((x) => +x.toFixed(10) + 0)).toEqual([
      0, 3.1415926536, 6.2831853072,
    ]);
    expect(rootsIn((x) => 1 / x, -1, 1.3)).toEqual([]);
    const touch = rootsIn((x) => (x - 1) ** 2, 0, 2.05, 41);
    expect(touch.length).toBe(1);
    expect(touch[0]).toBeCloseTo(1, 6);
  });
});

describe('derivative', () => {
  it('matches analytic derivatives', () => {
    const d = derivative(Math.sin, 1);
    expect(d.ok && d.value.value).toBeCloseTo(Math.cos(1), 10);
    const e = derivative((x) => x ** 3, 2);
    expect(e.ok && e.value.value).toBeCloseTo(12, 9);
  });

  it('refuses kinks and undefined points', () => {
    expect(derivative(Math.abs, 0).ok).toBe(false);
    expect(derivative((x) => 1 / x, 0).ok).toBe(false);
  });
});
