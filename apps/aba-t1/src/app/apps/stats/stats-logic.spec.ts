import { chart1, data1, fit2, initStats1, stats1Rows, stemLeaf } from './stats-logic';

describe('statistics apps logic', () => {
  it('1 Var: data with frequencies, statistics rows', () => {
    const s = initStats1();
    s.cols[0] = [1, 2, 3, 4];
    s.cols[1] = [1, 1, 2];
    expect(data1(s, { data: 0, freq: 1, plot: 'box' }).ok).toBe(false);
    s.cols[1] = [1, 1, 2, 0];
    const d = data1(s, { data: 0, freq: 1, plot: 'box' });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    const rows = stats1Rows(d.value.x, d.value.f);
    expect(rows.ok && rows.value.find((r) => r.name === 'n')?.value).toBe(4);
    expect(rows.ok && rows.value.find((r) => r.name === 'x̄')?.value).toBe(2.25);
  });

  it('charts: histogram classes, box five numbers, pareto percent, pie wedges', () => {
    const x = [1, 2, 2, 3, 3, 3, 9];
    const h = chart1('histogram', x, undefined, '#000', 0, { start: 0, width: 2 });
    expect(h.ok && h.value.trace.map((t) => t.y)).toEqual([1, 5, 0, 0, 1]);
    const b = chart1('box', x, undefined, '#000', 0, null);
    expect(b.ok && b.value.trace.map((t) => t.x)).toEqual([1, 2, 3, 3, 9]);
    const p = chart1('pareto', [1, 3], undefined, '#000', 0, null);
    expect(p.ok && p.value.trace.map((t) => t.y)).toEqual([75, 25]);
    const pie = chart1('pie', [1, 1], undefined, '#000', 0, null);
    expect(pie.ok && pie.value.pie).toBe(true);
    expect(chart1('pie', [-1, 1], undefined, '#000', 0, null).ok).toBe(false);
  });

  it('stem and leaf', () => {
    const r = stemLeaf([12, 15, 21, 27, 27, 33]);
    expect(r.ok && r.value.slice(0, 3)).toEqual(['1 | 2 5', '2 | 1 7 7', '3 | 3']);
  });

  it('2 Var: linear fit', () => {
    const f = fit2([1, 2, 3, 4], [3, 5, 7, 9], 'linear');
    expect(f.ok && f.value.f(10)).toBeCloseTo(21, 10);
  });
});
