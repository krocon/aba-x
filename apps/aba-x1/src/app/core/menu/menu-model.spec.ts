import { keymapFor } from '../actions/keymap';
import { desktopMenu, nativeSpec, webMenu } from './menu-model';

describe('menu-model', () => {
  it('macOS gets an app menu and system Edit items', () => {
    const m = desktopMenu('mac');
    expect(m.map((s) => s.label)).toEqual(['ABA-X1', 'File', 'Edit', 'View', 'Help']);
    expect(m[2].items.some((i) => i.kind === 'predefined' && i.which === 'paste')).toBe(true);
  });

  it('Windows/Linux keep Settings and Quit under File, About under Help', () => {
    const m = desktopMenu('other');
    expect(m.map((s) => s.label)).toEqual(['File', 'Edit', 'View', 'Help']);
    expect(m[0].items.some((i) => i.kind === 'action' && i.id === 'settings')).toBe(true);
    expect(m[3].items.some((i) => i.kind === 'action' && i.id === 'about')).toBe(true);
  });

  it('web menu has no OS items and no dangling separators', () => {
    for (const s of webMenu()) {
      expect(s.items.every((i) => i.kind !== 'predefined')).toBe(true);
      expect(s.items[0].kind).not.toBe('separator');
      expect(s.items.at(-1)?.kind).not.toBe('separator');
    }
  });

  it('native spec carries accelerators from the keymap, ids are unique', () => {
    const spec = nativeSpec(desktopMenu('mac'), keymapFor('mac'));
    const actions = spec.submenus.flatMap((s) => s.items).filter((i) => i.kind === 'action') as {
      id: string;
      accelerator: string | null;
    }[];
    expect(new Set(actions.map((a) => a.id)).size).toBe(actions.length);
    expect(actions.find((a) => a.id === 'shortcuts')?.accelerator).toBe('CmdOrCtrl+Slash');
    expect(actions.find((a) => a.id === 'toggleAngle')?.accelerator).toBe('Alt+R');
    expect(actions.find((a) => a.id === 'history')?.accelerator).toBeNull();
  });
});
