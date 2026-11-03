/**
 * One menu model for the native desktop menu and the HTML menu of the web build (prompt 045,
 * like ABA-X1 002/019). Pure: entries, per-OS structure and the spec for `set_app_menu`.
 */
import { accelerator, type Chord, type Os } from '@aba/core/actions/chords';

export type MenuAction =
  | 'exportBackup'
  | 'importBackup'
  | 'importApp'
  | 'importNote'
  | 'goHome'
  | 'goCas'
  | 'goApps'
  | 'goNotes'
  | 'goMemory'
  | 'goLists'
  | 'goMatrices'
  | 'settings'
  | 'keyboard'
  | 'about';

export type MenuEntry =
  | { kind: 'action'; id: MenuAction }
  | { kind: 'separator' }
  | { kind: 'predefined'; which: string };

export interface Submenu {
  /** text key suffix: menu.<label> */
  label: string;
  items: MenuEntry[];
}

const a = (id: MenuAction): MenuEntry => ({ kind: 'action', id });
const sep: MenuEntry = { kind: 'separator' };
const pre = (which: string): MenuEntry => ({ kind: 'predefined', which });

export function desktopMenu(os: Os): Submenu[] {
  const mac = os === 'mac';
  const file: MenuEntry[] = [
    a('exportBackup'),
    a('importBackup'),
    sep,
    a('importApp'),
    a('importNote'),
  ];
  if (!mac) file.push(sep, a('settings'), sep, pre('quit'));
  const menus: Submenu[] = [
    { label: 'File', items: file },
    {
      label: 'Edit',
      items: [
        pre('undo'),
        pre('redo'),
        sep,
        pre('cut'),
        pre('copy'),
        pre('paste'),
        pre('selectAll'),
      ],
    },
    {
      label: 'View',
      items: [
        a('goHome'),
        a('goCas'),
        a('goApps'),
        sep,
        a('goNotes'),
        a('goLists'),
        a('goMatrices'),
        a('goMemory'),
        ...(mac ? [sep, pre('fullscreen')] : []),
      ],
    },
    { label: 'Help', items: [a('keyboard'), ...(mac ? [] : [sep, a('about')])] },
  ];
  if (mac) {
    menus.unshift({
      label: 'App',
      items: [
        a('about'),
        sep,
        a('settings'),
        sep,
        pre('hide'),
        pre('hideOthers'),
        pre('showAll'),
        sep,
        pre('quit'),
      ],
    });
  }
  return menus;
}

/** The web menu: the same actions without OS items. */
export function webMenu(): Submenu[] {
  return desktopMenu('other')
    .map((m) => ({ ...m, items: m.items.filter((i) => i.kind !== 'predefined') }))
    .map((m) => ({
      ...m,
      items: m.items.filter(
        (i, k, all) =>
          !(
            i.kind === 'separator' &&
            (k === 0 || all[k - 1].kind === 'separator' || k === all.length - 1)
          ),
      ),
    }))
    .filter((m) => m.items.length > 0);
}

/** Shortcuts shown in the menus (the PC keyboard chords of these actions). */
export const MENU_CHORDS: Partial<Record<MenuAction, Chord>> = {
  exportBackup: { mod: true, key: 'S' },
  importBackup: { mod: true, key: 'O' },
  keyboard: { mod: true, key: '/' },
  settings: { mod: true, key: ',' },
};

/** Spec for the Rust command `set_app_menu` (labels already translated). */
export function nativeSpec(menus: readonly Submenu[], label: (key: string) => string) {
  return {
    submenus: menus.map((m) => ({
      label: label(`menu.${m.label}`),
      items: m.items.map((i) => {
        if (i.kind !== 'action') return i;
        const chord = MENU_CHORDS[i.id];
        return {
          kind: 'action',
          id: i.id,
          label: label(`menuItem.${i.id}`),
          accelerator: chord ? accelerator(chord) : null,
        };
      }),
    })),
  };
}
