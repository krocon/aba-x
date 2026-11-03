/**
 * Probability functions of the catalogue (prompt 038): density, cumulative probability and
 * inverse of the distributions, plus random numbers. Each takes real arguments and returns a
 * `MathResult` – the evaluators call them for every name in `STAT_FUNCTIONS`.
 *
 * Argument order: the value first, then the parameters (`normalcdf(x, μ, σ)`, `tcdf(t, ν)`,
 * `binomcdf(k, n, p)`); cumulative = P(X ≤ x). Inverses take the probability first.
 */
import { type MathResult, fail, ok } from '../result';
import {
  type ContinuousDistribution,
  type DiscreteDistribution,
  binomial,
  chiSquare,
  exponential,
  fisherF,
  geometric,
  normal,
  poisson,
  studentT,
  uniform,
} from './distributions';
import { Rng } from './random';

type Fn = (a: readonly number[]) => MathResult<number>;

/** Arity of every function (min, max) – the catalogue uses the same numbers. */
export const STAT_ARITY: Record<string, [number, number]> = {};

function continuous(
  name: string,
  make: (p: readonly number[]) => MathResult<ContinuousDistribution>,
  params: [number, number],
  out: Record<string, Fn>,
): void {
  const [min, max] = params;
  const at =
    (k: 'pdf' | 'cdf' | 'inv'): Fn =>
    (a) => {
      const d = make(a.slice(1));
      if (!d.ok) return d;
      return d.value[k](a[0]);
    };
  out[`${name}pdf`] = at('pdf');
  out[`${name}cdf`] = at('cdf');
  out[`inv${name}`] = at('inv');
  for (const f of [`${name}pdf`, `${name}cdf`, `inv${name}`]) STAT_ARITY[f] = [1 + min, 1 + max];
}

function discrete(
  name: string,
  make: (p: readonly number[]) => MathResult<DiscreteDistribution>,
  params: number,
  out: Record<string, Fn>,
): void {
  const at =
    (k: 'pmf' | 'cdf' | 'inv'): Fn =>
    (a) => {
      const d = make(a.slice(1));
      if (!d.ok) return d;
      return d.value[k](a[0]);
    };
  out[`${name}pdf`] = at('pmf');
  out[`${name}cdf`] = at('cdf');
  out[`inv${name}`] = at('inv');
  for (const f of [`${name}pdf`, `${name}cdf`, `inv${name}`])
    STAT_ARITY[f] = [1 + params, 1 + params];
}

let rng: Rng | null = null;
const generator = (): Rng => {
  if (!rng) {
    const r = Rng.seeded(Math.floor(Math.random() * 2 ** 31));
    if (r.ok) rng = r.value;
  }
  return rng!;
};

const real = (v: number): MathResult<number> =>
  Number.isFinite(v) ? ok(v) : fail('domain', 'no finite result');

export const STAT_FUNCTIONS: Record<string, Fn> = (() => {
  const out: Record<string, Fn> = {};
  continuous('normal', (p) => normal(p[0] ?? 0, p[1] ?? 1), [0, 2], out);
  continuous('t', (p) => studentT(p[0]), [1, 1], out);
  continuous('chi2', (p) => chiSquare(p[0]), [1, 1], out);
  continuous('f', (p) => fisherF(p[0], p[1]), [2, 2], out);
  continuous('exp', (p) => exponential(p[0]), [1, 1], out);
  continuous('uniform', (p) => uniform(p[0], p[1]), [2, 2], out);
  discrete('binom', (p) => binomial(p[0], p[1]), 2, out);
  discrete('poisson', (p) => poisson(p[0]), 1, out);
  discrete('geom', (p) => geometric(p[0]), 1, out);
  // the usual short name of the inverse normal
  out['invnorm'] = out['invnormal'];
  STAT_ARITY['invnorm'] = STAT_ARITY['invnormal'];
  // random numbers (seeded with randseed for reproducible sequences)
  out['random'] = () => ok(generator().random());
  STAT_ARITY['random'] = [0, 0];
  out['randint'] = ([a, b]) => {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a > b)
      return fail('domain', 'randint(a, b) needs integers a ≤ b');
    return ok(a + Math.floor(generator().random() * (b - a + 1)));
  };
  STAT_ARITY['randint'] = [2, 2];
  out['randnorm'] = ([m = 0, s = 1]) => {
    const r = generator().normal(m, s);
    return r.ok ? real(r.value) : r;
  };
  STAT_ARITY['randnorm'] = [0, 2];
  out['randbin'] = ([n, p]) => {
    const r = generator().binomial(n, p);
    return r.ok ? real(r.value) : r;
  };
  STAT_ARITY['randbin'] = [2, 2];
  out['randseed'] = ([s]) => {
    const r = Rng.seeded(s);
    if (!r.ok) return r;
    rng = r.value;
    return ok(s);
  };
  STAT_ARITY['randseed'] = [1, 1];
  return out;
})();

/** Help lines for the catalogue (English; the app has its own texts). */
export const STAT_HELP: Record<string, string> = {
  normalpdf: 'normal density: normalpdf(x[, μ, σ])',
  normalcdf: 'normal probability P(X ≤ x): normalcdf(x[, μ, σ])',
  invnormal: 'inverse normal: invnormal(p[, μ, σ])',
  invnorm: 'inverse normal: invnorm(p[, μ, σ])',
  tpdf: 'Student t density: tpdf(t, ν)',
  tcdf: 'Student t probability P(T ≤ t): tcdf(t, ν)',
  invt: 'inverse Student t: invt(p, ν)',
  chi2pdf: 'χ² density: chi2pdf(x, ν)',
  chi2cdf: 'χ² probability P(X ≤ x): chi2cdf(x, ν)',
  invchi2: 'inverse χ²: invchi2(p, ν)',
  fpdf: 'F density: fpdf(x, d1, d2)',
  fcdf: 'F probability P(X ≤ x): fcdf(x, d1, d2)',
  invf: 'inverse F: invf(p, d1, d2)',
  exppdf: 'exponential density: exppdf(x, λ)',
  expcdf: 'exponential probability: expcdf(x, λ)',
  invexp: 'inverse exponential: invexp(p, λ)',
  uniformpdf: 'uniform density: uniformpdf(x, a, b)',
  uniformcdf: 'uniform probability: uniformcdf(x, a, b)',
  invuniform: 'inverse uniform: invuniform(p, a, b)',
  binompdf: 'binomial probability P(X = k): binompdf(k, n, p)',
  binomcdf: 'binomial probability P(X ≤ k): binomcdf(k, n, p)',
  invbinom: 'inverse binomial: invbinom(q, n, p)',
  poissonpdf: 'Poisson probability P(X = k): poissonpdf(k, λ)',
  poissoncdf: 'Poisson probability P(X ≤ k): poissoncdf(k, λ)',
  invpoisson: 'inverse Poisson: invpoisson(q, λ)',
  geompdf: 'geometric probability P(X = k): geompdf(k, p)',
  geomcdf: 'geometric probability P(X ≤ k): geomcdf(k, p)',
  invgeom: 'inverse geometric: invgeom(q, p)',
  random: 'random number in [0, 1)',
  randint: 'random integer a … b: randint(a, b)',
  randnorm: 'normal random number: randnorm([μ, σ])',
  randbin: 'binomial random number: randbin(n, p)',
  randseed: 'seed of the random numbers: randseed(s)',
};
