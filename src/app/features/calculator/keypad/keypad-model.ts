/**
 * The ABA-X1 keypad: layout, shifted functions and what each key does. Pure data + functions,
 * no Angular. Look and feel follow classic graphing calculators (shift labels above the keys,
 * left shift violet, right shift teal), the key assignment is ABA-X1's own.
 */

export type Shift = 'none' | 'left' | 'right';

/** MathLive commands the keypad uses (subset of MathLive's selectors). */
export type EditCommand =
  | 'deleteBackward'
  | 'deleteForward'
  | 'deleteAll'
  | 'moveToPreviousChar'
  | 'moveToNextChar'
  | 'moveUp'
  | 'moveDown'
  | 'undo'
  | 'redo';

export type KeyAction =
  | { kind: 'insert'; latex: string }
  | { kind: 'command'; command: EditCommand }
  | { kind: 'enter' }
  | { kind: 'clear' }
  | { kind: 'shift'; shift: 'left' | 'right' }
  | { kind: 'alpha' }
  | { kind: 'stack'; op: 'drop' | 'swap' | 'recall' }
  /** Planned function – the key shows it, pressing it says "not available yet". */
  | { kind: 'planned'; what: string };

export interface ShiftedFunction {
  label: string;
  action: KeyAction;
}

export type KeyVariant = 'fn' | 'digit' | 'op' | 'enter' | 'shift-left' | 'shift-right' | 'alpha';

export interface KeyDef {
  id: string;
  label: string;
  /** Accessible name when the label is a symbol. */
  name: string;
  action: KeyAction;
  left?: ShiftedFunction;
  right?: ShiftedFunction;
  /** Letter for alpha entry, printed at the lower right of the key. */
  alpha?: string;
  variant: KeyVariant;
  /** Columns the key spans (ENTER). */
  span?: number;
}

const ins = (latex: string): KeyAction => ({ kind: 'insert', latex });
const cmd = (command: EditCommand): KeyAction => ({ kind: 'command', command });
const planned = (what: string): KeyAction => ({ kind: 'planned', what });
const fn = (label: string, action: KeyAction): ShiftedFunction => ({ label, action });

