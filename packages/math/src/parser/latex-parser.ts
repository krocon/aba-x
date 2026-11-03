/**
 * LaTeX input – the subset MathLive and the ABA-X1 keypad produce (ADR 0003). Letters are single
 * symbols (`xy` = x·y), names come from `\mathrm{…}`/`\operatorname{…}`. Structures are parsed here
 * and handed to the shared Pratt parser as finished `expr`/`prefix` tokens.
 */
import { call, div, mul, sym } from '../ast/build';
import type { Expr } from '../ast/nodes';
import { lookupFunction, lookupLatexFunction } from '../functions';
import { type MathResult, fail, ok } from '../result';
import { ParseError, type ParseOptions, Pratt, type Tok } from './pratt';

type Raw =
  | { t: 'cmd'; name: string; s: number; e: number }
  | { t: 'char'; c: string; s: number; e: number }
  | { t: 'lb'; s: number; e: number }
  | { t: 'rb'; s: number; e: number };

function scan(src: string): Raw[] {
  const out: Raw[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const m = /^[a-zA-Z]+/.exec(src.slice(i + 1));
      const name = m ? m[0] : (src[i + 1] ?? '');
      out.push({ t: 'cmd', name, s: i, e: i + 1 + name.length });
      i += 1 + Math.max(name.length, 1);
    } else if (c === '{') {
      out.push({ t: 'lb', s: i, e: i + 1 });
      i++;
    } else if (c === '}') {
      out.push({ t: 'rb', s: i, e: i + 1 });
      i++;
    } else if (/\s/.test(c)) {
      i++;
    } else {
      out.push({ t: 'char', c, s: i, e: i + 1 });
      i++;
    }
  }
  return out;
}

const SPACES = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad', 'enspace', 'thinspace']);
const GREEK = new Set(
  'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi rho sigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Sigma Phi Psi Omega'.split(
    ' ',
  ),
);
const OPS: Record<string, string> = {
  cdot: '*',
  times: '*',
  ast: '*',
  div: '/',
  le: '<=',
  leq: '<=',
  ge: '>=',
  geq: '>=',
  ne: '!=',
  neq: '!=',
  lt: '<',
  gt: '>',
  '%': '%',
  vert: '|',
  lvert: '|',
  rvert: '|',
  mid: '|',
};
const INVERSE: Record<string, string> = {
  sin: 'arcsin',
  cos: 'arccos',
  tan: 'arctan',
  sinh: 'arsinh',
  cosh: 'arcosh',
  tanh: 'artanh',
};
const MATRIX_ENVS = new Set(['pmatrix', 'bmatrix', 'Bmatrix', 'matrix', 'vmatrix', 'smallmatrix']);
const DELIMS: Record<string, string> = { '(': ')', '[': ']', '|': '|', '{': '}', '.': '.' };

class LatexLexer {
  constructor(
    private readonly raw: readonly Raw[],
    private readonly src: string,
    private readonly opts: ParseOptions,
  ) {}

  private err(code: 'syntax' | 'unknown-function' | 'unsupported', msg: string, r?: Raw): never {
    const s = r?.s ?? this.src.length;
    throw new ParseError(code, msg, s, r?.e ?? s);
  }

  /** Parses raw[from, to) to one expression. */
  parse(from: number, to: number): Expr {
    return new Pratt(this.tokens(from, to), this.opts).parseAll();
  }

  /** Index after the group starting at i: `{…}` or a single token. Returns [contentFrom, contentTo, next]. */
  private group(i: number, to: number): [number, number, number] {
    const r = this.raw[i];
    if (!r || i >= to) this.err('syntax', 'missing argument', this.raw[i - 1]);
    if (r.t === 'lb') {
      const close = this.matchBrace(i, to);
      return [i + 1, close, close + 1];
    }
    if (r.t === 'rb') this.err('syntax', 'unexpected "}"', r);
    return [i, i + 1, i + 1];
  }

  private matchBrace(i: number, to: number): number {
    let depth = 0;
    for (let j = i; j < to; j++) {
      const r = this.raw[j];
      if (r.t === 'lb') depth++;
      else if (r.t === 'rb' && --depth === 0) return j;
    }
    return this.err('syntax', 'missing "}"', this.raw[i]);
  }

