import {
  curveTable,
  curves,
  initCurveState,
  parseRelation,
  relationScope,
  relations,
  rowErrors,
} from './curve-logic';

const scope = { angle: 'rad' as const, variables: new Map<string, number>() };

describe('curve apps logic', () => {
  it('parametric: a circle', () => {
    const s = initCurveState('parametric');
    s.rows[0] = { fields: ['\\cos(T)', '\\sin(T)'], on: true };
    const cs = curves('parametric', s.rows, scope);
    expect(cs.length).toBe(1);
    const [x, y] = cs[0].point!(Math.PI / 2);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
    expect(curveTable('parametric', cs, 0, 1, 2)[0].values).toEqual([1, 0]);
  });

  it('polar: r = 2 in degrees and radians', () => {
    const s = initCurveState('polar');
    s.rows[0] = { fields: ['2'], on: true };
    const rad = curves('polar', s.rows, scope)[0].point!(Math.PI);
    expect(rad[0]).toBeCloseTo(-2, 12);
    const deg = curves('polar', s.rows, { ...scope, angle: 'deg' })[0].point!(90);
    expect(deg[1]).toBeCloseTo(2, 12);
  });

  it('sequence: recursive with start terms, table, cobweb, errors', () => {
    const s = initCurveState('sequence');
    s.rows[0] = { fields: ['U1(N-1)+U1(N-2)', '1', '1'], on: true };
    s.rows[1] = { fields: ['2.8\\cdot U2(N-1)\\cdot(1-U2(N-1))', '0.2', ''], on: true };
    s.rows[2] = { fields: ['2+', '', ''], on: true };
    const cs = curves('sequence', s.rows, scope);
    expect(cs.map((c) => c.name)).toEqual(['U1', 'U2']);
    expect(curveTable('sequence', cs, 1, 1, 6).map((r) => r.values[0])).toEqual([1, 1, 2, 3, 5, 8]);
    expect(cs[1].cobweb!(0.5)).toBeCloseTo(0.7, 12);
    expect(cs[0].cobweb).toBeUndefined();
    expect(rowErrors('sequence', s.rows)[2][0]).toBeTruthy();
  });

  it('relation: parse with connectives, errors, enabled list', () => {
    const s = initCurveState('relation');
    s.rows[0] = { fields: ['X^2+Y^2\\le9'], on: true };
    s.rows[1] = { fields: ['\\operatorname{and}\\left(X<1,Y>0\\right)'], on: true };
    s.rows[2] = { fields: ['and(X<1,Y>0)'], on: true };
    s.rows[3] = { fields: ['X+Y'], on: true };
    s.rows[4] = { fields: ['Y>X'], on: false };
    expect(relations(s.rows).map((r) => r.name)).toEqual(['V1', 'V2', 'V3']);
    const errs = rowErrors('relation', s.rows).map((e) => e[0]);
    expect(errs.slice(0, 3)).toEqual([null, null, null]);
    expect(errs[3]).toBeTruthy();
    expect(parseRelation('')).toBeNull();
    const sc = relationScope({
      angle: 'rad',
      variables: new Map([
        ['X', 1],
        ['A', 2],
      ]),
    });
    expect([...sc.variables.keys()]).toEqual(['A']);
  });
});
