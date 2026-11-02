import { fail, mapResult, ok } from './result';

describe('MathResult', () => {
  it('maps successful values', () => {
    expect(mapResult(ok(2), (n) => n * 3)).toEqual({ ok: true, value: 6 });
  });

  it('passes errors through unchanged', () => {
    const err = fail<number>('division-by-zero', '1/0');
    expect(mapResult(err, (n) => n * 3)).toBe(err);
  });

  it('keeps the span of syntax errors', () => {
    expect(fail('syntax', 'unexpected )', { start: 3, end: 4 })).toEqual({
      ok: false,
      error: { code: 'syntax', message: 'unexpected )', span: { start: 3, end: 4 } },
    });
  });
});
