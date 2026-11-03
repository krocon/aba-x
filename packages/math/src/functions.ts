/**
 * Catalogue of built-in functions and constants – the single source for parsers, serializers, the
 * evaluator and the allow-list of the CAS adapter (design 003 E4, technical evaluation §3).
 */

export interface FunctionDef {
  /** Canonical name in the AST and in text input. */
  readonly name: string;
  readonly minArgs: number;
  readonly maxArgs: number;
  /** Other names accepted in text input (`asin` for `arcsin` …). */
  readonly aliases?: readonly string[];
  /** LaTeX command without backslash, if LaTeX has one (`sin`, `arcsin`, `ln`). */
  readonly latex?: string;
  /** Short description for help and the VARS/catalogue menus. */
  readonly help: string;
}

const f = (
  name: string,
  minArgs: number,
  maxArgs: number,
  help: string,
  extra: Partial<FunctionDef> = {},
): FunctionDef => ({ name, minArgs, maxArgs, help, ...extra });

export const FUNCTIONS: readonly FunctionDef[] = [
  f('sin', 1, 1, 'sine', { latex: 'sin' }),
  f('cos', 1, 1, 'cosine', { latex: 'cos' }),
  f('tan', 1, 1, 'tangent', { latex: 'tan' }),
  f('cot', 1, 1, 'cotangent', { latex: 'cot' }),
  f('sec', 1, 1, 'secant', { latex: 'sec' }),
  f('csc', 1, 1, 'cosecant', { latex: 'csc' }),
  f('arcsin', 1, 1, 'inverse sine', { latex: 'arcsin', aliases: ['asin'] }),
  f('arccos', 1, 1, 'inverse cosine', { latex: 'arccos', aliases: ['acos'] }),
  f('arctan', 1, 1, 'inverse tangent', { latex: 'arctan', aliases: ['atan'] }),
  f('sinh', 1, 1, 'hyperbolic sine', { latex: 'sinh' }),
  f('cosh', 1, 1, 'hyperbolic cosine', { latex: 'cosh' }),
  f('tanh', 1, 1, 'hyperbolic tangent', { latex: 'tanh' }),
  f('arsinh', 1, 1, 'inverse hyperbolic sine', { aliases: ['asinh', 'arcsinh'] }),
  f('arcosh', 1, 1, 'inverse hyperbolic cosine', { aliases: ['acosh', 'arccosh'] }),
  f('artanh', 1, 1, 'inverse hyperbolic tangent', { aliases: ['atanh', 'arctanh'] }),
  f('exp', 1, 1, 'exponential function', { latex: 'exp' }),
  f('ln', 1, 1, 'natural logarithm', { latex: 'ln' }),
  /** log(x) = base 10, log(x, b) = base b – calculator convention. */
  f('log', 1, 2, 'logarithm (base 10, or log(x, b))', { latex: 'log', aliases: ['lg'] }),
  f('sqrt', 1, 1, 'square root'),
  /** root(x, n) = n-th root. */
  f('root', 2, 2, 'n-th root: root(x, n)'),
  f('abs', 1, 1, 'absolute value'),
  f('sign', 1, 1, 'sign', { aliases: ['sgn'] }),
  f('floor', 1, 1, 'round down'),
  f('ceil', 1, 1, 'round up'),
  f('round', 1, 1, 'round to nearest'),
  f('min', 2, 32, 'minimum'),
  f('max', 2, 32, 'maximum'),
  f('gcd', 2, 32, 'greatest common divisor'),
  f('lcm', 2, 32, 'least common multiple'),
  f('mod', 2, 2, 'remainder: mod(a, n)'),
  f('nCr', 2, 2, 'binomial coefficient', { aliases: ['binomial'] }),
  f('nPr', 2, 2, 'permutations'),
  f('erf', 1, 1, 'error function', { latex: 'operatorname{erf}' }),
  // complex numbers (prompt 027, ABA-T1 home view); the CAS does not know them (adapter allow-list)
  f('re', 1, 1, 'real part', { latex: 'operatorname{re}', aliases: ['real'] }),
  f('im', 1, 1, 'imaginary part', { latex: 'operatorname{im}', aliases: ['imag'] }),
  f('conj', 1, 1, 'complex conjugate', { latex: 'operatorname{conj}' }),
  f('arg', 1, 1, 'argument (angle) of a complex number', { latex: 'arg' }),
  // units (prompt 031): values with units like 5_m; the CAS does not know them
  f('convert', 2, 2, 'convert(value, 1_unit): value in another unit'),
  f('mksa', 1, 1, 'value in SI base units'),
  f('ufactor', 2, 2, 'ufactor(value, 1_unit): value in this unit times SI base units'),
  f('usimplify', 1, 1, 'value in a named SI unit (N, J, W, …)'),
  // based integers (prompt 031)
  f('bitand', 2, 2, 'bitwise AND'),
  f('bitor', 2, 2, 'bitwise OR'),
  f('bitxor', 2, 2, 'bitwise exclusive OR'),
  f('bitnot', 1, 1, 'bitwise NOT'),
  f('bitsl', 1, 2, 'shift left (by n bits)'),
  f('bitsr', 1, 2, 'shift right, logical'),
  f('bitasr', 1, 2, 'shift right, arithmetic'),
  f('bitrl', 1, 2, 'rotate left'),
  f('bitrr', 1, 2, 'rotate right'),
  f('r2b', 1, 1, 'integer → based integer'),
  f('b2r', 1, 1, 'based integer → real number'),
  f('bin', 1, 1, 'show in base 2'),
  f('oct', 1, 1, 'show in base 8'),
  f('dec', 1, 1, 'show in base 10'),
  f('hex', 1, 1, 'show in base 16'),
  // lists and matrices (prompt 032)
  f('size', 1, 1, 'number of items of a list, rows and columns of a matrix'),
  f('sumlist', 1, 1, 'sum of the items of a list'),
  f('prodlist', 1, 1, 'product of the items of a list'),
  f('deltalist', 1, 1, 'differences of neighbouring items'),
  f('sort', 1, 1, 'list sorted ascending'),
  f('reverse', 1, 1, 'list in reverse order'),
  f('concat', 2, 2, 'two lists joined'),
  f('pos', 2, 2, 'position of a value in a list (0 = not found)'),
  f('get', 2, 3, 'item i of a list, entry (i, j) of a matrix'),
  f('makelist', 4, 5, 'makelist(expr, var, a, b[, step])'),
  f('dot', 2, 2, 'dot product of two vectors'),
  f('cross', 2, 2, 'cross product of two 3-vectors'),
  f('identity', 1, 1, 'identity matrix n×n'),
  f('randmat', 1, 2, 'random integer matrix'),
  f('det', 1, 1, 'determinant'),
  f('inv', 1, 1, 'inverse matrix'),
  f('trn', 1, 1, 'transposed matrix'),
  f('rref', 1, 1, 'reduced row echelon form'),
  f('rank', 1, 1, 'rank of a matrix'),
  f('trace', 1, 1, 'trace of a square matrix'),
  f('norm', 1, 1, 'Frobenius norm of a matrix, length of a vector'),
  f('eigval', 1, 1, 'eigenvalues'),
  f('eigvec', 1, 1, 'eigenvectors of a symmetric matrix (columns)'),
  f('linsolve', 2, 2, 'linsolve(A, b): solution of A·x = b'),
];

