import { inline, render, titleOf } from './notes-logic';

describe('notes', () => {
  it('renders the Markdown subset as data', () => {
    expect(inline('a **b** *c* `d` $x^2$')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'b', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'i', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'd' },
      { kind: 'text', text: ' ' },
      { kind: 'math', text: 'x^2' },
    ]);
    const b = render('# Title\nline one\nline two\n\n- item\n<script>');
    expect(b.map((x) => x.kind)).toEqual(['h', 'p', 'li', 'p']);
    expect(b[1].parts[0]).toEqual({ kind: 'text', text: 'line one line two' });
    expect(b[3].parts[0]).toEqual({ kind: 'text', text: '<script>' });
  });

  it('takes the title from the first line', () => {
    expect(titleOf('\n# **Quadratic** formula\n…')).toBe('Quadratic formula');
    expect(titleOf('')).toBe('Note');
  });
});
