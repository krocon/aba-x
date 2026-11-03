/**
 * Names typed letter by letter in MathLive (prompts 029/032): MathLive writes `sumlist(` as the
 * letters s·u·m·l·i·s·t and `L1` as L·1. These helpers turn them into names before parsing.
 */
import { FUNCTIONS } from '@aba/math/functions';

/**
 * Command words typed letter by letter (`solve(` in MathLive is s·o·l·v·e) become
 * `\operatorname{solve}` when a parenthesis follows – names longer than one letter only.
 */
export function markCommands(src: string, names: Iterable<string>): string {
  // MathLive writes an inline shortcut \operatorname{solve} back as \operatorname{\mathrm{solve}}
  src = src.replace(/\\operatorname\{\\mathrm\{([^{}]*)\}\}/g, '\\operatorname{$1}');
  const long = [...names].filter((n) => n.length > 1).sort((a, b) => b.length - a.length);
  if (!long.length) return src;
  const re = new RegExp(`(?<![\\\\a-zA-Z{])(${long.join('|')})(?=\\s*(?:\\(|\\\\left\\())`, 'g');
  return src.replace(re, '\\operatorname{$1}');
}

/** Every catalogue function name and alias (for the home view). */
export function catalogNames(): string[] {
  return FUNCTIONS.flatMap((f) => [f.name, ...(f.aliases ?? [])]);
}

/** List and matrix slots L0–L9, M0–M9 (also MathLive's L_0, L_{0}) become one name. */
export function markSlots(src: string): string {
  return src.replace(
    /(?<![\\a-zA-Z{])([LM])(?:_\{?([0-9])\}?|([0-9]))(?![0-9])/g,
    '\\mathrm{$1$2$3}',
  );
}

/**
 * MathLive inline shortcuts for catalogue words (`sumlist` → one name instead of Σ + list). Names
 * with a LaTeX command of their own (sin, ln, …) keep MathLive's handling.
 */
export function catalogShortcuts(extra: Iterable<string> = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FUNCTIONS) {
    if (f.latex && !f.latex.startsWith('operatorname')) continue;
    for (const n of [f.name, ...(f.aliases ?? [])])
      if (n.length > 1) out[n] = `\\operatorname{${n}}`;
  }
  for (const n of extra) if (n.length > 1) out[n] = `\\operatorname{${n}}`;
  // a few of MathLive's own shortcuts that do not collide with catalogue words
  for (const g of [
    'alpha',
    'beta',
    'gamma',
    'delta',
    'theta',
    'lambda',
    'mu',
    'pi',
    'sigma',
    'phi',
    'omega',
  ]) {
    out[g] = `\\${g}`;
  }
  out['inf'] = '\\infty';
  return out;
}
