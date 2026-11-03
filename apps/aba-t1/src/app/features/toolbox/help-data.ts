/**
 * Help texts of ABA-T1 (prompt 030), written for this app (no manual texts of other products).
 * One entry per command of the toolbox/catalogue: syntax, description in English and German and an
 * example that can be inserted. View topics explain the screens.
 */
export interface CommandHelp {
  syntax: string;
  en: string;
  de: string;
  /** example input (LaTeX) */
  example: string;
}

const h = (syntax: string, en: string, de: string, example: string): CommandHelp => ({
  syntax,
  en,
  de,
  example,
});

export const COMMAND_HELP: Record<string, CommandHelp> = {
  abs: h(
    'abs(x)',
    'Absolute value; for complex numbers the modulus.',
    'Betrag; bei komplexen Zahlen der Betrag |z|.',
    '\\left|-3\\right|',
  ),
  sign: h('sign(x)', 'Sign: −1, 0 or 1.', 'Vorzeichen: −1, 0 oder 1.', '\\operatorname{sign}(-2)'),
  floor: h(
    'floor(x)',
    'Largest integer ≤ x.',
    'Größte ganze Zahl ≤ x.',
    '\\operatorname{floor}(2.7)',
  ),
  ceil: h(
    'ceil(x)',
    'Smallest integer ≥ x.',
    'Kleinste ganze Zahl ≥ x.',
    '\\operatorname{ceil}(2.1)',
  ),
  round: h(
    'round(x)',
    'Rounds to the nearest integer.',
    'Rundet auf die nächste ganze Zahl.',
    '\\operatorname{round}(2.5)',
  ),
  min: h(
    'min(a, b, …)',
    'Smallest of the arguments.',
    'Kleinstes der Argumente.',
    '\\operatorname{min}(3,1,2)',
  ),
  max: h(
    'max(a, b, …)',
    'Largest of the arguments.',
    'Größtes der Argumente.',
    '\\operatorname{max}(3,1,2)',
  ),
  mod: h(
    'mod(a, n)',
    'Remainder of a divided by n (0 ≤ r < |n|).',
    'Rest von a geteilt durch n (0 ≤ r < |n|).',
    '\\operatorname{mod}(17,5)',
  ),
  gcd: h(
    'gcd(a, b)',
    'Greatest common divisor of integers (CAS: of polynomials).',
    'Größter gemeinsamer Teiler ganzer Zahlen (CAS: von Polynomen).',
    '\\operatorname{gcd}(12,18)',
  ),
  lcm: h(
    'lcm(a, b)',
    'Least common multiple of integers (CAS: of polynomials).',
    'Kleinstes gemeinsames Vielfaches (CAS: von Polynomen).',
    '\\operatorname{lcm}(4,6)',
  ),
  nCr: h(
    'nCr(n, k)',
    'Binomial coefficient: k of n without order.',
    'Binomialkoeffizient: k aus n ohne Reihenfolge.',
    '\\operatorname{nCr}(5,2)',
  ),
  nPr: h(
    'nPr(n, k)',
    'Permutations: k of n with order.',
    'Variationen: k aus n mit Reihenfolge.',
    '\\operatorname{nPr}(5,2)',
  ),
  factorial: h(
    'n!',
    'Factorial of a non-negative integer.',
    'Fakultät einer nicht negativen ganzen Zahl.',
    '5!',
  ),
  sin: h(
    'sin(x)',
    'Sine (angle mode from the settings).',
    'Sinus (Winkelmaß aus den Einstellungen).',
    '\\sin\\left(30\\right)',
  ),
  cos: h('cos(x)', 'Cosine.', 'Kosinus.', '\\cos\\left(0\\right)'),
  tan: h('tan(x)', 'Tangent.', 'Tangens.', '\\tan\\left(45\\right)'),
  cot: h('cot(x)', 'Cotangent 1/tan(x).', 'Kotangens 1/tan(x).', '\\cot\\left(45\\right)'),
  sec: h('sec(x)', 'Secant 1/cos(x).', 'Sekans 1/cos(x).', '\\sec\\left(0\\right)'),
  csc: h('csc(x)', 'Cosecant 1/sin(x).', 'Kosekans 1/sin(x).', '\\csc\\left(90\\right)'),
  arcsin: h(
    'arcsin(x)',
    'Inverse sine (complex results outside −1…1 if enabled).',
    'Arkussinus (außerhalb −1…1 komplex, wenn eingeschaltet).',
    '\\arcsin\\left(0.5\\right)',
  ),
  arccos: h('arccos(x)', 'Inverse cosine.', 'Arkuskosinus.', '\\arccos\\left(0.5\\right)'),
  arctan: h('arctan(x)', 'Inverse tangent.', 'Arkustangens.', '\\arctan\\left(1\\right)'),
  sinh: h('sinh(x)', 'Hyperbolic sine.', 'Sinus hyperbolicus.', '\\sinh\\left(1\\right)'),
  cosh: h('cosh(x)', 'Hyperbolic cosine.', 'Kosinus hyperbolicus.', '\\cosh\\left(1\\right)'),
  tanh: h('tanh(x)', 'Hyperbolic tangent.', 'Tangens hyperbolicus.', '\\tanh\\left(1\\right)'),
  arsinh: h(
    'arsinh(x)',
    'Inverse hyperbolic sine.',
    'Areasinus hyperbolicus.',
    '\\operatorname{arsinh}(1)',
  ),
  arcosh: h(
    'arcosh(x)',
    'Inverse hyperbolic cosine (x ≥ 1).',
    'Areakosinus hyperbolicus (x ≥ 1).',
    '\\operatorname{arcosh}(2)',
  ),
  artanh: h(
    'artanh(x)',
    'Inverse hyperbolic tangent (−1 < x < 1).',
    'Areatangens hyperbolicus (−1 < x < 1).',
    '\\operatorname{artanh}(0.5)',
  ),
  exp: h('exp(x)', 'Exponential function eˣ.', 'Exponentialfunktion eˣ.', '\\exp\\left(1\\right)'),
  ln: h('ln(x)', 'Natural logarithm.', 'Natürlicher Logarithmus.', '\\ln\\left(e\\right)'),
  log: h(
    'log(x) · log(x, b)',
    'Logarithm to base 10, or to base b.',
    'Logarithmus zur Basis 10 oder zur Basis b.',
    '\\log\\left(1000\\right)',
  ),
  sqrt: h(
    '√x',
    'Square root (complex for x < 0 if enabled).',
    'Quadratwurzel (für x < 0 komplex, wenn eingeschaltet).',
    '\\sqrt{2}',
  ),
  root: h(
    'root(x, n)',
    'n-th root; odd roots of negative numbers are real.',
    'n-te Wurzel; ungerade Wurzeln negativer Zahlen sind reell.',
    '\\sqrt[3]{-8}',
  ),
  erf: h('erf(x)', 'Error function.', 'Fehlerfunktion.', '\\operatorname{erf}(1)'),
  re: h(
    're(z)',
    'Real part of a complex number.',
    'Realteil einer komplexen Zahl.',
    '\\operatorname{re}(3+4i)',
  ),
  im: h('im(z)', 'Imaginary part.', 'Imaginärteil.', '\\operatorname{im}(3+4i)'),
  conj: h(
    'conj(z)',
    'Complex conjugate.',
    'Konjugiert komplexe Zahl.',
    '\\operatorname{conj}(3+4i)',
  ),
  arg: h(
    'arg(z)',
    'Argument (angle) of a complex number.',
    'Argument (Winkel) einer komplexen Zahl.',
    '\\arg\\left(i\\right)',
  ),
  sum: h(
    'Σ f(k), k = a…b',
    'Sum; in the CAS also with a symbolic upper bound.',
    'Summe; im CAS auch mit symbolischer oberer Grenze.',
    '\\sum_{k=1}^{10}k^2',
  ),
  product: h('Π f(k), k = a…b', 'Product.', 'Produkt.', '\\prod_{k=1}^{5}k'),
  integral: h(
    '∫ₐᵇ f(x) dx',
    'Definite integral (home: numerical, CAS: exact if possible).',
    'Bestimmtes Integral (Start: numerisch, CAS: exakt, wenn möglich).',
    '\\int_0^1x^2\\,\\mathrm{d}x',
  ),
  derivative: h(
    'd/dx f(x)',
    'Derivative (CAS).',
    'Ableitung (CAS).',
    '\\frac{\\mathrm{d}}{\\mathrm{d}x}x^3',
  ),
  limit: h(
    'limit(f, x, a)',
    'Limit of f for x → a (CAS).',
    'Grenzwert von f für x → a (CAS).',
    '\\operatorname{limit}(\\frac{\\sin(x)}{x},x,0)',
  ),
  simplify: h(
    'simplify(e)',
    'Simplifies an expression exactly.',
    'Vereinfacht einen Ausdruck exakt.',
    '\\operatorname{simplify}(\\frac{x^2-1}{x-1})',
  ),
  expand: h(
    'expand(e)',
    'Multiplies out products and powers.',
    'Multipliziert Produkte und Potenzen aus.',
    '\\operatorname{expand}((x+1)^3)',
  ),
  factor: h(
    'factor(e)',
    'Factors a polynomial.',
    'Faktorisiert ein Polynom.',
    '\\operatorname{factor}(x^2-5x+6)',
  ),
  partfrac: h(
    'partfrac(f, x)',
    'Partial fraction decomposition.',
    'Partialbruchzerlegung.',
    '\\operatorname{partfrac}(\\frac{1}{x^2-1},x)',
  ),
  solve: h(
    'solve(eq, x) · solve([eq1, eq2], [x, y])',
    'Solves an equation or a system exactly; every solution is checked.',
    'Löst eine Gleichung oder ein System exakt; jede Lösung wird geprüft.',
    '\\operatorname{solve}(x^2=2,x)',
  ),
  nsolve: h(
    'nsolve(eq, x, start) · nsolve(eq, x, a, b)',
    'Numerical root near a start value or in [a, b].',
    'Numerische Nullstelle nahe einem Startwert oder in [a, b].',
    '\\operatorname{nsolve}(\\cos(x)=x,x,1)',
  ),
  diff: h(
    'diff(f, x[, n])',
    'n-th derivative with respect to x.',
    'n-te Ableitung nach x.',
    '\\operatorname{diff}(\\sin(x)^2,x)',
  ),
  integrate: h(
    'integrate(f, x[, a, b])',
    'Antiderivative (without + C) or definite integral.',
    'Stammfunktion (ohne + C) oder bestimmtes Integral.',
    '\\operatorname{integrate}(x\\,e^x,x)',
  ),
  taylor: h(
    'taylor(f, x, n, a)',
    'Taylor polynomial of order n (≤ 12) around a (default 0).',
    'Taylorpolynom der Ordnung n (≤ 12) um a (Standard 0).',
    '\\operatorname{taylor}(e^x,x,4)',
  ),
  laplace: h(
    'laplace(f, t, s)',
    'Laplace transform.',
    'Laplace-Transformation.',
    '\\operatorname{laplace}(t^2,t,s)',
  ),
  quo: h(
    'quo(a, b)',
    'Quotient of polynomial division.',
    'Quotient der Polynomdivision.',
    '\\operatorname{quo}(x^3-1,x-1)',
  ),
  rem: h(
    'rem(a, b)',
    'Remainder of polynomial division.',
    'Rest der Polynomdivision.',
    '\\operatorname{rem}(x^3+2,x-1)',
  ),
  degree: h(
    'degree(p, x)',
    'Degree of a polynomial.',
    'Grad eines Polynoms.',
    '\\operatorname{degree}(3x^5+2x,x)',
  ),
  coeff: h(
    'coeff(p, x)',
    'Coefficients from the highest power down.',
    'Koeffizienten von der höchsten Potenz an.',
    '\\operatorname{coeff}(3x^2+2x+1,x)',
  ),
  ifactor: h(
    'ifactor(n)',
    'Prime factorisation (n ≤ 2⁵³).',
    'Primfaktorzerlegung (n ≤ 2⁵³).',
    '\\operatorname{ifactor}(360)',
  ),
  isprime: h('isprime(n)', 'Is n a prime?', 'Ist n eine Primzahl?', '\\operatorname{isprime}(97)'),
  nextprime: h(
    'nextprime(n)',
    'Smallest prime greater than n.',
    'Kleinste Primzahl größer als n.',
    '\\operatorname{nextprime}(100)',
  ),
  prevprime: h(
    'prevprime(n)',
    'Largest prime smaller than n.',
    'Größte Primzahl kleiner als n.',
    '\\operatorname{prevprime}(100)',
  ),
  euler: h(
    'euler(n)',
    'Euler’s totient φ(n).',
    'Eulersche φ-Funktion.',
    '\\operatorname{euler}(36)',
  ),
  divisors: h(
    'divisors(n)',
    'All positive divisors.',
    'Alle positiven Teiler.',
    '\\operatorname{divisors}(12)',
  ),
  iquo: h(
    'iquo(a, b)',
    'Integer quotient.',
    'Ganzzahliger Quotient.',
    '\\operatorname{iquo}(17,5)',
  ),
  irem: h(
    'irem(a, b)',
    'Integer remainder (0 ≤ r < |b|).',
    'Ganzzahliger Rest (0 ≤ r < |b|).',
    '\\operatorname{irem}(17,5)',
  ),
  convert: h(
    'convert(value, 1_unit)',
    'Converts a quantity into another unit of the same dimension; temperatures convert absolutely.',
    'Rechnet eine Größe in eine andere Einheit derselben Dimension um; Temperaturen absolut.',
    '\\operatorname{convert}(100\\mathrm{\\_km}/\\mathrm{\\_h},1\\mathrm{\\_m}/\\mathrm{\\_s})',
  ),
  mksa: h(
    'mksa(value)',
    'Expresses a quantity in SI base units (m, kg, s, A, K, mol, cd).',
    'Drückt eine Größe in SI-Basiseinheiten aus.',
    '\\operatorname{mksa}(1\\mathrm{\\_N})',
  ),
  ufactor: h(
    'ufactor(value, 1_unit)',
    'Expresses a quantity with the given unit and SI base units for the rest.',
    'Drückt eine Größe mit der gegebenen Einheit und SI-Basiseinheiten für den Rest aus.',
    '\\operatorname{ufactor}(1\\mathrm{\\_J},1\\mathrm{\\_N})',
  ),
  usimplify: h(
    'usimplify(value)',
    'Uses a named SI unit (N, J, W, Pa, …) where one fits.',
    'Verwendet eine benannte SI-Einheit (N, J, W, Pa, …), wenn eine passt.',
    '\\operatorname{usimplify}(2\\mathrm{\\_kg}\\cdot3\\mathrm{\\_m})',
  ),
  bitand: h(
    'bitand(a, b)',
    'Bitwise AND of integers.',
    'Bitweises UND ganzer Zahlen.',
    '\\operatorname{bitand}(\\#\\mathrm{Ch},\\#\\mathrm{Ah})',
  ),
  bitor: h(
    'bitor(a, b)',
    'Bitwise OR.',
    'Bitweises ODER.',
    '\\operatorname{bitor}(\\#\\mathrm{Ch},\\#\\mathrm{Ah})',
  ),
  bitxor: h(
    'bitxor(a, b)',
    'Bitwise exclusive OR.',
    'Bitweises exklusives ODER.',
    '\\operatorname{bitxor}(\\#\\mathrm{Ch},\\#\\mathrm{Ah})',
  ),
  bitnot: h(
    'bitnot(a)',
    'Bitwise NOT within the word size.',
    'Bitweises NICHT innerhalb der Wortbreite.',
    '\\operatorname{bitnot}(\\#\\mathrm{0h})',
  ),
  bitsl: h(
    'bitsl(a[, n])',
    'Shift left by n bits (default 1).',
    'Um n Bit nach links schieben (Standard 1).',
    '\\operatorname{bitsl}(\\#\\mathrm{1h},4)',
  ),
  bitsr: h(
    'bitsr(a[, n])',
    'Logical shift right.',
    'Logisch nach rechts schieben.',
    '\\operatorname{bitsr}(\\#\\mathrm{F0h},4)',
  ),
  bitasr: h(
    'bitasr(a[, n])',
    'Arithmetic shift right (keeps the sign bit).',
    'Arithmetisch nach rechts schieben (Vorzeichenbit bleibt).',
    '\\operatorname{bitasr}(\\#\\mathrm{80h})',
  ),
  bitrl: h(
    'bitrl(a[, n])',
    'Rotate left within the word size.',
    'Innerhalb der Wortbreite nach links rotieren.',
    '\\operatorname{bitrl}(\\#\\mathrm{81h})',
  ),
  bitrr: h(
    'bitrr(a[, n])',
    'Rotate right.',
    'Nach rechts rotieren.',
    '\\operatorname{bitrr}(\\#\\mathrm{81h})',
  ),
  r2b: h(
    'r2b(n)',
    'Integer → based integer in the default base.',
    'Ganze Zahl → Zahl in der eingestellten Basis.',
    '\\operatorname{r2b}(200)',
  ),
  b2r: h(
    'b2r(#…)',
    'Based integer → real number (signed per settings).',
    'Basis-Zahl → reelle Zahl (Vorzeichen laut Einstellung).',
    '\\operatorname{b2r}(\\#\\mathrm{FFh})',
  ),
  bin: h(
    'bin(n)',
    'Shows an integer in base 2.',
    'Zeigt eine ganze Zahl zur Basis 2.',
    '\\operatorname{bin}(10)',
  ),
  oct: h(
    'oct(n)',
    'Shows an integer in base 8.',
    'Zeigt eine ganze Zahl zur Basis 8.',
    '\\operatorname{oct}(64)',
  ),
  dec: h(
    'dec(n)',
    'Shows an integer in base 10.',
    'Zeigt eine ganze Zahl zur Basis 10.',
    '\\operatorname{dec}(\\#\\mathrm{FFh})',
  ),
  hex: h(
    'hex(n)',
    'Shows an integer in base 16.',
    'Zeigt eine ganze Zahl zur Basis 16.',
    '\\operatorname{hex}(255)',
  ),
  size: h(
    'size(L) · size(M)',
    'Number of items of a list; rows and columns of a matrix.',
    'Anzahl der Elemente einer Liste; Zeilen und Spalten einer Matrix.',
    '\\operatorname{size}(\\lbrace5,6,7\\rbrace)',
  ),
  sumlist: h(
    'sumlist(L)',
    'Sum of the items of a list.',
    'Summe der Elemente einer Liste.',
    '\\operatorname{sumlist}(\\lbrace1,2,3\\rbrace)',
  ),
  prodlist: h(
    'prodlist(L)',
    'Product of the items of a list.',
    'Produkt der Elemente einer Liste.',
    '\\operatorname{prodlist}(\\lbrace1,2,3\\rbrace)',
  ),
  deltalist: h(
    'deltalist(L)',
    'Differences of neighbouring items.',
    'Differenzen benachbarter Elemente.',
    '\\operatorname{deltalist}(\\lbrace1,4,9\\rbrace)',
  ),
  sort: h(
    'sort(L)',
    'The list sorted ascending.',
    'Die Liste aufsteigend sortiert.',
    '\\operatorname{sort}(\\lbrace3,1,2\\rbrace)',
  ),
  reverse: h(
    'reverse(L)',
    'The list in reverse order.',
    'Die Liste in umgekehrter Reihenfolge.',
    '\\operatorname{reverse}(\\lbrace1,2,3\\rbrace)',
  ),
  concat: h(
    'concat(L1, L2)',
    'Joins two lists.',
    'Hängt zwei Listen aneinander.',
    '\\operatorname{concat}(\\lbrace1\\rbrace,\\lbrace2,3\\rbrace)',
  ),
  pos: h(
    'pos(L, x)',
    'Position of x in the list (0 = not found).',
    'Position von x in der Liste (0 = nicht gefunden).',
    '\\operatorname{pos}(\\lbrace4,5,6\\rbrace,5)',
  ),
  get: h(
    'get(L, i) · get(M, i, j)',
    'Item i of a list, entry (i, j) of a matrix (counting from 1).',
    'Element i einer Liste, Eintrag (i, j) einer Matrix (ab 1 gezählt).',
    '\\operatorname{get}(\\lbrace4,5,6\\rbrace,2)',
  ),
  makelist: h(
    'makelist(expr, var, a, b[, step])',
    'List of expr for var = a, a + step, …, b.',
    'Liste von expr für var = a, a + Schritt, …, b.',
    '\\operatorname{makelist}(k^2,k,1,5)',
  ),
  dot: h(
    'dot(u, v)',
    'Dot product of two vectors (lists).',
    'Skalarprodukt zweier Vektoren (Listen).',
    '\\operatorname{dot}(\\lbrace1,2\\rbrace,\\lbrace3,4\\rbrace)',
  ),
  cross: h(
    'cross(u, v)',
    'Cross product of two vectors with 3 components.',
    'Kreuzprodukt zweier Vektoren mit 3 Komponenten.',
    '\\operatorname{cross}(\\lbrace1,0,0\\rbrace,\\lbrace0,1,0\\rbrace)',
  ),
  identity: h(
    'identity(n)',
    'n×n identity matrix.',
    'n×n-Einheitsmatrix.',
    '\\operatorname{identity}(3)',
  ),
  randmat: h(
    'randmat(r[, c])',
    'Random integer matrix (−99…99).',
    'Zufällige ganzzahlige Matrix (−99…99).',
    '\\operatorname{randmat}(2,3)',
  ),
  det: h(
    'det(M)',
    'Determinant (CAS: exact, also with symbols).',
    'Determinante (CAS: exakt, auch mit Symbolen).',
    '\\operatorname{det}\\left(\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\right)',
  ),
  inv: h(
    'inv(M) · M^(-1)',
    'Inverse matrix (singular matrices are reported).',
    'Inverse Matrix (singuläre Matrizen werden gemeldet).',
    '\\operatorname{inv}\\left(\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\right)',
  ),
  trn: h(
    'trn(M)',
    'Transposed matrix.',
    'Transponierte Matrix.',
    '\\operatorname{trn}\\left(\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\right)',
  ),
  rref: h(
    'rref(M)',
    'Reduced row echelon form.',
    'Reduzierte Zeilenstufenform.',
    '\\operatorname{rref}\\left(\\begin{pmatrix}1&2&3\\\\4&5&6\\end{pmatrix}\\right)',
  ),
  rank: h(
    'rank(M)',
    'Rank of a matrix.',
    'Rang einer Matrix.',
    '\\operatorname{rank}\\left(\\begin{pmatrix}1&2\\\\2&4\\end{pmatrix}\\right)',
  ),
  trace: h(
    'trace(M)',
    'Sum of the diagonal.',
    'Summe der Diagonale.',
    '\\operatorname{trace}\\left(\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\right)',
  ),
  norm: h(
    'norm(M) · norm(v)',
    'Frobenius norm of a matrix, length of a vector.',
    'Frobeniusnorm einer Matrix, Länge eines Vektors.',
    '\\operatorname{norm}(\\lbrace3,4\\rbrace)',
  ),
  eigval: h(
    'eigval(M)',
    'Eigenvalues (numerical; complex pairs possible).',
    'Eigenwerte (numerisch; komplexe Paare möglich).',
    '\\operatorname{eigval}\\left(\\begin{pmatrix}2&1\\\\1&2\\end{pmatrix}\\right)',
  ),
  eigvec: h(
    'eigvec(M)',
    'Eigenvectors of a symmetric matrix as columns.',
    'Eigenvektoren einer symmetrischen Matrix als Spalten.',
    '\\operatorname{eigvec}\\left(\\begin{pmatrix}2&1\\\\1&2\\end{pmatrix}\\right)',
  ),
  linsolve: h(
    'linsolve(A, b)',
    'Solution x of A·x = b.',
    'Lösung x von A·x = b.',
    '\\operatorname{linsolve}\\left(\\begin{pmatrix}2&1\\\\1&3\\end{pmatrix},\\lbrace3,5\\rbrace\\right)',
  ),
  matrix2: h(
    '[[a, b], [c, d]]',
    '2×2 matrix template; the matrix editor (⇧4) makes larger ones.',
    '2×2-Matrixvorlage; größere im Matrixeditor (⇧4).',
    '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}',
  ),
};

