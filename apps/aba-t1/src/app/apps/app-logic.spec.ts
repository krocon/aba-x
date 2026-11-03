import type { AppDef, AppInstance } from './app-contract';
import { builtIn, remove, reset, restore, saveCopy, sorted } from './app-logic';

const def = (id: string, version = 1): AppDef => ({
  id,
  title: { en: id, de: id },
  icon: '',
  init: () => ({ n: 0 }),
  version,
  start: 'symb',
  views: {},
});

describe('app library logic', () => {
  const defs = [def('function'), def('polar', 2)];

  it('restores stored apps: built-ins present, unknown dropped, old states reset', () => {
    const stored: AppInstance[] = [
      { ...builtIn(defs[0], 'en'), state: { n: 5 } },
      { ...builtIn(defs[1], 'en'), version: 1, state: { n: 7 } },
      { ...builtIn(def('gone'), 'en') },
    ];
    const r = restore(stored, defs, 'en');
    expect(r.map((i) => i.id)).toEqual(['function', 'polar']);
    expect(r[0].state).toEqual({ n: 5 });
    expect(r[1].state).toEqual({ n: 0 });
    expect(restore(undefined, defs, 'de').length).toBe(2);
  });

  it('saves copies under unique names, resets and deletes only copies', () => {
    const list = restore([], defs, 'en');
    const withCopy = saveCopy(list, 'function', 'Parabola') as AppInstance[];
    expect(withCopy.length).toBe(3);
    expect(saveCopy(withCopy, 'function', 'parabola')).toMatch(/exists/);
    expect(saveCopy(withCopy, 'function', ' ')).toMatch(/name/);
    const copy = withCopy[2];
    expect(copy.copy).toBe(true);
    const changed = withCopy.map((i) => (i.id === copy.id ? { ...i, state: { n: 9 } } : i));
    expect(reset(changed, copy.id, defs).find((i) => i.id === copy.id)?.state).toEqual({ n: 0 });
    expect(remove(withCopy, 'function').length).toBe(3);
    expect(remove(withCopy, copy.id).length).toBe(2);
  });

  it('sorts by name or by last use', () => {
    const list = restore([], defs, 'en').map((i, k) => ({ ...i, used: k }));
    expect(sorted(list, 'used', defs).map((i) => i.id)).toEqual(['polar', 'function']);
    expect(sorted(list, 'alpha', defs).map((i) => i.id)).toEqual(['function', 'polar']);
  });
});
