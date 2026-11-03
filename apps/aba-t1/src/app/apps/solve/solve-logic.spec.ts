import { describe, expect, it } from 'vitest';
import { type CurveState, initCurveState, rowErrors } from '../curve/curve-logic';
import { equations, plotEquation, solveStep, variables } from './solve-logic';

const withRows = (latex: string[], extra: Partial<CurveState> = {}): CurveState => {
  const s = initCurveState('solve');
  return {
    ...s,
    rows: s.rows.map((r, i) => ({ ...r, fields: [latex[i] ?? ''] })),
    ...extra,
  };
};

describe('solve app logic', () => {
  it('reads the equations and their variables', () => {
    const s = withRows(['P\\cdot V=N\\cdot8.314\\cdot T', '', 'X^{2}-4']);
    expect(equations(s).map((e) => e.name)).toEqual(['E1', 'E3']);
    expect(variables(s).map((v) => v.name)).toEqual(['N', 'P', 'T', 'V', 'X']);
    expect(variables(s, new Map([['T', 300]])).find((v) => v.name === 'T')?.value).toBe(300);
  });

  it('marks inequalities as errors', () => {
    const errs = rowErrors('solve', withRows(['X<1', 'X=1']).rows);
    expect(errs[0][0]).toMatch(/equation/);
    expect(errs[1][0]).toBeNull();
  });

  it('solves one equation in three variables for the cursor variable', () => {
    const s = withRows(['A=B\\cdot C'], { values: { A: 0, B: 4, C: 2.5 } });
    const r = solveStep(s, 'A', {});
    expect(r.status.kind).toBe('zero');
    expect(r.values['A']).toBeCloseTo(10, 12);
    const b = solveStep({ ...s, values: { A: 12, B: 1, C: 3 } }, 'B', {});
    expect(b.values['B']).toBeCloseTo(4, 10);
  });

  it('says honestly when there is no solution', () => {
    const r = solveStep(withRows(['X^{2}+1=0'], { values: { X: 1 } }), 'X', {});
    expect(r.status.kind).toBe('extremum');
  });

  it('solves a system with marked unknowns', () => {
    const s = withRows(['X+Y=10', 'X-Y=2'], { values: { X: 0, Y: 0 }, unknowns: ['X', 'Y'] });
    const r = solveStep(s, null, {});
    expect(r.status.kind).toBe('system');
    expect(r.values['X']).toBeCloseTo(6, 9);
    expect(r.values['Y']).toBeCloseTo(4, 9);
  });

  it('reports a missing unknown', () => {
    expect(solveStep(withRows(['X=1']), null, {}).status.kind).toBe('error');
  });

  it('finds the equation to plot', () => {
    const s = withRows(['A=2', 'B=A+1']);
    expect(plotEquation(s, 'B')?.eq.name).toBe('E2');
    expect(plotEquation(s, 'Z')).toBeNull();
  });
});