  /** Plain letters of raw[from, to) (for \mathrm{…}), or null when the group holds more than text. */
  private text(from: number, to: number): string | null {
    let s = '';
    for (let j = from; j < to; j++) {
      const r = this.raw[j];
      // \_ in a name: units like \mathrm{\_km} (prompt 031)
      if (r.t === 'cmd' && r.name === '_') {
        s += '_';
        continue;
      }
      if (r.t !== 'char' || !/[\p{L}\p{N}]/u.test(r.c)) return null;
      s += r.c;
    }
    return s;
  }

  /** Is raw[i] the start of a differential `d x`, `\mathrm{d}x` or `\differentialD x`? Returns [variable, next]. */
  private differential(i: number, to: number): [string, number] | null {
    const r = this.raw[i];
    let j = -1;
    if (r?.t === 'char' && r.c === 'd') j = i + 1;
    else if (r?.t === 'cmd' && (r.name === 'differentialD' || r.name === 'partial')) j = i + 1;
    else if (r?.t === 'cmd' && (r.name === 'mathrm' || r.name === 'operatorname')) {
      const [a, b, n] = this.group(i + 1, to);
      if (this.text(a, b) === 'd') j = n;
    }
    if (j < 0) return null;
    const v = this.raw[j];
    if (j < to && v?.t === 'char' && /\p{L}/u.test(v.c)) return [v.c, j + 1];
    return null;
  }

  /** Reads optional `_{…}` and `^{…}` (any order) at i. */
  private limits(
    i: number,
    to: number,
  ): { sub?: [number, number]; sup?: [number, number]; next: number } {
    const out: { sub?: [number, number]; sup?: [number, number]; next: number } = { next: i };
    for (let k = 0; k < 2; k++) {
      const r = this.raw[out.next];
      if (out.next >= to || r?.t !== 'char' || (r.c !== '_' && r.c !== '^')) break;
      const [a, b, n] = this.group(out.next + 1, to);
      if (r.c === '_') out.sub = [a, b];
      else out.sup = [a, b];
      out.next = n;
    }
    return out;
  }

  tokens(from: number, to: number): Tok[] {
    const toks: Tok[] = [];
    let i = from;
    const push = (t: Tok) => toks.push(t);
    while (i < to) {
      const r = this.raw[i];
      if (r.t === 'lb') {
        const close = this.matchBrace(i, to);
        push({ k: 'expr', x: this.parse(i + 1, close), s: r.s, e: this.raw[close].e });
        i = close + 1;
        continue;
      }
      if (r.t === 'rb') this.err('syntax', 'unexpected "}"', r);
      if (r.t === 'char') {
        i = this.char(r, i, to, push);
        continue;
      }
      i = this.command(r as Extract<Raw, { t: 'cmd' }>, i, to, push);
    }
    const end = to < this.raw.length ? this.raw[to].s : this.src.length;
    push({ k: 'eof', s: end, e: end });
    return toks;
  }

  private char(
    r: Extract<Raw, { t: 'char' }>,
    i: number,
    to: number,
    push: (t: Tok) => void,
  ): number {
    const c = r.c;
    if (/[0-9.]/.test(c)) {
      let j = i;
      let v = '';
      while (j < to) {
        const x = this.raw[j];
        if (x.t !== 'char' || !/[0-9.]/.test(x.c)) break;
        v += x.c;
        j++;
      }
      if (!/^(\d+\.?\d*|\.\d+)$/.test(v)) this.err('syntax', `invalid number "${v}"`, r);
      push({ k: 'num', v, s: r.s, e: this.raw[j - 1].e });
      return j;
    }
    if (c === '^') {
      const [a, b, n] = this.group(i + 1, to);
      const only = this.raw[a];
      if (b === a + 1 && only.t === 'cmd' && only.name === 'circ') {
        // degrees: x° = x·π/180
        push({ k: 'op', v: '*', s: r.s, e: this.raw[n - 1].e });
        push({ k: 'expr', x: div(sym('pi'), { type: 'num', value: '180' }), s: r.s, e: r.e });
        return n;
      }
      push({ k: 'op', v: '^', s: r.s, e: r.e });
      push({ k: 'expr', x: this.parse(a, b), s: this.raw[a]?.s ?? r.s, e: this.raw[n - 1].e });
      return n;
    }
    if (c === '_') this.err('syntax', 'unexpected subscript', r);
    if (c === '&') this.err('syntax', 'unexpected "&" outside a matrix', r);
    if (/\p{L}/u.test(c)) {
      // x_1, x_{12} → one name
      const after = this.raw[i + 1];
      if (after?.t === 'char' && after.c === '_' && i + 1 < to) {
        const [a, b, n] = this.group(i + 2, to);
        const idx = this.text(a, b);
        if (idx === null) this.err('syntax', 'subscripts must be letters or digits', after);
        push({ k: 'id', v: `${c}_${idx}`, s: r.s, e: this.raw[n - 1].e });
        return n;
      }
      push({ k: 'id', v: c, s: r.s, e: r.e });
      return i + 1;
    }
    const map: Record<string, string> = { '−': '-', '·': '*', '×': '*', '÷': '/', '*': '*' };
    const v = map[c] ?? c;
    if ('+-*/=<>!,()[]|%'.includes(v)) {
      push({ k: 'op', v, s: r.s, e: r.e });
      return i + 1;
    }
    return this.err('syntax', `unexpected "${c}"`, r);
  }

