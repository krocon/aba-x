/**
 * CSV after RFC 4180 (prompt 041): fields with the separator, quotes, line breaks or outer blanks are
 * quoted, quotes doubled; lines end with CRLF. Reading accepts CRLF, LF and CR. Pure.
 */

export type CsvSeparator = ',' | ';' | '\t';

/** The rows of a CSV text (a final line break does not start an empty row). */
export function parseCsv(text: string, separator: CsvSeparator = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else field += c;
      i++;
      continue;
    }
    if (c === '"' && field === '') quoted = true;
    else if (c === separator) endField();
    else if (c === '\r' || c === '\n') {
      endRow();
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else field += c;
    i++;
  }
  if (field !== '' || row.length || quoted) endRow();
  return rows;
}

/** One field, quoted when needed. */
export function csvField(s: string, separator: CsvSeparator = ','): string {
  const needs = s.includes(separator) || /["\r\n]/.test(s) || (s !== s.trim() && s.length > 0);
  return needs ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeCsv(
  rows: readonly (readonly string[])[],
  separator: CsvSeparator = ',',
): string {
  return rows.map((r) => r.map((f) => csvField(f, separator)).join(separator) + '\r\n').join('');
}
