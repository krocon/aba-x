import { describe, expect, it } from 'vitest';
import { parseText } from '../parser/text-parser';
import { evaluateNumeric } from '../numeric/evaluate';
import {
  LOGIC_FUNCTIONS,
  compilePoint,
  compileRelation,
  evaluateInterval,
  evaluateRelation,
} from './eval';
import * as I from './interval';

const parse = (s: string) => {
  const p = parseText(s, { functions: LOGIC_FUNCTIONS });
  if (!p.ok) throw new Error(`${s}: ${p.error.message}`);
  return p.value;
};

const box = (x0: number, x1: number, y0: number, y1: number) =>
  [I.make(x0, x1), I.make(y0, y1)] as const;

describe('interval evaluation of expressions', () => {
  it('encloses the point evaluator on random points (rad and deg)', () => {
    const exprs = [
      'X^2+Y^2',
      'sin(X*Y)',
      'X^(1/3)+root(Y,3)',
      'sqrt(X)-ln(Y)',
      'log(X, 2)+log(Y)',
      'tan(X)/Y',
      'abs(X)-floor(Y)+round(X)*sign(Y)',
      'arcsin(X/4)+arccos(Y/4)+arctan(X*Y)',
      'exp(X)-cosh(Y)+tanh(X)',
      'min(X, Y, 1)+max(X^2, Y)',
      'X^Y',
      'pi*e*X%',
      'cot(X)+sec(Y)+csc(X)',
      'erf(X)+sinh(Y)',
    ];
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const angle of ['rad', 'deg'] as const) {
      for (const s of exprs) {
        const e = parse(s);
        const f = compilePoint(e, { angle });
        if (!f.ok) throw new Error(f.error.message);
        for (let k = 0; k < 150; k++) {
          const x0 = -4 + 8 * rand();
          const y0 = -4 + 8 * rand();
          const w = rand() * (k % 3 === 0 ? 3 : 0.1);
          const [X, Y] = box(x0, x0 + w, y0, y0 + w);
          const F = evaluateInterval(e, X, Y, { angle });
          if (!F.ok) throw new Error(F.error.message);
          for (let m = 0; m < 10; m++) {
            const x = x0 + w * rand();
            const y = y0 + w * rand();
            const v = f.value(x, y);
            if (Number.isNaN(v)) {
              expect(F.value.def).not.toBe('all');
              continue;
            }
            expect(F.value.def, `${s} at ${x}, ${y}`).not.toBe('none');
            if (!(F.value.lo <= v && v <= F.value.hi))
              throw new Error(
                `${s}(${x}, ${y}) = ${v} ∉ [${F.value.lo}, ${F.value.hi}] (${angle})`,
              );
          }
        }
      }
    }
  });

  it('the point evaluator agrees with the numeric evaluator', () => {
    for (const s of ['X^(1/3)', 'root(X,3)', 'log(X,2)', 'sqrt(X)+Y^2', 'X^-2']) {
      const e = parse(s);
      const f = compilePoint(e);
      if (!f.ok) throw new Error(f.error.message);
      for (const [x, y] of [
        [-8, 2],
        [8, 3],
        [0.5, -1],
      ]) {
        const r = evaluateNumeric(e, {
          variables: new Map([
            ['X', x],
            ['Y', y],
          ]),
        });
        if (r.ok) expect(f.value(x, y)).toBeCloseTo(r.value, 12);
        else expect(f.value(x, y)).toBeNaN();
      }
    }
  });

  it('reports unknown names and non-relations as errors', () => {
    expect(evaluateRelation(parse('Z>1'), I.point(0), I.point(0))).toMatchObject({
      ok: false,
      error: { code: 'unknown-symbol' },
    });
    expect(evaluateRelation(parse('gcd(X,2)>1'), I.point(0), I.point(0))).toMatchObject({
      ok: false,
      error: { code: 'unknown-function' },
    });
    expect(compileRelation(parse('X+Y'))).toMatchObject({
      ok: false,
      error: { code: 'unsupported' },
    });
    expect(compileRelation(parse('X! > 1'))).toMatchObject({ ok: false });
    // stored variables
    expect(
      evaluateRelation(parse('Y>A'), ...box(0, 1, 2, 3), { variables: new Map([['A', 1]]) }),
    ).toEqual({ ok: true, value: 'true' });
  });
});

describe('three-valued truth of relations', () => {
  const truth = (s: string, x0: number, x1: number, y0: number, y1: number) => {
    const r = evaluateRelation(parse(s), ...box(x0, x1, y0, y1));
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };

  it('inequalities', () => {
    expect(truth('Y>X^2', -0.5, 0.5, 1, 2)).toBe('true');
    expect(truth('Y>X^2', 2, 3, 0, 1)).toBe('false');
    expect(truth('Y>X^2', 0.9, 1.1, 0.9, 1.1)).toBe('unknown');
    expect(truth('Y>=X', 0, 1, 1, 2)).toBe('true'); // touches at (1, 1)
    expect(truth('Y>X', 0, 1, 1, 2)).toBe('unknown');
  });

  it('equalities are never true on a box, ≠ never false', () => {
    expect(truth('X=2', 1.9, 2.1, 0, 1)).toBe('unknown');
    expect(truth('X=2', 2.5, 3, 0, 1)).toBe('false');
    expect(truth('X^2+Y^2=4', -0.1, 0.1, -0.1, 0.1)).toBe('false');
    expect(truth('X!=2', 2.5, 3, 0, 1)).toBe('true');
    expect(truth('X!=2', 1.9, 2.1, 0, 1)).toBe('unknown');
  });

  it('undefined sides make a relation fail, partial ones undecided', () => {
    expect(truth('sqrt(X)>-1', -2, -1, 0, 1)).toBe('false');
    expect(truth('sqrt(X)>-1', -1, 1, 0, 1)).toBe('unknown');
    expect(truth('sqrt(X)>-1', 1, 2, 0, 1)).toBe('true');
    expect(truth('1/X>0', -1, 1, 0, 1)).toBe('unknown');
    expect(truth('ln(X)<5', -3, -2, 0, 1)).toBe('false');
  });

  it('connectives (Kleene logic) and chained comparisons', () => {
    expect(truth('and(X^2+Y^2<9, Y>0)', -1, 1, 1, 2)).toBe('true');
    expect(truth('and(X^2+Y^2<9, Y>0)', -1, 1, -2, -1)).toBe('false');
    expect(truth('or(X>1, X<-1)', 2, 3, 0, 1)).toBe('true');
    expect(truth('or(X>1, X<-1)', -0.5, 0.5, 0, 1)).toBe('false');
    expect(truth('not(Y>X^2)', 2, 3, 0, 1)).toBe('true');
    expect(truth('xor(X>0, Y>0)', 1, 2, -2, -1)).toBe('true');
    expect(truth('xor(X>0, Y>0)', 1, 2, 1, 2)).toBe('false');
    expect(truth('xor(X>0, Y>0)', -1, 2, 1, 2)).toBe('unknown');
    expect(truth('0<X<1', 0.2, 0.8, 0, 1)).toBe('true');
    expect(truth('0<X<1', 1.2, 1.8, 0, 1)).toBe('false');
  });

  it('point truth and forced atoms', () => {
    const r = compileRelation(parse('and(Y>X^2, X<1)'));
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.atoms.length).toBe(2);
    expect(r.value.pointTruth(0, 1)).toBe(true);
    expect(r.value.pointTruth(2, 5)).toBe(false);
    expect(r.value.pointTruthWith(2, 5, new Map([[1, true]]))).toBe(true);
  });
});
