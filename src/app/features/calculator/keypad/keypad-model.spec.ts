import {
  ALL_KEYS,
  FUNCTION_ROWS,
  NUMBER_ROWS,
  keyIdForPhysical,
  nextShift,
  resolveKey,
  softkeyIndexForPhysical,
} from './keypad-model';

const key = (id: string) => ALL_KEYS.find((k) => k.id === id)!;

describe('keypad-model', () => {
  it('has unique ids and full rows (6 columns above, 5 below)', () => {
    expect(new Set(ALL_KEYS.map((k) => k.id)).size).toBe(ALL_KEYS.length);
    for (const row of FUNCTION_ROWS) {
      expect(row.reduce((n, k) => n + (k.span ?? 1), 0)).toBe(6);
    }
    for (const row of NUMBER_ROWS) expect(row.length).toBe(5);
  });

  it('gives every key an accessible name', () => {
    for (const k of ALL_KEYS) expect(k.name.trim()).not.toBe('');
  });

  it('resolves shifted functions and falls back to the plain action', () => {
    expect(resolveKey(key('sin'), 'none')).toEqual({ kind: 'insert', latex: '\\sin(#0)' });
    expect(resolveKey(key('sin'), 'left')).toEqual({ kind: 'insert', latex: '\\arcsin(#0)' });
    expect(resolveKey(key('sin'), 'right')).toEqual({ kind: 'insert', latex: '\\sinh(#0)' });
    expect(resolveKey(key('d5'), 'left')).toEqual({ kind: 'insert', latex: '5' });
  });

  it('treats shift as a one-shot modifier', () => {
    const left = { kind: 'shift', shift: 'left' } as const;
    const right = { kind: 'shift', shift: 'right' } as const;
    expect(nextShift('none', left)).toBe('left');
    expect(nextShift('left', left)).toBe('none');
    expect(nextShift('left', right)).toBe('right');
    expect(nextShift('left', { kind: 'insert', latex: '1' })).toBe('none');
  });

  it('maps hardware keys to virtual keys and softkeys', () => {
    expect(keyIdForPhysical('7')).toBe('d7');
    expect(keyIdForPhysical('*')).toBe('mul');
    expect(keyIdForPhysical('Enter')).toBe('enter');
    expect(keyIdForPhysical('Escape')).toBe('on');
    expect(keyIdForPhysical('q')).toBeNull();
    expect(softkeyIndexForPhysical('F1')).toBe(0);
    expect(softkeyIndexForPhysical('F6')).toBe(5);
    expect(softkeyIndexForPhysical('F7')).toBe(-1);
    for (const k of ['7', '+', 'Enter', 'Backspace', 'ArrowLeft']) {
      expect(ALL_KEYS.some((v) => v.id === keyIdForPhysical(k))).toBe(true);
    }
  });
});
