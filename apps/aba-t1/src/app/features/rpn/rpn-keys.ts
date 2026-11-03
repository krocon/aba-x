/**
 * Device keys in RPN entry (prompt 028), pure: operators and functions act on the stack at once
 * (a non-empty entry line is pushed first), everything else edits the line like in the home view.
 */
import type { Expr } from '@aba/math/ast/nodes';
import type { Operation } from '@aba/math/rpn/rpn-stack';
import type { KeyPress } from '../../core/actions/shift-alpha';
import { type EditAction, editFor } from '../home/home-keys';

export type RpnAction =
  | { kind: 'op'; op: Operation }
  | { kind: 'enter' }
  | { kind: 'backspace' }
  | { kind: 'sto' }
  | { kind: 'clearStack' }
  | { kind: 'edit'; edit: EditAction };

const num = (v: string): Expr => ({ type: 'num', value: v });
const call = (name: string, arity = 1): RpnAction => ({
  kind: 'op',
  op: { kind: 'call', name, arity },
});
const bin = (op: '+' | '-' | '*' | '/' | '^'): RpnAction => ({
  kind: 'op',
  op: { kind: 'binary', op },
});
const expr = (build: (a: Expr[]) => Expr): RpnAction => ({
  kind: 'op',
  op: { kind: 'expr', arity: 1, build },
});

const MAIN: Record<string, RpnAction> = {
  add: bin('+'),
  sub: bin('-'),
  mul: bin('*'),
  div: bin('/'),
  pow: bin('^'),
  sq: expr(([x]) => ({ type: 'bin', op: '^', left: x, right: num('2') })),
  sin: call('sin'),
  cos: call('cos'),
  tan: call('tan'),
  ln: call('ln'),
  log: call('log'),
  neg: { kind: 'op', op: { kind: 'neg' } },
  enter: { kind: 'enter' },
  bksp: { kind: 'backspace' },
};

const SHIFT: Record<string, RpnAction> = {
  pow: call('root', 2),
  sq: call('sqrt'),
  sin: call('arcsin'),
  cos: call('arccos'),
  tan: call('arctan'),
  ln: call('exp'),
  log: expr(([x]) => ({ type: 'bin', op: '^', left: num('10'), right: x })),
  neg: call('abs'),
  div: expr(([x]) => ({ type: 'bin', op: '/', left: num('1'), right: x })),
  d9: { kind: 'op', op: { kind: 'post', op: '!' } },
  eex: { kind: 'sto' },
  esc: { kind: 'clearStack' },
  enter: { kind: 'enter' },
};

export function rpnActionFor(p: KeyPress): RpnAction | null {
  if (p.layer !== 'alpha') {
    const a = (p.layer === 'shift' ? SHIFT : MAIN)[p.id];
    if (a) return a;
  }
  const edit = editFor(p);
  return edit ? { kind: 'edit', edit } : null;
}
