import { OBJECT_FORMAT, buildBackup, parseBackup, parseObject } from './backup-logic';

describe('backup', () => {
  const app = { name: 'ABA-T1', version: '0.1.0' };

  it('round-trips and lists the parts', () => {
    const b = buildBackup(
      { home: { version: 1, entries: [] }, notes: { version: 1, notes: [] } },
      app,
    );
    const p = parseBackup(JSON.stringify(b));
    expect(p.ok && p.keys).toEqual(['home', 'notes']);
  });

  it('refuses foreign, damaged, newer and empty files', () => {
    expect(parseBackup('{')).toMatchObject({ ok: false });
    expect(
      parseBackup(JSON.stringify({ format: 'aba-x-backup', version: 1, data: {} })),
    ).toMatchObject({
      ok: false,
      message: expect.stringMatching(/not an ABA-T1/),
    });
    expect(parseBackup(JSON.stringify({ ...buildBackup({}, app), version: 99 }))).toMatchObject({
      message: expect.stringMatching(/newer/),
    });
    expect(parseBackup(JSON.stringify(buildBackup({ home: { entries: [] } }, app)))).toMatchObject({
      message: expect.stringMatching(/damaged/),
    });
    expect(parseBackup(JSON.stringify(buildBackup({}, app)))).toMatchObject({
      message: 'the backup is empty',
    });
  });

  it('reads single object files of the right kind', () => {
    const f = JSON.stringify({
      format: OBJECT_FORMAT,
      version: 1,
      kind: 'note',
      data: { text: 'x' },
    });
    expect(parseObject(f, 'note')).toEqual({ ok: true, data: { text: 'x' } });
    expect(parseObject(f, 'app').ok).toBe(false);
  });
});