  private command(
    r: Extract<Raw, { t: 'cmd' }>,
    i: number,
    to: number,
    push: (t: Tok) => void,
  ): number {
    const n = r.name;
    if (SPACES.has(n)) return i + 1;
    if (OPS[n]) {
      push({ k: 'op', v: OPS[n], s: r.s, e: r.e });
      return i + 1;
    }
    if (n === 'pi' || n === 'infty' || n === 'exponentialE' || n === 'imaginaryI') {
      const v = { pi: 'pi', infty: 'inf', exponentialE: 'e', imaginaryI: 'i' }[n];
      push({ k: 'id', v, s: r.s, e: r.e });
      return i + 1;
    }
    if (GREEK.has(n)) {
      push({ k: 'id', v: n, s: r.s, e: r.e });
      return i + 1;
    }
    if (n === 'placeholder') this.err('syntax', 'empty placeholder – fill in all boxes', r);
    if (n === 'frac' || n === 'dfrac' || n === 'tfrac' || n === 'cfrac')
      return this.frac(r, i, to, push);
    if (n === 'sqrt') return this.sqrt(r, i, to, push);
    if (n === 'left') return this.leftRight(r, i, to, push);
    if (n === 'right') this.err('syntax', '\\right without \\left', r);
    if (n === 'int') return this.integral(r, i, to, push);
    if (n === 'sum' || n === 'prod') return this.series(r, i, to, push);
    if (n === 'lim') return this.limit(r, i, to, push);
    if (n === 'begin') return this.matrix(r, i, to, push);
    if (n === '{' || n === 'lbrace') this.err('unsupported', 'sets are not supported', r);
    if (n === '#') return this.based(r, i, to, push);
    if (
      n === 'mathrm' ||
      n === 'operatorname' ||
      n === 'text' ||
      n === 'mathit' ||
      n === 'mathbf'
    ) {
      const [a, b, next] = this.group(i + 1, to);
      const name = this.text(a, b);
      if (name === null) {
        push({ k: 'expr', x: this.parse(a, b), s: r.s, e: this.raw[next - 1].e });
        return next;
      }
      const fn = lookupFunction(name);
      if (fn) return this.fnToken(fn.name, r, next, to, push);
      push({ k: 'id', v: name, s: r.s, e: this.raw[next - 1].e });
      return next;
    }
    const fn = lookupLatexFunction(n);
    if (fn) return this.fnToken(fn.name, r, i + 1, to, push);
    return this.err('unknown-function', `unknown command \\${n}`, r);
  }

  /** `\#FFh` or `\#\mathrm{FFh}`: a based integer (prompt 031), kept as written. */
  private based(r: Raw, i: number, to: number, push: (t: Tok) => void): number {
    let j = i + 1;
    let digits = '';
    const next = this.raw[j];
    if (next?.t === 'cmd' && (next.name === 'mathrm' || next.name === 'operatorname')) {
      const [a, b, after] = this.group(j + 1, to);
      digits = this.text(a, b) ?? '';
      j = after;
    } else {
      while (j < to) {
        const x = this.raw[j];
        if (x.t !== 'char' || !/[0-9A-Za-z]/.test(x.c)) break;
        digits += x.c;
        j++;
      }
    }
    if (!digits) this.err('syntax', 'a based integer needs digits after #', r);
    push({ k: 'num', v: `#${digits}`, s: r.s, e: this.raw[j - 1].e });
    return j;
  }

