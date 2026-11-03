import { rpnActionFor } from './rpn-keys';

describe('RPN keys', () => {
  it('operators act on the stack, digits edit the line', () => {
    expect(rpnActionFor({ id: 'add', layer: 'main' })).toEqual({
      kind: 'op',
      op: { kind: 'binary', op: '+' },
    });
    expect(rpnActionFor({ id: 'sq', layer: 'shift' })).toEqual({
      kind: 'op',
      op: { kind: 'call', name: 'sqrt', arity: 1 },
    });
    expect(rpnActionFor({ id: 'd7', layer: 'main' })).toMatchObject({
      kind: 'edit',
      edit: { kind: 'insert', text: '7' },
    });
    expect(rpnActionFor({ id: 'sin', layer: 'alpha', char: 'G' })).toMatchObject({ kind: 'edit' });
    expect(rpnActionFor({ id: 'eex', layer: 'shift' })).toEqual({ kind: 'sto' });
    expect(rpnActionFor({ id: 'apps', layer: 'main' })).toBeNull();
  });
});
