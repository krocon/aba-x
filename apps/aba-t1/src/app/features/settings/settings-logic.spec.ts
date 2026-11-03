import { cycle, defaultSettings, readSettings, valueOf, withValue } from './settings-logic';

describe('ABA-T1 settings', () => {
  it('defaults and broken documents', () => {
    expect(readSettings(null, 'de')).toEqual(defaultSettings('de'));
    const s = readSettings(
      { angle: 'grad', format: { mode: 'fixed', digits: 99 }, entry: 'rpn' },
      'en',
    );
    expect(s.angle).toBe('rad');
    expect(s.format).toEqual({ mode: 'fixed', digits: 4, decimal: '.' });
    expect(s.entry).toBe('rpn');
  });

  it('cycles and sets values', () => {
    let s = defaultSettings('en');
    s = cycle(s, 'angle', 1);
    expect(s.angle).toBe('deg');
    s = cycle(s, 'complex', -1);
    expect(s.complex).toBe('polar');
    s = withValue(s, 'digits', '2');
    s = withValue(s, 'mode', 'fixed');
    s = withValue(s, 'decimal', ',');
    expect(s.format).toEqual({ mode: 'fixed', digits: 2, decimal: ',' });
    expect(valueOf(s, 'digits')).toBe('2');
    expect(cycle(s, 'digits', -1).format.digits).toBe(1);
  });
});