/** Upper block: six columns of function keys. */
export const FUNCTION_ROWS: readonly (readonly KeyDef[])[] = [
  [
    {
      id: 'sto',
      label: 'STO',
      name: 'Store',
      action: planned('STO'),
      left: fn('RCL', planned('RCL')),
      alpha: 'A',
      variant: 'fn',
    },
    {
      id: 'const',
      label: 'π',
      name: 'Pi',
      action: ins('\\pi'),
      left: fn('e', ins('e')),
      right: fn('i', ins('i')),
      alpha: 'B',
      variant: 'fn',
    },
    {
      id: 'var-x',
      label: 'x',
      name: 'Variable x',
      action: ins('x'),
      left: fn('y', ins('y')),
      right: fn('t', ins('t')),
      alpha: 'C',
      variant: 'fn',
    },
    {
      id: 'comma',
      label: ',',
      name: 'Comma',
      action: ins(','),
      left: fn('=', ins('=')),
      right: fn('<', ins('<')),
      alpha: 'D',
      variant: 'fn',
    },
    {
      id: 'up',
      label: '▲',
      name: 'Up',
      action: cmd('moveUp'),
      left: fn('RECALL', { kind: 'stack', op: 'recall' }),
      alpha: 'E',
      variant: 'fn',
    },
    {
      id: 'undo',
      label: 'UNDO',
      name: 'Undo',
      action: cmd('undo'),
      left: fn('REDO', cmd('redo')),
      alpha: 'F',
      variant: 'fn',
    },
  ],
  [
    {
      id: 'paren-open',
      label: '(',
      name: 'Open parenthesis',
      action: ins('('),
      left: fn('[', ins('\\left[#0\\right]')),
      alpha: 'G',
      variant: 'fn',
    },
    {
      id: 'paren-close',
      label: ')',
      name: 'Close parenthesis',
      action: ins(')'),
      left: fn(',', ins(',')),
      alpha: 'H',
      variant: 'fn',
    },
    {
      id: 'abs',
      label: '|x|',
      name: 'Absolute value',
      action: ins('\\left|#0\\right|'),
      left: fn('n!', ins('!')),
      right: fn('%', ins('\\%')),
      alpha: 'I',
      variant: 'fn',
    },
    {
      id: 'left',
      label: '◀',
      name: 'Left',
      action: cmd('moveToPreviousChar'),
      left: fn('SWAP', { kind: 'stack', op: 'swap' }),
      alpha: 'J',
      variant: 'fn',
    },
    {
      id: 'down',
      label: '▼',
      name: 'Down',
      action: cmd('moveDown'),
      alpha: 'K',
      variant: 'fn',
    },
    {
      id: 'right',
      label: '▶',
      name: 'Right',
      action: cmd('moveToNextChar'),
      alpha: 'L',
      variant: 'fn',
    },
  ],
  [
    {
      id: 'sin',
      label: 'SIN',
      name: 'Sine',
      action: ins('\\sin(#0)'),
      left: fn('ASIN', ins('\\arcsin(#0)')),
      right: fn('SINH', ins('\\sinh(#0)')),
      alpha: 'M',
      variant: 'fn',
    },
    {
      id: 'cos',
      label: 'COS',
      name: 'Cosine',
      action: ins('\\cos(#0)'),
      left: fn('ACOS', ins('\\arccos(#0)')),
      right: fn('COSH', ins('\\cosh(#0)')),
      alpha: 'N',
      variant: 'fn',
    },
    {
      id: 'tan',
      label: 'TAN',
      name: 'Tangent',
      action: ins('\\tan(#0)'),
      left: fn('ATAN', ins('\\arctan(#0)')),
      right: fn('TANH', ins('\\tanh(#0)')),
      alpha: 'O',
      variant: 'fn',
    },
    {
      id: 'sqrt',
      label: '√x',
      name: 'Square root',
      action: ins('\\sqrt{#0}'),
      left: fn('x²', ins('^2')),
      right: fn('ⁿ√x', ins('\\sqrt[#?]{#0}')),
      alpha: 'P',
      variant: 'fn',
    },
    {
      id: 'pow',
      label: 'yˣ',
      name: 'Power',
      action: ins('^{#0}'),
      left: fn('10ˣ', ins('10^{#0}')),
      right: fn('eˣ', ins('e^{#0}')),
      alpha: 'Q',
      variant: 'fn',
    },
    {
      id: 'inv',
      label: '1/x',
      name: 'Reciprocal',
      action: ins('\\frac{1}{#0}'),
      left: fn('LOG', ins('\\log_{10}(#0)')),
      right: fn('LN', ins('\\ln(#0)')),
      alpha: 'R',
      variant: 'fn',
    },
  ],
  [
    {
      id: 'enter',
      label: 'ENTER',
      name: 'Enter',
      action: { kind: 'enter' },
      left: fn('ANS', ins('\\mathrm{Ans}')),
      variant: 'enter',
      span: 2,
    },
    {
      id: 'neg',
      label: '+/−',
      name: 'Change sign',
      action: ins('-'),
      alpha: 'S',
      variant: 'fn',
    },
    {
      id: 'eex',
      label: 'EEX',
      name: 'Exponent of ten',
      action: ins('\\cdot10^{#0}'),
      left: fn('logₐ', ins('\\log_{#?}(#0)')),
      alpha: 'T',
      variant: 'fn',
    },
    {
      id: 'del',
      label: 'DEL',
      name: 'Delete forward',
      action: cmd('deleteForward'),
      left: fn('CLEAR', { kind: 'clear' }),
      alpha: 'U',
      variant: 'fn',
    },
    {
      id: 'bksp',
      label: '⌫',
      name: 'Backspace',
      action: cmd('deleteBackward'),
      left: fn('DROP', { kind: 'stack', op: 'drop' }),
      variant: 'fn',
    },
  ],
];

