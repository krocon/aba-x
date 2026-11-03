/**
 * Keyboard shortcuts of ABA-X1 (prompt 007): the actions and the default keymap. Chord matching and
 * formatting are shared (`@aba/core/actions/chords`, prompt 026).
 */
import type { Keymap as KeymapOf, Os } from '@aba/core/actions/chords';

export {
  accelerator,
  detectOs,
  formatChord,
  matches,
  resolve,
  type Chord,
  type KeyLike,
  type Os,
} from '@aba/core/actions/chords';

export type ActionId =
  | 'softkey1'
  | 'softkey2'
  | 'softkey3'
  | 'softkey4'
  | 'softkey5'
  | 'softkey6'
  | 'toNumber'
  | 'toggleAngle'
  | 'toggleApprox'
  | 'drop'
  | 'swap'
  | 'clearStack'
  | 'shortcuts'
  | 'copyResult'
  | 'exportData'
  | 'importData'
  | 'about'
  | 'settings'
  | 'history'
  | 'vars'
  | 'modeStandard'
  | 'modeCas'
  | 'modeGraph'
  | 'toggleFullSize';

export interface ActionInfo {
  readonly id: ActionId;
  readonly title: string;
}

export const ACTIONS: readonly ActionInfo[] = [
  { id: 'softkey1', title: 'Softkey 1 (Standard)' },
  { id: 'softkey2', title: 'Softkey 2 (CAS)' },
  { id: 'softkey3', title: 'Softkey 3 (Graph)' },
  { id: 'softkey4', title: 'Softkey 4 (VARS)' },
  { id: 'softkey5', title: 'Softkey 5' },
  { id: 'softkey6', title: 'Softkey 6' },
  { id: 'toNumber', title: '→NUM: decimal value' },
  { id: 'toggleAngle', title: 'Radians / degrees' },
  { id: 'toggleApprox', title: 'Exact / approximate mode' },
  { id: 'drop', title: 'DROP: remove stack level 1' },
  { id: 'swap', title: 'SWAP: exchange levels 1 and 2' },
  { id: 'clearStack', title: 'Clear the stack' },
  { id: 'shortcuts', title: 'Keyboard shortcuts' },
  { id: 'copyResult', title: 'Copy level 1 (or the selected level)' },
  { id: 'exportData', title: 'Export data…' },
  { id: 'importData', title: 'Import data…' },
  { id: 'about', title: 'About ABA-X1' },
  { id: 'settings', title: 'Settings…' },
  { id: 'history', title: 'History' },
  { id: 'vars', title: 'Variables' },
  { id: 'modeStandard', title: 'Standard mode' },
  { id: 'modeCas', title: 'CAS mode' },
  { id: 'modeGraph', title: 'Graph mode' },
  { id: 'toggleFullSize', title: 'Full size' },
];

export type Keymap = KeymapOf<ActionId>;

const BASE: Keymap = [
  { action: 'softkey1', chord: { key: 'F1' } },
  { action: 'softkey2', chord: { key: 'F2' } },
  { action: 'softkey3', chord: { key: 'F3' } },
  { action: 'softkey4', chord: { key: 'F4' } },
  { action: 'softkey5', chord: { key: 'F5' } },
  { action: 'softkey6', chord: { key: 'F6' } },
  { action: 'toNumber', chord: { shift: true, key: 'Enter' } },
  { action: 'toggleAngle', chord: { alt: true, key: 'R' } },
  { action: 'toggleApprox', chord: { alt: true, key: 'E' } },
  { action: 'drop', chord: { alt: true, key: 'Backspace' } },
  { action: 'swap', chord: { alt: true, key: 'S' } },
  { action: 'clearStack', chord: { alt: true, shift: true, key: 'Backspace' } },
  { action: 'shortcuts', chord: { mod: true, key: '/' } },
  { action: 'settings', chord: { mod: true, key: ',' } },
  { action: 'exportData', chord: { mod: true, key: 'S' } },
  { action: 'importData', chord: { mod: true, key: 'O' } },
  { action: 'copyResult', chord: { mod: true, shift: true, key: 'C' } },
  { action: 'toggleFullSize', chord: { alt: true, key: 'F' } },
];

/** Default keymap; identical on all OS today, `Mod` resolves per OS. */
export function keymapFor(os: Os): Keymap {
  void os;
  return BASE;
}
