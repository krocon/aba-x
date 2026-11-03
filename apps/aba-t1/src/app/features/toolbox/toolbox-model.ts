/**
 * The toolbox of ABA-T1 (prompt 030) as data: tabs → categories → commands. Insertion templates
 * come from the command name (LaTeX command where one exists, else `\operatorname{name}`).
 * Pure; the catalogue is every command once, alphabetically.
 */
import { lookupFunction } from '@aba/math/functions';
import { parseText } from '@aba/math/parser/text-parser';
import { toLatex } from '@aba/math/serializer';
import { CONSTANTS } from '@aba/math/units/constants.data';
import { UNIT_MENU } from '@aba/math/units/units.data';

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
  cat(
    'units',
    'Units',
    'Einheiten',
    ['convert', 'mksa', 'ufactor', 'usimplify'].map((n) => fn(n)),
  ),
  cat('base', 'Integer base', 'Ganzzahl-Basis', [
    ...['bitand', 'bitor', 'bitxor', 'bitnot', 'bitsl', 'bitsr', 'bitasr', 'bitrl', 'bitrr'].map(
      (n) => fn(n),
    ),
    ...['r2b', 'b2r', 'bin', 'oct', 'dec', 'hex'].map((n) => fn(n)),
  ]),
  cat(
    'list',
    'List',
    'Liste',
    [
      'size',
      'sumlist',
      'prodlist',
      'deltalist',
      'sort',
      'reverse',
      'concat',
      'pos',
      'get',
      'makelist',
    ].map((n) => fn(n)),
  ),
  cat('matrix', 'Matrix', 'Matrix', [
    tpl('matrix2', '\\begin{pmatrix}#0&#?\\\\#?&#?\\end{pmatrix}', '[['),
    ...[
      'det',
      'inv',
      'trn',
      'rref',
      'rank',
      'trace',
      'norm',
      'eigval',
      'eigvec',
      'linsolve',
      'identity',
      'randmat',
      'dot',
      'cross',
    ].map((n) => fn(n)),
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
  cat(
    'cmatrix',
    'Matrix',
    'Matrix',
    ['det', 'inv', 'trn'].map((n) => fn(n, true)),
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

/** Units key (⇧Template): unit categories and constants (prompt 031). */
export function unitCategories(): ToolCategory[] {
  const names: Record<string, [string, string]> = {
    length: ['Length', 'Länge'],
    area: ['Area', 'Fläche'],
    volume: ['Volume', 'Volumen'],
    time: ['Time', 'Zeit'],
    speed: ['Speed', 'Geschwindigkeit'],
    mass: ['Mass', 'Masse'],
    force: ['Force', 'Kraft'],
    energy: ['Energy', 'Energie'],
    power: ['Power', 'Leistung'],
    pressure: ['Pressure', 'Druck'],
    temperature: ['Temperature', 'Temperatur'],
    electricity: ['Electricity', 'Elektrizität'],
    amount: ['Amount', 'Stoffmenge'],
    light: ['Light', 'Licht'],
    radiation: ['Radiation', 'Strahlung'],
    viscosity: ['Viscosity', 'Viskosität'],
    angle: ['Angle', 'Winkel'],
  };
  const units = Object.entries(UNIT_MENU).map(([id, list]) =>
    cat(
      id,
      names[id]?.[0] ?? id,
      names[id]?.[1] ?? id,
      list.map((u) => ({ name: u, latex: `\\mathrm{\\_${u}}`, text: `_${u}` })),
    ),
  );
  const constNames: Record<string, [string, string]> = {
    math: ['Constants: mathematics', 'Konstanten: Mathematik'],
    chemistry: ['Constants: chemistry', 'Konstanten: Chemie'],
    physics: ['Constants: physics', 'Konstanten: Physik'],
    quantum: ['Constants: quantum', 'Konstanten: Quanten'],
  };
  const consts = Object.entries(constNames).map(([id, [en, de]]) =>
    cat(
      `const-${id}`,
      en,
      de,
      CONSTANTS.filter((c) => c.category === id).map((c) => {
        const text = c.unit ? `${c.value}*${c.unit}` : String(c.value);
        const p = parseText(c.unit ? `(${text})` : text);
        return { name: `${c.symbol} = ${c.value}`, latex: p.ok ? toLatex(p.value) : text, text };
      }),
    ),
  );
  return [...units, ...consts];
}

/** Base key (⇧−): literals and the integer functions (prompt 031). */
export function baseEntries(): ToolEntry[] {
  return [
    { name: '#…h', latex: '\\#\\mathrm{#?h}', text: '#' },
    { name: '#…b', latex: '\\#\\mathrm{#?b}', text: '#' },
    { name: '#…o', latex: '\\#\\mathrm{#?o}', text: '#' },
    { name: '#…d', latex: '\\#\\mathrm{#?d}', text: '#' },
    ...MATH_TAB.find((c) => c.id === 'base')!.entries,
  ];
}
