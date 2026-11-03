import { parseText } from '@aba/math/parser/text-parser';
import { functionsDoc, loadFunctions, loadVariables, variablesDoc, varsMenu } from './vars-logic';

const p = (s: string) => {
  const r = parseText(s, { functions: new Set(['f']) });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('vars-logic', () => {
  it('round-trips variables and functions through their documents', () => {
    const vars = new Map([['a', p('2*sqrt(2)')]]);
    const fns = new Map([['f', { params: ['x'], body: p('x^2 + f(1)') }]]);
    expect(loadVariables(variablesDoc(vars)).map).toEqual(vars);
    expect(loadFunctions(functionsDoc(fns)).map).toEqual(fns);
  });

  it('skips broken items and never overwrites newer documents', () => {
    const r = loadVariables({
      schemaVersion: 2,
      items: [{ name: 'a', value: '1' }, { name: 'pi', value: '3' }, { name: 'b', value: '(' }, 7],
    });
    expect([...r.map.keys()]).toEqual(['a']);
    expect(r.skipped).toBe(3);
    expect(r.readOnly).toBe(true);
    expect(loadFunctions(null).map.size).toBe(0);
  });

  it('builds the VARS menu with NXT pages and EXIT last', () => {
    expect(
      varsMenu(['b', 'a'], [{ name: 'f', arity: 1 }], 0).map((e) =>
        e.kind === 'var' || e.kind === 'fn' ? e.name : e.kind,
      ),
    ).toEqual(['a', 'b', 'f', 'exit']);
    const many = ['a', 'b', 'c', 'd', 'e', 'g'];
    const names = (page: number) =>
      varsMenu(many, [], page).map((e) => ('name' in e ? e.name : e.kind));
    expect(names(0)).toEqual(['a', 'b', 'c', 'd', 'next', 'exit']);
    expect(names(1)).toEqual(['e', 'g', 'next', 'exit']);
    expect(names(2)).toEqual(names(0));
  });
});
