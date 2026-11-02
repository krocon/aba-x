/**
 * Keyboard shortcuts per OS (prompt 007). Pure: chord notation, matching against KeyboardEvents,
 * the default keymaps. Chords use `Mod` = ⌘ on macOS, Ctrl elsewhere; keys are matched on
 * `event.code` for letters (layout-independent) and on `event.key` otherwise.
 */

export type Os = 'mac' | 'other';

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

export interface Chord {
  readonly mod?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
  /** `event.key` for named keys (`F1`, `Enter`, `Backspace`, `/`) or a letter `A`–`Z` (matched on `event.code`). */
  readonly key: string;
}

export type Keymap = readonly { action: ActionId; chord: Chord }[];

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

export function detectOs(platform: string): Os {
  return /mac|iphone|ipad/i.test(platform) ? 'mac' : 'other';
}

export interface KeyLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function matches(chord: Chord, e: KeyLike, os: Os): boolean {
  const mod = os === 'mac' ? e.metaKey : e.ctrlKey;
  const otherMod = os === 'mac' ? e.ctrlKey : e.metaKey;
  if (!!chord.mod !== mod || otherMod) return false;
  if (!!chord.alt !== e.altKey || !!chord.shift !== e.shiftKey) return false;
  if (/^[A-Z]$/.test(chord.key)) return e.code === `Key${chord.key}`;
  return e.key === chord.key;
}

export function resolve(keymap: Keymap, e: KeyLike, os: Os): ActionId | null {
  return keymap.find((b) => matches(b.chord, e, os))?.action ?? null;
}

/** Display form: ⌘/ on macOS, Ctrl+/ elsewhere; ⌥ = Alt. */
export function formatChord(chord: Chord, os: Os): string {
  const keyName: Record<string, string> = {
    Backspace: os === 'mac' ? '⌫' : 'Backspace',
    Enter: os === 'mac' ? '↩' : 'Enter',
  };
  const key = keyName[chord.key] ?? chord.key;
  if (os === 'mac') {
    return `${chord.alt ? '⌥' : ''}${chord.shift ? '⇧' : ''}${chord.mod ? '⌘' : ''}${key}`;
  }
  return [chord.mod && 'Ctrl', chord.alt && 'Alt', chord.shift && 'Shift', key]
    .filter(Boolean)
    .join('+');
}

/** Accelerator string for the native menu (Tauri/muda notation), or null. */
export function accelerator(chord: Chord): string | null {
  const names: Record<string, string> = { '/': 'Slash', ',': 'Comma', '.': 'Period' };
  const key = names[chord.key] ?? chord.key;
  if (!/^([A-Z]|F\d{1,2}|Slash|Comma|Period|Backspace|Enter)$/.test(key)) return null;
  return [chord.mod && 'CmdOrCtrl', chord.alt && 'Alt', chord.shift && 'Shift', key]
    .filter(Boolean)
    .join('+');
}
