/**
 * Pure helpers of the program editor (prompt 044): highlighting spans from the language's own
 * tokenizer, automatic indentation, the templates of the menu and find/replace.
 */
import { tokenize } from '@aba/ppl';

export interface Span {
  text: string;
  /** CSS class: kw, id, num, str, op, cmt, bad, or '' for white space */
  cls: string;
}

const CLS: Record<string, string> = {
  keyword: 'kw',
  identifier: 'id',
  number: 'num',
  string: 'str',
  operator: 'op',
  punctuation: 'op',
  comment: 'cmt',
  invalid: 'bad',
};

/** The source as coloured spans (white space between tokens kept as plain text). */
export function highlight(source: string): Span[] {
  const out: Span[] = [];
  let at = 0;
  for (const t of tokenize(source)) {
    if (t.start > at) out.push({ text: source.slice(at, t.start), cls: '' });
    if (t.end > t.start) out.push({ text: source.slice(t.start, t.end), cls: CLS[t.kind] ?? '' });
    at = Math.max(at, t.end);
  }
  if (at < source.length) out.push({ text: source.slice(at), cls: '' });
  return out;
}

const OPENERS = /\b(BEGIN|THEN|ELSE|DO|REPEAT|CASE|DEFAULT)\s*$/i;
const CLOSERS = /^\s*(END|ELSE|UNTIL|DEFAULT)\b/i;

/** Indentation for a new line after `line`: the same, two more after an opening keyword. */
export function indentAfter(line: string): string {
  const base = /^\s*/.exec(line)?.[0] ?? '';
  return OPENERS.test(line.replace(/\/\/.*$/, '')) ? `${base}  ` : base;
}

/** Re-indents a whole program from its block structure (two spaces per level). */
export function reindent(source: string): string {
  let level = 0;
  return source
    .split('\n')
    .map((raw) => {
      const line = raw.trim();
      if (!line) return '';
      if (CLOSERS.test(line)) level = Math.max(0, level - 1);
      const out = '  '.repeat(level) + line;
      const code = line.replace(/\/\/.*$/, '');
      if (OPENERS.test(code) || /^(ELSE|DEFAULT)\b/i.test(line)) level++;
      return out;
    })
    .join('\n');
}

export interface Template {
  label: string;
  /** text with `|` where the cursor goes */
  text: string;
}

export const TEMPLATES: Template[] = [
  { label: 'EXPORT f() BEGIN … END', text: 'EXPORT |()\nBEGIN\n  \nEND;' },
  { label: 'f() BEGIN … END', text: '|()\nBEGIN\n  \nEND;' },
  { label: 'LOCAL', text: 'LOCAL |;' },
  { label: 'IF THEN END', text: 'IF | THEN\n  \nEND;' },
  { label: 'IF THEN ELSE END', text: 'IF | THEN\n  \nELSE\n  \nEND;' },
  { label: 'CASE', text: 'CASE\n  IF | THEN  END;\n  DEFAULT \nEND;' },
  { label: 'FOR FROM TO DO', text: 'FOR | FROM 1 TO 10 DO\n  \nEND;' },
  { label: 'FOR … STEP', text: 'FOR | FROM 1 TO 10 STEP 1 DO\n  \nEND;' },
  { label: 'WHILE DO', text: 'WHILE | DO\n  \nEND;' },
  { label: 'REPEAT UNTIL', text: 'REPEAT\n  \nUNTIL |;' },
  { label: 'RETURN', text: 'RETURN |;' },
  { label: 'PRINT', text: 'PRINT(|);' },
  { label: 'MSGBOX', text: 'MSGBOX(|);' },
  { label: 'INPUT', text: 'INPUT(|);' },
  { label: 'CHOOSE', text: 'CHOOSE(|, "Title", "a", "b");' },
  { label: 'WAIT', text: 'WAIT(|);' },
  { label: 'GETKEY', text: 'GETKEY|' },
  { label: 'RECT_P', text: 'RECT_P(|);' },
  { label: 'LINE_P', text: 'LINE_P(|);' },
  { label: 'PIXON_P', text: 'PIXON_P(|);' },
  { label: 'TEXTOUT_P', text: 'TEXTOUT_P("|", 10, 10);' },
  { label: 'RGB', text: 'RGB(|)' },
  { label: 'BREAK', text: 'BREAK;|' },
  { label: 'CONTINUE', text: 'CONTINUE;|' },
];

/**
 * Inserts a template at `at` with the indentation of that line; returns the new text and the
 * cursor position (where `|` was).
 */
export function insertTemplate(
  source: string,
  at: number,
  t: Template,
): { text: string; cursor: number } {
  const lineStart = source.lastIndexOf('\n', at - 1) + 1;
  const indent = /^\s*/.exec(source.slice(lineStart, at))?.[0] ?? '';
  const body = t.text.replace(/\n/g, `\n${indent}`);
  const mark = body.indexOf('|');
  const clean = body.replace('|', '');
  return {
    text: source.slice(0, at) + clean + source.slice(at),
    cursor: at + (mark < 0 ? clean.length : mark),
  };
}

/** Offset of a 1-based line/column. */
export function offsetOf(source: string, line: number, column: number): number {
  let at = 0;
  for (let l = 1; l < line; l++) {
    const n = source.indexOf('\n', at);
    if (n < 0) return source.length;
    at = n + 1;
  }
  return Math.min(source.length, at + Math.max(0, column - 1));
}

/** 1-based line of an offset. */
export const lineOf = (source: string, at: number) => source.slice(0, at).split('\n').length;

/** Next match of `needle` from `from` (wraps around); case-insensitive. -1 = none. */
export function findNext(source: string, needle: string, from: number): number {
  if (!needle) return -1;
  const s = source.toLowerCase();
  const n = needle.toLowerCase();
  const i = s.indexOf(n, from);
  return i >= 0 ? i : s.indexOf(n);
}

/** Replaces every match (case-insensitive); returns the text and the number of replacements. */
export function replaceAll(
  source: string,
  needle: string,
  by: string,
): { text: string; count: number } {
  if (!needle) return { text: source, count: 0 };
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let count = 0;
  const text = source.replace(re, () => {
    count++;
    return by;
  });
  return { text, count };
}
