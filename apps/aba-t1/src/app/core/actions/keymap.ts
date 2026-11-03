/**
 * Hardware keyboard of ABA-T1 (prompt 026). Two parts:
 * - chords (capture phase, `ActionDispatcher`): F-keys and Alt/Mod combinations for the keys that
 *   have no counterpart on a PC keyboard (Apps, Symb, Plot, Num, CAS, Menu, …), the same on every OS
 *   except `Mod` = ⌘/Ctrl;
 * - characters (bubble phase, only when no text field has the focus): digits, operators, Enter,
 *   Backspace, Esc, arrows and letters press the matching device key.
 */
import type { Chord, Keymap as KeymapOf, Os } from '@aba/core/actions/chords';
import type { Layer } from './shift-alpha';

/** `<key id>` or `<key id>.shift`, `menu1`…`menu6` (`.shift`), and app-level actions. */
export type T1Action = string;
export type Keymap = KeymapOf<T1Action>;

export interface ChordBinding {
  action: T1Action;
  chord: Chord;
  /** shown in the keyboard overview */
  title: string;
}

const key = (id: string, chord: Chord, title: string, shiftTitle?: string): ChordBinding[] => [
  { action: id, chord, title },
  ...(shiftTitle
    ? [{ action: `${id}.shift`, chord: { ...chord, shift: true }, title: shiftTitle }]
    : []),
];

export const CHORDS: readonly ChordBinding[] = [
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [
    { action: `menu${n}`, chord: { key: `F${n}` }, title: `Menu button ${n}` },
  ]),
  ...key('symb', { key: 'F7' }, 'Symbolic view', 'Symbolic setup'),
  ...key('plot', { key: 'F8' }, 'Plot view', 'Plot setup'),
  ...key('num', { key: 'F9' }, 'Numeric view', 'Numeric setup'),
  ...key('help', { key: 'F10' }, 'Help', 'User keys'),
  ...key('apps', { alt: true, key: 'A' }, 'Apps', 'App info'),
  ...key('home', { alt: true, key: 'H' }, 'Home', 'Home settings'),
  ...key('cas', { alt: true, key: 'K' }, 'CAS', 'CAS settings'),
  ...key('menu', { alt: true, key: 'M' }, 'Menu'),
  ...key('view', { alt: true, key: 'W' }, 'View'),
  ...key('toolbox', { alt: true, key: 'T' }, 'Toolbox', 'Memory'),
  ...key('vars', { alt: true, key: 'V' }, 'Variables', 'Characters'),
  ...key('template', { alt: true, key: 'P' }, 'Templates', 'Units'),
  ...key('xtn', { alt: true, key: 'X' }, 'x, t, θ, n', 'Define'),
  { action: 'view.shift', chord: { mod: true, shift: true, key: 'C' }, title: 'Copy' },
  { action: 'menu.shift', chord: { mod: true, shift: true, key: 'V' }, title: 'Paste' },
  { action: 'shift', chord: { alt: true, key: 'S' }, title: 'Shift' },
  { action: 'alpha', chord: { alt: true, key: 'L' }, title: 'Alpha' },
  { action: 'on', chord: { alt: true, key: 'O' }, title: 'On / cancel' },
  { action: 'on.shift', chord: { alt: true, shift: true, key: 'O' }, title: 'Off' },
  { action: 'shortcuts', chord: { mod: true, key: '/' }, title: 'Keyboard shortcuts' },
];

export function keymapFor(os: Os): Keymap {
  void os;
  return CHORDS;
}

/** Splits an action into key id and layer (`sin.shift` → sin, shift). */
export function keyOfAction(action: T1Action): { id: string; layer: Layer } {
  return action.endsWith('.shift')
    ? { id: action.slice(0, -'.shift'.length), layer: 'shift' }
    : { id: action, layer: 'main' };
}

const CHARS: Record<string, string> = {
  '+': 'add',
  '-': 'sub',
  '*': 'mul',
  '/': 'div',
  '^': 'pow',
  '(': 'paren',
  ')': 'paren',
  ',': 'comma',
  '.': 'dot',
  ' ': 'space',
  Enter: 'enter',
  Backspace: 'bksp',
  Escape: 'esc',
};

const ROCKER: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export type Physical =
  | { kind: 'key'; id: string; layer: Layer; char?: string }
  | { kind: 'rocker'; dir: 'up' | 'down' | 'left' | 'right'; shift: boolean };

/** A plain key (no Ctrl/⌘/Alt) of the PC keyboard → device key; null if it has none. */
export function physicalKey(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): Physical | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (ROCKER[e.key]) return { kind: 'rocker', dir: ROCKER[e.key], shift: e.shiftKey };
  if (/^[0-9]$/.test(e.key)) return { kind: 'key', id: `d${e.key}`, layer: 'main' };
  if (e.key === 'Delete') return { kind: 'key', id: 'bksp', layer: 'shift' };
  if (e.key === 'Escape' && e.shiftKey) return { kind: 'key', id: 'esc', layer: 'shift' };
  if (CHARS[e.key]) return { kind: 'key', id: CHARS[e.key], layer: 'main' };
  if (/^[a-zA-Z]$/.test(e.key)) return { kind: 'key', id: `letter`, layer: 'alpha', char: e.key };
  return null;
}
