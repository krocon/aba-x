/**
 * Lexer of the programming language. `tokenize` also serves syntax highlighting: it never fails,
 * keeps comments and marks what it cannot read as `invalid` (with a message), so an editor can
 * colour half-typed programs. Keywords are case-insensitive; `value` holds them in upper case.
 */

export type TokenKind =
  | 'keyword'
  | 'identifier'
  | 'number'
  | 'string'
  | 'operator'
  | 'comment'
  | 'punctuation'
  | 'invalid';

export interface Token {
  readonly kind: TokenKind;
  /** the source text of the token */
  readonly text: string;
  /** keyword in upper case, string without quotes and with escapes resolved, operator normalised */
  readonly value: string;
  /** offset of the first character */
  readonly start: number;
  /** offset after the last character */
  readonly end: number;
  /** 1-based */
  readonly line: number;
  /** 1-based */
  readonly column: number;
  /** why an `invalid` token is invalid */
  readonly message?: string;
}

export const KEYWORDS: ReadonlySet<string> = new Set([
  'BEGIN',
  'END',
  'EXPORT',
  'LOCAL',
  'RETURN',
  'IF',
  'THEN',
  'ELSE',
  'CASE',
  'DEFAULT',
  'FOR',
  'FROM',
  'TO',
  'DOWNTO',
  'STEP',
  'DO',
  'WHILE',
  'REPEAT',
  'UNTIL',
  'BREAK',
  'CONTINUE',
  'AND',
  'OR',
  'NOT',
  'XOR',
  'MOD',
]);

/** Operators, longest first; the value is the canonical spelling. */
const OPERATORS: readonly (readonly [string, string])[] = [
  [':=', ':='],
  ['==', '=='],
  ['<>', '≠'],
  ['<=', '≤'],
  ['>=', '≥'],
  ['≠', '≠'],
  ['≤', '≤'],
  ['≥', '≥'],
  ['=', '=='],
  ['<', '<'],
  ['>', '>'],
  ['+', '+'],
  ['-', '-'],
  ['−', '-'],
  ['*', '*'],
  ['×', '*'],
  ['/', '/'],
  ['÷', '/'],
  ['^', '^'],
  ['!', '!'],
];

const PUNCTUATION = '(){}[],;';

const isDigit = (c: string) => c >= '0' && c <= '9';
const IDENT_START = /[\p{L}_]/u;
const IDENT_PART = /[\p{L}\p{N}_]/u;

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', '"': '"', '\\': '\\' };

/** All tokens of `source` incl. comments; whitespace is skipped. Never throws. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let lineStart = 0;
  const push = (kind: TokenKind, start: number, value: string, message?: string) => {
    const t: Token = {
      kind,
      text: source.slice(start, pos),
      value,
      start,
      end: pos,
      line,
      column: start - lineStart + 1,
    };
    tokens.push(message ? { ...t, message } : t);
  };
  while (pos < source.length) {
    const c = source[pos];
    if (c === '\n') {
      pos++;
      line++;
      lineStart = pos;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === ' ') {
      pos++;
      continue;
    }
    const start = pos;
    if (c === '/' && source[pos + 1] === '/') {
      while (pos < source.length && source[pos] !== '\n') pos++;
      push('comment', start, source.slice(start + 2, pos));
      continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(source[pos + 1] ?? ''))) {
      while (isDigit(source[pos] ?? '')) pos++;
      if (source[pos] === '.') {
        pos++;
        while (isDigit(source[pos] ?? '')) pos++;
      }
      const e = source[pos];
      if (e === 'e' || e === 'E' || e === 'ᴇ') {
        let p = pos + 1;
        if (source[p] === '+' || source[p] === '-' || source[p] === '−') p++;
        if (isDigit(source[p] ?? '')) {
          pos = p;
          while (isDigit(source[pos] ?? '')) pos++;
        }
      }
      push('number', start, source.slice(start, pos).replace(/[ᴇ]/, 'e').replace('−', '-'));
      continue;
    }
    if (c === '"') {
      pos++;
      let value = '';
      let closed = false;
      let bad: string | undefined;
      while (pos < source.length && source[pos] !== '\n') {
        const d = source[pos];
        if (d === '"') {
          pos++;
          closed = true;
          break;
        }
        if (d === '\\') {
          const n = source[pos + 1] ?? '';
          const r = ESCAPES[n];
          if (r === undefined) bad ??= `unknown escape \\${n} in string`;
          value += r ?? n;
          pos += 2;
          continue;
        }
        value += d;
        pos++;
      }
      if (!closed) push('invalid', start, value, 'unterminated string');
      else if (bad) push('invalid', start, value, bad);
      else push('string', start, value);
      continue;
    }
    if (IDENT_START.test(c)) {
      pos++;
      while (pos < source.length && IDENT_PART.test(source[pos])) pos++;
      const text = source.slice(start, pos);
      const upper = text.toUpperCase();
      if (KEYWORDS.has(upper)) push('keyword', start, upper);
      else push('identifier', start, text);
      continue;
    }
    if (PUNCTUATION.includes(c)) {
      pos++;
      push('punctuation', start, c);
      continue;
    }
    const op = OPERATORS.find(([o]) => source.startsWith(o, pos));
    if (op) {
      pos += op[0].length;
      push('operator', start, op[1]);
      continue;
    }
    pos++;
    const message =
      c === '#' ? '#-directives (like #cas) are not supported' : `unexpected character ${c}`;
    push('invalid', start, c, message);
  }
  return tokens;
}
