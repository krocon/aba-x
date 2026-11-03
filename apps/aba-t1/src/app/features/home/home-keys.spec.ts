import { editFor } from './home-keys';

describe('home keys', () => {
  it('maps digits, functions and shift functions', () => {
    expect(editFor({ id: 'd7', layer: 'main' })).toEqual({ kind: 'insert', latex: '7', text: '7' });
    expect(editFor({ id: 'sin', layer: 'shift' })).toMatchObject({ text: 'asin(' });
    expect(editFor({ id: 'eex', layer: 'shift' })).toMatchObject({ text: '▶' });
    expect(editFor({ id: 'sin', layer: 'alpha', char: 'g' })).toMatchObject({ latex: 'g' });
    expect(editFor({ id: 'enter', layer: 'main' })).toEqual({ kind: 'enter' });
    expect(editFor({ id: 'esc', layer: 'shift' })).toEqual({ kind: 'clearHistory' });
  });

  it('leaves navigation keys to the app', () => {
    for (const id of ['apps', 'home', 'cas', 'symb', 'vars', 'toolbox', 'menu']) {
      expect(editFor({ id, layer: 'main' })).toBeNull();
    }
  });
});