/** Lower block: five columns, shift keys on the left, digits in the middle, operators right. */
export const NUMBER_ROWS: readonly (readonly KeyDef[])[] = [
  [
    { id: 'alpha', label: 'α', name: 'Alpha', action: { kind: 'alpha' }, variant: 'alpha' },
    {
      id: 'd7',
      label: '7',
      name: '7',
      action: ins('7'),
      left: fn('∫', ins('\\int_{#?}^{#?}#0\\,dx')),
      right: fn('d/dx', ins('\\frac{d}{dx}#0')),
      alpha: 'V',
      variant: 'digit',
    },
    {
      id: 'd8',
      label: '8',
      name: '8',
      action: ins('8'),
      left: fn('Σ', ins('\\sum_{k=1}^{#?}#0')),
      right: fn('Π', ins('\\prod_{k=1}^{#?}#0')),
      alpha: 'W',
      variant: 'digit',
    },
    {
      id: 'd9',
      label: '9',
      name: '9',
      action: ins('9'),
      left: fn('lim', ins('\\lim_{x\\to#?}#0')),
      right: fn('SOLVE', planned('SOLVE')),
      alpha: 'X',
      variant: 'digit',
    },
    {
      id: 'div',
      label: '÷',
      name: 'Divide',
      action: ins('\\frac{#@}{#?}'),
      left: fn('a/b', ins('\\frac{#0}{#?}')),
      alpha: 'Y',
      variant: 'op',
    },
  ],
  [
    {
      id: 'shift-left',
      label: '◀⇧',
      name: 'Left shift',
      action: { kind: 'shift', shift: 'left' },
      variant: 'shift-left',
    },
    {
      id: 'd4',
      label: '4',
      name: '4',
      action: ins('4'),
      left: fn('MAT', ins('\\begin{pmatrix}#0 & #? \\\\ #? & #?\\end{pmatrix}')),
      right: fn('VEC', ins('\\begin{pmatrix}#0 \\\\ #?\\end{pmatrix}')),
      alpha: 'Z',
      variant: 'digit',
    },
    { id: 'd5', label: '5', name: '5', action: ins('5'), variant: 'digit' },
    { id: 'd6', label: '6', name: '6', action: ins('6'), variant: 'digit' },
    { id: 'mul', label: '×', name: 'Multiply', action: ins('\\cdot'), variant: 'op' },
  ],
  [
    {
      id: 'shift-right',
      label: '⇧▶',
      name: 'Right shift',
      action: { kind: 'shift', shift: 'right' },
      variant: 'shift-right',
    },
    { id: 'd1', label: '1', name: '1', action: ins('1'), variant: 'digit' },
    { id: 'd2', label: '2', name: '2', action: ins('2'), variant: 'digit' },
    { id: 'd3', label: '3', name: '3', action: ins('3'), variant: 'digit' },
    { id: 'sub', label: '−', name: 'Subtract', action: ins('-'), variant: 'op' },
  ],
  [
    {
      id: 'on',
      label: 'ON',
      name: 'Clear line',
      action: { kind: 'clear' },
      variant: 'alpha',
    },
    { id: 'd0', label: '0', name: '0', action: ins('0'), variant: 'digit' },
    { id: 'dot', label: '.', name: 'Decimal point', action: ins('.'), variant: 'digit' },
    {
      id: 'spc',
      label: 'SPC',
      name: 'Space',
      action: ins('\\,'),
      left: fn('°', ins('^{\\circ}')),
      variant: 'digit',
    },
    { id: 'add', label: '+', name: 'Add', action: ins('+'), variant: 'op' },
  ],
];

export const ALL_KEYS: readonly KeyDef[] = [...FUNCTION_ROWS, ...NUMBER_ROWS].flat();

/** What a key does under the current shift state (no shifted function → the plain action). */
export function resolveKey(key: KeyDef, shift: Shift): KeyAction {
  if (shift === 'left' && key.left) return key.left.action;
  if (shift === 'right' && key.right) return key.right.action;
  return key.action;
}

/**
 * Shift is a one-shot modifier like on a calculator: pressing it arms it, pressing the same
 * shift again disarms it, the other shift switches; any other key consumes it.
 */
export function nextShift(current: Shift, pressed: KeyAction): Shift {
  if (pressed.kind !== 'shift') return 'none';
  return current === pressed.shift ? 'none' : pressed.shift;
}

/**
 * The virtual key that corresponds to a key of the hardware keyboard – only to light it up
 * as feedback; the typing itself is handled by the math field.
 */
export function keyIdForPhysical(key: string): string | null {
  if (/^[0-9]$/.test(key)) return `d${key}`;
  const map: Record<string, string> = {
    '+': 'add',
    '-': 'sub',
    '*': 'mul',
    '/': 'div',
    '.': 'dot',
    ',': 'comma',
    '^': 'pow',
    '(': 'paren-open',
    ')': 'paren-close',
    '|': 'abs',
    Enter: 'enter',
    Backspace: 'bksp',
    Delete: 'del',
    Escape: 'on',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ' ': 'spc',
    x: 'var-x',
  };
  return map[key] ?? null;
}

/** F1–F6 → index of the softkey, otherwise -1. */
export function softkeyIndexForPhysical(key: string): number {
  const m = /^F([1-6])$/.exec(key);
  return m ? Number(m[1]) - 1 : -1;
}