  /** Function command with optional `^{-1}`, `^2` and (for log) `_{b}`. */
  private fnToken(name: string, r: Raw, i: number, to: number, push: (t: Tok) => void): number {
    const lim = this.limits(i, to);
    let fname = name;
    let pow: Expr | undefined;
    let extra: Expr | undefined;
    if (lim.sup) {
      const p = this.parse(lim.sup[0], lim.sup[1]);
      const isMinusOne = p.type === 'neg' && p.arg.type === 'num' && p.arg.value === '1';
      if (isMinusOne && INVERSE[name]) fname = INVERSE[name];
      else pow = p;
    }
    if (lim.sub) {
      if (name !== 'log') this.err('syntax', `${name} takes no subscript`, r);
      extra = this.parse(lim.sub[0], lim.sub[1]);
    }
    push({ k: 'fn', v: fname, pow, extra, s: r.s, e: this.raw[lim.next - 1]?.e ?? r.e });
    return lim.next;
  }

  private frac(r: Raw, i: number, to: number, push: (t: Tok) => void): number {
    const [a1, b1, n1] = this.group(i + 1, to);
    const [a2, b2, n2] = this.group(n1, to);
    const order = this.derivativeOrder(a1, b1);
    if (order !== null) {
      const d = this.differential(a2, b2);
      const v = d && this.derivativeDenominator(d, b2, order);
      if (v) {
        push({
          k: 'prefix',
          make: (expr) => ({ type: 'deriv', expr, variable: v, order }),
          s: r.s,
          e: this.raw[n2 - 1].e,
        });
        return n2;
      }
    }
    push({
      k: 'expr',
      x: div(this.parse(a1, b1), this.parse(a2, b2)),
      s: r.s,
      e: this.raw[n2 - 1].e,
    });
    return n2;
  }

  /** Numerator `d`, `\mathrm{d}` or `d^n` → n, otherwise null. */
  private derivativeOrder(a: number, b: number): number | null {
    const d = this.differentialSymbol(a, b);
    if (d === null) return null;
    if (d === b) return 1;
    const caret = this.raw[d];
    if (caret.t === 'char' && caret.c === '^') {
      const [x, y, next] = this.group(d + 1, b);
      const n = Number(this.text(x, y));
      if (next === b && Number.isInteger(n) && n >= 1) return n;
    }
    return null;
  }

  /** Index after a lone `d` / `\mathrm{d}` / `\differentialD` at a, or null. */
  private differentialSymbol(a: number, b: number): number | null {
    const r = this.raw[a];
    if (a >= b) return null;
    if (
      (r.t === 'char' && r.c === 'd') ||
      (r.t === 'cmd' && (r.name === 'differentialD' || r.name === 'partial'))
    )
      return a + 1;
    if (r.t === 'cmd' && (r.name === 'mathrm' || r.name === 'operatorname')) {
      const [x, y, next] = this.group(a + 1, b);
      if (this.text(x, y) === 'd') return next;
    }
    return null;
  }

  /** Denominator `dx` or `dx^n` (n = order) → variable. */
  private derivativeDenominator(
    [v, next]: [string, number],
    end: number,
    order: number,
  ): string | null {
    if (next === end) return order === 1 ? v : null;
    const caret = this.raw[next];
    if (caret.t === 'char' && caret.c === '^') {
      const [x, y, after] = this.group(next + 1, end);
      if (after === end && Number(this.text(x, y)) === order) return v;
    }
    return null;
  }

  private sqrt(r: Raw, i: number, to: number, push: (t: Tok) => void): number {
    let j = i + 1;
    let index: Expr | undefined;
    const open = this.raw[j];
    if (open?.t === 'char' && open.c === '[') {
      let k = j + 1;
      let depth = 0;
      for (; k < to; k++) {
        const x = this.raw[k];
        if (x.t === 'lb') depth++;
        else if (x.t === 'rb') depth--;
        else if (depth === 0 && x.t === 'char' && x.c === ']') break;
      }
      if (k >= to) this.err('syntax', 'missing "]"', open);
      index = this.parse(j + 1, k);
      j = k + 1;
    }
    const [a, b, n] = this.group(j, to);
    const radicand = this.parse(a, b);
    push({
      k: 'expr',
      x: index ? call('root', radicand, index) : call('sqrt', radicand),
      s: r.s,
      e: this.raw[n - 1].e,
    });
    return n;
  }

