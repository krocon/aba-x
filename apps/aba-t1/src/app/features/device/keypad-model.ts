/**
 * The ABA-T1 keypad as data (prompts 025/026): position, main, shift and alpha legends of every
 * key. Layout and shift logic follow the operating concept of a touch graphing calculator (master
 * prompt ABA-T1 §2); look and colours are our own. Key ids are stable – actions refer to them.
 */

export type KeyGroup = 'app' | 'sys' | 'fn' | 'num' | 'mod' | 'enter';

export interface KeyDef {
  id: string;
  /** Legend on the key (also its accessible name unless `aria` is set). */
  main: string;
  /** Legend above the key in the shift colour. */
  shift?: string;
  /** Legend beside the key in the alpha colour (letters A–Z and a few characters). */
  alpha?: string;
  group: KeyGroup;
  /** Grid columns the key spans (Enter: 2). */
  span?: number;
  /** Accessible name when the legend is a symbol. */
  aria?: string;
}

/** Upper cluster around the rocker: app keys left, system keys right. */
export const TOP_LEFT: KeyDef[][] = [
  [
    { id: 'apps', main: 'Apps', shift: 'Info', group: 'app' },
    { id: 'symb', main: 'Symb', shift: 'Setup', group: 'app', aria: 'Symbolic view' },
  ],
  [
    { id: 'home', main: '⌂', shift: 'Settings', group: 'app', aria: 'Home' },
    { id: 'plot', main: 'Plot', shift: 'Setup', group: 'app', aria: 'Plot view' },
  ],
  [{ id: 'num', main: 'Num', shift: 'Setup', group: 'app', aria: 'Numeric view' }],
];

export const TOP_RIGHT: KeyDef[][] = [
  [
    { id: 'help', main: 'Help', shift: 'User', group: 'sys' },
    { id: 'esc', main: 'Esc', shift: 'Clear', group: 'sys', aria: 'Escape' },
  ],
  [
    { id: 'view', main: 'View', shift: 'Copy', group: 'sys' },
    { id: 'cas', main: 'CAS', shift: 'Settings', group: 'sys', aria: 'CAS view' },
  ],
  [{ id: 'menu', main: 'Menu', shift: 'Paste', group: 'sys' }],
];

/** Function block: six columns. */
export const FUNCTION_ROWS: KeyDef[][] = [
  [
    { id: 'vars', main: 'Vars', shift: 'Chars', alpha: 'A', group: 'fn' },
    { id: 'toolbox', main: 'Toolbox', shift: 'Mem', alpha: 'B', group: 'fn' },
    { id: 'template', main: '▢/√▢', shift: 'Units', alpha: 'C', group: 'fn', aria: 'Template' },
    { id: 'xtn', main: 'x,t,θ,n', shift: 'Define', alpha: 'D', group: 'fn', aria: 'Variable' },
    { id: 'frac', main: 'a b/c', shift: '° ′ ″', alpha: 'E', group: 'fn', aria: 'Fraction' },
    { id: 'bksp', main: '⌫', shift: 'Del', group: 'fn', aria: 'Backspace' },
  ],
  [
    { id: 'pow', main: 'xʸ', shift: 'ʸ√x', alpha: 'F', group: 'fn', aria: 'Power' },
    { id: 'sin', main: 'SIN', shift: 'ASIN', alpha: 'G', group: 'fn', aria: 'Sine' },
    { id: 'cos', main: 'COS', shift: 'ACOS', alpha: 'H', group: 'fn', aria: 'Cosine' },
    { id: 'tan', main: 'TAN', shift: 'ATAN', alpha: 'I', group: 'fn', aria: 'Tangent' },
    { id: 'ln', main: 'LN', shift: 'eˣ', alpha: 'J', group: 'fn', aria: 'Natural logarithm' },
    { id: 'log', main: 'LOG', shift: '10ˣ', alpha: 'K', group: 'fn', aria: 'Logarithm' },
  ],
  [
    { id: 'sq', main: 'x²', shift: '√', alpha: 'L', group: 'fn', aria: 'Square' },
    { id: 'neg', main: '+/−', shift: '|x|', alpha: 'M', group: 'fn', aria: 'Negate' },
    { id: 'paren', main: '( )', shift: '▢ₙ', alpha: 'N', group: 'fn', aria: 'Parentheses' },
    { id: 'comma', main: ',', shift: 'Eval', alpha: 'O', group: 'fn', aria: 'Comma' },
    { id: 'enter', main: 'Enter', shift: '≈', group: 'enter', span: 2 },
  ],
];

/** Number block: five columns, modifiers on the left. */
export const NUMBER_ROWS: KeyDef[][] = [
  [
    { id: 'eex', main: 'EEX', shift: 'Sto ▸', alpha: 'P', group: 'fn', aria: 'Exponent' },
    { id: 'd7', main: '7', shift: 'List', alpha: 'Q', group: 'num' },
    { id: 'd8', main: '8', shift: '{ }', alpha: 'R', group: 'num' },
    { id: 'd9', main: '9', shift: '!,∞,→', alpha: 'S', group: 'num' },
    { id: 'div', main: '÷', shift: 'x⁻¹', alpha: 'T', group: 'num', aria: 'Divide' },
  ],
  [
    { id: 'alpha', main: 'α', shift: 'a…z', group: 'mod', aria: 'Alpha' },
    { id: 'd4', main: '4', shift: 'Matrix', alpha: 'U', group: 'num' },
    { id: 'd5', main: '5', shift: '[ ]', alpha: 'V', group: 'num' },
    { id: 'd6', main: '6', shift: '≤≥≠', alpha: 'W', group: 'num' },
    { id: 'mul', main: '×', shift: '∠', alpha: 'X', group: 'num', aria: 'Multiply' },
  ],
  [
    { id: 'shift', main: '⇧', group: 'mod', aria: 'Shift' },
    { id: 'd1', main: '1', shift: 'Program', alpha: 'Y', group: 'num' },
    { id: 'd2', main: '2', shift: 'i', alpha: 'Z', group: 'num' },
    { id: 'd3', main: '3', shift: 'π', alpha: '#', group: 'num' },
    { id: 'sub', main: '−', shift: 'Base', alpha: ':', group: 'num', aria: 'Subtract' },
  ],
  [
    { id: 'on', main: 'On', shift: 'Off', group: 'sys', aria: 'On / cancel' },
    { id: 'd0', main: '0', shift: 'Notes', alpha: '"', group: 'num' },
    { id: 'dot', main: '.', shift: '=', group: 'num', aria: 'Decimal point' },
    { id: 'space', main: '␣', shift: '_', group: 'num', aria: 'Space' },
    { id: 'add', main: '+', shift: 'Ans', alpha: ';', group: 'num', aria: 'Add' },
  ],
];

/** Every key once (tests, keymaps). */
export function allKeys(): KeyDef[] {
  return [TOP_LEFT, TOP_RIGHT, FUNCTION_ROWS, NUMBER_ROWS].flat(2);
}

export function keyById(id: string): KeyDef | undefined {
  return allKeys().find((k) => k.id === id);
}
