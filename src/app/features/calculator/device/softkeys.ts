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
