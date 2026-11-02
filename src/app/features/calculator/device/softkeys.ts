import { AppMode } from '../../../core/ui-state/ui-state-logic';

/** One label of the soft menu at the bottom of the display (F1–F6). */
export type Softkey =
  { label: string; kind: 'mode'; mode: AppMode } | { label: string; kind: 'planned'; what: string };

/** Menu of the walking skeleton: the three modes, then entries of later prompts. */
export const MAIN_MENU: readonly Softkey[] = [
  { label: 'STD', kind: 'mode', mode: 'standard' },
  { label: 'CAS', kind: 'mode', mode: 'cas' },
  { label: 'GRAPH', kind: 'mode', mode: 'graph' },
  { label: 'VARS', kind: 'planned', what: 'VARS' },
  { label: 'HIST', kind: 'planned', what: 'HIST' },
  { label: 'SETUP', kind: 'planned', what: 'SETUP' },
];

export const MODE_TITLES: Record<AppMode, string> = {
  standard: 'STANDARD',
  cas: 'CAS',
  graph: 'GRAPH',
};

/** A soft-menu label as the device shows it. */
export interface MenuItem {
  label: string;
  run: () => void;
  active: boolean;
  planned: boolean;
  /** aria-pressed for mode keys, null otherwise. */
  pressed: boolean | null;
}

export interface MainMenuHandlers {
  setMode(mode: AppMode): void;
  openVars(): void;
  planned(what: string): void;
}

export function mainItems(
  menu: readonly Softkey[],
  mode: AppMode,
  h: MainMenuHandlers,
): MenuItem[] {
  return menu.map((k) => {
    if (k.kind === 'mode') {
      const on = k.mode === mode;
      return {
        label: k.label,
        run: () => h.setMode(k.mode),
        active: on,
        planned: false,
        pressed: on,
      };
    }
    if (k.what === 'VARS') {
      return {
        label: k.label,
        run: () => h.openVars(),
        active: false,
        planned: false,
        pressed: null,
      };
    }
    return {
      label: k.label,
      run: () => h.planned(k.what),
      active: false,
      planned: true,
      pressed: null,
    };
  });
}

const item = (label: string, run: () => void): MenuItem => ({
  label,
  run,
  active: false,
  planned: false,
  pressed: null,
});

/** What the CAS menus need from the calculator store. */
export interface CasMenuTarget {
  casOp(op: 'simplify' | 'expand' | 'factor' | 'solve' | 'deriv' | 'integ'): Promise<void>;
  insertTemplate(latex: string): void;
  menu: { set(m: 'mode' | 'main' | 'vars' | 'cas-calc'): void };
}

/** CAS mode menu (prompt 010): algebra on the line or level 1, CALC submenu, MODE back to the mode menu. */
export function casMenu(c: CasMenuTarget): MenuItem[] {
  return [
    item('SIMP', () => void c.casOp('simplify')),
    item('EXPA', () => void c.casOp('expand')),
    item('FACT', () => void c.casOp('factor')),
    item('SOLVE', () => void c.casOp('solve')),
    item('CALC▸', () => c.menu.set('cas-calc')),
    item('MODE▸', () => c.menu.set('main')),
  ];
}

/** Calculus submenu (prompts 011/012). */
export function casCalcMenu(c: CasMenuTarget): MenuItem[] {
  return [
    item('DERIV', () => void c.casOp('deriv')),
    item('INTEG', () => void c.casOp('integ')),
    item('∫ab', () => c.insertTemplate('\\int_{#?}^{#?}#0\\,dx')),
    item('d/dx', () => c.insertTemplate('\\frac{d}{dx}#0')),
    item('LIM', () => c.insertTemplate('\\lim_{x\\to#?}#0')),
    item('BACK', () => c.menu.set('mode')),
  ];
}
