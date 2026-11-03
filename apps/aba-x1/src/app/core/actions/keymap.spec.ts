import { ACTIONS, detectOs, formatChord, keymapFor, matches, resolve } from './keymap';

const ev = (
  key: string,
  mods: Partial<{ meta: boolean; ctrl: boolean; alt: boolean; shift: boolean }> = {},
  code?: string,
) => ({
  key,
  code,
  metaKey: !!mods.meta,
  ctrlKey: !!mods.ctrl,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
});

describe('keymap', () => {
  it('has no duplicate chords and only known actions', () => {
    const km = keymapFor('mac');
    const seen = new Set(km.map((b) => JSON.stringify(b.chord)));
    expect(seen.size).toBe(km.length);
    for (const b of km) expect(ACTIONS.some((a) => a.id === b.action)).toBe(true);
  });

  it('resolves Mod per OS and letters by code (layout independent)', () => {
    expect(resolve(keymapFor('mac'), ev('/', { meta: true }), 'mac')).toBe('shortcuts');
    expect(resolve(keymapFor('other'), ev('/', { ctrl: true }), 'other')).toBe('shortcuts');
    expect(resolve(keymapFor('mac'), ev('/', { ctrl: true }), 'mac')).toBeNull();
    // Option+R types ® on a Mac keyboard – matched by code
    expect(resolve(keymapFor('mac'), ev('®', { alt: true }, 'KeyR'), 'mac')).toBe('toggleAngle');
    expect(resolve(keymapFor('mac'), ev('Enter', { shift: true }), 'mac')).toBe('toNumber');
    expect(resolve(keymapFor('mac'), ev('Enter'), 'mac')).toBeNull();
    expect(matches({ key: 'F1' }, ev('F1', { shift: true }), 'mac')).toBe(false);
  });

  it('formats chords per OS and detects the OS', () => {
    expect(formatChord({ mod: true, key: '/' }, 'mac')).toBe('⌘/');
    expect(formatChord({ mod: true, key: '/' }, 'other')).toBe('Ctrl+/');
    expect(formatChord({ alt: true, shift: true, key: 'Backspace' }, 'other')).toBe(
      'Alt+Shift+Backspace',
    );
    expect(detectOs('MacIntel')).toBe('mac');
    expect(detectOs('Win32')).toBe('other');
  });
});