export interface TopicHelp {
  en: string;
  de: string;
}

export const VIEW_HELP: Record<string, TopicHelp> = {
  home: {
    en: 'Home: type a calculation and press Enter. ↑ selects earlier entries, Enter copies one. Sto ▶ stores into a variable, := defines, = tests. Templates key: fractions, roots, sums. Toolbox: all functions.',
    de: 'Startansicht: Rechnung eingeben, Enter. ↑ wählt frühere Einträge, Enter übernimmt sie. Sto ▶ speichert in eine Variable, := definiert, = prüft. Vorlagen-Taste: Brüche, Wurzeln, Summen. Toolbox: alle Funktionen.',
  },
  rpn: {
    en: 'RPN: Enter puts the line on the stack (empty line: DUP), operators act at once, ⌫ on an empty line drops. ↑ selects a level: PICK, ROLL, ROLLD, DROPN, ECHO.',
    de: 'RPN: Enter legt die Zeile ab (leere Zeile: DUP), Operatoren wirken sofort, ⌫ in leerer Zeile löscht Ebene 1. ↑ wählt eine Ebene: PICK, ROLL, ROLLD, DROPN, ECHO.',
  },
  cas: {
    en: 'CAS: exact results. Commands are calls like factor(…) or solve(…, x); the toolbox CAS tab lists them. ⇧Enter or ≈ gives a decimal value. ≈ marks approximations, ? an unchecked result.',
    de: 'CAS: exakte Ergebnisse. Befehle sind Aufrufe wie factor(…) oder solve(…, x); der CAS-Reiter der Toolbox zeigt alle. ⇧Enter oder ≈ liefert einen Dezimalwert. ≈ markiert Näherungen, ? ungeprüfte Ergebnisse.',
  },
  settings: {
    en: 'Settings: ↑↓ choose a row, ←→ or Enter change it, OK or Esc closes.',
    de: 'Einstellungen: ↑↓ wählt eine Zeile, ←→ oder Enter ändert sie, OK oder Esc schließt.',
  },
  function: {
    en: 'Function app: Symb lists F1…F0 (Enter edits, ✓ plots); Plot traces the curve (←→, ↑↓ switch curve), Zoom, Fcn (root, intersection, slope, extremum, signed area, tangent), Go To, Defn, Views (split screen, PNG); Num tables values (+/− change the step). ⇧Plot/⇧Num: setups.',
    de: 'Funktionen-App: Symb listet F1…F0 (Enter bearbeitet, ✓ zeichnet); Plot verfolgt die Kurve (←→, ↑↓ wechselt), Zoom, Fcn (Nullstelle, Schnittpunkt, Steigung, Extremum, Fläche, Tangente), Gehe zu, Def., Ansicht (geteilt, PNG); Num zeigt Werte (+/− ändern den Schritt). ⇧Plot/⇧Num: Einstellungen.',
  },
  toolbox: {
    en: 'Toolbox: the menu buttons choose Math, CAS, App, User or Catalogue. ↑↓ choose, → or Enter opens, ← goes back, Help explains the selected command. In the catalogue a letter jumps.',
    de: 'Toolbox: Die Menütasten wählen Math, CAS, App, Nutzer oder Katalog. ↑↓ wählt, → oder Enter öffnet, ← geht zurück, Help erklärt den gewählten Befehl. Im Katalog springt ein Buchstabe.',
  },
};
