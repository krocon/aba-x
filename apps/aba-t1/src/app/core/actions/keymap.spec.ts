import { resolve } from '@aba/core/actions/chords';
import { allKeys } from '../../features/device/keypad-model';
import { CHORDS, keyOfAction, keymapFor, physicalKey } from './keymap';

const ev = (
  key: string,
  mods: Partial<Record<'ctrl' | 'meta' | 'alt' | 'shift', boolean>> = {},
  code?: string,
) => ({
  key,
  code,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
});

describe('ABA-T1 keymap', () => {
  it('has no duplicate chords and only refers to device keys or menu buttons', () => {
    const seen = new Set(CHORDS.map((b) => JSON.stringify(b.chord)));
    expect(seen.size).toBe(CHORDS.length);
    const ids = new Set(allKeys().map((k) => k.id));
    for (const b of CHORDS) {
      const { id } = keyOfAction(b.action);
      expect(ids.has(id) || /^menu[1-6]$/.test(id) || id === 'shortcuts', b.action).toBe(true);
    }
  });

  it('resolves F-keys, Alt and Mod chords per OS (letters by code)', () => {
    expect(resolve(keymapFor('mac'), ev('F7'), 'mac')).toBe('symb');
    expect(resolve(keymapFor('mac'), ev('F7', { shift: true }), 'mac')).toBe('symb.shift');
    expect(resolve(keymapFor('mac'), ev('å', { alt: true }, 'KeyA'), 'mac')).toBe('apps');
    expect(resolve(keymapFor('other'), ev('/', { ctrl: true }), 'other')).toBe('shortcuts');
    expect(resolve(keymapFor('mac'), ev('Enter'), 'mac')).toBeNull();
  });

  it('maps plain PC keys to device keys', () => {
    expect(physicalKey(ev('7'))).toEqual({ kind: 'key', id: 'd7', layer: 'main' });
    expect(physicalKey(ev('*'))).toEqual({ kind: 'key', id: 'mul', layer: 'main' });
    expect(physicalKey(ev('Enter'))).toEqual({ kind: 'key', id: 'enter', layer: 'main' });
    expect(physicalKey(ev('Delete'))).toEqual({ kind: 'key', id: 'bksp', layer: 'shift' });
    expect(physicalKey(ev('ArrowUp', { shift: true }))).toEqual({
      kind: 'rocker',
      dir: 'up',
      shift: true,
    });
    expect(physicalKey(ev('q'))).toEqual({ kind: 'key', id: 'letter', layer: 'alpha', char: 'q' });
    expect(physicalKey(ev('s', { ctrl: true }))).toBeNull();
    expect(physicalKey(ev('§'))).toBeNull();
  });

  it('splits actions into key and layer', () => {
    expect(keyOfAction('cas.shift')).toEqual({ id: 'cas', layer: 'shift' });
    expect(keyOfAction('menu3')).toEqual({ id: 'menu3', layer: 'main' });
  });
});
