/**
 * The template key (prompt 027): textbook structures with placeholders, inserted at the cursor.
 * `#0` = the selection (or the first placeholder), `#?` = further placeholders (MathLive syntax).
 */
export interface Template {
  id: string;
  latex: string;
  /** shown in the palette (LaTeX) */
  preview: string;
  label: string;
}

export const TEMPLATES: readonly Template[] = [
  { id: 'frac', latex: '\\frac{#0}{#?}', preview: '\\frac{a}{b}', label: 'Fraction' },
  { id: 'pow', latex: '#0^{#?}', preview: 'a^{b}', label: 'Power' },
  { id: 'sqrt', latex: '\\sqrt{#0}', preview: '\\sqrt{a}', label: 'Square root' },
  { id: 'root', latex: '\\sqrt[#?]{#0}', preview: '\\sqrt[n]{a}', label: 'n-th root' },
  {
    id: 'exp10',
    latex: '#0\\times10^{#?}',
    preview: 'a\\times10^{n}',
    label: 'Times power of ten',
  },
  { id: 'sub', latex: '#0_{#?}', preview: 'a_{n}', label: 'Subscript' },
  { id: 'abs', latex: '\\left|#0\\right|', preview: '\\left|a\\right|', label: 'Absolute value' },
  { id: 'paren', latex: '\\left(#0\\right)', preview: '\\left(a\\right)', label: 'Parentheses' },
  { id: 'sum', latex: '\\sum_{#?=#?}^{#?}#0', preview: '\\sum_{k=1}^{n}a', label: 'Sum' },
  { id: 'prod', latex: '\\prod_{#?=#?}^{#?}#0', preview: '\\prod_{k=1}^{n}a', label: 'Product' },
  {
    id: 'deriv',
    latex: '\\frac{\\mathrm{d}}{\\mathrm{d}#?}#0',
    preview: '\\frac{d}{dx}f',
    label: 'Derivative',
  },
  {
    id: 'int',
    latex: '\\int_{#?}^{#?}#0\\,\\mathrm{d}#?',
    preview: '\\int_{a}^{b}f\\,dx',
    label: 'Definite integral',
  },
  {
    id: 'log',
    latex: '\\log_{#?}\\left(#0\\right)',
    preview: '\\log_{b}(a)',
    label: 'Logarithm to base b',
  },
  { id: 'list', latex: '\\lbrace #0,#?\\rbrace', preview: '\\lbrace a,b\\rbrace', label: 'List' },
  {
    id: 'mat2',
    latex: '\\begin{pmatrix}#0 & #?\\\\ #? & #?\\end{pmatrix}',
    preview: '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}',
    label: '2×2 matrix',
  },
  { id: 'deg', latex: '#0^{\\circ}', preview: 'a^{\\circ}', label: 'Degrees' },
];
