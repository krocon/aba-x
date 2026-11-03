/**
 * Keyboard chords per OS (prompt 007, shared since prompt 026). Pure: chord notation, matching
 * against KeyboardEvents, formatting, native-menu accelerators. Each app brings its own action ids
 * and keymap. Chords use `Mod` = ⌘ on macOS, Ctrl elsewhere; keys are matched on `event.code` for
 * letters (layout-independent) and on `event.key` otherwise.
 */

export type Os = 'mac' | 'other';

export interface Chord {
  readonly mod?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
  /** `event.key` for named keys (`F1`, `Enter`, `Backspace`, `/`) or a letter `A`–`Z` (matched on `event.code`). */
  readonly key: string;
}

export type Keymap<A extends string = string> = readonly { action: A; chord: Chord }[];

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

export function resolve<A extends string>(keymap: Keymap<A>, e: KeyLike, os: Os): A | null {
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
