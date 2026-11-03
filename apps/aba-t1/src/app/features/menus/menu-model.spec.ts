import { desktopMenu, nativeSpec, webMenu } from './menu-model';

describe('ABA-T1 menu model', () => {
  it('has an app menu on macOS and File › Quit elsewhere', () => {
    expect(desktopMenu('mac')[0].label).toBe('App');
    const file = desktopMenu('other')[0];
    expect(file.items.at(-1)).toEqual({ kind: 'predefined', which: 'quit' });
  });

  it('the web menu has no OS items and no stray separators', () => {
    for (const m of webMenu()) {
      expect(m.items.some((i) => i.kind === 'predefined')).toBe(false);
      expect(m.items[0].kind).not.toBe('separator');
      expect(m.items.at(-1)!.kind).not.toBe('separator');
    }
  });

  it('builds the native spec with translated labels and accelerators', () => {
    const spec = nativeSpec(desktopMenu('other'), (k) => k.toUpperCase());
    const exp = spec.submenus[0].items[0] as { label: string; accelerator: string };
    expect(exp).toMatchObject({ label: 'MENUITEM.EXPORTBACKUP', accelerator: 'CmdOrCtrl+S' });
  });
});