  private leftRight(r: Raw, i: number, to: number, push: (t: Tok) => void): number {
    const open = this.delimiter(i + 1);
    let depth = 0;
    for (let j = i; j < to; j++) {
      const x = this.raw[j];
      if (x.t !== 'cmd') continue;
      if (x.name === 'left') depth++;
      if (x.name === 'right' && --depth === 0) {
        const close = this.delimiter(j + 1);
        if ((open === '[' && close === ']') || (open === '(' && close === ')')) {
          // hand the brackets to the Pratt parser: \left[1,2\right] is a list, \left(a,b\right)
          // an argument list after a function
          push({ k: 'op', v: open, s: r.s, e: r.e });
          for (const t of this.tokens(i + 2, j).slice(0, -1)) push(t);
          push({ k: 'op', v: close, s: x.s, e: this.raw[j + 1].e });
          return j + 2;
        }
        const inner = this.parse(i + 2, j);
        const x2 = open === '|' && close === '|' ? call('abs', inner) : inner;
        if (open === '{') this.err('unsupported', 'sets are not supported', r);
        push({ k: 'expr', x: x2, s: r.s, e: this.raw[j + 1].e });
        return j + 2;
      }
    }
    return this.err('syntax', '\\left without \\right', r);
  }

  private delimiter(i: number): string {
    const d = this.raw[i];
    if (d?.t === 'char' && DELIMS[d.c] !== undefined) return d.c;
    if (d?.t === 'char' && (d.c === ')' || d.c === ']')) return d.c;
    if (d?.t === 'cmd' && (d.name === 'vert' || d.name === 'lvert' || d.name === 'rvert'))
      return '|';
    if (d?.t === 'cmd' && (d.name === '{' || d.name === '}' || d.name === 'lbrace')) return '{';
    return this.err('syntax', 'unknown delimiter', d);
  }

  private integral(r: Raw, i: number, to: number, push: (t: Tok) => void): number {
    const lim = this.limits(i + 1, to);
    if (!!lim.sub !== !!lim.sup) this.err('syntax', 'a definite integral needs both bounds', r);
    let depth = 0;
    for (let j = lim.next; j < to; j++) {
      const x = this.raw[j];
      if (x.t === 'lb') depth++;
      else if (x.t === 'rb') depth--;
      if (depth !== 0) continue;
      const d = this.differential(j, to);
      if (!d) continue;
      if (j === lim.next) this.err('syntax', 'the integral is empty', r);
      const body = this.parse(lim.next, j);
      const node: Expr = lim.sub
        ? {
            type: 'int',
            expr: body,
            variable: d[0],
            lower: this.parse(lim.sub[0], lim.sub[1]),
            upper: this.parse(lim.sup![0], lim.sup![1]),
          }
        : { type: 'int', expr: body, variable: d[0] };
      push({ k: 'expr', x: node, s: r.s, e: this.raw[d[1] - 1].e });
      return d[1];
    }
    return this.err('syntax', 'the integral needs a differential like dx', r);
  }

  private series(
    r: Extract<Raw, { t: 'cmd' }>,
    i: number,
    to: number,
    push: (t: Tok) => void,
  ): number {
    const lim = this.limits(i + 1, to);
    if (!lim.sub || !lim.sup) this.err('syntax', `\\${r.name} needs k=a below and b above`, r);
    const start = this.parse(lim.sub[0], lim.sub[1]);
    if (start.type !== 'rel' || start.op !== '=' || start.left.type !== 'sym') {
      this.err('syntax', `\\${r.name}: write the index as k=1`, r);
    }
    const variable = (start.left as { name: string }).name;
    const lower = start.right;
    const upper = this.parse(lim.sup[0], lim.sup[1]);
    const kind = r.name === 'sum' ? 'sum' : 'prod';
    push({
      k: 'prefix',
      make: (expr) => ({ type: 'series', kind, expr, variable, lower, upper }),
      s: r.s,
      e: this.raw[lim.next - 1].e,
    });
    return lim.next;
  }

