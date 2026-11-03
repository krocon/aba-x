import { allKeys, keyById } from './keypad-model';

describe('ABA-T1 keypad model', () => {
  const keys = allKeys();

  it('has 47 keys with unique ids', () => {
    expect(keys.length).toBe(47);
    expect(new Set(keys.map((k) => k.id)).size).toBe(keys.length);
  });

  it('puts the letters A–Z on alpha legends exactly once', () => {
    const letters = keys.map((k) => k.alpha).filter((a): a is string => !!a && /^[A-Z]$/.test(a));
    expect([...letters].sort().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

  it('names symbol keys for screen readers', () => {
    for (const k of keys) {
      const name = k.aria ?? k.main;
      expect(/[A-Za-z0-9]/.test(name), k.id).toBe(true);
    }
  });

  it('finds keys by id', () => {
    expect(keyById('enter')?.span).toBe(2);
    expect(keyById('nope')).toBeUndefined();
  });
});