/** Names that build their own node type in text input: diff(f, x[, n]), integrate(f, x[, a, b]), … */
export const OPERATOR_FUNCTIONS = ['diff', 'integrate', 'sum', 'product', 'limit'] as const;

export const CONSTANTS = ['pi', 'e', 'i', 'inf'] as const;

const byName = new Map<string, FunctionDef>();
for (const def of FUNCTIONS) {
  byName.set(def.name, def);
  for (const a of def.aliases ?? []) byName.set(a, def);
}

/** Resolves a name or alias to its definition. */
export function lookupFunction(name: string): FunctionDef | undefined {
  return byName.get(name);
}

const latexCommands = new Map<string, FunctionDef>();
for (const def of FUNCTIONS) if (def.latex) latexCommands.set(def.latex, def);
for (const [cmd, name] of [
  ['arcsinh', 'arsinh'],
  ['arccosh', 'arcosh'],
  ['arctanh', 'artanh'],
  ['sgn', 'sign'],
] as const) {
  latexCommands.set(cmd, byName.get(name)!);
}

/** Function for a LaTeX command (`sin` → sin, `arcsin` → arcsin). */
export function lookupLatexFunction(command: string): FunctionDef | undefined {
  return latexCommands.get(command);
}

export function isConstant(name: string): boolean {
  return (CONSTANTS as readonly string[]).includes(name);
}
