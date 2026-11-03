import { DE, EN } from './texts';

describe('ABA-T1 texts', () => {
  it('German has every English key and no empty text', () => {
    expect(Object.keys(DE).sort()).toEqual(Object.keys(EN).sort());
    for (const [k, v] of Object.entries(DE)) expect(v.trim(), k).not.toBe('');
  });
});
