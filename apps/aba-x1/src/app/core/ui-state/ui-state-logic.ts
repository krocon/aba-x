/** The three operating modes of the master prompt §2. */
export const APP_MODES = ['standard', 'cas', 'graph'] as const;
export type AppMode = (typeof APP_MODES)[number];

export const UI_STATE_SCHEMA = 1;

/** Document `ui-state` – small things the user expects back after a restart. */
export interface UiStateDoc {
  schemaVersion: number;
  mode: AppMode;
}

export const DEFAULT_UI_STATE: UiStateDoc = { schemaVersion: UI_STATE_SCHEMA, mode: 'standard' };

export function isAppMode(value: unknown): value is AppMode {
  return typeof value === 'string' && (APP_MODES as readonly string[]).includes(value);
}

/**
 * Accepts whatever was stored; unknown or broken fields fall back to the default. A document
 * written by a newer version is read as far as it is understood (`readOnly`), but not
 * overwritten, so going back to an older version never destroys newer data.
 */
export function sanitizeUiState(raw: unknown): { state: UiStateDoc; readOnly: boolean } {
  if (typeof raw !== 'object' || raw === null) return { state: DEFAULT_UI_STATE, readOnly: false };
  const doc = raw as Record<string, unknown>;
  const version = typeof doc['schemaVersion'] === 'number' ? doc['schemaVersion'] : 0;
  const mode = isAppMode(doc['mode']) ? doc['mode'] : DEFAULT_UI_STATE.mode;
  return {
    state: { schemaVersion: UI_STATE_SCHEMA, mode },
    readOnly: version > UI_STATE_SCHEMA,
  };
}

/** Next/previous mode for arrow keys in the mode tab list (wraps around). */
export function stepMode(mode: AppMode, delta: 1 | -1): AppMode {
  const i = APP_MODES.indexOf(mode);
  return APP_MODES[(i + delta + APP_MODES.length) % APP_MODES.length];
}
