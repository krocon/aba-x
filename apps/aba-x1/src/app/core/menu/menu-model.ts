/**
 * One menu model for the native menu (desktop) and the HTML menu (web) – prompts 002/019.
 * Pure: builds the structure per OS; accelerators come from the keymap.
 */
import { ACTIONS, type ActionId, type Keymap, type Os, accelerator } from '../actions/keymap';

export type MenuEntry =
  | { kind: 'action'; id: ActionId; label: string; shortcut?: string }
  | { kind: 'separator' }
  | { kind: 'predefined'; which: string };

export interface Submenu {
  label: string;
  items: MenuEntry[];
}

const act = (id: ActionId, label?: string): MenuEntry => ({
  kind: 'action',
  id,
  label: label ?? ACTIONS.find((a) => a.id === id)?.title ?? id,
});
const sep: MenuEntry = { kind: 'separator' };
const pre = (which: string): MenuEntry => ({ kind: 'predefined', which });

/**
 * Desktop menu bar. macOS: app menu first (About, Settings, Hide, Quit), Edit with the system items
 * (without them ⌘C/⌘V do not reach the web view). Windows/Linux: Settings and Quit under File.
 */
export function desktopMenu(os: Os): Submenu[] {
  const mac = os === 'mac';
  const file: MenuEntry[] = [act('exportData'), act('importData')];
  if (!mac) file.push(sep, act('settings'), sep, pre('quit'));
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
        sep,
        act('copyResult'),
        act('clearStack'),
      ],
    },
    {
      label: 'View',
      items: [
        act('modeStandard'),
        act('modeCas'),
        act('modeGraph'),
        sep,
        act('history'),
        act('vars'),
        sep,
        act('toggleAngle'),
        act('toggleApprox'),
        sep,
        act('toggleFullSize'),
        ...(mac ? [pre('fullscreen')] : []),
      ],
    },
    { label: 'Help', items: [act('shortcuts'), ...(mac ? [] : [sep, act('about')])] },
  ];
  if (mac) {
    menus.unshift({
      label: 'ABA-X1',
      items: [
        act('about'),
        sep,
        act('settings'),
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

/** Web menu: the same actions without OS items (the browser has its own Edit menu). */
export function webMenu(): Submenu[] {
  return desktopMenu('other')
    .map((m) => ({ ...m, items: m.items.filter((i) => i.kind !== 'predefined') }))
    .map((m) => ({ ...m, items: trimSeparators(m.items) }))
    .filter((m) => m.items.length > 0);
}

function trimSeparators(items: MenuEntry[]): MenuEntry[] {
  const out = items.filter(
    (i, k) => !(i.kind === 'separator' && (k === 0 || items[k - 1]?.kind === 'separator')),
  );
  while (out.at(-1)?.kind === 'separator') out.pop();
  return out;
}

/** Spec for the Rust command `set_app_menu`. */
export function nativeSpec(menus: readonly Submenu[], keymap: Keymap) {
  return {
    submenus: menus.map((m) => ({
      label: m.label,
      items: m.items.map((i) => {
        if (i.kind !== 'action') return i;
        const chord = keymap.find((b) => b.action === i.id)?.chord;
        const acc = chord ? accelerator(chord) : null;
        return { kind: 'action', id: i.id, label: i.label, accelerator: acc };
      }),
    })),
  };
}