  private limit(r: Raw, i: number, to: number, push: (t: Tok) => void): number {
    const lim = this.limits(i + 1, to);
    if (!lim.sub) this.err('syntax', '\\lim needs x\\to a below', r);
    const [a, b] = lim.sub;
    const arrow = this.raw
      .slice(a, b)
      .findIndex((x) => x.t === 'cmd' && ['to', 'rightarrow', 'longrightarrow'].includes(x.name));
    if (arrow < 1) this.err('syntax', '\\lim: write the subscript as x\\to a', r);
    const v = this.text(a, a + arrow);
    if (!v || v.length !== 1) this.err('syntax', '\\lim: the variable must be one letter', r);
    let toEnd = b;
    let direction: '+' | '-' | undefined;
    const last = this.raw[b - 1];
    const prev = this.raw[b - 2];
    if (
      prev?.t === 'char' &&
      prev.c === '^' &&
      last.t === 'char' &&
      (last.c === '+' || last.c === '-')
    ) {
      direction = last.c;
      toEnd = b - 2;
    }
    const target = this.parse(a + arrow + 1, toEnd);
    push({
      k: 'prefix',
      make: (expr) => ({
        type: 'limit',
        expr,
        variable: v,
        to: target,
        ...(direction ? { direction } : {}),
      }),
      s: r.s,
      e: this.raw[lim.next - 1].e,
    });
    return lim.next;
  }

  private matrix(r: Raw, i: number, to: number, push: (t: Tok) => void): number {
    const [a, b, next] = this.group(i + 1, to);
    const env = this.text(a, b);
    if (!env || !MATRIX_ENVS.has(env))
      this.err('unsupported', `environment ${env} is not supported`, r);
    let depth = 0;
    let cellStart = next;
    const rows: Expr[][] = [[]];
    for (let j = next; j < to; j++) {
      const x = this.raw[j];
      if (x.t === 'lb') depth++;
      else if (x.t === 'rb') depth--;
      if (depth !== 0) continue;
      if (x.t === 'cmd' && x.name === 'end') {
        const [ea, eb, after] = this.group(j + 1, to);
        if (this.text(ea, eb) !== env) this.err('syntax', `\\end does not match ${env}`, x);
        if (j > cellStart) rows[rows.length - 1].push(this.parse(cellStart, j));
        const clean = rows.filter((row) => row.length > 0);
        if (clean.length === 0 || clean.some((row) => row.length !== clean[0].length)) {
          this.err('syntax', 'all matrix rows need the same number of entries', r);
        }
        push({ k: 'expr', x: { type: 'matrix', rows: clean }, s: r.s, e: this.raw[after - 1].e });
        return after;
      }
      const amp = x.t === 'char' && x.c === '&';
      const row = x.t === 'cmd' && x.name === '\\';
      if (amp || row) {
        rows[rows.length - 1].push(this.parse(cellStart, j));
        if (row) rows.push([]);
        cellStart = j + 1;
      }
    }
    return this.err('syntax', `missing \\end{${env}}`, r);
  }
}

/** The token stream of a whole LaTeX input (for statement detection). Throws ParseError. */
/**
 * MathLive writes a name inserted as `\operatorname{gcd}` back as `\operatorname{\mathrm{gcd}}`
 * (prompt 030) – the same name. Positions in error messages refer to the normalised input.
 */
export function normalizeLatex(src: string): string {
  return (
    src
      .replace(/\\operatorname\{\\mathrm\{([^{}]*)\}\}/g, '\\operatorname{$1}')
      // a unit typed after a number (MathLive makes "5_m" a subscript): 5_{km} → 5\mathrm{\_km}
      .replace(/(\d)_\{?([A-Za-zµΩ]+)\}?/g, '$1\\mathrm{\\_$2}')
  );
}

export function scanLatexTokens(src: string, opts: ParseOptions = {}): Tok[] {
  src = normalizeLatex(src);
  const raw = scan(src);
  return new LatexLexer(raw, src, opts).tokens(0, raw.length);
}

export function parseLatex(src: string, opts: ParseOptions = {}): MathResult<Expr> {
  src = normalizeLatex(src);
  try {
    const raw = scan(src);
    return ok(new LatexLexer(raw, src, opts).parse(0, raw.length));
  } catch (e) {
    if (e instanceof ParseError) return fail(e.code, e.message, { start: e.start, end: e.end });
    throw e;
  }
}

/** Implicit product of two expressions – exported for tests of the degree rule. */
export const product = (a: Expr, b: Expr): Expr => mul(a, b);
