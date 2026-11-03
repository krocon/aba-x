import { buildBundle, bundleFileName, parseBundle } from './backup-logic';

describe('backup-logic', () => {
  it('round-trips a bundle and summarises it', () => {
    const b = buildBundle(
      {
        variables: { schemaVersion: 1, items: [{ name: 'a', value: '5' }] },
        history: { schemaVersion: 1, items: [] },
      },
      new Date('2026-11-02T10:00:00Z'),
    );
    const r = parseBundle(JSON.stringify(b));
    expect(r.ok && r.summary).toEqual({ variables: 1, functions: 0, history: 0, settings: false });
    expect(bundleFileName(new Date('2026-11-02T10:00:00Z'))).toBe('aba-x-backup-2026-11-02.json');
  });

  it('refuses other files and newer versions', () => {
    expect(parseBundle('{')).toMatchObject({ ok: false });
    expect(parseBundle('{"format":"x"}')).toMatchObject({ ok: false });
    expect(
      parseBundle(JSON.stringify({ format: 'aba-x-backup', version: 2, data: {} })),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('newer'),
    });
  });
});
