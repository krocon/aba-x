import { DEFAULT_UI_STATE, sanitizeUiState, stepMode } from './ui-state-logic';

describe('ui-state-logic', () => {
  it('falls back to the default for missing or broken documents', () => {
    for (const raw of [null, undefined, 42, 'x', []]) {
      expect(sanitizeUiState(raw).state).toEqual(DEFAULT_UI_STATE);
    }
    expect(sanitizeUiState({ schemaVersion: 1, mode: 'tetris' }).state.mode).toBe('standard');
  });

  it('keeps a valid mode', () => {
    expect(sanitizeUiState({ schemaVersion: 1, mode: 'graph' })).toEqual({
      state: { schemaVersion: 1, mode: 'graph' },
      readOnly: false,
    });
  });

  it('never overwrites a document of a newer version', () => {
    expect(sanitizeUiState({ schemaVersion: 2, mode: 'cas' })).toEqual({
      state: { schemaVersion: 1, mode: 'cas' },
      readOnly: true,
    });
  });

  it('steps through the modes and wraps around', () => {
    expect(stepMode('standard', 1)).toBe('cas');
    expect(stepMode('graph', 1)).toBe('standard');
    expect(stepMode('standard', -1)).toBe('graph');
  });
});
