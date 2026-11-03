/**
 * Notes of ABA-T1 (prompt 045), pure. A note is plain text with a small Markdown subset: `# `
 * headings, `- ` list items, **bold**, *italic*, `code` and $formulas$ (LaTeX). Rendering produces
 * data for the template – never HTML from user text.
 */
export interface Note {
  id: string;
  title: string;
  text: string;
  updated: number;
}

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'b'; text: string }
  | { kind: 'i'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'math'; text: string };

export interface Block {
  kind: 'h' | 'p' | 'li';
  parts: Inline[];
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\$[^$]+\$)/g;

export function inline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    if (m.index! > last) out.push({ kind: 'text', text: src.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith('**')) out.push({ kind: 'b', text: t.slice(2, -2) });
    else if (t.startsWith('*')) out.push({ kind: 'i', text: t.slice(1, -1) });
    else if (t.startsWith('`')) out.push({ kind: 'code', text: t.slice(1, -1) });
    else out.push({ kind: 'math', text: t.slice(1, -1) });
    last = m.index! + t.length;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}

export function render(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', parts: inline(para.join(' ')) });
    para = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) flush();
    else if (/^#{1,3}\s/.test(line)) {
      flush();
      blocks.push({ kind: 'h', parts: inline(line.replace(/^#{1,3}\s+/, '')) });
    } else if (/^\s*[-*]\s/.test(line)) {
      flush();
      blocks.push({ kind: 'li', parts: inline(line.replace(/^\s*[-*]\s+/, '')) });
    } else para.push(line.trim());
  }
  flush();
  return blocks;
}

/** Title: the first line without Markdown marks (or "Note"). */
export function titleOf(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  return (
    first
      .replace(/^#+\s*|[*`$]/g, '')
      .trim()
      .slice(0, 40) || 'Note'
  );
}

export function newNote(now = Date.now()): Note {
  return {
    id: `n${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: 'Note',
    text: '',
    updated: now,
  };
}
