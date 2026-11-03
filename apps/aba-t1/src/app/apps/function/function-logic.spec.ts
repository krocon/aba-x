import { definitions, initFunctionState, plottables, table } from './function-logic';

const scope = { angle: 'rad' as const, variables: new Map([['A', 2]]) };

describe('function app logic', () => {
  it('compiles enabled definitions that may use each other and home variables', () => {
    const s = initFunctionState();
    s.fns[0] = { latex: 'X^2', on: true };
    s.fns[1] = { latex: 'F1(X)+A', on: true };
    s.fns[2] = { latex: '\\sin(X)', on: false };
    s.fns[3] = { latex: '2+', on: true };
    const ps = plottables(s.fns, scope);
    expect(ps.map((p) => p.name)).toEqual(['F1', 'F2']);
    expect(ps[1].f(3)).toBe(11);
    expect(definitions(s.fns).errors[3]).toBeTruthy();
  });

  it('tables values with gaps as NaN', () => {
    const s = initFunctionState();
    s.fns[0] = { latex: '\\frac{1}{X}', on: true };
    const rows = table(plottables(s.fns, scope), -1, 0.5, 3);
    expect(rows.map((r) => r.x)).toEqual([-1, -0.5, 0]);
    expect(rows[2].ys[0]).toBeNaN();
  });
});
