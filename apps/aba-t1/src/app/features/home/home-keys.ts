/**
 * What a device key does in the home entry line (prompt 027), pure. Textbook entry inserts LaTeX
 * templates (MathLive: `#0` = selection/placeholder, `#@` = the expression before the caret,
 * `#?` = further placeholders); algebraic entry inserts plain text.
 */
import type { KeyPress } from '../../core/actions/shift-alpha';
import { STO_LATEX, STO_TEXT } from './home-logic';

export type EditAction =
  | { kind: 'insert'; latex: string; text: string }
  | { kind: 'command'; command: 'deleteBackward' | 'deleteForward' }
  | { kind: 'enter' }
  | { kind: 'clear' }
  | { kind: 'clearHistory' }
  | { kind: 'templates' }
  | { kind: 'cancel' };

const ins = (latex: string, text = latex): EditAction => ({ kind: 'insert', latex, text });
const fn = (latexName: string, textName: string) =>
  ins(`\\${latexName}\\left(#0\\right)`, `${textName}(`);

const MAIN: Record<string, EditAction> = {
  dot: ins('.'),
  add: ins('+'),
  sub: ins('-'),
  mul: ins('\\times', '*'),
  div: ins('\\frac{#@}{#?}', '/'),
  pow: ins('#@^{#?}', '^'),
  sq: ins('#@^{2}', '^2'),
  sin: fn('sin', 'sin'),
  cos: fn('cos', 'cos'),
  tan: fn('tan', 'tan'),
  ln: fn('ln', 'ln'),
  log: fn('log', 'log'),
  neg: ins('-'),
  paren: ins('\\left(#0\\right)', '('),
  comma: ins(','),
  eex: ins('\\times10^{#?}', '*10^('),
  space: ins('\\,', ' '),
  xtn: ins('X'),
  bksp: { kind: 'command', command: 'deleteBackward' },
  esc: { kind: 'clear' },
  enter: { kind: 'enter' },
  template: { kind: 'templates' },
  on: { kind: 'cancel' },
};

const SHIFT: Record<string, EditAction> = {
  pow: ins('\\sqrt[#?]{#0}', 'root('),
  sq: ins('\\sqrt{#0}', 'sqrt('),
  sin: fn('arcsin', 'asin'),
  cos: fn('arccos', 'acos'),
  tan: fn('arctan', 'atan'),
  ln: ins('e^{#0}', 'e^('),
  log: ins('10^{#0}', '10^('),
  neg: ins('\\left|#0\\right|', 'abs('),
  eex: ins(STO_LATEX, STO_TEXT),
  dot: ins('='),
  d2: ins('i'),
  d3: ins('\\pi', 'pi'),
  d6: ins('\\le', '<='),
  d9: ins('!'),
  div: ins('#@^{-1}', '^-1'),
  add: ins('\\mathrm{Ans}', 'Ans'),
  bksp: { kind: 'command', command: 'deleteForward' },
  esc: { kind: 'clearHistory' },
  enter: { kind: 'enter' },
};

export function editFor(p: KeyPress): EditAction | null {
  if (p.layer === 'alpha') return p.char ? ins(p.char) : null;
  if (p.layer === 'main' && /^d\d$/.test(p.id)) return ins(p.id.slice(1));
  return (p.layer === 'shift' ? SHIFT : MAIN)[p.id] ?? null;
}
