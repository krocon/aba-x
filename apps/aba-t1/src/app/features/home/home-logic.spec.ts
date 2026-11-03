import { parseLatex } from '@aba/math/parser/latex-parser';
import { complex, real } from '@aba/math/value/value';
import { defaultSettings } from '../settings/settings-logic';
import { parseHomeInput, resultText, valueAsInput } from './home-logic';
import { TEMPLATES } from './templates';

describe('home input', () => {
  it('reads expressions, tests, Sto ▶ and :=', () => {
    expect(parseHomeInput('2+3', 'text')).toMatchObject({ ok: true, value: { kind: 'expr' } });
    expect(parseHomeInput('A=5', 'text')).toMatchObject({
      ok: true,
      value: { kind: 'expr', expr: { type: 'rel' } },
    });
    expect(parseHomeInput('5*2▶B', 'text')).toMatchObject({
      ok: true,
      value: { kind: 'store', name: 'B' },
    });
    expect(parseHomeInput('\\frac{1}{2}\\blacktriangleright\\mathrm{Half}', 'latex')).toMatchObject(
      {
        ok: true,
        value: { kind: 'store', name: 'Half' },
      },
    );
    expect(parseHomeInput('C:=7', 'text')).toMatchObject({
      ok: true,
      value: { kind: 'store', name: 'C' },
    });
    expect(parseHomeInput('f(x)\\coloneq x^2', 'latex')).toMatchObject({
      ok: true,
      value: { kind: 'define', name: 'f', params: ['x'] },
    });
  });

  it('rejects bad targets', () => {
    expect(parseHomeInput('5▶sin', 'text').ok).toBe(false);
    expect(parseHomeInput('5▶', 'text').ok).toBe(false);
    expect(parseHomeInput('2+3:=4', 'text').ok).toBe(false);
  });

  it('formats results and copies values back as input', () => {
    const s = defaultSettings('en');
    expect(resultText({ input: '', kind: 'text', value: real(0.5) }, s)).toBe('0.5');
    expect(resultText({ input: '', kind: 'text', value: null, note: 'Done' }, s)).toBe('Done');
    expect(valueAsInput(real(1.5e20), 'text', s)).toBe('1.5*10^(20)');
    expect(valueAsInput(complex(1, -2), 'latex', s)).toBe('1-2i');
  });

  it('every template parses once its placeholders are filled', () => {
    for (const t of TEMPLATES) {
      if (t.id === 'list' || t.id === 'mat2' || t.id === 'sub') continue; // lists/matrices: 032
      const filled = t.latex.replace(/#0/g, '2').replace(/#\?/g, () => '3');
      const r = parseLatex(
        filled.replace('\\mathrm{d}3', '\\mathrm{d}x').replace('{3=3}', '{k=1}'),
      );
      expect(r.ok, `${t.id}: ${filled} ${r.ok ? '' : r.error.message}`).toBe(true);
    }
  });
});
