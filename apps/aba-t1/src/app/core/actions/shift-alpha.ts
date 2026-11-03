/**
 * Shift and alpha of the ABA-T1 keypad (prompt 026), pure. Shift acts on the next key; alpha once
 * types one letter, alpha twice locks it; shift + alpha gives lower-case letters; Esc releases
 * everything. A key without the requested legend falls back to its main function.
 */
import type { KeyDef } from '../../features/device/keypad-model';

export type AlphaMode = 'off' | 'once' | 'lock';

export interface ModState {
  shift: boolean;
  alpha: AlphaMode;
  /** letters in lower case (alpha entered with shift) */
  lower: boolean;
}

export const IDLE: ModState = { shift: false, alpha: 'off', lower: false };

export type Layer = 'main' | 'shift' | 'alpha';

/** A key press after shift/alpha: which function of the key, and the letter for alpha. */
export interface KeyPress {
  id: string;
  layer: Layer;
  /** the typed character for alpha (lower case if requested) */
  char?: string;
}

export interface Step {
  state: ModState;
  /** null for the modifier keys themselves */
  press: KeyPress | null;
}

export function step(state: ModState, key: KeyDef): Step {
  if (key.id === 'shift') return { state: { ...state, shift: !state.shift }, press: null };
  if (key.id === 'alpha') {
    if (state.shift) return { state: { shift: false, alpha: 'once', lower: true }, press: null };
    const next: AlphaMode =
      state.alpha === 'off' ? 'once' : state.alpha === 'once' ? 'lock' : 'off';
    return {
      state: { shift: false, alpha: next, lower: next === 'off' ? false : state.lower },
      press: null,
    };
  }
  if (key.id === 'esc' && !state.shift) return { state: IDLE, press: { id: 'esc', layer: 'main' } };
  if (state.alpha !== 'off' && key.alpha) {
    const char = state.lower ? key.alpha.toLowerCase() : key.alpha;
    const keep = state.alpha === 'lock';
    return {
      state: keep ? { ...state, shift: false } : IDLE,
      press: { id: key.id, layer: 'alpha', char },
    };
  }
  const layer: Layer = state.shift && key.shift ? 'shift' : 'main';
  return {
    state: { ...state, shift: false, alpha: state.alpha === 'once' ? 'off' : state.alpha },
    press: { id: key.id, layer },
  };
}

/** Annunciators for the title bar. */
export function annunciators(state: ModState): string[] {
  const out: string[] = [];
  if (state.shift) out.push('⇧');
  if (state.alpha !== 'off')
    out.push(`${state.lower ? 'a' : 'A'}${state.alpha === 'lock' ? '🔒' : ''}`);
  return out;
}
