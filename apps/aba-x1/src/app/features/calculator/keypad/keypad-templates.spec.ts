import { parseLatex } from '@aba/math/parser/latex-parser';
import { ALL_KEYS } from './keypad-model';

describe('keypad templates', () => {
  it('parse in the math core once their placeholders are filled', () => {
    for (const key of ALL_KEYS) {
      for (const action of [key.action, key.left?.action, key.right?.action]) {
        if (action?.kind !== 'insert' || [',', '(', ')'].includes(action.latex)) continue;
        const filled = action.latex
          .replaceAll('#@', 'y')
          .replaceAll('#0', 'x')
          .replaceAll('#?', '2');
        // operators and single characters need operands around them
        const src = /^[+\-.,=<!)\]]|^\\cdot$|^\\%$|^\^/.test(filled) ? `x${filled}2` : filled;
        const wrapped = src.startsWith('\\cdot10') ? `3${src}` : src;
        if (wrapped === '\\,') continue;
        const r = parseLatex(wrapped);
        expect(r.ok, `${key.id}: ${wrapped} → ${!r.ok ? r.error.message : ''}`).toBe(true);
      }
    }
  });
});
