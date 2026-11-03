import { type DataSource, initInference, runInference } from './inference-logic';

const none: DataSource = { list: () => null, matrix: () => null };

describe('inference app logic', () => {
  it('one-sample T test: statistic, P, decision, plot', () => {
    const s = initInference();
    s.inputs = { ...s.inputs, mean: 3, s: Math.sqrt(2.5), n: 5, mu0: 0 };
    const r = runInference(s, none);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const get = (n: string) => r.value.rows.find((x) => x.name === n)?.value;
    expect(get('T')).toBeCloseTo(4.242640687, 8);
    expect(get('P')).toBeCloseTo(0.013236, 5);
    expect(get('Result')).toBe('@reject');
    expect(r.value.plot.dist).toBe('t');
    expect(r.value.plot.df).toBe(4);
  });

  it('interval and χ² from lists, errors as values', () => {
    const s = initInference();
    s.method = 'zint1';
    s.inputs = { ...s.inputs, mean: 10, sigma: 2, n: 25, level: 0.95 };
    const r = runInference(s, none);
    expect(r.ok && r.value.rows[0].value).toBeCloseTo(10 - 1.959963985 * 0.4, 8);
    s.method = 'chiGof';
    expect(runInference(s, none).ok).toBe(false);
    const data: DataSource = {
      list: (d) =>
        d === 1 ? [315, 108, 101, 32] : d === 2 ? [9 / 16, 3 / 16, 3 / 16, 1 / 16] : null,
      matrix: () => null,
    };
    const c = runInference({ ...s, inputs: { ...s.inputs, obs: 1, exp: 2 } }, data);
    expect(c.ok && c.value.rows.find((x) => x.name === 'χ²')?.value).toBeCloseTo(0.47, 2);
  });
});
