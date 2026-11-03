import { parseLatex } from '@aba/math/parser/latex-parser';
import { CAS_COMMANDS } from '@aba/math/symbolic/cas-commands';
import { COMMAND_HELP } from './help-data';
import { CAS_TAB, MATH_TAB, catalog, jumpTo, userEntries } from './toolbox-model';

describe('toolbox model', () => {
  it('every entry has help in both languages with an example that parses', () => {
    for (const e of catalog()) {
      const h = COMMAND_HELP[e.name];
      expect(h, e.name).toBeTruthy();
      expect(h.en.trim() && h.de.trim(), e.name).toBeTruthy();
      const p = parseLatex(h.example, { functions: new Set(CAS_COMMANDS) });
      expect(p.ok, `${e.name}: ${h.example} ${p.ok ? '' : p.error.message}`).toBe(true);
    }
  });

  it('templates parse once filled, CAS commands are complete', () => {
    for (const c of [...MATH_TAB, ...CAS_TAB]) {
      for (const e of c.entries) {
        const fill = (first: string) =>
          e.latex
            .replace('#@', '2')
            .replace(/\{#\?=#\?\}/, '{k=1}')
            .replace(/#0/g, first)
            .replace(/#\?/g, '3');
        // functions with two or more arguments get "2,3"
        const ok = ['2', '2,3', 'x^2,x', 'x^2,x,0', 'x^2,x,0,1'].some(
          (f) => parseLatex(fill(f), { functions: new Set(CAS_COMMANDS) }).ok,
        );
        expect(ok, `${e.name}: ${fill('2')}`).toBe(true);
      }
    }
    const inCas = new Set(CAS_TAB.flatMap((c) => c.entries.map((e) => e.name)));
    for (const c of CAS_COMMANDS) expect(inCas.has(c), c).toBe(true);
  });

  it('catalogue is sorted, unique and jumps by letter', () => {
    const all = catalog();
    expect(new Set(all.map((e) => e.name)).size).toBe(all.length);
    expect(all[jumpTo(all, 'T')].name).toMatch(/^t/i);
    expect(jumpTo(all, 'ö')).toBe(-1);
    expect(userEntries(['g', 'area'])[0]).toMatchObject({
      name: 'area',
      latex: '\\operatorname{area}\\left(#0\\right)',
    });
  });
});
