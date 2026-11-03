import { DEFAULT_SETTINGS, sanitizeSettings, settingsDoc } from './settings-logic';

describe('settings-logic', () => {
  it('falls back to defaults and clamps numbers', () => {
    expect(sanitizeSettings(null).settings).toEqual(DEFAULT_SETTINGS);
    const r = sanitizeSettings({
      angle: 'grad',
      digits: 99,
      timeoutSec: 0,
      theme: 'dark',
      lang: 'de',
      approx: true,
    });
    expect(r.settings).toEqual({
      angle: 'rad',
      approx: true,
      digits: 15,
      timeoutSec: 1,
      theme: 'dark',
      lang: 'de',
      fullSize: false,
    });
  });

  it('round-trips and keeps newer documents read-only', () => {
    const s = { ...DEFAULT_SETTINGS, angle: 'deg' as const };
    expect(sanitizeSettings(settingsDoc(s)).settings).toEqual(s);
    expect(sanitizeSettings({ schemaVersion: 2 }).readOnly).toBe(true);
  });
});
