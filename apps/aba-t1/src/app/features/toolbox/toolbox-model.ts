/**
 * The toolbox of ABA-T1 (prompt 030) as data: tabs → categories → commands. Insertion templates
 * come from the command name (LaTeX command where one exists, else `\operatorname{name}`).
 * Pure; the catalogue is every command once, alphabetically.
 */
import { lookupFunction } from '@aba/math/functions';

export type ToolboxTab = 'math' | 'cas' | 'app' | 'user' | 'catalog';

export interface ToolEntry {
  /** command name = help key */
  name: string;
  latex: string;
  text: string;
  /** a CAS command (works in the CAS view) */
  cas?: boolean;
}

export interface ToolCategory {
  id: string;
  en: string;
  de: string;
  entries: ToolEntry[];
}

const fn = (name: string, cas = false): ToolEntry => {
  const def = lookupFunction(name);
  const cmd =
    def?.latex && !def.latex.startsWith('operatorname')
      ? `\\${def.latex}`
      : `\\operatorname{${name}}`;
  return { name, latex: `${cmd}\\left(#0\\right)`, text: `${name}(`, ...(cas ? { cas } : {}) };
};
const tpl = (name: string, latex: string, text: string, cas = false): ToolEntry => ({
  name,
  latex,
  text,
  ...(cas ? { cas } : {}),
});
const cat = (id: string, en: string, de: string, entries: ToolEntry[]): ToolCategory => ({
  id,
  en,
  de,
  entries,
});

export const MATH_TAB: ToolCategory[] = [
  cat(
    'numbers',
    'Numbers',
    'Zahlen',
    ['abs', 'sign', 'floor', 'ceil', 'round', 'min', 'max'].map((n) => fn(n)),
  ),
  cat('arith', 'Arithmetic', 'Arithmetik', [
    ...['gcd', 'lcm', 'mod'].map((n) => fn(n)),
    tpl('sqrt', '\\sqrt{#0}', 'sqrt('),
    tpl('root', '\\sqrt[#?]{#0}', 'root('),
  ]),
  cat(
    'trig',
    'Trigonometry',
    'Trigonometrie',
    ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan'].map((n) => fn(n)),
  ),
  cat(
    'hyp',
    'Hyperbolic',
    'Hyperbolisch',
    ['sinh', 'cosh', 'tanh', 'arsinh', 'arcosh', 'artanh'].map((n) => fn(n)),
  ),
  cat(
    'explog',
    'Exp & log',
    'Exp & Log',
    ['exp', 'ln', 'log'].map((n) => fn(n)),
  ),
  cat(
    'complex',
    'Complex',
    'Komplex',
    ['re', 'im', 'conj', 'arg', 'abs'].map((n) => fn(n)),
  ),
  cat('prob', 'Probability', 'Wahrscheinlichkeit', [
    tpl('factorial', '#@!', '!'),
    fn('nCr'),
    fn('nPr'),
    fn('erf'),
  ]),
  cat('calc', 'Calculus', 'Analysis', [
    tpl('sum', '\\sum_{#?=#?}^{#?}#0', 'sum('),
    tpl('product', '\\prod_{#?=#?}^{#?}#0', 'product('),
    tpl('integral', '\\int_{#?}^{#?}#0\\,\\mathrm{d}x', 'integrate('),
  ]),
];

export const CAS_TAB: ToolCategory[] = [
  cat(
    'algebra',
    'Algebra',
    'Algebra',
    ['simplify', 'expand', 'factor', 'partfrac'].map((n) => fn(n, true)),
  ),
  cat('calculus', 'Calculus', 'Analysis', [
    tpl('derivative', '\\frac{\\mathrm{d}}{\\mathrm{d}x}#0', 'diff(', true),
    ...['diff', 'integrate', 'limit', 'taylor', 'laplace'].map((n) => fn(n, true)),
  ]),
  cat(
    'solve',
    'Solve',
    'Lösen',
    ['solve', 'nsolve'].map((n) => fn(n, true)),
  ),
  cat(
    'integer',
    'Integer',
    'Ganzzahl',
    [
      'ifactor',
      'isprime',
      'nextprime',
      'prevprime',
      'euler',
      'divisors',
      'iquo',
      'irem',
      'gcd',
      'lcm',
    ].map((n) => fn(n, true)),
  ),
  cat(
    'poly',
    'Polynomial',
    'Polynom',
    ['quo', 'rem', 'degree', 'coeff'].map((n) => fn(n, true)),
  ),
];

/** Every command once, alphabetically (catalogue). */
export function catalog(): ToolEntry[] {
  const seen = new Map<string, ToolEntry>();
  for (const c of [...MATH_TAB, ...CAS_TAB])
    for (const e of c.entries) if (!seen.has(e.name)) seen.set(e.name, e);
  return [...seen.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  );
}

/** Index of the first catalogue entry starting with a letter (catalogue jump), or −1. */
export function jumpTo(entries: readonly ToolEntry[], letter: string): number {
  const l = letter.toLowerCase();
  return entries.findIndex((e) => e.name.toLowerCase().startsWith(l));
}

/** User functions as entries (User tab). */
export function userEntries(names: Iterable<string>): ToolEntry[] {
  return [...names].sort().map((name) => ({
    name,
    latex:
      name.length === 1 ? `${name}\\left(#0\\right)` : `\\operatorname{${name}}\\left(#0\\right)`,
    text: `${name}(`,
  }));
}

/** Character palette (⇧Vars). */
export const CHARS: readonly { latex: string; text: string; label: string }[] = [
  ...[
    'alpha',
    'beta',
    'gamma',
    'delta',
    'epsilon',
    'theta',
    'lambda',
    'mu',
    'pi',
    'rho',
    'sigma',
    'tau',
    'phi',
    'omega',
  ].map((g) => ({
    latex: `\\${g}`,
    text: String.fromCodePoint(
      {
        alpha: 945,
        beta: 946,
        gamma: 947,
        delta: 948,
        epsilon: 949,
        theta: 952,
        lambda: 955,
        mu: 956,
        pi: 960,
        rho: 961,
        sigma: 963,
        tau: 964,
        phi: 966,
        omega: 969,
      }[g]!,
    ),
    label: g,
  })),
  { latex: '\\Delta', text: 'Δ', label: 'Delta' },
  { latex: '\\Sigma', text: 'Σ', label: 'Sigma' },
  { latex: '\\Omega', text: 'Ω', label: 'Omega' },
  { latex: '\\le', text: '<=', label: 'less or equal' },
  { latex: '\\ge', text: '>=', label: 'greater or equal' },
  { latex: '\\ne', text: '!=', label: 'not equal' },
  { latex: '\\infty', text: 'inf', label: 'infinity' },
  { latex: '^{\\circ}', text: '°', label: 'degree' },
  { latex: '\\pm', text: '±', label: 'plus minus' },
  { latex: '\\to', text: '→', label: 'arrow' },
  { latex: '\\angle', text: '∠', label: 'angle' },
  { latex: '\\%', text: '%', label: 'percent' },
  { latex: '!', text: '!', label: 'factorial' },
  { latex: '\\_', text: '_', label: 'underscore' },
  { latex: '"', text: '"', label: 'quote' },
  { latex: '#', text: '#', label: 'hash' },
];
